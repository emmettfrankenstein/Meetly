import type { types } from "mediasoup";
import { mediaCodecs, webRtcTransportOptions } from "./mediasoup.config";
import { getNextWorker } from "./sfu.worker";
import type { SfuPeer, SfuRoom } from "./sfu.types";

const rooms = new Map<string, SfuRoom>();

export async function getOrCreateSfuRoom(roomId: string) {
  const existingRoom = rooms.get(roomId);

  if (existingRoom) {
    return existingRoom;
  }

  const worker = getNextWorker();

  const router = await worker.createRouter({
    mediaCodecs,
  });

  const room: SfuRoom = {
    roomId,
    router,
    peers: new Map(),
  };

  rooms.set(roomId, room);

  console.log(`SFU room created [roomId:${roomId}]`);

  return room;
}

export function getSfuRoom(roomId: string) {
  return rooms.get(roomId) || null;
}

export function getRoomProducers(roomId: string) {
  const room = rooms.get(roomId);

  if (!room) return [];

  return Array.from(room.peers.values()).flatMap((peer) =>
    Array.from(peer.producers.values()).map((producer) => ({
      producer,
      socketId: peer.socketId,
      username: peer.username,
      appData: producer.appData,
    })),
  );
}

export function addPeerToRoom(input: {
  room: SfuRoom;
  socketId: string;
  userId?: string;
  username: string;
  role: "host" | "guest";
}) {
  const peer: SfuPeer = {
    socketId: input.socketId,
    userId: input.userId,
    username: input.username,
    role: input.role,
    producers: new Map(),
    consumers: new Map(),
  };

  input.room.peers.set(input.socketId, peer);

  return peer;
}

export function getPeer(roomId: string, socketId: string) {
  const room = getSfuRoom(roomId);

  if (!room) return null;

  return room.peers.get(socketId) || null;
}

export async function createWebRtcTransport(router: types.Router) {
  const transport = await router.createWebRtcTransport(webRtcTransportOptions);

  transport.on("icestatechange", (iceState) => {
    console.log("SFU transport ICE state:", {
      transportId: transport.id,
      iceState,
    });
  });

  transport.on("dtlsstatechange", (dtlsState) => {
    console.log("SFU transport DTLS state:", {
      transportId: transport.id,
      dtlsState,
    });

    if (dtlsState === "closed") {
      transport.close();
    }
  });
  return transport;
}

export function serializeWebRtcTransport(transport: types.WebRtcTransport) {
  console.log("Serialized SFU transport:", {
    transportId: transport.id,
    iceCandidates: transport.iceCandidates,
  });
  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  };
}

export function getExistingProducersForPeer(room: SfuRoom, socketId: string) {
  const producers: Array<{
    producerId: string;
    socketId: string;
    username: string;
    kind: types.MediaKind;
    appData: unknown;
  }> = [];

  room.peers.forEach((peer) => {
    if (peer.socketId === socketId) return;

    peer.producers.forEach((producer) => {
      producers.push({
        producerId: producer.id,
        socketId: peer.socketId,
        username: peer.username,
        kind: producer.kind,
        appData: producer.appData,
      });
    });
  });

  return producers;
}

export function removePeerFromRooms(
  socketId: string,
  onProducerClosed?: (input: {
    roomId: string;
    producerId: string;
    socketId: string;
  }) => void,
) {
  rooms.forEach((room, roomId) => {
    const peer = room.peers.get(socketId);

    if (!peer) return;

    peer.consumers.forEach((consumer) => consumer.close());
    // peer.producers.forEach((producer) => producer.close());
    peer.producers.forEach((producer) => {
      producer.close();

      onProducerClosed?.({
        roomId,
        producerId: producer.id,
        socketId,
      });
    });

    peer.sendTransport?.close();
    peer.recvTransport?.close();

    // room.peers.delete(socketId);

    // console.log(`SFU peer removed [socketId:${socketId}, roomId:${roomId}]`);
    room.peers.delete(socketId);

    console.log("SFU peer removed:", {
      roomId,
      socketId,
      remainingPeers: room.peers.size,
    });

    if (room.peers.size === 0) {
      room.router.close();
      rooms.delete(roomId);

      console.log(`SFU room closed [roomId:${roomId}]`);
    }
  });
}

export function closeExistingScreenShareProducer(
  roomId: string,
  exceptSocketId?: string,
) {
  const room = rooms.get(roomId);

  if (!room) return null;

  for (const peer of room.peers.values()) {
    if (peer.socketId === exceptSocketId) continue;

    for (const [producerId, producer] of peer.producers.entries()) {
      const appData = producer.appData as { mediaTag?: string };

      if (appData?.mediaTag === "screen") {
        producer.close();
        peer.producers.delete(producerId);

        return {
          producerId,
          socketId: peer.socketId,
        };
      }
    }
  }

  return null;
}
