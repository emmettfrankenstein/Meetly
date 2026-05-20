import type { Server, Socket } from "socket.io";
import type { types } from "mediasoup";
import {
  addPeerToRoom,
  createWebRtcTransport,
  getExistingProducersForPeer,
  getOrCreateSfuRoom,
  getPeer,
  removePeerFromRooms,
  serializeWebRtcTransport,
  closeExistingScreenShareProducer,
} from "./sfu.roomStore";

type Ack<T> = (response: T) => void;

type SfuError = {
  error: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown SFU error";
}

export function registerSfuSocketHandlers(io: Server, socket: Socket) {
  socket.on(
    "sfu:join-room",
    async (
      payload: {
        roomId: string;
        username: string;
        userId?: string;
        role?: "host" | "guest";
      },
      callback: Ack<
        | {
            routerRtpCapabilities: types.RtpCapabilities;
            existingProducers: ReturnType<typeof getExistingProducersForPeer>;
          }
        | SfuError
      >,
    ) => {
      try {
        const room = await getOrCreateSfuRoom(payload.roomId);

        addPeerToRoom({
          room,
          socketId: socket.id,
          userId: payload.userId,
          username: payload.username || "Anonymous",
          role: payload.role === "host" ? "host" : "guest",
        });

        socket.join(payload.roomId);

        const existingProducers = getExistingProducersForPeer(room, socket.id);

        callback({
          routerRtpCapabilities: room.router.rtpCapabilities,
          existingProducers,
        });

        console.log(
          `SFU peer joined [roomId:${payload.roomId}, socketId:${socket.id}]`,
        );
      } catch (error) {
        callback({
          error: getErrorMessage(error),
        });
      }
    },
  );

  socket.on(
    "sfu:create-transport",
    async (
      payload: {
        roomId: string;
        direction: "send" | "recv";
      },
      callback: Ack<ReturnType<typeof serializeWebRtcTransport> | SfuError>,
    ) => {
      try {
        const room = await getOrCreateSfuRoom(payload.roomId);
        const peer = getPeer(payload.roomId, socket.id);

        if (!peer) {
          callback({ error: "Peer not found in SFU room" });
          return;
        }

        const transport = await createWebRtcTransport(room.router);

        if (payload.direction === "send") {
          peer.sendTransport = transport;
        } else {
          peer.recvTransport = transport;
        }

        transport.on("dtlsstatechange", (dtlsState) => {
          if (dtlsState === "closed") {
            transport.close();
          }
        });

        callback(serializeWebRtcTransport(transport));
      } catch (error) {
        callback({
          error: getErrorMessage(error),
        });
      }
    },
  );

  socket.on(
    "sfu:connect-transport",
    async (
      payload: {
        roomId: string;
        transportId: string;
        dtlsParameters: types.DtlsParameters;
      },
      callback: Ack<{ connected: true } | SfuError>,
    ) => {
      try {
        const peer = getPeer(payload.roomId, socket.id);

        if (!peer) {
          callback({ error: "Peer not found" });
          return;
        }

        const transport =
          peer.sendTransport?.id === payload.transportId
            ? peer.sendTransport
            : peer.recvTransport?.id === payload.transportId
              ? peer.recvTransport
              : null;

        if (!transport) {
          callback({ error: "Transport not found" });
          return;
        }

        await transport.connect({
          dtlsParameters: payload.dtlsParameters,
        });

        callback({ connected: true });
      } catch (error) {
        callback({
          error: getErrorMessage(error),
        });
      }
    },
  );

  socket.on(
    "sfu:produce",
    async (
      payload: {
        roomId: string;
        transportId: string;
        kind: types.MediaKind;
        rtpParameters: types.RtpParameters;
        appData?: Record<string, unknown>;
      },
      callback: Ack<{ producerId: string } | SfuError>,
    ) => {
      try {
        const room = await getOrCreateSfuRoom(payload.roomId);
        const peer = getPeer(payload.roomId, socket.id);

        if (!peer || !peer.sendTransport) {
          callback({ error: "Send transport not found" });
          return;
        }

        if (peer.sendTransport.id !== payload.transportId) {
          callback({ error: "Invalid send transport" });
          return;
        }

        const appData = payload.appData as { mediaTag?: string } | undefined;

        if (appData?.mediaTag === "screen") {
          const closedScreenShare = closeExistingScreenShareProducer(
            payload.roomId,
            socket.id,
          );

          if (closedScreenShare) {
            socket.to(payload.roomId).emit("sfu:producer-closed", {
              producerId: closedScreenShare.producerId,
              socketId: closedScreenShare.socketId,
            });
          }
        }

        const producer = await peer.sendTransport.produce({
          kind: payload.kind,
          rtpParameters: payload.rtpParameters,
          appData: {
            socketId: socket.id,
            username: peer.username,
            ...(payload.appData || {}),
          },
        });

        peer.producers.set(producer.id, producer);

        producer.on("transportclose", () => {
          peer.producers.delete(producer.id);
        });

        callback({
          producerId: producer.id,
        });

        socket.to(payload.roomId).emit("sfu:new-producer", {
          producerId: producer.id,
          socketId: socket.id,
          username: peer.username,
          kind: producer.kind,
          appData: producer.appData,
        });

        console.log(
          `SFU producer created [roomId:${payload.roomId}, producerId:${producer.id}, kind:${producer.kind}]`,
        );
      } catch (error) {
        callback({
          error: getErrorMessage(error),
        });
      }
    },
  );

  socket.on(
    "sfu:consume",
    async (
      payload: {
        roomId: string;
        producerId: string;
        rtpCapabilities: types.RtpCapabilities;
      },
      callback: Ack<
        | {
            id: string;
            producerId: string;
            kind: types.MediaKind;
            rtpParameters: types.RtpParameters;
            appData?: types.AppData;
          }
        | SfuError
      >,
    ) => {
      try {
        const room = await getOrCreateSfuRoom(payload.roomId);
        const peer = getPeer(payload.roomId, socket.id);

        if (!peer || !peer.recvTransport) {
          callback({ error: "Receive transport not found" });
          return;
        }

        const canConsume = room.router.canConsume({
          producerId: payload.producerId,
          rtpCapabilities: payload.rtpCapabilities,
        });

        if (!canConsume) {
          callback({ error: "Client cannot consume this producer" });
          return;
        }

        const consumer = await peer.recvTransport.consume({
          producerId: payload.producerId,
          rtpCapabilities: payload.rtpCapabilities,
          //   paused: true,
          paused: false,
        });

        peer.consumers.set(consumer.id, consumer);

        consumer.on("transportclose", () => {
          peer.consumers.delete(consumer.id);
        });

        consumer.on("producerclose", () => {
          peer.consumers.delete(consumer.id);

          socket.emit("sfu:consumer-closed", {
            consumerId: consumer.id,
            producerId: payload.producerId,
          });
        });

        callback({
          id: consumer.id,
          producerId: payload.producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
          appData: consumer.appData || {},
        });
      } catch (error) {
        callback({
          error: getErrorMessage(error),
        });
      }
    },
  );

  socket.on(
    "sfu:resume-consumer",
    async (
      payload: {
        roomId: string;
        consumerId: string;
      },
      callback: Ack<{ resumed: true } | SfuError>,
    ) => {
      try {
        const peer = getPeer(payload.roomId, socket.id);

        if (!peer) {
          callback({ error: "Peer not found" });
          return;
        }

        const consumer = peer.consumers.get(payload.consumerId);

        if (!consumer) {
          callback({ error: "Consumer not found" });
          return;
        }

        if (consumer.paused) {
          await consumer.resume();
        }
        // await consumer.resume();

        console.log("SFU consumer resumed:", {
          roomId: payload.roomId,
          socketId: socket.id,
          consumerId: consumer.id,
          producerId: consumer.producerId,
          kind: consumer.kind,
          paused: consumer.paused,
        });

        callback({ resumed: true });
      } catch (error) {
        callback({
          error: getErrorMessage(error),
        });
      }
    },
  );

  socket.on(
    "sfu:close-producer",
    async (
      payload: {
        roomId: string;
        producerId: string;
      },
      callback: Ack<{ closed: true } | SfuError>,
    ) => {
      try {
        const peer = getPeer(payload.roomId, socket.id);

        if (!peer) {
          callback({ error: "Peer not found" });
          return;
        }

        const producer = peer.producers.get(payload.producerId);

        if (!producer) {
          callback({ error: "Producer not found" });
          return;
        }

        producer.close();
        peer.producers.delete(payload.producerId);

        socket.to(payload.roomId).emit("sfu:producer-closed", {
          producerId: payload.producerId,
          socketId: socket.id,
        });

        callback({ closed: true });
      } catch (error) {
        callback({
          error: getErrorMessage(error),
        });
      }
    },
  );

  socket.on(
    "sfu:pause-producer",
    async (
      payload: {
        roomId: string;
        producerId: string;
      },
      callback: Ack<{ paused: true } | SfuError>,
    ) => {
      try {
        const peer = getPeer(payload.roomId, socket.id);

        if (!peer) {
          callback({ error: "Peer not found" });
          return;
        }

        const producer = peer.producers.get(payload.producerId);

        if (!producer) {
          callback({ error: "Producer not found" });
          return;
        }

        await producer.pause();

        socket.to(payload.roomId).emit("sfu:producer-paused", {
          producerId: producer.id,
          socketId: socket.id,
          kind: producer.kind,
          appData: producer.appData,
        });

        callback({ paused: true });
      } catch (error) {
        callback({
          error: getErrorMessage(error),
        });
      }
    },
  );

  socket.on(
    "sfu:resume-producer",
    async (
      payload: {
        roomId: string;
        producerId: string;
      },
      callback: Ack<{ resumed: true } | SfuError>,
    ) => {
      try {
        const peer = getPeer(payload.roomId, socket.id);

        if (!peer) {
          callback({ error: "Peer not found" });
          return;
        }

        const producer = peer.producers.get(payload.producerId);

        if (!producer) {
          callback({ error: "Producer not found" });
          return;
        }

        await producer.resume();

        socket.to(payload.roomId).emit("sfu:producer-resumed", {
          producerId: producer.id,
          socketId: socket.id,
          kind: producer.kind,
          appData: producer.appData,
        });

        callback({ resumed: true });
      } catch (error) {
        callback({
          error: getErrorMessage(error),
        });
      }
    },
  );

  socket.on("disconnect", () => {
    // removePeerFromRooms(socket.id);
    removePeerFromRooms(socket.id, ({ roomId, producerId, socketId }) => {
      socket.to(roomId).emit("sfu:producer-closed", {
        producerId,
        socketId,
      });
    });
  });
}
