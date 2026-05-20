import { useCallback, useRef, useState } from "react";
import { socket } from "../services/socket";
import { getRtcConfiguration } from "../services/iceServers";

// const iceServers: RTCConfiguration = {
//   iceServers: [
//     {
//       urls: "stun:stun.l.google.com:19302",
//     },
//   ],
// };

type IncomingOfferPayload = {
  fromSocketId: string;
  offer: RTCSessionDescriptionInit;
};

type IncomingAnswerPayload = {
  fromSocketId: string;
  answer: RTCSessionDescriptionInit;
};

type IncomingIceCandidatePayload = {
  fromSocketId: string;
  candidate: RTCIceCandidateInit;
};

type UseWebRTCOptions = {
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  onRemoteStream: (stream: MediaStream | null) => void;
};

export type ConnectionQuality = {
  label: "Not connected" | "Excellent" | "Good" | "Poor" | "Disconnected";
  rttMs: number | null;
  jitterMs: number | null;
  packetsLost: number;
};

export function useWebRTC({
  localStreamRef,
  onRemoteStream,
}: UseWebRTCOptions) {
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteSocketIdRef = useRef<string | null>(null);

  const [webrtcStatus, setWebrtcStatus] = useState("WebRTC not connected");

  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>(
    {
      label: "Not connected",
      rttMs: null,
      jitterMs: null,
      packetsLost: 0,
    },
  );

  const closePeerConnection = useCallback(() => {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    remoteSocketIdRef.current = null;
    onRemoteStream(null);
    setWebrtcStatus("WebRTC disconnected");
  }, [onRemoteStream]);

  const createPeerConnection = useCallback(
    (targetSocketId: string) => {
      closePeerConnection();

      // const peerConnection = new RTCPeerConnection(iceServers);
      const peerConnection = new RTCPeerConnection(getRtcConfiguration());

      peerConnectionRef.current = peerConnection;
      remoteSocketIdRef.current = targetSocketId;

      const localStream = localStreamRef.current;

      if (localStream) {
        localStream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, localStream);
        });
      }

      peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        onRemoteStream(remoteStream);
        setWebrtcStatus("Remote stream connected");
      };

      peerConnection.onicecandidate = (event) => {
        console.log("ICE candidate:", event.candidate?.candidate);
        if (event.candidate) {
          socket.emit("ice-candidate", {
            targetSocketId,
            candidate: event.candidate,
          });
        }
      };

      peerConnection.onconnectionstatechange = () => {
        setWebrtcStatus(`WebRTC state: ${peerConnection.connectionState}`);
      };

      peerConnection.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", peerConnection.iceConnectionState);
      };

      return peerConnection;
    },
    [closePeerConnection, localStreamRef, onRemoteStream],
  );

  const createAndSendOffer = useCallback(
    async (targetSocketId: string) => {
      const peerConnection = createPeerConnection(targetSocketId);

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      socket.emit("offer", {
        targetSocketId,
        offer,
      });

      setWebrtcStatus("Offer sent");
    },
    [createPeerConnection],
  );

  const handleIncomingOffer = useCallback(
    async ({ fromSocketId, offer }: IncomingOfferPayload) => {
      const peerConnection = createPeerConnection(fromSocketId);

      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer),
      );

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socket.emit("answer", {
        targetSocketId: fromSocketId,
        answer,
      });

      setWebrtcStatus("Answer sent");
    },
    [createPeerConnection],
  );

  const handleIncomingAnswer = useCallback(
    async ({ answer }: IncomingAnswerPayload) => {
      const peerConnection = peerConnectionRef.current;

      if (!peerConnection) return;

      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(answer),
      );

      setWebrtcStatus("Answer received");
    },
    [],
  );

  const handleIncomingIceCandidate = useCallback(
    async ({ candidate }: IncomingIceCandidatePayload) => {
      const peerConnection = peerConnectionRef.current;

      if (!peerConnection) return;

      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));

      setWebrtcStatus("ICE candidate added");
    },
    [],
  );

  const replaceOutgoingVideoTrack = useCallback(
    (newTrack: MediaStreamTrack) => {
      const peerConnection = peerConnectionRef.current;

      if (!peerConnection) {
        setWebrtcStatus("No active peer connection for screen share");
        return false;
      }

      const videoSender = peerConnection
        .getSenders()
        .find((sender) => sender.track?.kind === "video");

      if (!videoSender) {
        setWebrtcStatus("No outgoing video sender found");
        return false;
      }

      videoSender.replaceTrack(newTrack);
      setWebrtcStatus("Outgoing video track replaced");

      return true;
    },
    [],
  );

  const updateConnectionQuality = useCallback(async () => {
    const peerConnection = peerConnectionRef.current;

    if (!peerConnection) {
      setConnectionQuality({
        label: "Not connected",
        rttMs: null,
        jitterMs: null,
        packetsLost: 0,
      });

      return;
    }

    if (
      peerConnection.connectionState === "disconnected" ||
      peerConnection.connectionState === "failed" ||
      peerConnection.connectionState === "closed"
    ) {
      setConnectionQuality({
        label: "Disconnected",
        rttMs: null,
        jitterMs: null,
        packetsLost: 0,
      });

      return;
    }

    const stats = await peerConnection.getStats();

    let rttMs: number | null = null;
    let jitterMs: number | null = null;
    let packetsLost = 0;

    stats.forEach((report) => {
      if (
        report.type === "candidate-pair" &&
        report.state === "succeeded" &&
        typeof report.currentRoundTripTime === "number"
      ) {
        rttMs = Math.round(report.currentRoundTripTime * 1000);
      }

      if (report.type === "inbound-rtp" && report.kind === "video") {
        if (typeof report.jitter === "number") {
          jitterMs = Math.round(report.jitter * 1000);
        }

        if (typeof report.packetsLost === "number") {
          packetsLost += report.packetsLost;
        }
      }
    });

    let label: ConnectionQuality["label"] = "Excellent";

    if (
      (rttMs !== null && rttMs > 300) ||
      (jitterMs !== null && jitterMs > 80)
    ) {
      label = "Poor";
    } else if (
      (rttMs !== null && rttMs > 150) ||
      (jitterMs !== null && jitterMs > 40)
    ) {
      label = "Good";
    }

    setConnectionQuality({
      label,
      rttMs,
      jitterMs,
      packetsLost,
    });
  }, []);

  return {
    peerConnectionRef,
    remoteSocketIdRef,
    webrtcStatus,
    connectionQuality,
    createAndSendOffer,
    handleIncomingOffer,
    handleIncomingAnswer,
    handleIncomingIceCandidate,
    closePeerConnection,
    replaceOutgoingVideoTrack,
    updateConnectionQuality,
  };
}
