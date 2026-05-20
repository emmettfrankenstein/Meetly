import dgram from "dgram";
import type { types } from "mediasoup";
import { getRoomProducers, getSfuRoom } from "../sfu/sfu.roomStore";
import type { RecordingConsumerInfo } from "./recording.types";

import { selectProducersForRecording } from "./recording.policy";
import type { RecordingProducerPolicy } from "./recording.types";

function getRandomPort(min = 50000, max = 59999) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function reserveUdpPort() {
  return new Promise<number>((resolve, reject) => {
    const socket = dgram.createSocket("udp4");

    socket.once("error", (error) => {
      socket.close();
      reject(error);
    });

    socket.bind(getRandomPort(), "127.0.0.1", () => {
      const address = socket.address();

      if (typeof address === "string") {
        socket.close();
        reject(new Error("Unexpected UDP address format"));
        return;
      }

      const port = address.port;

      socket.close(() => {
        resolve(port);
      });
    });
  });
}

export async function createRecordingConsumerForProducer(input: {
  roomId: string;
  producer: types.Producer;
}) {
  const room = getSfuRoom(input.roomId);

  if (!room) {
    throw new Error("SFU room not found");
  }

  const rtpPort = await reserveUdpPort();

  const transport = await room.router.createPlainTransport({
    listenIp: {
      ip: "127.0.0.1",
    },
    rtcpMux: true,
    comedia: false,
  });

  await transport.connect({
    ip: "127.0.0.1",
    port: rtpPort,
  });

  const consumer = await transport.consume({
    producerId: input.producer.id,
    rtpCapabilities: room.router.rtpCapabilities,
    paused: true,
  });

  const info: RecordingConsumerInfo = {
    producerId: input.producer.id,
    consumerId: consumer.id,
    kind: consumer.kind,
    rtpPort,
    transport,
    consumer,
  };

  return info;
}

export async function createRecordingConsumersForRoom(
  roomId: string,
  policy: RecordingProducerPolicy,
) {
  //   const producers = getRoomProducers(roomId).filter(({ producer }) => {
  //     const appData = producer.appData as { mediaTag?: string } | undefined;

  //     return (
  //       producer.kind === "audio" ||
  //       (producer.kind === "video" && appData?.mediaTag !== "screen")
  //     );
  //   });

  const producers = selectProducersForRecording(roomId, policy);

  const consumers: RecordingConsumerInfo[] = [];

  for (const { producer } of producers) {
    const consumerInfo = await createRecordingConsumerForProducer({
      roomId,
      producer,
    });

    consumers.push(consumerInfo);
  }

  return consumers;
}

export async function resumeRecordingConsumers(
  consumers: RecordingConsumerInfo[],
) {
  for (const consumerInfo of consumers) {
    await consumerInfo.consumer.resume();
  }
}
