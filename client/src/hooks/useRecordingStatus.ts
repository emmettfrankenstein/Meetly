import { useEffect, useState } from "react";
import { socket } from "../services/socket";

type RecordingStatusState = {
  isRecording: boolean;
  recordingId?: string;
  startedAt?: string;
};

export function useRecordingStatus() {
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatusState>({
    isRecording: false,
  });

  useEffect(() => {
    function handleRecordingState(payload: {
      isRecording: boolean;
      roomId: string;
      recordingId?: string;
      startedAt?: string;
    }) {
      setRecordingStatus({
        isRecording: payload.isRecording,
        recordingId: payload.recordingId,
        startedAt: payload.startedAt,
      });
    }

    function handleRecordingStarted(payload: {
      recordingId: string;
      roomId: string;
      startedAt: string;
    }) {
      setRecordingStatus({
        isRecording: true,
        recordingId: payload.recordingId,
        startedAt: payload.startedAt,
      });
    }

    function handleRecordingStopped() {
      setRecordingStatus({
        isRecording: false,
      });
    }

    socket.on("recording:state", handleRecordingState);
    socket.on("recording:started", handleRecordingStarted);
    socket.on("recording:stopped", handleRecordingStopped);

    return () => {
      socket.off("recording:state", handleRecordingState);
      socket.off("recording:started", handleRecordingStarted);
      socket.off("recording:stopped", handleRecordingStopped);
    };
  }, []);

  return recordingStatus;
}
