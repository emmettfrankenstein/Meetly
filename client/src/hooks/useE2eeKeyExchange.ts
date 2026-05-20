import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "../services/socket";

import {
  decryptRoomKeyFromHost,
  deriveWrappingKey,
  encryptRoomKeyForPeer,
  exportParticipantPublicKey,
  exportRoomCryptoKey,
  generateParticipantKeyPair,
  generateRoomCryptoKey,
  importParticipantPublicKey,
  importRoomCryptoKey,
  type E2eeEncryptedRoomKeyPayload,
} from "../utils/e2eeKeyExchange";

import {
  getStoredRoomKey,
  saveStoredRoomKey,
} from "../utils/e2eeRoomKeyStorage";

type E2eeExchangeStatus =
  | "off"
  | "preparing"
  | "waiting-for-host"
  | "ready"
  | "error";

type PeerPublicKeyPayload = {
  socketId: string;
  username: string;
  publicKeyJwk: JsonWebKey;
};

type UseE2eeKeyExchangeInput = {
  enabled: boolean;
  roomId: string | undefined;
  username: string;
  isHost: boolean;
  isJoined: boolean;
};

export function useE2eeKeyExchange({
  enabled,
  roomId,
  username,
  isHost,
  isJoined,
}: UseE2eeKeyExchangeInput) {
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [status, setStatus] = useState<E2eeExchangeStatus>("off");
  const [error, setError] = useState<string | null>(null);

  const keyPairRef = useRef<CryptoKeyPair | null>(null);
  const publicKeyJwkRef = useRef<JsonWebKey | null>(null);
  const roomKeyRef = useRef<CryptoKey | null>(null);
  const peerPublicKeysRef = useRef(new Map<string, PeerPublicKeyPayload>());
  const sentRoomKeyToPeersRef = useRef(new Set<string>());

  const pendingEncryptedRoomKeyRef = useRef<{
    senderSocketId: string;
    encryptedRoomKey: E2eeEncryptedRoomKeyPayload;
  } | null>(null);

  const reset = useCallback(() => {
    keyPairRef.current = null;
    publicKeyJwkRef.current = null;
    roomKeyRef.current = null;
    peerPublicKeysRef.current.clear();
    sentRoomKeyToPeersRef.current.clear();
    setCryptoKey(null);
    setStatus(enabled ? "preparing" : "off");
    setError(null);
  }, [enabled]);

  const sendRoomKeyToPeer = useCallback(
    async (peer: PeerPublicKeyPayload) => {
      if (!roomId) return;
      if (!isHost) return;
      if (!keyPairRef.current) return;
      if (!roomKeyRef.current) return;
      if (sentRoomKeyToPeersRef.current.has(peer.socketId)) return;

      const peerPublicKey = await importParticipantPublicKey(peer.publicKeyJwk);

      const wrappingKey = await deriveWrappingKey({
        privateKey: keyPairRef.current.privateKey,
        peerPublicKey,
      });

      const encryptedRoomKey = await encryptRoomKeyForPeer({
        roomKey: roomKeyRef.current,
        wrappingKey,
      });

      socket.emit("e2ee:encrypted-room-key", {
        roomId,
        targetSocketId: peer.socketId,
        encryptedRoomKey,
      });

      sentRoomKeyToPeersRef.current.add(peer.socketId);
    },
    [isHost, roomId],
  );

  useEffect(() => {
    if (!enabled) {
      reset();
      setStatus("off");
      return;
    }

    if (!roomId || !isJoined) {
      return;
    }

    const activeRoomId = roomId;

    let cancelled = false;

    async function startExchange() {
      try {
        setStatus("preparing");
        setError(null);

        const keyPair = await generateParticipantKeyPair();
        const publicKeyJwk = await exportParticipantPublicKey(
          keyPair.publicKey,
        );

        if (cancelled) return;

        keyPairRef.current = keyPair;
        publicKeyJwkRef.current = publicKeyJwk;

        if (isHost) {
          const roomKey = await generateRoomCryptoKey();

          if (cancelled) return;

          roomKeyRef.current = roomKey;
          setCryptoKey(roomKey);
          setStatus("ready");
        } else {
          setStatus("waiting-for-host");
        }

        if (isHost) {
          const storedRoomKey = getStoredRoomKey(activeRoomId);
          const roomKey = storedRoomKey
            ? await importRoomCryptoKey(storedRoomKey)
            : await generateRoomCryptoKey();

          if (!storedRoomKey) {
            const exportedRoomKey = await exportRoomCryptoKey(roomKey);
            saveStoredRoomKey(activeRoomId, exportedRoomKey);
          }

          if (cancelled) return;

          roomKeyRef.current = roomKey;
          setCryptoKey(roomKey);
          setStatus("ready");
        } else {
          const storedRoomKey = getStoredRoomKey(activeRoomId);

          if (storedRoomKey) {
            const roomKey = await importRoomCryptoKey(storedRoomKey);

            if (cancelled) return;

            roomKeyRef.current = roomKey;
            setCryptoKey(roomKey);
            setStatus("ready");
          } else {
            setStatus("waiting-for-host");
          }
        }

        socket.emit("e2ee:public-key", {
          roomId: activeRoomId,
          username,
          publicKeyJwk,
        });

        if (!isHost) {
          socket.emit("e2ee:request-room-key", {
            roomId: activeRoomId,
          });
        }
      } catch (exchangeError) {
        console.error("E2EE key exchange failed:", exchangeError);
        setStatus("error");
        setError("Failed to prepare encrypted meeting keys.");
      }
    }

    void startExchange();

    return () => {
      cancelled = true;
    };
  }, [enabled, isHost, isJoined, reset, roomId, username]);

  useEffect(() => {
    if (!enabled || !roomId) return;

    const activeRoomId = roomId;

    function handlePeerPublicKey(peer: PeerPublicKeyPayload) {
      peerPublicKeysRef.current.set(peer.socketId, peer);

      const pendingEncryptedRoomKey = pendingEncryptedRoomKeyRef.current;

      if (
        !isHost &&
        pendingEncryptedRoomKey &&
        pendingEncryptedRoomKey.senderSocketId === peer.socketId
      ) {
        void handleEncryptedRoomKey({
          roomId: activeRoomId,
          senderSocketId: pendingEncryptedRoomKey.senderSocketId,
          encryptedRoomKey: pendingEncryptedRoomKey.encryptedRoomKey,
        });

        return;
      }

      if (isHost) {
        void sendRoomKeyToPeer(peer).catch((sendError) => {
          console.error("Failed to send encrypted room key:", sendError);
        });
      }
    }

    function handleRoomKeyRequested(payload: {
      roomId: string;
      requesterSocketId: string;
      username: string;
    }) {
      if (!isHost) return;
      if (payload.roomId !== activeRoomId) return;
     
      const peer = peerPublicKeysRef.current.get(payload.requesterSocketId);

      if (!peer) {
        return;
      }

      void sendRoomKeyToPeer(peer).catch((sendError) => {
        console.error("Failed to answer E2EE room key request:", sendError);
      });
    }

    async function handleEncryptedRoomKey(payload: {
      roomId: string;
      senderSocketId: string;
      encryptedRoomKey: E2eeEncryptedRoomKeyPayload;
    }) {
      if (payload.roomId !== roomId) return;

      if (isHost) return;
      if (!keyPairRef.current) return;

      try {
        const hostPublicKey = peerPublicKeysRef.current.get(
          payload.senderSocketId,
        );

        if (!hostPublicKey) {
          pendingEncryptedRoomKeyRef.current = {
            senderSocketId: payload.senderSocketId,
            encryptedRoomKey: payload.encryptedRoomKey,
          };

          setStatus("waiting-for-host");
          return;
        }

        const importedHostPublicKey = await importParticipantPublicKey(
          hostPublicKey.publicKeyJwk,
        );

        const wrappingKey = await deriveWrappingKey({
          privateKey: keyPairRef.current.privateKey,
          peerPublicKey: importedHostPublicKey,
        });

        const roomKey = await decryptRoomKeyFromHost({
          encryptedRoomKey: payload.encryptedRoomKey,
          wrappingKey,
        });

        const exportedRoomKey = await exportRoomCryptoKey(roomKey);
        saveStoredRoomKey(roomId, exportedRoomKey);
        roomKeyRef.current = roomKey;
        setCryptoKey(roomKey);
        setStatus("ready");
        setError(null);
        pendingEncryptedRoomKeyRef.current = null;
      } catch (decryptError) {
        console.error("Failed to decrypt E2EE room key:", decryptError);
        setStatus("error");
        setError("Failed to decrypt encrypted meeting key.");
      }
    }

    function handleE2eeError(payload: { message: string }) {
      setStatus("error");
      setError(payload.message);
    }

    function handlePeerLeft(payload: { socketId: string }) {
      peerPublicKeysRef.current.delete(payload.socketId);
      sentRoomKeyToPeersRef.current.delete(payload.socketId);
    }

    socket.on("e2ee:peer-public-key", handlePeerPublicKey);
    socket.on("e2ee:room-key-requested", handleRoomKeyRequested);
    socket.on("e2ee:encrypted-room-key", handleEncryptedRoomKey);
    socket.on("e2ee:error", handleE2eeError);
    socket.on("e2ee:peer-left", handlePeerLeft);

    return () => {
      socket.off("e2ee:peer-public-key", handlePeerPublicKey);
      socket.off("e2ee:room-key-requested", handleRoomKeyRequested);
      socket.off("e2ee:encrypted-room-key", handleEncryptedRoomKey);
      socket.off("e2ee:error", handleE2eeError);
      socket.off("e2ee:peer-left", handlePeerLeft);
    };
  }, [enabled, isHost, roomId, sendRoomKeyToPeer]);

  return {
    cryptoKey,
    status,
    error,
    isReady: !enabled || status === "ready",
    reset,
  };
}
