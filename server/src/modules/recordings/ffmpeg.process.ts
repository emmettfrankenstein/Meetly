import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { env } from "../../config/env";

export type FfmpegProcess = {
  process: ChildProcessWithoutNullStreams;
  stop: () => Promise<void>;
};

export function getFfmpegPath() {
  // return process.env.FFMPEG_PATH || "ffmpeg";
  return env.FFMPEG_PATH;
}

export function checkFfmpegAvailable() {
  return new Promise<boolean>((resolve) => {
    const ffmpeg = spawn(getFfmpegPath(), ["-version"]);

    ffmpeg.on("error", () => {
      resolve(false);
    });

    ffmpeg.on("close", (code) => {
      resolve(code === 0);
    });
  });
}

export function spawnFfmpeg(args: string[]) {
  const ffmpeg = spawn(getFfmpegPath(), args, {
    stdio: ["pipe", "pipe", "pipe"],
  });

  ffmpeg.stdout.on("data", (data: Buffer) => {
    if (env.NODE_ENV !== "production") {
      console.log(`FFmpeg stdout: ${data.toString()}`);
    }
  });

  ffmpeg.stderr.on("data", (data: Buffer) => {
    if (env.NODE_ENV !== "production") {
      console.log(`FFmpeg stderr: ${data.toString()}`);
    }
  });

  ffmpeg.on("error", (error) => {
    console.error("FFmpeg process error:", error);
  });

  return ffmpeg;
}

export function stopFfmpegProcess(
  ffmpeg: ChildProcessWithoutNullStreams,
  timeoutMs = 5000,
) {
  return new Promise<void>((resolve) => {
    if (ffmpeg.killed) {
      resolve();
      return;
    }

    const timeoutId = setTimeout(() => {
      if (!ffmpeg.killed) {
        ffmpeg.kill("SIGKILL");
      }

      resolve();
    }, timeoutMs);

    ffmpeg.once("close", () => {
      clearTimeout(timeoutId);
      resolve();
    });

    ffmpeg.kill("SIGINT");
  });
}

export function spawnFfmpegForSdpRecording(input: {
  sdpPath: string;
  outputPath: string;
  onOutput?: (line: string) => void;
}) {
  const args = [
    "-protocol_whitelist",
    "file,udp,rtp",
    "-fflags",
    "+genpts",
    "-analyzeduration",
    "1000000",
    "-probesize",
    "1000000",
    "-i",
    input.sdpPath,
    "-map",
    "0",
    "-c:v",
    "copy",
    "-c:a",
    "copy",
    "-f",
    "webm",
    input.outputPath,
  ];

  console.log("Starting FFmpeg recording:", {
    ffmpegPath: getFfmpegPath(),
    args,
  });

  //   return spawnFfmpeg(args);
  const ffmpeg = spawn(getFfmpegPath(), args, {
    stdio: ["pipe", "pipe", "pipe"],
  });

  ffmpeg.stdout.on("data", (data: Buffer) => {
    const line = data.toString();
    input.onOutput?.(line);
    if (env.NODE_ENV !== "production") {
      console.log(`FFmpeg stdout: ${line}`);
    }
  });

  ffmpeg.stderr.on("data", (data: Buffer) => {
    const line = data.toString();
    input.onOutput?.(line);
    if (env.NODE_ENV !== "production") {
      console.log(`FFmpeg stderr: ${line}`);
    }
  });

  ffmpeg.on("error", (error) => {
    const line = error.message;
    input.onOutput?.(line);
    console.error("FFmpeg process error:", error);
  });

  return ffmpeg;
}
