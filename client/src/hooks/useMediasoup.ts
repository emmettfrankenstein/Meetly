import { useCallback, useEffect, useRef, useState } from "react";
import { Device } from "mediasoup-client";
import type { Consumer, Producer, Transport } from "mediasoup-client/types";
import { socket } from "../services/socket";
import type {
  ConsumeResponse,
  CreateTransportResponse,
  ExistingProducer,
  JoinSfuRoomResponse,
  ProduceResponse,
} from "../types/sfu";
import { hasSfuError } from "../types/sfu";

import {
  attachReceiverE2eeTransform,
  attachSenderE2eeTransform,
} from "../utils/e2eeTransform";
const DEBUG_SFU = import.meta.env.DEV;

function debugSfu(message: string, data?: unknown) {
  if (!DEBUG_SFU) return;

  if (data === undefined) {
    console.log(message);
    return;
  }

  console.log(message, data);
}

export type RemoteSfuStream = {
  peerSocketId: string;
  username: string;
  producerId: string;
  consumerId: string;
  kind: "audio" | "video";
  stream: MediaStream;
  appData?: unknown;
};

type ProducerMeta = {
  producer: Producer;
  mediaTag: "audio" | "video" | "screen";
};

type UseMediasoupOptions = {
  roomId: string;
  username: string;
  userId?: string;
  role: "host" | "guest";
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  isE2eeEnabled?: boolean;
  e2eeCryptoKey?: CryptoKey | null;
  // e2eeCryptoKey: e2eeExchange.cryptoKey;
};

type SfuHealth = "idle" | "connecting" | "connected" | "degraded" | "failed";

function emitWithAck<TResponse>(
  eventName: string,
  payload: unknown,
): Promise<TResponse> {
  return new Promise((resolve) => {
    socket.emit(eventName, payload, (response: TResponse) => {
      resolve(response);
    });
  });
}

