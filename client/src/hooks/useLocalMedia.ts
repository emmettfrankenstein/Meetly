import { useCallback, useRef, useState } from "react";

export type MediaDeviceOption = {
  deviceId: string;
  label: string;
};

export function useLocalMedia() {
  const localStreamRef = useRef<MediaStream | null>(null);

  const [audioDevices, setAudioDevices] = useState<MediaDeviceOption[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceOption[]>([]);

  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState("");
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState("");

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mediaStatus, setMediaStatus] = useState("Media not started");

  const loadDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const audioInputs = devices
        .filter((device) => device.kind === "audioinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${index + 1}`,
        }));

      const videoInputs = devices
        .filter((device) => device.kind === "videoinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
        }));

      setAudioDevices(audioInputs);
      setVideoDevices(videoInputs);

      if (!selectedAudioDeviceId && audioInputs[0]) {
        setSelectedAudioDeviceId(audioInputs[0].deviceId);
      }

      if (!selectedVideoDeviceId && videoInputs[0]) {
        setSelectedVideoDeviceId(videoInputs[0].deviceId);
      }
    } catch (error) {
      console.error(error);
      setMediaStatus("Could not load media devices");
    }
  }, [selectedAudioDeviceId, selectedVideoDeviceId]);

  const stopLocalMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    localStreamRef.current = null;

    setIsMicOn(false);
    setIsCameraOn(false);
    setMediaStatus("Media stopped");
  }, [localStreamRef]);

  const startLocalMedia = useCallback(
    async (options?: { audioDeviceId?: string; videoDeviceId?: string }) => {
      try {
        stopLocalMedia();

        const audioDeviceId =
          options?.audioDeviceId || selectedAudioDeviceId || undefined;

        const videoDeviceId =
          options?.videoDeviceId || selectedVideoDeviceId || undefined;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoDeviceId
            ? {
                deviceId: { exact: videoDeviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 },
                aspectRatio: { ideal: 16 / 9 },
              }
            : {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                aspectRatio: { ideal: 16 / 9 },
              },
          audio: audioDeviceId
            ? {
                deviceId: { exact: audioDeviceId },
              }
            : true,
        });

        localStreamRef.current = stream;

        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();

        setIsCameraOn(videoTracks.some((track) => track.enabled));
        setIsMicOn(audioTracks.some((track) => track.enabled));

        setMediaStatus(
          `Media ready: ${videoTracks.length} video track(s), ${audioTracks.length} audio track(s)`,
        );

        await loadDevices();

        return stream;
      } catch (error) {
        console.error(error);
        setMediaStatus("No camera/microphone available. You can still join.");
        return null;
      }
    },
    [loadDevices, selectedAudioDeviceId, selectedVideoDeviceId, stopLocalMedia],
  );

  const switchAudioDevice = useCallback(
    async (deviceId: string) => {
      setSelectedAudioDeviceId(deviceId);

      return startLocalMedia({
        audioDeviceId: deviceId,
        videoDeviceId: selectedVideoDeviceId,
      });
    },
    [selectedVideoDeviceId, startLocalMedia],
  );

  const switchVideoDevice = useCallback(
    async (deviceId: string) => {
      setSelectedVideoDeviceId(deviceId);

      return startLocalMedia({
        audioDeviceId: selectedAudioDeviceId,
        videoDeviceId: deviceId,
      });
    },
    [selectedAudioDeviceId, startLocalMedia],
  );

  const toggleMic = useCallback(() => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];

    if (!audioTrack) {
      setMediaStatus("No microphone track found");
      return;
    }

    audioTrack.enabled = !audioTrack.enabled;
    setIsMicOn(audioTrack.enabled);
  }, []);

  const toggleCamera = useCallback(() => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];

    if (!videoTrack) {
      setMediaStatus("No camera track found");
      return;
    }

    videoTrack.enabled = !videoTrack.enabled;
    setIsCameraOn(videoTrack.enabled);
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const screenTrack = screenStream.getVideoTracks()[0];

      if (!screenTrack) {
        setMediaStatus("No screen track found");
        return null;
      }

      setIsScreenSharing(true);
      setMediaStatus("Screen sharing started");

      return screenTrack;
    } catch (error) {
      console.error(error);
      setMediaStatus("Could not start screen sharing");
      return null;
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    
    setIsScreenSharing(false);
    setMediaStatus("Screen sharing stopped");
  }, []);

  return {
    localStreamRef,

    audioDevices,
    videoDevices,
    selectedAudioDeviceId,
    selectedVideoDeviceId,

    isMicOn,
    isCameraOn,
    isScreenSharing,
    mediaStatus,

    loadDevices,
    startLocalMedia,
    stopLocalMedia,
    switchAudioDevice,
    switchVideoDevice,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
  };
}
