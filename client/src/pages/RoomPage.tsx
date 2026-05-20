import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { socket } from "../services/socket";
import { useLocalMedia } from "../hooks/useLocalMedia";
import { useSocketRoom } from "../hooks/useSocketRoom";
import { useWebRTC } from "../hooks/useWebRTC";
import { useMediasoup } from "../hooks/useMediasoup";
import { ChatPanel } from "../components/ChatPanel";

import {
  getMeetingByRoomId,
  verifyMeetingPasscode,
  type Meeting,
} from "../services/meetingApi";
import { InviteModal } from "../components/InviteModal";
import { PreJoinLobby } from "../components/PreJoinLobby";
import { useAuthStore } from "../stores/authStore";

import type { ExistingProducer } from "../types/sfu";
import { SfuVideoGrid } from "../components/SfuVideoGrid";

import { RecordingPanel } from "../components/RecordingPanel";

import { useRecordingStatus } from "../hooks/useRecordingStatus";

import { useBackgroundEffectStream } from "../hooks/useBackgroundEffectStream";

import { SelfViewControls } from "../components/SelfViewControls";

import { LayoutSwitcher } from "../components/LayoutSwitcher";
import { useMeetingLayout } from "../hooks/useMeetingLayout";

import { GridMeetingLayout } from "../components/GridMeetingLayout";

import { SpeakerFloatingLayout } from "../components/SpeakerFloatingLayout";

import { FullscreenMeetingLayout } from "../components/FullscreenMeetingLayout";

import { FloatingControlsDock } from "../components/FloatingControlsDock";

import { StatusPanel } from "../components/StatusPanel";

import { FocusMeetingLayout } from "../components/FocusMeetingLayout";
import { useMeetingShortcuts } from "../hooks/useMeetingShortcuts";

import { DeviceSettingsPanel } from "../components/DeviceSettingsPanel";

import {
  downloadE2eeRecordingBlob,
  listE2eeRecordings,
  // uploadE2eeRecording, // // We will keep it here for now
  type E2eeRecordingDto,
} from "../services/e2eeRecordingApi";
import type { EncryptedRecordingMetadata } from "../utils/e2eeRecordingCrypto";

import {
  decryptRecordingBlob,
  encryptRecordingBlob,
} from "../utils/e2eeRecordingCrypto";

import { E2eeClientRecordingPanel } from "../components/E2eeClientRecordingPanel";
import {
  useClientRecording,
  type ClientRecordingRemoteStream,
} from "../hooks/useClientRecording";

import { useE2eeSupport } from "../hooks/useE2eeSupport";
import { useE2eeKeyExchange } from "../hooks/useE2eeKeyExchange";

import type { ChatMessage } from "../hooks/useSocketRoom";

import {
  decryptChatMessage,
  encryptChatMessage,
  looksLikeEncryptedChatMessage,
} from "../utils/e2eeChatCrypto";

const mediaMode = import.meta.env.VITE_MEDIA_MODE || "p2p";
const isSfuMode = mediaMode === "sfu";

