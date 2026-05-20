import { useEffect, useRef, useState } from "react";
import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";
import type { SelfViewBackgroundEffect } from "../types/layout";

type UseBackgroundEffectStreamInput = {
  sourceStream: MediaStream | null;
  effect: SelfViewBackgroundEffect;
};

type BackgroundEffectStatus =
  | "off"
  | "loading"
  | "active"
  | "unsupported"
  | "error";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

const WIDTH = 640;
const HEIGHT = 360;
const FPS = 24;

function hasVideoTrack(stream: MediaStream | null) {
  return Boolean(
    stream?.getVideoTracks().some((track) => track.readyState === "live"),
  );
}

export function useBackgroundEffectStream({
  sourceStream,
  effect,
}: UseBackgroundEffectStreamInput) {
  const [processedStream, setProcessedStream] = useState<MediaStream | null>(
    null,
  );
  const [status, setStatus] = useState<BackgroundEffectStatus>("off");
  const [error, setError] = useState<string | null>(null);

  const objectRefs = useRef<{
    video?: HTMLVideoElement;
    canvas?: HTMLCanvasElement;
    animationFrameId?: number;
    segmenter?: ImageSegmenter;
    outputStream?: MediaStream;
  }>({});

  useEffect(() => {
    let cancelled = false;

    async function stopCurrent() {
      const refs = objectRefs.current;

      if (refs.animationFrameId !== undefined) {
        window.cancelAnimationFrame(refs.animationFrameId);
      }

      refs.outputStream?.getTracks().forEach((track) => {
        track.stop();
      });

      refs.video?.pause();

      if (refs.video) {
        refs.video.srcObject = null;
      }

      refs.segmenter?.close();

      objectRefs.current = {};
      setProcessedStream(null);
    }

    async function startProcessing() {
      await stopCurrent();

      if (effect === "none") {
        setStatus("off");
        setError(null);
        return;
      }

      if (!sourceStream || !hasVideoTrack(sourceStream)) {
        setStatus("unsupported");
        setError("Camera stream is not available.");
        return;
      }

      if (typeof HTMLCanvasElement === "undefined") {
        setStatus("unsupported");
        setError("Background effects are not supported in this browser.");
        return;
      }

      try {
        setStatus("loading");
        setError(null);

        const filesetResolver = await FilesetResolver.forVisionTasks(WASM_URL);

        if (cancelled) return;

        const segmenter = await ImageSegmenter.createFromOptions(
          filesetResolver,
          {
            baseOptions: {
              modelAssetPath: MODEL_URL,
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            outputCategoryMask: true,
          },
        );

        if (cancelled) {
          segmenter.close();
          return;
        }

        const video = document.createElement("video");
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;
        video.srcObject = sourceStream;

        await video.play().catch(() => undefined);

        const canvas = document.createElement("canvas");
        canvas.width = WIDTH;
        canvas.height = HEIGHT;

        const ctx = canvas.getContext("2d", {
          willReadFrequently: true,
        });

        if (!ctx) {
          segmenter.close();
          setStatus("error");
          setError("Canvas processing is not available.");
          return;
        }

        const outputStream = canvas.captureStream(FPS);
        const [originalAudioTrack] = sourceStream.getAudioTracks();

        if (originalAudioTrack) {
          outputStream.addTrack(originalAudioTrack);
        }

        objectRefs.current = {
          video,
          canvas,
          segmenter,
          outputStream,
        };

        setProcessedStream(outputStream);
        setStatus("active");

        const drawFrame = () => {
          if (cancelled) return;

          if (video.readyState < 2) {
            objectRefs.current.animationFrameId =
              window.requestAnimationFrame(drawFrame);
            return;
          }

          try {
            ctx.drawImage(video, 0, 0, WIDTH, HEIGHT);

            const timestampMs = performance.now();
            const result = segmenter.segmentForVideo(video, timestampMs);
            const mask = result.categoryMask;

            if (!mask) {
              objectRefs.current.animationFrameId =
                window.requestAnimationFrame(drawFrame);
              return;
            }

            const originalFrame = ctx.getImageData(0, 0, WIDTH, HEIGHT);
            const outputFrame = ctx.createImageData(WIDTH, HEIGHT);
            const maskData = mask.getAsFloat32Array();

            if (effect === "blur") {
              const blurredCanvas = document.createElement("canvas");
              blurredCanvas.width = WIDTH;
              blurredCanvas.height = HEIGHT;

              const blurredCtx = blurredCanvas.getContext("2d");

              if (blurredCtx) {
                blurredCtx.filter = "blur(14px)";
                blurredCtx.drawImage(video, 0, 0, WIDTH, HEIGHT);
                blurredCtx.filter = "none";

                const blurredFrame = blurredCtx.getImageData(
                  0,
                  0,
                  WIDTH,
                  HEIGHT,
                );

                for (let index = 0; index < maskData.length; index += 1) {
                  const pixelIndex = index * 4;
                  const personConfidence = maskData[index];

                  const usePerson = personConfidence > 0.45;

                  outputFrame.data[pixelIndex] = usePerson
                    ? originalFrame.data[pixelIndex]
                    : blurredFrame.data[pixelIndex];
                  outputFrame.data[pixelIndex + 1] = usePerson
                    ? originalFrame.data[pixelIndex + 1]
                    : blurredFrame.data[pixelIndex + 1];
                  outputFrame.data[pixelIndex + 2] = usePerson
                    ? originalFrame.data[pixelIndex + 2]
                    : blurredFrame.data[pixelIndex + 2];
                  outputFrame.data[pixelIndex + 3] = 255;
                }

                ctx.putImageData(outputFrame, 0, 0);
              }
            }

            if (effect === "remove") {
              for (let index = 0; index < maskData.length; index += 1) {
                const pixelIndex = index * 4;
                const personConfidence = maskData[index];
                const usePerson = personConfidence > 0.45;

                if (usePerson) {
                  outputFrame.data[pixelIndex] = originalFrame.data[pixelIndex];
                  outputFrame.data[pixelIndex + 1] =
                    originalFrame.data[pixelIndex + 1];
                  outputFrame.data[pixelIndex + 2] =
                    originalFrame.data[pixelIndex + 2];
                  outputFrame.data[pixelIndex + 3] = 255;
                } else {
                  outputFrame.data[pixelIndex] = 2;
                  outputFrame.data[pixelIndex + 1] = 6;
                  outputFrame.data[pixelIndex + 2] = 23;
                  outputFrame.data[pixelIndex + 3] = 255;
                }
              }

              ctx.putImageData(outputFrame, 0, 0);
            }
          } catch (processingError) {
            console.warn("Background effect frame failed:", processingError);
          }

          objectRefs.current.animationFrameId =
            window.requestAnimationFrame(drawFrame);
        };

        drawFrame();
      } catch (processingError) {
        console.error("Background effect failed:", processingError);
        setStatus("error");
        setError("Unable to start background effect.");
      }
    }

    void startProcessing();

    return () => {
      cancelled = true;
      void stopCurrent();
    };
  }, [effect, sourceStream]);

  return {
    processedStream,
    status,
    error,
    isActive: status === "active" && Boolean(processedStream),
  };
}
