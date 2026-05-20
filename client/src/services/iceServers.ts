export function getIceServers(): RTCIceServer[] {
  const stunUrl =
    import.meta.env.VITE_STUN_URL || "stun:stun.l.google.com:19302";

  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

  const iceServers: RTCIceServer[] = [
    {
      urls: stunUrl,
    },
  ];

  if (turnUrl && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return iceServers;
}

export function getRtcConfiguration(): RTCConfiguration {
  return {
    iceServers: getIceServers(),
    // iceTransportPolicy: "relay",
  };
}