export function useMediasoup({
  roomId,
  username,
  userId,
  role,
  localStreamRef,
  isE2eeEnabled,
  e2eeCryptoKey,
}: UseMediasoupOptions) {
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);

  const [sendTransportState, setSendTransportState] = useState("new");
  const [recvTransportState, setRecvTransportState] = useState("new");

  const producersRef = useRef<Map<string, ProducerMeta>>(new Map());
  const consumersRef = useRef<Map<string, Consumer>>(new Map());
  const e2eeCleanupRef = useRef<Array<() => void>>([]);
  const consumedProducerIdsRef = useRef<Set<string>>(new Set());

  const [remoteStreams, setRemoteStreams] = useState<RemoteSfuStream[]>([]);
  const [sfuStatus, setSfuStatus] = useState("SFU not connected");
  const [sfuHealth, setSfuHealth] = useState<SfuHealth>("idle");

  const [e2eeTransformStatus, setE2eeTransformStatus] = useState<
    "off" | "attaching" | "active" | "failed"
  >("off");

  const [localScreenShareProducerId, setLocalScreenShareProducerId] = useState<
    string | null
  >(null);

  const replaceProducerTrackByMediaTag = useCallback(
    async (mediaTag: "audio" | "video", newTrack: MediaStreamTrack) => {
      const entry = Array.from(producersRef.current.values()).find(
        (producerEntry) => producerEntry.mediaTag === mediaTag,
      );

      if (!entry) {
        throw new Error(`No ${mediaTag} producer found`);
      }

      await entry.producer.replaceTrack({
        track: newTrack,
      });

      if (entry.producer.paused) {
        await entry.producer.resume();
      }

      debugSfu("SFU producer track replaced:", {
        producerId: entry.producer.id,
        mediaTag,
        trackKind: newTrack.kind,
        label: newTrack.label,
        readyState: newTrack.readyState,
      });
    },
    [],
  );

  const createSendTransport = useCallback(async () => {
    const device = deviceRef.current;

    if (!device) {
      throw new Error("mediasoup Device not loaded");
    }

    const response = await emitWithAck<CreateTransportResponse>(
      "sfu:create-transport",
      {
        roomId,
        direction: "send",
      },
    );

    if (hasSfuError(response)) {
      throw new Error(response.error);
    }

    const transport = device.createSendTransport(response);

    transport.on("connectionstatechange", (state) => {
      debugSfu("SFU send transport state:", state);
      setSendTransportState(state);

      if (state === "connected") {
        setSfuHealth("connected");
      }

      if (state === "disconnected") {
        setSfuHealth("degraded");
        setSfuStatus("SFU send transport disconnected");
      }

      if (state === "failed" || state === "closed") {
        setSfuHealth("failed");
        setSfuStatus(`SFU send transport ${state}`);
      }
    });

    transport.on("connect", ({ dtlsParameters }, callback, errback) => {
      emitWithAck<{ connected: true } | { error: string }>(
        "sfu:connect-transport",
        {
          roomId,
          transportId: transport.id,
          dtlsParameters,
        },
      )
        .then((connectResponse) => {
          if (hasSfuError(connectResponse)) {
            errback(new Error(connectResponse.error));
            return;
          }

          callback();
        })
        .catch((error) => {
          errback(error instanceof Error ? error : new Error("Connect failed"));
        });
    });

    transport.on(
      "produce",
      ({ kind, rtpParameters, appData }, callback, errback) => {
        emitWithAck<ProduceResponse>("sfu:produce", {
          roomId,
          transportId: transport.id,
          kind,
          rtpParameters,
          appData,
        })
          .then((produceResponse) => {
            if (hasSfuError(produceResponse)) {
              errback(new Error(produceResponse.error));
              return;
            }

            callback({
              id: produceResponse.producerId,
            });
          })
          .catch((error) => {
            errback(
              error instanceof Error ? error : new Error("Produce failed"),
            );
          });
      },
    );

    sendTransportRef.current = transport;
    return transport;
  }, [roomId]);

  const createRecvTransport = useCallback(async () => {
    const device = deviceRef.current;

    if (!device) {
      throw new Error("mediasoup Device not loaded");
    }

    const response = await emitWithAck<CreateTransportResponse>(
      "sfu:create-transport",
      {
        roomId,
        direction: "recv",
      },
    );

    if (hasSfuError(response)) {
      throw new Error(response.error);
    }

    const transport = device.createRecvTransport(response);

    transport.on("connectionstatechange", (state) => {
      debugSfu("SFU recv transport state:", state);
      setRecvTransportState(state);

      if (state === "connected") {
        setSfuHealth("connected");
      }

      if (state === "disconnected") {
        setSfuHealth("degraded");
        setSfuStatus("SFU receive transport disconnected");
      }

      if (state === "failed" || state === "closed") {
        setSfuHealth("failed");
        setSfuStatus(`SFU receive transport ${state}`);
      }
    });

    transport.on("connect", ({ dtlsParameters }, callback, errback) => {
      emitWithAck<{ connected: true } | { error: string }>(
        "sfu:connect-transport",
        {
          roomId,
          transportId: transport.id,
          dtlsParameters,
        },
      )
        .then((connectResponse) => {
          if (hasSfuError(connectResponse)) {
            errback(new Error(connectResponse.error));
            return;
          }

          callback();
        })
        .catch((error) => {
          errback(error instanceof Error ? error : new Error("Connect failed"));
        });
    });

    recvTransportRef.current = transport;
    return transport;
  }, [roomId]);

  const consumeProducer = useCallback(
    async (producerInfo: ExistingProducer) => {
      if (consumedProducerIdsRef.current.has(producerInfo.producerId)) {
        debugSfu(
          "Skipping duplicate SFU producer consume:",
          producerInfo.producerId,
        );
        return;
      }

      consumedProducerIdsRef.current.add(producerInfo.producerId);

      try {
        const device = deviceRef.current;
        let recvTransport = recvTransportRef.current;

        if (!device) return;

        if (!recvTransport) {
          recvTransport = await createRecvTransport();
        }

        const response = await emitWithAck<ConsumeResponse>("sfu:consume", {
          roomId,
          producerId: producerInfo.producerId,
          rtpCapabilities: device.rtpCapabilities,
        });

        if (hasSfuError(response)) {
          setSfuStatus(response.error);
          consumedProducerIdsRef.current.delete(producerInfo.producerId);
          return;
        }

        const consumer = await recvTransport.consume({
          id: response.id,
          producerId: response.producerId,
          kind: response.kind,
          rtpParameters: response.rtpParameters,
          appData: response.appData ?? {},
        });

        if (isE2eeEnabled && e2eeCryptoKey && consumer.rtpReceiver) {
          try {
            setE2eeTransformStatus("attaching");

            const handle = await attachReceiverE2eeTransform({
              receiver: consumer.rtpReceiver,
              cryptoKey: e2eeCryptoKey,
            });

            e2eeCleanupRef.current.push(handle.cleanup);
            setE2eeTransformStatus("active");
          } catch (error) {
            console.error("Failed to attach E2EE receiver transform:", error);
            setE2eeTransformStatus("failed");
            throw error;
          }
        }

        consumersRef.current.set(consumer.id, consumer);

        const stream = new MediaStream([consumer.track]);

        consumer.track.onmute = () => {
          console.warn("Remote consumer track muted:", {
            consumerId: consumer.id,
            producerId: consumer.producerId,
            kind: consumer.kind,
          });
        };

        consumer.track.onunmute = () => {
          debugSfu("Remote consumer track unmuted:", {
            consumerId: consumer.id,
            producerId: consumer.producerId,
            kind: consumer.kind,
          });
        };

        setRemoteStreams((current) => {
          const alreadyExists = current.some(
            (item) => item.consumerId === consumer.id,
          );

          if (alreadyExists) return current;

          return [
            ...current,
            {
              peerSocketId: producerInfo.socketId,
              username: producerInfo.username,
              producerId: producerInfo.producerId,
              consumerId: consumer.id,
              kind: consumer.kind,
              stream,
              // appData: producerInfo.appData,
              appData: response.appData ?? producerInfo.appData,
            },
          ];
        });

        await emitWithAck<{ resumed: true } | { error: string }>(
          "sfu:resume-consumer",
          {
            roomId,
            consumerId: consumer.id,
          },
        );
      } catch (error) {
        consumedProducerIdsRef.current.delete(producerInfo.producerId);
        setSfuStatus(
          error instanceof Error ? error.message : "Failed to consume producer",
        );
      }
    },
    [createRecvTransport, e2eeCryptoKey, isE2eeEnabled, roomId],
  );

  const produceLocalTracks = useCallback(async () => {
    const localStream = localStreamRef.current;

    if (!localStream) {
      // throw new Error("Local stream not ready");
      setSfuStatus("Joined SFU without local media");
      return;
    }

    const tracks = localStream.getTracks().filter((track) => {
      return track.readyState === "live";
    });

    if (tracks.length === 0) {
      setSfuStatus("Joined SFU without active media tracks");
      return;
    }

    let sendTransport = sendTransportRef.current;

    if (!sendTransport) {
      sendTransport = await createSendTransport();
    }

    for (const track of tracks) {
      const producer = await sendTransport.produce({
        track,
        appData: {
          //   mediaTag: track.kind,
          mediaTag: track.kind === "audio" ? "audio" : "video",
        },
      });

      if (isE2eeEnabled && e2eeCryptoKey && producer.rtpSender) {
        setE2eeTransformStatus("attaching");
        const handle = await attachSenderE2eeTransform({
          sender: producer.rtpSender,
          cryptoKey: e2eeCryptoKey,
        });

        e2eeCleanupRef.current.push(handle.cleanup);
        setE2eeTransformStatus("active");
      }

      const mediaTag = track.kind === "audio" ? "audio" : "video";

      producersRef.current.set(producer.id, {
        producer,
        mediaTag,
      });

      // setLocalScreenShareProducerId(producer.id);
      setSfuStatus("Screen sharing");

      // Logging to check
      debugSfu("SFU local producer created:", {
        producerId: producer.id,
        kind: producer.kind,
        mediaTag: track.kind,
      });
    }
  }, [createSendTransport, e2eeCryptoKey, isE2eeEnabled, localStreamRef]);

  const joinSfuRoom = useCallback(async () => {
    try {
      setSfuHealth("connecting");

      setSfuStatus("Joining SFU room...");

      if (!socket.connected) {
        socket.connect();
      }

      const joinResponse = await emitWithAck<JoinSfuRoomResponse>(
        "sfu:join-room",
        {
          roomId,
          username,
          userId,
          role,
        },
      );

      if (hasSfuError(joinResponse)) {
        throw new Error(joinResponse.error);
      }

      const device = new Device();
      await device.load({
        routerRtpCapabilities: joinResponse.routerRtpCapabilities,
      });

      deviceRef.current = device;

      //   await createSendTransport();
      await createRecvTransport();
      await produceLocalTracks();

      for (const producer of joinResponse.existingProducers) {
        await consumeProducer(producer);
      }

      setSfuHealth("connected");

      setSfuStatus("SFU connected");
    } catch (error) {
      setSfuStatus(error instanceof Error ? error.message : "SFU join failed");
      setSfuHealth("failed");
    }
  }, [
    consumeProducer,
    createRecvTransport,
    createSendTransport,
    produceLocalTracks,
    role,
    roomId,
    userId,
    username,
  ]);

  const closeSfu = useCallback(() => {
    e2eeCleanupRef.current.forEach((cleanup) => cleanup());
    e2eeCleanupRef.current = [];

    consumersRef.current.forEach((consumer) => consumer.close());
    // producersRef.current.forEach((producer) => producer.close());
    producersRef.current.forEach(({ producer }) => producer.close());

    sendTransportRef.current?.close();
    recvTransportRef.current?.close();

    consumersRef.current.clear();
    producersRef.current.clear();
    consumedProducerIdsRef.current.clear();

    sendTransportRef.current = null;
    recvTransportRef.current = null;
    deviceRef.current = null;

    setRemoteStreams([]);
    setLocalScreenShareProducerId(null);
    setSfuStatus("SFU disconnected");
    setE2eeTransformStatus("off");
  }, []);

  const removeRemoteStreamByConsumerId = useCallback((consumerId: string) => {
    setRemoteStreams((current) =>
      current.filter((stream) => stream.consumerId !== consumerId),
    );

    const consumer = consumersRef.current.get(consumerId);
    consumer?.close();
    consumersRef.current.delete(consumerId);
  }, []);

  const removeRemoteStreamsByProducerId = useCallback((producerId: string) => {
    consumedProducerIdsRef.current.delete(producerId);

    setRemoteStreams((current) =>
      current.filter((stream) => stream.producerId !== producerId),
    );

    consumersRef.current.forEach((consumer, consumerId) => {
      if (consumer.producerId === producerId) {
        consumer.close();
        consumersRef.current.delete(consumerId);
      }
    });
  }, []);

  const markRemoteProducerPaused = useCallback((producerId: string) => {
    setRemoteStreams((current) =>
      current.map((remoteStream) => {
        if (remoteStream.producerId !== producerId) return remoteStream;

        remoteStream.stream.getTracks().forEach((track) => {
          track.enabled = false;
        });

        return remoteStream;
      }),
    );
  }, []);

  const markRemoteProducerResumed = useCallback((producerId: string) => {
    setRemoteStreams((current) =>
      current.map((remoteStream) => {
        if (remoteStream.producerId !== producerId) return remoteStream;

        remoteStream.stream.getTracks().forEach((track) => {
          track.enabled = true;
        });

        return remoteStream;
      }),
    );
  }, []);

  const reconnectSfu = useCallback(async () => {
    try {
      setSfuHealth("connecting");
      setSfuStatus("Reconnecting SFU media...");

      e2eeCleanupRef.current.forEach((cleanup) => cleanup());
      e2eeCleanupRef.current = [];

      consumersRef.current.forEach((consumer) => consumer.close());
      producersRef.current.forEach(({ producer }) => producer.close());

      sendTransportRef.current?.close();
      recvTransportRef.current?.close();

      consumersRef.current.clear();
      producersRef.current.clear();
      consumedProducerIdsRef.current.clear();

      sendTransportRef.current = null;
      recvTransportRef.current = null;
      deviceRef.current = null;

      setRemoteStreams([]);
      setLocalScreenShareProducerId(null);

      await joinSfuRoom();
    } catch (error) {
      setSfuHealth("failed");
      setSfuStatus(
        error instanceof Error ? error.message : "SFU reconnect failed",
      );
    }
  }, [joinSfuRoom]);

  useEffect(() => {
    function handleConsumerClosed(payload: { consumerId: string }) {
      removeRemoteStreamByConsumerId(payload.consumerId);
    }

    function handleProducerClosed(payload: { producerId: string }) {
      removeRemoteStreamsByProducerId(payload.producerId);
    }

    function handleProducerPaused(payload: { producerId: string }) {
      markRemoteProducerPaused(payload.producerId);
    }

    function handleProducerResumed(payload: { producerId: string }) {
      markRemoteProducerResumed(payload.producerId);
    }

    socket.on("sfu:consumer-closed", handleConsumerClosed);
    socket.on("sfu:producer-closed", handleProducerClosed);
    socket.on("sfu:producer-paused", handleProducerPaused);
    socket.on("sfu:producer-resumed", handleProducerResumed);

    return () => {
      socket.off("sfu:consumer-closed", handleConsumerClosed);
      socket.off("sfu:producer-closed", handleProducerClosed);
      socket.off("sfu:producer-paused", handleProducerPaused);
      socket.off("sfu:producer-resumed", handleProducerResumed);
    };
  }, [
    markRemoteProducerPaused,
    markRemoteProducerResumed,
    removeRemoteStreamByConsumerId,
    removeRemoteStreamsByProducerId,
  ]);

  const closeProducerByMediaTag = useCallback(
    async (mediaTag: "audio" | "video" | "screen") => {
      const matchingEntry = Array.from(producersRef.current.entries()).find(
        ([, value]) => value.mediaTag === mediaTag,
      );

      if (!matchingEntry) return;

      const [producerId, { producer }] = matchingEntry;

      producer.close();
      producersRef.current.delete(producerId);

      if (mediaTag === "screen") {
        setLocalScreenShareProducerId(null);
        setSfuStatus("SFU connected");
      }

      await emitWithAck<{ closed: true } | { error: string }>(
        "sfu:close-producer",
        {
          roomId,
          producerId,
        },
      );
    },
    [roomId],
  );

  const produceScreenTrack = useCallback(
    async (screenTrack: MediaStreamTrack) => {
      let sendTransport = sendTransportRef.current;

      if (!sendTransport) {
        sendTransport = await createSendTransport();
      }

      const producer = await sendTransport.produce({
        track: screenTrack,
        appData: {
          mediaTag: "screen",
        },
      });

      if (isE2eeEnabled && e2eeCryptoKey && producer.rtpSender) {
        const handle = await attachSenderE2eeTransform({
          sender: producer.rtpSender,
          cryptoKey: e2eeCryptoKey,
        });

        e2eeCleanupRef.current.push(handle.cleanup);
      }

      producersRef.current.set(producer.id, {
        producer,
        mediaTag: "screen",
      });

      screenTrack.onended = async () => {
        await closeProducerByMediaTag("screen");
      };

      return producer.id;
    },
    [
      createSendTransport,
      e2eeCryptoKey,
      isE2eeEnabled,
      closeProducerByMediaTag,
    ],
  );

  const setProducerPausedByMediaTag = useCallback(
    async (mediaTag: "audio" | "video", shouldPause: boolean) => {
      const matchingEntry = Array.from(producersRef.current.entries()).find(
        ([, value]) => value.mediaTag === mediaTag,
      );

      if (!matchingEntry) {
        console.warn(`No SFU producer found for ${mediaTag}`);
        return;
      }

      const [producerId, { producer }] = matchingEntry;

      debugSfu("SFU producer pause state changed:", {
        mediaTag,
        producerId,
        shouldPause,
      });

      if (shouldPause) {
        producer.pause();

        await emitWithAck<{ paused: true } | { error: string }>(
          "sfu:pause-producer",
          {
            roomId,
            producerId,
          },
        );

        return;
      }

      producer.resume();

      await emitWithAck<{ resumed: true } | { error: string }>(
        "sfu:resume-producer",
        {
          roomId,
          producerId,
        },
      );
    },
    [roomId],
  );

  return {
    sfuStatus,
    sfuHealth,
    sendTransportState,
    recvTransportState,
    e2eeTransformStatus,
    remoteStreams,
    joinSfuRoom,
    reconnectSfu,
    consumeProducer,
    closeSfu,
    removeRemoteStreamByConsumerId,
    produceScreenTrack,
    closeProducerByMediaTag,
    setProducerPausedByMediaTag,
    localScreenShareProducerId,
    replaceProducerTrackByMediaTag,
  };
}
