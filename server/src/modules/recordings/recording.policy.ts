import type { types } from "mediasoup";
import { getRoomProducers } from "../sfu/sfu.roomStore";
import type { RecordingProducerPolicy } from "./recording.types";

type RoomProducerInfo = {
  producer: types.Producer;
  socketId: string;
  username: string;
  appData: types.AppData;
};

export const defaultRecordingPolicy: RecordingProducerPolicy = {
  includeAudio: true,
  includeCameraVideo: true,
  includeScreenShare: false,
  maxAudioTracks: 1,
  maxVideoTracks: 1,
};

function getMediaTag(producer: types.Producer) {
  const appData = producer.appData as { mediaTag?: string } | undefined;

  return appData?.mediaTag;
}

export function selectProducersForRecording(
  roomId: string,
  policy: RecordingProducerPolicy = defaultRecordingPolicy,
) {
  const producers = getRoomProducers(roomId) as RoomProducerInfo[];

  const audioProducers = producers.filter(({ producer }) => {
    return policy.includeAudio && producer.kind === "audio";
  });

  const cameraVideoProducers = producers.filter(({ producer }) => {
    return (
      policy.includeCameraVideo &&
      producer.kind === "video" &&
      getMediaTag(producer) !== "screen"
    );
  });

  const screenShareProducers = producers.filter(({ producer }) => {
    return (
      policy.includeScreenShare &&
      producer.kind === "video" &&
      getMediaTag(producer) === "screen"
    );
  });

  const selectedAudio = audioProducers.slice(0, policy.maxAudioTracks);

  let selectedVideo = cameraVideoProducers.slice(0, policy.maxVideoTracks);

  if (selectedVideo.length === 0 && policy.includeScreenShare) {
    selectedVideo = screenShareProducers.slice(0, policy.maxVideoTracks);
  }

  return [...selectedAudio, ...selectedVideo];
}

export function describeRecordingSelection(
  roomId: string,
  policy: RecordingProducerPolicy = defaultRecordingPolicy,
) {
  const selected = selectProducersForRecording(roomId, policy);

  return selected.map(({ producer, socketId, username }) => ({
    producerId: producer.id,
    socketId,
    username,
    kind: producer.kind,
    appData: producer.appData,
  }));
}
