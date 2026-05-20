import type { types } from "mediasoup";

export type SfuPeerRole = "host" | "guest";

export type SfuPeer = {
  socketId: string;
  userId?: string;
  username: string;
  role: SfuPeerRole;

  sendTransport?: types.WebRtcTransport;
  recvTransport?: types.WebRtcTransport;

  producers: Map<string, types.Producer>;
  consumers: Map<string, types.Consumer>;
};

export type SfuRoom = {
  roomId: string;
  router: types.Router;
  peers: Map<string, SfuPeer>;
};
