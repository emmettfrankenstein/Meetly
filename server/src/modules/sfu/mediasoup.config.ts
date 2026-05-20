import type { types } from "mediasoup";
import { env } from "../../config/env";

const listenIp = env.MEDIASOUP_LISTEN_IP;
const announcedAddress =
  env.NODE_ENV === "production"
    ? env.MEDIASOUP_ANNOUNCED_IP
    : env.MEDIASOUP_ANNOUNCED_IP || "127.0.0.1";

const minPort = env.MEDIASOUP_MIN_PORT;
const maxPort = env.MEDIASOUP_MAX_PORT;

export const mediaCodecs: types.RouterRtpCodecCapability[] = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: {
      "x-google-start-bitrate": 1000,
    },
  },
];

export const webRtcTransportOptions: types.WebRtcTransportOptions = {
  listenInfos: [
    {
      protocol: "udp",
      ip: listenIp,
      announcedAddress,
      portRange: {
        min: minPort,
        max: maxPort,
      },
    },
    {
      protocol: "tcp",
      ip: listenIp,
      announcedAddress,
      portRange: {
        min: minPort,
        max: maxPort,
      },
    },
  ],
  enableUdp: true,
  enableTcp: true,
  preferUdp: true,
  initialAvailableOutgoingBitrate: 1_000_000,
};
