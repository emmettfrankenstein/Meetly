import type { RecordingConsumerInfo } from "./recording.types";

function getCodec(consumerInfo: RecordingConsumerInfo) {
  const codec = consumerInfo.consumer.rtpParameters.codecs[0];

  if (!codec) {
    throw new Error(`No codec found for consumer ${consumerInfo.consumerId}`);
  }

  return codec;
}

function getPayloadType(consumerInfo: RecordingConsumerInfo) {
  return getCodec(consumerInfo).payloadType;
}

function getCodecName(consumerInfo: RecordingConsumerInfo) {
  return getCodec(consumerInfo).mimeType.split("/")[1];
}

function getClockRate(consumerInfo: RecordingConsumerInfo) {
  return getCodec(consumerInfo).clockRate;
}

function getChannels(consumerInfo: RecordingConsumerInfo) {
  return getCodec(consumerInfo).channels;
}

function getFmtpLine(consumerInfo: RecordingConsumerInfo) {
  const codec = getCodec(consumerInfo);
  const parameters = codec.parameters || {};

  const entries = Object.entries(parameters);

  if (entries.length === 0) return null;

  const fmtpValue = entries.map(([key, value]) => `${key}=${value}`).join(";");

  return `a=fmtp:${codec.payloadType} ${fmtpValue}`;
}

function buildMediaSection(consumerInfo: RecordingConsumerInfo) {
  const payloadType = getPayloadType(consumerInfo);
  const codecName = getCodecName(consumerInfo);
  const clockRate = getClockRate(consumerInfo);
  const channels = getChannels(consumerInfo);

  const rtpmap =
    consumerInfo.kind === "audio" && channels
      ? `${payloadType} ${codecName}/${clockRate}/${channels}`
      : `${payloadType} ${codecName}/${clockRate}`;

  const lines = [
    `m=${consumerInfo.kind} ${consumerInfo.rtpPort} RTP/AVP ${payloadType}`,
    "c=IN IP4 127.0.0.1",
    `a=rtpmap:${rtpmap}`,
  ];

  const fmtpLine = getFmtpLine(consumerInfo);

  if (fmtpLine) {
    lines.push(fmtpLine);
  }

  lines.push("a=recvonly");

  return lines.join("\n");
}

export function createRecordingSdp(consumers: RecordingConsumerInfo[]) {
  const mediaSections = consumers.map(buildMediaSection).join("\n");

  return [
    "v=0",
    "o=- 0 0 IN IP4 127.0.0.1",
    "s=Meetly Recording",
    "c=IN IP4 127.0.0.1",
    "t=0 0",
    mediaSections,
    "",
  ].join("\n");
}