export function RoomPage() {
  const navigate = useNavigate();
  const params = useParams();

  const urlRoomId = params.roomId || "demo-room";

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const hasStartedSfuRef = useRef(false);

  const [localScreenShareStream, setLocalScreenShareStream] =
    useState<MediaStream | null>(null);

  const [roomId] = useState(urlRoomId);

  const user = useAuthStore((state) => state.user);

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [meetingStatus, setMeetingStatus] = useState("Loading meeting...");

  const [isRoomUnlocked, setIsRoomUnlocked] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
  const [isVerifyingPasscode, setIsVerifyingPasscode] = useState(false);

  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const [username, setUsername] = useState(user?.username || "Guest");
  const isHost = Boolean(user && meeting && meeting.createdById === user.id);
  const participantRole = isHost ? "host" : "guest";

  const recordingStatus = useRecordingStatus();
  const isE2eeEnabled = Boolean(meeting?.isE2eeEnabled);
  const e2eeSupport = useE2eeSupport();

  const meetingLayout = useMeetingLayout();

  const isImmersiveLayout =
    meetingLayout.mode === "fullscreen" || meetingLayout.mode === "focus";

  const [isLayoutPanelOpen, setIsLayoutPanelOpen] = useState(false);
  const [isStatusPanelOpen, setIsStatusPanelOpen] = useState(false);

  const [isRecordingPanelOpen, setIsRecordingPanelOpen] = useState(false);
  const [isControlsDockCollapsed, setIsControlsDockCollapsed] = useState(false);

  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);

  const [isEncryptingRecording, setIsEncryptingRecording] = useState(false);
  const [encryptedRecordingBlob, setEncryptedRecordingBlob] =
    useState<Blob | null>(null);
  const [encryptedRecordingUrl, setEncryptedRecordingUrl] = useState<
    string | null
  >(null);

  const [encryptedRecordingMetadata, setEncryptedRecordingMetadata] =
    useState<EncryptedRecordingMetadata | null>(null);

  const [uploadedE2eeRecordings, setUploadedE2eeRecordings] = useState<
    E2eeRecordingDto[]
  >([]);

  const [isUploadingE2eeRecording, setIsUploadingE2eeRecording] =
    useState(false);
  const [e2eeRecordingUploadError, setE2eeRecordingUploadError] = useState<
    string | null
  >(null);

  const [isDecryptingE2eeRecordingId, setIsDecryptingE2eeRecordingId] =
    useState<string | null>(null);

  const [decryptedE2eeRecordingUrl, setDecryptedE2eeRecordingUrl] = useState<
    string | null
  >(null);

  const [e2eeRecordingPlaybackError, setE2eeRecordingPlaybackError] = useState<
    string | null
  >(null);

  const [displayChatMessages, setDisplayChatMessages] = useState<ChatMessage[]>(
    [],
  );

  const {
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
  } = useLocalMedia();

  const [hasEnteredLobby, setHasEnteredLobby] = useState(false);
  const [localPreviewStream, setLocalPreviewStream] =
    useState<MediaStream | null>(null);

  const handleRemoteStream = useCallback((stream: MediaStream | null) => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
    }
  }, []);

  const selfViewBackground = useBackgroundEffectStream({
    sourceStream: localStreamRef.current,
    effect: meetingLayout.selfView.backgroundEffect,
  });

  const localSelfViewStream =
    selfViewBackground.processedStream || localStreamRef.current;

  const {
    createAndSendOffer,
    handleIncomingOffer,
    handleIncomingAnswer,
    handleIncomingIceCandidate,
    closePeerConnection,
    replaceOutgoingVideoTrack,
    updateConnectionQuality,
  } = useWebRTC({
    localStreamRef,
    onRemoteStream: handleRemoteStream,
  });

  const handleUserJoined = useCallback(
    async (payload: { socketId: string; username: string }) => {
      if (isSfuMode) return;

      await createAndSendOffer(payload.socketId);
    },
    [createAndSendOffer, isSfuMode],
  );

  const handleUserLeft = useCallback(() => {
    closePeerConnection();
  }, [closePeerConnection]);

  async function handleToggleMic() {
    const nextMicState = !isMicOn;

    toggleMic();

    updateMediaStatus({
      isMicOn: nextMicState,
      isCameraOn,
    });

    if (isSfuMode) {
      await setProducerPausedByMediaTag("audio", !nextMicState);
    }
  }

  async function handleToggleCamera() {
    const nextCameraState = !isCameraOn;

    toggleCamera();

    updateMediaStatus({
      isMicOn,
      isCameraOn: nextCameraState,
    });

    if (isSfuMode) {
      await setProducerPausedByMediaTag("video", !nextCameraState);
    }
  }

  function handleToggleLocalRecording() {
    if (e2eeClientRecording.isRecording) {
      e2eeClientRecording.stopRecording();
      return;
    }

    e2eeClientRecording.startRecording();
  }

  function handleToggleScreenShare() {
    if (isScreenSharing) {
      void handleStopScreenShare();
      return;
    }

    void handleStartScreenShare();
  }

  function closeFloatingPanels() {
    setIsLayoutPanelOpen(false);
    setIsStatusPanelOpen(false);
    setIsRecordingPanelOpen(false);
    setIsChatPanelOpen(false);
    setIsDevicePanelOpen(false);
  }

  function toggleLayoutPanel() {
    setIsLayoutPanelOpen((current) => !current);
    setIsStatusPanelOpen(false);
    setIsRecordingPanelOpen(false);
    setIsChatPanelOpen(false);
    setIsDevicePanelOpen(false);
  }

  function toggleStatusPanel() {
    setIsStatusPanelOpen((current) => !current);
    setIsLayoutPanelOpen(false);
    setIsRecordingPanelOpen(false);
    setIsChatPanelOpen(false);
    setIsDevicePanelOpen(false);
  }

  function toggleChatPanel() {
    setIsChatPanelOpen((current) => !current);
    setIsLayoutPanelOpen(false);
    setIsStatusPanelOpen(false);
    setIsRecordingPanelOpen(false);
    setIsDevicePanelOpen(false);
  }

  function toggleRecordingPanel() {
    setIsRecordingPanelOpen((current) => !current);
    setIsLayoutPanelOpen(false);
    setIsStatusPanelOpen(false);
    setIsChatPanelOpen(false);
    setIsDevicePanelOpen(false);
  }

  // // // // //  We shall keep it here for now

  // async function handleUploadEncryptedRecording() {
  //   if (!roomId) return;

  //   if (!encryptedRecordingBlob || !encryptedRecordingMetadata) {
  //     alert("Encrypt the recording before uploading.");
  //     return;
  //   }

  //   try {
  //     setIsUploadingE2eeRecording(true);
  //     setE2eeRecordingUploadError(null);

  //     await uploadE2eeRecording({
  //       roomId,
  //       encryptedBlob: encryptedRecordingBlob,
  //       metadata: encryptedRecordingMetadata,
  //     });

  //     const response = await listE2eeRecordings(roomId);
  //     setUploadedE2eeRecordings(response.recordings);
  //   } catch (error) {
  //     const message =
  //       error instanceof Error
  //         ? error.message
  //         : "Failed to upload encrypted recording.";

  //     setE2eeRecordingUploadError(message);
  //   } finally {
  //     setIsUploadingE2eeRecording(false);
  //   }
  // }

  async function handleEncryptLocalRecording() {
    if (!e2eeClientRecording.recordingBlob) {
      alert("No local recording is available to encrypt.");
      return;
    }

    if (!e2eeExchange.cryptoKey) {
      alert("Encrypted meeting key is not ready.");
      return;
    }

    try {
      setIsEncryptingRecording(true);

      if (encryptedRecordingUrl) {
        URL.revokeObjectURL(encryptedRecordingUrl);
        setEncryptedRecordingUrl(null);
      }

      const result = await encryptRecordingBlob({
        recordingBlob: e2eeClientRecording.recordingBlob,
        key: e2eeExchange.cryptoKey,
      });

      const url = URL.createObjectURL(result.encryptedBlob);

      setEncryptedRecordingBlob(result.encryptedBlob);
      setEncryptedRecordingUrl(url);

      setEncryptedRecordingMetadata({
        ...result.metadata,
        durationSec: e2eeClientRecording.durationSec ?? undefined,
        startedAt: e2eeClientRecording.startedAt?.toISOString(),
      } as EncryptedRecordingMetadata);
    } catch (error) {
      console.error("Failed to encrypt local recording:", error);
      alert("Failed to encrypt local recording.");
    } finally {
      setIsEncryptingRecording(false);
    }
  }

  async function handlePlayUploadedE2eeRecording(recording: {
    id: string;
    metadata: unknown;
    sizeBytes: number;
    durationSec?: number | null;
    createdAt: string;
  }) {
    if (!e2eeExchange.cryptoKey) {
      alert("Encrypted meeting key is not ready.");
      return;
    }

    try {
      setIsDecryptingE2eeRecordingId(recording.id);
      setE2eeRecordingPlaybackError(null);

      if (decryptedE2eeRecordingUrl) {
        URL.revokeObjectURL(decryptedE2eeRecordingUrl);
        setDecryptedE2eeRecordingUrl(null);
      }

      const encryptedBlob = await downloadE2eeRecordingBlob(recording.id);

      const decryptedBlob = await decryptRecordingBlob({
        encryptedBlob,
        metadata: recording.metadata as {
          version: "meetly-recording-e2ee-v1";
          iv: string;
          originalType: string;
          encryptedAt: string;
          durationSec?: number;
          startedAt?: string;
        },
        key: e2eeExchange.cryptoKey,
      });

      const playbackUrl = URL.createObjectURL(decryptedBlob);
      setDecryptedE2eeRecordingUrl(playbackUrl);
    } catch (error) {
      console.error("Failed to decrypt uploaded E2EE recording:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Failed to decrypt uploaded encrypted recording.";

      setE2eeRecordingPlaybackError(message);
    } finally {
      setIsDecryptingE2eeRecordingId(null);
    }
  }

  const handleMeetingEnded = useCallback(() => {
    closePeerConnection();
    stopLocalMedia();
    navigate("/");
  }, [closePeerConnection, stopLocalMedia, navigate]);

  const {
    isJoined,
    // socketStatus,
    participants,
    chatMessages,
    chatError,
    joinRoom,
    updateMediaStatus,
    sendChatMessage,
    endMeeting,
    disconnectSocket,
  } = useSocketRoom({
    roomId,
    username,
    userId: user?.id,
    role: participantRole,
    isMicOn,
    isCameraOn,
    canJoin: isRoomUnlocked,
    onUserJoined: handleUserJoined,
    onOffer: handleIncomingOffer,
    onAnswer: handleIncomingAnswer,
    onIceCandidate: handleIncomingIceCandidate,
    onUserLeft: handleUserLeft,
    onMeetingEnded: handleMeetingEnded,
  });

  const e2eeExchange = useE2eeKeyExchange({
    enabled: isE2eeEnabled,
    roomId,
    username,
    isHost: participantRole === "host",
    isJoined,
  });

  const {
    sfuStatus,
    sfuHealth,
    sendTransportState,
    recvTransportState,
    e2eeTransformStatus,
    remoteStreams: sfuRemoteStreams,
    joinSfuRoom,
    consumeProducer,
    closeSfu,
    produceScreenTrack,
    closeProducerByMediaTag,
    setProducerPausedByMediaTag,
    replaceProducerTrackByMediaTag,
  } = useMediasoup({
    roomId,
    username,
    userId: user?.id,
    role: participantRole,
    localStreamRef,
    isE2eeEnabled,
    e2eeCryptoKey: e2eeExchange.cryptoKey,
  });

  const [isDevicePanelOpen, setIsDevicePanelOpen] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>(
    [],
  );
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [selectedMicId, setSelectedMicId] = useState("");
  const [deviceSwitchError, setDeviceSwitchError] = useState<string | null>(
    null,
  );

  const shouldRenderPanel =
    isLayoutPanelOpen ||
    isRecordingPanelOpen ||
    isChatPanelOpen ||
    isDevicePanelOpen ||
    !isE2eeEnabled;

  const hasSidePanelOpen = !isImmersiveLayout && shouldRenderPanel;

  function toggleDevicePanel() {
    setIsDevicePanelOpen((current) => !current);
    setIsLayoutPanelOpen(false);
    setIsStatusPanelOpen(false);
    setIsRecordingPanelOpen(false);
    setIsChatPanelOpen(false);
  }

  async function refreshDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    setAvailableDevices(devices);

    const currentVideoTrack = localStreamRef.current?.getVideoTracks()[0];
    const currentAudioTrack = localStreamRef.current?.getAudioTracks()[0];

    if (currentVideoTrack) {
      const settings = currentVideoTrack.getSettings();
      setSelectedCameraId(settings.deviceId || "");
    }

    if (currentAudioTrack) {
      const settings = currentAudioTrack.getSettings();
      setSelectedMicId(settings.deviceId || "");
    }
  }

  useEffect(() => {
    if (!hasEnteredLobby) return;

    void refreshDevices();

    navigator.mediaDevices.addEventListener("devicechange", refreshDevices);

    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        refreshDevices,
      );
    };
  }, [hasEnteredLobby]);

  async function handleSwitchMicrophone(deviceId: string) {
    try {
      setDeviceSwitchError(null);
      setSelectedMicId(deviceId);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
        },
        video: false,
      });

      const [newAudioTrack] = stream.getAudioTracks();

      if (!newAudioTrack) {
        throw new Error("Selected microphone did not provide an audio track");
      }

      const oldAudioTrack = localStreamRef.current?.getAudioTracks()[0];

      if (localStreamRef.current) {
        if (oldAudioTrack) {
          localStreamRef.current.removeTrack(oldAudioTrack);
          oldAudioTrack.stop();
        }

        localStreamRef.current.addTrack(newAudioTrack);
      } else {
        localStreamRef.current = new MediaStream([newAudioTrack]);
      }

      if (isSfuMode && isJoined) {
        await replaceProducerTrackByMediaTag("audio", newAudioTrack);
      }

      if (!isMicOn) {
        newAudioTrack.enabled = false;
      }

      await refreshDevices();
    } catch (error) {
      setDeviceSwitchError(
        error instanceof Error ? error.message : "Could not switch microphone",
      );
    }
  }

  async function handleSwitchCamera(deviceId: string) {
    try {
      setDeviceSwitchError(null);
      setSelectedCameraId(deviceId);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
      });

      const [newVideoTrack] = stream.getVideoTracks();

      if (!newVideoTrack) {
        throw new Error("Selected camera did not provide a video track");
      }

      const oldVideoTrack = localStreamRef.current?.getVideoTracks()[0];

      if (localStreamRef.current) {
        if (oldVideoTrack) {
          localStreamRef.current.removeTrack(oldVideoTrack);
          oldVideoTrack.stop();
        }

        localStreamRef.current.addTrack(newVideoTrack);
      } else {
        localStreamRef.current = new MediaStream([newVideoTrack]);
      }

      if (isSfuMode && isJoined) {
        await replaceProducerTrackByMediaTag("video", newVideoTrack);
      }

      if (!isCameraOn) {
        newVideoTrack.enabled = false;
      }

      await refreshDevices();
    } catch (error) {
      setDeviceSwitchError(
        error instanceof Error ? error.message : "Could not switch camera",
      );
    }
  }

  const clientRecordingRemoteStreams = useMemo<
    ClientRecordingRemoteStream[]
  >(() => {
    return sfuRemoteStreams.map((remoteStream) => {
      const appData = remoteStream.appData as
        | { mediaTag?: "camera" | "screen" | "audio"; username?: string }
        | undefined;

      return {
        stream: remoteStream.stream,
        username: remoteStream.username || appData?.username || "Participant",
        mediaTag:
          appData?.mediaTag === "screen"
            ? "screen"
            : appData?.mediaTag === "audio"
              ? "audio"
              : "camera",
      };
    });
  }, [sfuRemoteStreams]);

  const e2eeClientRecording = useClientRecording({
    localStream: localStreamRef.current,
    localUsername: username,
    localScreenShareStream,
    remoteStreams: clientRecordingRemoteStreams,
    layoutMode: meetingLayout.mode,
    // layoutPreset: meetingLayout.preset,
    selfView: meetingLayout.selfView,
  });

  useEffect(() => {
    if (!isSfuMode) return;

    function handleNewProducer(payload: ExistingProducer) {
      consumeProducer(payload);
      console.log("New SFU producer received:", payload);
    }

    socket.on("sfu:new-producer", handleNewProducer);

    return () => {
      socket.off("sfu:new-producer", handleNewProducer);
    };
  }, [consumeProducer, isSfuMode]);

  useEffect(() => {
    async function loadMeeting() {
      try {
        const result = await getMeetingByRoomId(roomId);
        setMeeting(result.meeting);
        setMeetingStatus("Meeting loaded");

        if (user && result.meeting.createdById === user.id) {
          setIsRoomUnlocked(true);
        }
      } catch (error) {
        console.error(error);
        setMeetingStatus("Meeting not found");
      }
    }

    loadMeeting();
  }, [roomId, user]);

  useEffect(() => {
    let mounted = true;

    async function initMedia() {
      await loadDevices();
      const stream = await startLocalMedia();

      if (!mounted) return;

      if (stream) {
        setLocalPreviewStream(stream);
      }
      if (localVideoRef.current && stream) {
        localVideoRef.current.srcObject = stream;

        localVideoRef.current.play().catch((error) => {
          console.warn("Local video autoplay failed:", error);
        });
      }
    }

    initMedia();

    return () => {
      mounted = false;
      closePeerConnection();
      closeSfu();
      stopLocalMedia();
      disconnectSocket();
    };
  }, [
    loadDevices,
    startLocalMedia,
    stopLocalMedia,
    closePeerConnection,
    disconnectSocket,
    closeSfu,
  ]);

  useEffect(() => {
    if (!hasEnteredLobby) return;

    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [hasEnteredLobby, localPreviewStream, localStreamRef]);

  useEffect(() => {
    if (!isJoined || isSfuMode) return;

    const intervalId = window.setInterval(() => {
      updateConnectionQuality();
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isJoined, isSfuMode, updateConnectionQuality]);

  useEffect(() => {
    if (!hasEnteredLobby) return;
    if (!isJoined) return;
    if (!isSfuMode) return;
    if (hasStartedSfuRef.current) return;

    if (isE2eeEnabled && !e2eeExchange.cryptoKey) {
      return;
    }

    hasStartedSfuRef.current = true;
    joinSfuRoom();
  }, [
    e2eeExchange.cryptoKey,
    hasEnteredLobby,
    isE2eeEnabled,
    isJoined,
    isSfuMode,
    joinSfuRoom,
  ]);

  useEffect(() => {
    hasStartedSfuRef.current = false;
  }, [roomId]);

  useEffect(() => {
    let cancelled = false;

    async function decryptMessages() {
      if (!isE2eeEnabled) {
        setDisplayChatMessages(chatMessages);
        return;
      }

      const mappedMessages = await Promise.all(
        chatMessages.map(async (chatMessage) => {
          if (!looksLikeEncryptedChatMessage(chatMessage.message)) {
            return {
              ...chatMessage,
              isEncrypted: false,
            };
          }

          if (!e2eeExchange.cryptoKey) {
            return {
              ...chatMessage,
              message: "Encrypted message. Waiting for meeting key.",
              isEncrypted: true,
              decryptionFailed: true,
            };
          }

          try {
            const plaintext = await decryptChatMessage({
              encryptedMessage: chatMessage.message,
              key: e2eeExchange.cryptoKey,
            });

            return {
              ...chatMessage,
              message: plaintext,
              isEncrypted: true,
              decryptionFailed: false,
            };
          } catch {
            return {
              ...chatMessage,
              message: "Unable to decrypt message.",
              isEncrypted: true,
              decryptionFailed: true,
            };
          }
        }),
      );

      if (!cancelled) {
        setDisplayChatMessages(mappedMessages);
      }
    }

    void decryptMessages();

    return () => {
      cancelled = true;
    };
  }, [chatMessages, e2eeExchange.cryptoKey, isE2eeEnabled]);

  useEffect(() => {
    return () => {
      if (encryptedRecordingUrl) {
        URL.revokeObjectURL(encryptedRecordingUrl);
      }
    };
  }, [encryptedRecordingUrl]);

  useEffect(() => {
    if (!roomId) return;
    if (!isE2eeEnabled) return;
    if (participantRole !== "host") return;

    let cancelled = false;

    async function loadRecordings() {
      try {
        const response = await listE2eeRecordings(roomId);

        if (!cancelled) {
          setUploadedE2eeRecordings(response.recordings);
        }
      } catch {
        if (!cancelled) {
          setUploadedE2eeRecordings([]);
        }
      }
    }

    void loadRecordings();

    return () => {
      cancelled = true;
    };
  }, [isE2eeEnabled, participantRole, roomId]);

  useEffect(() => {
    return () => {
      if (decryptedE2eeRecordingUrl) {
        URL.revokeObjectURL(decryptedE2eeRecordingUrl);
      }
    };
  }, [decryptedE2eeRecordingUrl]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!e2eeClientRecording.isRecording) return;

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [e2eeClientRecording.isRecording]);

  useMeetingShortcuts({
    enabled: hasEnteredLobby,
    layoutMode: meetingLayout.mode,
    onToggleMic: () => {
      void handleToggleMic();
    },
    onToggleCamera: () => {
      void handleToggleCamera();
    },
    onToggleRecording: handleToggleLocalRecording,
    onToggleScreenShare: handleToggleScreenShare,
    onToggleLayoutPanel: toggleLayoutPanel,
    onToggleStatusPanel: toggleStatusPanel,
    onToggleChatPanel: toggleChatPanel,
    onSetLayoutMode: meetingLayout.setMode,
    onClosePanels: closeFloatingPanels,
  });

  function handleLeaveMeeting() {
    if (e2eeClientRecording.isRecording) {
      const shouldLeave = window.confirm(
        "A local recording is still running. Leaving now will stop it. Do you want to leave?",
      );

      if (!shouldLeave) return;

      e2eeClientRecording.stopRecording();
    }

    leaveRoom();
  }

  function handleEndMeetingFromDock() {
    const shouldEnd = window.confirm(
      "End this meeting for everyone? All participants will be disconnected.",
    );

    if (!shouldEnd) return;

    endMeeting();
    leaveRoom();
  }

  async function handleSendChatMessage(message: string) {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) return;

    if (isE2eeEnabled) {
      if (!e2eeExchange.cryptoKey) {
        alert("Encrypted chat is not ready yet. Please wait a moment.");
        return;
      }

      const encryptedMessage = await encryptChatMessage({
        message: trimmedMessage,
        key: e2eeExchange.cryptoKey,
      });

      sendChatMessage(encryptedMessage);
      return;
    }

    sendChatMessage(trimmedMessage);
  }

  async function handleStartScreenShare() {
    const screenTrack = await startScreenShare();

    if (!screenTrack) return;

    if (isSfuMode) {
      await produceScreenTrack(screenTrack);

      const screenPreviewStream = new MediaStream([screenTrack]);
      setLocalScreenShareStream(screenPreviewStream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenPreviewStream;
      }

      screenTrack.onended = () => {
        void handleStopScreenShare();
      };

      return;
    }

    const replaced = replaceOutgoingVideoTrack(screenTrack);

    if (!replaced) {
      screenTrack.stop();
      return;
    }

    const screenPreviewStream = new MediaStream([screenTrack]);

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = screenPreviewStream;
    }

    screenTrack.onended = () => {
      handleStopScreenShare();
    };
  }

  async function handleStopScreenShare() {
    if (isSfuMode) {
      await closeProducerByMediaTag("screen");

      setLocalScreenShareStream(null);

      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      stopScreenShare();
      return;
    }

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];

    if (!cameraTrack) return;

    replaceOutgoingVideoTrack(cameraTrack);

    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }

    stopScreenShare();
  }

  async function handleVerifyPasscode(event: React.FormEvent) {
    event.preventDefault();

    try {
      setPasscodeError("");
      setIsVerifyingPasscode(true);

      const result = await verifyMeetingPasscode({
        roomId,
        passcode,
      });

      setMeeting(result.meeting);
      setIsRoomUnlocked(true);
      setMeetingStatus("Meeting unlocked");
    } catch (error) {
      setPasscodeError(
        error instanceof Error ? error.message : "Invalid meeting passcode",
      );
    } finally {
      setIsVerifyingPasscode(false);
    }
  }

  async function handleAudioDeviceChange(deviceId: string) {
    const stream = await switchAudioDevice(deviceId);

    if (stream) {
      setLocalPreviewStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    }
  }

  async function handleVideoDeviceChange(deviceId: string) {
    const stream = await switchVideoDevice(deviceId);

    if (stream) {
      setLocalPreviewStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    }
  }

  function handleJoinFromLobby() {
    if (isE2eeEnabled && !e2eeSupport.isSupported) {
      alert(
        "This browser does not support Meetly encrypted media yet. Try Chrome or Edge.",
      );
      return;
    }

    setHasEnteredLobby(true);

    joinRoom();
  }

  function leaveRoom() {
    hasStartedSfuRef.current = false;

    if (e2eeClientRecording.isRecording) {
      e2eeClientRecording.stopRecording();
    }

    e2eeClientRecording.clearRecording();

    closeSfu();
    closePeerConnection();
    stopScreenShare();
    stopLocalMedia();

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setLocalScreenShareStream(null);
    setHasEnteredLobby(false);
    setLocalPreviewStream(null);

    disconnectSocket();
    navigate("/");
  }

  useEffect(() => {
    return () => {
      e2eeClientRecording.clearRecording();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (meeting && !isRoomUnlocked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <section className="w-full max-w-md">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">
              Meetly
            </p>

            <h1 className="mt-3 text-3xl font-bold">
              {meeting.title || "Protected meeting"}
            </h1>

            <p className="mt-2 text-slate-400">
              Enter the meeting passcode to continue.
            </p>

            <form onSubmit={handleVerifyPasscode} className="mt-6 space-y-4">
              <label className="flex flex-col gap-2">
                <span className="text-sm text-slate-300">Passcode</span>
                <input
                  value={passcode}
                  onChange={(event) => setPasscode(event.target.value)}
                  placeholder="Enter 6-digit passcode"
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
                  autoFocus
                />
              </label>

              {passcodeError && (
                <p className="rounded-xl border border-rose-800 bg-rose-950 px-3 py-2 text-sm text-rose-200">
                  {passcodeError}
                </p>
              )}

              <button
                disabled={isVerifyingPasscode}
                className="w-full rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {isVerifyingPasscode ? "Verifying..." : "Enter meeting"}
              </button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  if (meeting && isRoomUnlocked && !hasEnteredLobby) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <section className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-8">
          <PreJoinLobby
            meetingTitle={meeting.title || "Meetly Meeting"}
            localStream={localPreviewStream}
            username={username}
            onUsernameChange={setUsername}
            audioDevices={audioDevices}
            videoDevices={videoDevices}
            selectedAudioDeviceId={selectedAudioDeviceId}
            selectedVideoDeviceId={selectedVideoDeviceId}
            onAudioDeviceChange={handleAudioDeviceChange}
            onVideoDeviceChange={handleVideoDeviceChange}
            isMicOn={isMicOn}
            isCameraOn={isCameraOn}
            onToggleMic={toggleMic}
            onToggleCamera={toggleCamera}
            onJoin={handleJoinFromLobby}
            mediaStatus={mediaStatus}
          />
        </section>
      </main>
    );
  }

  return (
    <section className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-900/80 bg-slate-950/80 px-5 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-sm font-black text-cyan-200">
              M
            </div>

            <span className="text-lg font-bold text-white">Meetly</span>
          </div>

          <div className="hidden h-7 w-px bg-slate-800 md:block" />

          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-white">
              {meeting?.title || "Untitled Meeting"}
            </h1>

            <p className="text-[11px] text-slate-500">
              Room ID:{" "}
              <span className="font-mono text-slate-300">{roomId}</span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-100">
            E2EE On
          </span>

          <span className="hidden rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-[11px] font-semibold text-slate-300 sm:inline-flex">
            {participants.length} participant
            {participants.length === 1 ? "" : "s"}
          </span>

          <button
            type="button"
            onClick={() => setIsInviteOpen(true)}
            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            Invite
          </button>
        </div>
      </header>

      <main
        className={`mx-auto grid max-w-[1500px] items-start gap-4 px-4 py-4 pb-28 ${
          hasSidePanelOpen
            ? "xl:grid-cols-[minmax(0,1fr)_320px]"
            : "xl:grid-cols-1"
        }`}
      >
        {isSfuMode ? (
          <div className="min-w-0">
            {meetingLayout.mode === "speaker" ? (
              <SpeakerFloatingLayout
                localStream={localSelfViewStream}
                localUsername={username}
                remoteStreams={sfuRemoteStreams}
                participants={participants}
                currentSocketId={socket.id}
                isMicOn={isMicOn}
                isCameraOn={isCameraOn}
                selfView={meetingLayout.selfView}
                onSelfViewChange={meetingLayout.updateSelfView}
              />
            ) : meetingLayout.mode === "grid" ? (
              <GridMeetingLayout
                localStream={localStreamRef.current}
                localScreenShareStream={localScreenShareStream}
                localUsername={username}
                remoteStreams={sfuRemoteStreams}
                participants={participants}
                currentSocketId={socket.id}
                isMicOn={isMicOn}
                isCameraOn={isCameraOn}
              />
            ) : meetingLayout.mode === "fullscreen" ? (
              <FullscreenMeetingLayout
                localStream={localSelfViewStream}
                localUsername={username}
                remoteStreams={sfuRemoteStreams}
                participants={participants}
                currentSocketId={socket.id}
                isMicOn={isMicOn}
                isCameraOn={isCameraOn}
                selfView={meetingLayout.selfView}
                onSelfViewChange={meetingLayout.updateSelfView}
                onExitFullscreenMode={() => meetingLayout.setMode("speaker")}
                onOpenStatusPanel={() => {
                  setIsLayoutPanelOpen(false);
                  setIsStatusPanelOpen(true);
                }}
              />
            ) : meetingLayout.mode === "focus" ? (
              <FocusMeetingLayout
                localStream={localSelfViewStream}
                localUsername={username}
                remoteStreams={sfuRemoteStreams}
                participants={participants}
                currentSocketId={socket.id}
                isMicOn={isMicOn}
                isCameraOn={isCameraOn}
                selfView={meetingLayout.selfView}
                onSelfViewChange={meetingLayout.updateSelfView}
              />
            ) : (
              <SfuVideoGrid
                localStream={localStreamRef.current}
                localScreenShareStream={localScreenShareStream}
                localUsername={username}
                remoteStreams={sfuRemoteStreams}
                participants={participants}
                currentSocketId={socket.id}
                isMicOn={isMicOn}
                isCameraOn={isCameraOn}
              />
            )}
          </div>
        ) : (
          <div className="grid items-start gap-4 md:grid-cols-2">
            <div className="overflow-hidden rounded-2xl bg-black shadow-xl">
              <div className="aspect-video bg-black">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="flex items-center justify-between bg-slate-900 px-4 py-3">
                <p className="font-semibold">You</p>
                <p className="text-sm text-slate-400">
                  {isMicOn ? "Mic on" : "Muted"} ·{" "}
                  {isCameraOn ? "Camera on" : "Camera off"}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl bg-black shadow-xl">
              <div className="aspect-video bg-black">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="bg-slate-900 px-4 py-3">
                <p className="font-semibold">Remote participant</p>
              </div>
            </div>
          </div>
        )}

        {shouldRenderPanel && (
          <aside
            className={
              isImmersiveLayout
                ? "fixed right-4 top-20 z-[80] max-h-[calc(100vh-8rem)] w-[calc(100%-2rem)] max-w-sm space-y-4 overflow-y-auto"
                : "space-y-4 xl:sticky xl:top-4"
            }
          >
            {!isE2eeEnabled && (
              <RecordingPanel
                roomId={roomId}
                isHost={participantRole === "host"}
                isRecordingActive={recordingStatus.isRecording}
                isE2eeEnabled={isE2eeEnabled}
              />
            )}

            {isDevicePanelOpen && (
              <DeviceSettingsPanel
                devices={availableDevices}
                selectedCameraId={selectedCameraId}
                selectedMicId={selectedMicId}
                error={deviceSwitchError}
                onSelectCamera={handleSwitchCamera}
                onSelectMicrophone={handleSwitchMicrophone}
                onRefreshDevices={refreshDevices}
              />
            )}

            {isRecordingPanelOpen && (
              <E2eeClientRecordingPanel
                canRecord={true}
                isE2eeEnabled={isE2eeEnabled}
                status={e2eeClientRecording.status}
                error={e2eeClientRecording.error}
                recordingUrl={e2eeClientRecording.recordingUrl}
                recordingBlob={e2eeClientRecording.recordingBlob}
                encryptedRecordingUrl={encryptedRecordingUrl}
                encryptedRecordingSize={encryptedRecordingBlob?.size ?? null}
                isEncrypting={isEncryptingRecording}
                isUploading={isUploadingE2eeRecording}
                uploadError={e2eeRecordingUploadError}
                uploadedRecordings={uploadedE2eeRecordings}
                decryptedPlaybackUrl={decryptedE2eeRecordingUrl}
                playbackError={e2eeRecordingPlaybackError}
                layoutMode={meetingLayout.mode}
                decryptingRecordingId={isDecryptingE2eeRecordingId}
                durationSec={e2eeClientRecording.durationSec}
                startedAt={e2eeClientRecording.startedAt}
                onStart={e2eeClientRecording.startRecording}
                onStop={e2eeClientRecording.stopRecording}
                onClear={() => {
                  e2eeClientRecording.clearRecording();

                  if (encryptedRecordingUrl) {
                    URL.revokeObjectURL(encryptedRecordingUrl);
                  }

                  if (decryptedE2eeRecordingUrl) {
                    URL.revokeObjectURL(decryptedE2eeRecordingUrl);
                  }

                  setEncryptedRecordingBlob(null);
                  setEncryptedRecordingUrl(null);
                  setEncryptedRecordingMetadata(null);
                  setE2eeRecordingUploadError(null);
                  setDecryptedE2eeRecordingUrl(null);
                  setE2eeRecordingPlaybackError(null);
                }}
                onEncrypt={handleEncryptLocalRecording}
                onUpload={undefined}
                onPlayUploaded={handlePlayUploadedE2eeRecording}
                onDeleteUploaded={undefined}
              />
            )}

            {isLayoutPanelOpen && (
              <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
                <LayoutSwitcher
                  mode={meetingLayout.mode}
                  preset={meetingLayout.preset}
                  onModeChange={(mode) => {
                    meetingLayout.setMode(mode);
                    setIsLayoutPanelOpen(false);
                  }}
                  onPresetChange={meetingLayout.setPreset}
                  onResetLayout={meetingLayout.resetLayout}
                />

                {(meetingLayout.mode === "speaker" ||
                  meetingLayout.mode === "fullscreen" ||
                  meetingLayout.mode === "focus") && (
                  <SelfViewControls
                    selfView={meetingLayout.selfView}
                    backgroundStatus={selfViewBackground.status}
                    backgroundError={selfViewBackground.error}
                    onUpdate={meetingLayout.updateSelfView}
                    onReset={meetingLayout.resetSelfView}
                  />
                )}
              </div>
            )}
            {isChatPanelOpen && (
              <ChatPanel
                messages={isE2eeEnabled ? displayChatMessages : chatMessages}
                currentUserId={user?.id}
                currentSocketId={socket.id}
                error={chatError}
                onSendMessage={handleSendChatMessage}
                disabled={!isJoined}
                isE2eeEnabled={isE2eeEnabled}
                isChatReady={!isE2eeEnabled || Boolean(e2eeExchange.cryptoKey)}
              />
            )}
          </aside>
        )}
      </main>

      <StatusPanel
        isOpen={isStatusPanelOpen}
        onClose={() => setIsStatusPanelOpen(false)}
        e2eeStatus={e2eeExchange.status}
        e2eeTransformStatus={e2eeTransformStatus}
        sfuStatus={sfuStatus}
        sfuHealth={sfuHealth}
        sendTransportState={sendTransportState}
        recvTransportState={recvTransportState}
        localRecordingStatus={e2eeClientRecording.status}
        participants={participants}
        isMicOn={isMicOn}
        isCameraOn={isCameraOn}
        isScreenSharing={isScreenSharing}
        mediaStatus={mediaStatus}
        currentSocketId={socket.id}
      />

      <FloatingControlsDock
        isCollapsed={isControlsDockCollapsed}
        isMicOn={isMicOn}
        isCameraOn={isCameraOn}
        isScreenSharing={isScreenSharing}
        isRecording={e2eeClientRecording.isRecording}
        isHost={isHost}
        layoutMode={meetingLayout.mode}
        onToggleCollapsed={() =>
          setIsControlsDockCollapsed((current) => !current)
        }
        onToggleMic={() => {
          void handleToggleMic();
        }}
        onToggleCamera={() => {
          void handleToggleCamera();
        }}
        onOpenDevices={toggleDevicePanel}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleRecording={handleToggleLocalRecording}
        onOpenLayout={toggleLayoutPanel}
        onOpenStatus={toggleStatusPanel}
        onOpenChat={toggleChatPanel}
        onOpenRecordings={toggleRecordingPanel}
        onEndMeeting={handleEndMeetingFromDock}
        onLeave={handleLeaveMeeting}
      />
      {meeting && isInviteOpen && (
        <InviteModal meeting={meeting} onClose={() => setIsInviteOpen(false)} />
      )}
    </section>
  );
}
