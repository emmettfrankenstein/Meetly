import { useCallback, useEffect, useState } from "react";
import { socket } from "../services/socket";

export type Participant = {
  socketId: string;
  username: string;
  userId?: string;
  role: "host" | "guest";
  isMicOn: boolean;
  isCameraOn: boolean;
};

export type ChatMessage = {
  id: string;
  type: "user" | "system";
  message: string;
  username: string;
  socketId?: string;
  userId?: string;
  createdAt: string;
  isEncrypted?: boolean;
  decryptionFailed?: boolean;
};

type UseSocketRoomOptions = {
  roomId: string;
  username: string;
  userId?: string;
  role: "host" | "guest";
  isMicOn: boolean;
  isCameraOn: boolean;
  canJoin: boolean;
  onUserJoined: (payload: { socketId: string; username: string }) => void;
  onOffer: (payload: {
    fromSocketId: string;
    offer: RTCSessionDescriptionInit;
  }) => void;
  onAnswer: (payload: {
    fromSocketId: string;
    answer: RTCSessionDescriptionInit;
  }) => void;
  onIceCandidate: (payload: {
    fromSocketId: string;
    candidate: RTCIceCandidateInit;
  }) => void;
  onUserLeft: () => void;
  onMeetingEnded: () => void;
};

export function useSocketRoom({
  roomId,
  username,
  userId,
  role,
  isMicOn,
  isCameraOn,
  canJoin,
  onUserJoined,
  onOffer,
  onAnswer,
  onIceCandidate,
  onUserLeft,
  onMeetingEnded,
}: UseSocketRoomOptions) {
  const [isJoined, setIsJoined] = useState(false);
  const [socketStatus, setSocketStatus] = useState("Socket not connected");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState("");

  const joinRoom = useCallback(() => {
    if (!canJoin) {
      setSocketStatus("Camera/microphone not ready. Please allow permissions.");
      return;
    }

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("join-room", {
      roomId,
      username,
      userId,
      role,
      isMicOn,
      isCameraOn,
    });

    setIsJoined(true);
  }, [canJoin, roomId, username, userId, role, isMicOn, isCameraOn]);

  const updateMediaStatus = useCallback(
    (status: { isMicOn: boolean; isCameraOn: boolean }) => {
      if (!isJoined) return;

      socket.emit("media-status-updated", status);
    },
    [isJoined],
  );

  const sendChatMessage = useCallback(
    (message: string) => {
      if (!isJoined) return;

      setChatError("");

      socket.emit("chat-message", {
        roomId,
        message,
      });
    },
    [isJoined, roomId],
  );

  const endMeeting = useCallback(() => {
    if (!isJoined) return;

    socket.emit("end-meeting", {
      roomId,
    });
  }, [isJoined, roomId]);

  const disconnectSocket = useCallback(() => {
    socket.disconnect();
    setIsJoined(false);
    setParticipants([]);
    setChatMessages([]);
    setSocketStatus("Socket disconnected");
  }, []);

  useEffect(() => {
    socket.on("connect", () => {
      setSocketStatus(`Socket connected: ${socket.id}`);
    });

    socket.on("joined-room", (payload) => {
      setSocketStatus(`Joined room: ${payload.roomId}`);

      if (payload.users) {
        setParticipants(payload.users);
      }

      if (payload.chatMessages) {
        setChatMessages(payload.chatMessages);
      }
    });

    socket.on("participants-updated", (payload) => {
      setParticipants(payload.users || []);
    });

    socket.on("chat-message", (message: ChatMessage) => {
      setChatMessages(
        (currentMessages) => {
          const alreadyExists = currentMessages.some(
            (existingMessage) => existingMessage.id === message.id,
          );

          if (alreadyExists) return currentMessages;

          return [...currentMessages, message];
        }, // [...currentMessages, message]
      );
    });

    socket.on("user-joined", onUserJoined);
    socket.on("offer", onOffer);
    socket.on("answer", onAnswer);
    socket.on("ice-candidate", onIceCandidate);
    socket.on("user-left", onUserLeft);
    socket.on("meeting-ended", onMeetingEnded);

    socket.on("meeting-error", (payload) => {
      setSocketStatus(payload.message || "Meeting error");
    });
    socket.on("chat-error", (payload) => {
      setChatError(payload.message || "Could not send message");
    });

    return () => {
      socket.off("connect");
      socket.off("joined-room");
      socket.off("participants-updated");
      socket.off("chat-message");
      socket.off("user-joined", onUserJoined);
      socket.off("offer", onOffer);
      socket.off("answer", onAnswer);
      socket.off("ice-candidate", onIceCandidate);
      socket.off("user-left", onUserLeft);
      socket.off("meeting-ended", onMeetingEnded);
      socket.off("meeting-error");
      socket.off("chat-error");
    };
  }, [onUserJoined, onOffer, onAnswer, onIceCandidate, onUserLeft]);

  return {
    isJoined,
    socketStatus,
    participants,
    chatMessages,
    chatError,
    joinRoom,
    updateMediaStatus,
    sendChatMessage,
    endMeeting,
    disconnectSocket,
  };
}
