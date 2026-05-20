export const clientEnv = {
  serverUrl: import.meta.env.VITE_SERVER_URL || "http://localhost:4000",
  mediaMode: import.meta.env.VITE_MEDIA_MODE || "p2p",
  isDev: import.meta.env.DEV,
};

// # VITE_SERVER_URL=http://192.168.1.5:4000
// VITE_SERVER_URL=http://localhost:4000

// VITE_STUN_URL=stun:stun.l.google.com:19302

// # VITE_TURN_URL=turn:192.168.1.5:3478
// VITE_TURN_URL=turn:localhost:3478

// VITE_TURN_USERNAME=meetly_user
// VITE_TURN_CREDENTIAL=meetly_password

// # For mediasoup we use sfu
// VITE_MEDIA_MODE=sfu
// # For peer to peer
// # VITE_MEDIA_MODE=p2p
