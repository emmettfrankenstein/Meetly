# Meetly Deployment Notes

## Required production environment variables

Server:

```env
NODE_ENV=production
PORT=4000

DATABASE_URL=postgresql://...
JWT_SECRET=<strong random secret, at least 32 chars>

CLIENT_URLS=https://your-frontend-domain.com

COOKIE_SECURE=true
COOKIE_SAME_SITE=none

MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=<public server IP or hostname>
MEDIASOUP_MIN_PORT=40000
MEDIASOUP_MAX_PORT=40100

RECORDINGS_DIR=/app/recordings
FFMPEG_PATH=ffmpeg
RECORDING_RETENTION_DAYS=30


```

Client:

```env
VITE_SERVER_URL=https://your-api-domain.com
VITE_MEDIA_MODE=sfu

```

## Required open ports
TCP 4000 for API/WebSocket
UDP/TCP 40000-40100 for mediasoup WebRTC transports
TCP/UDP 3478 for TURN
UDP 50000-50050 for TURN relay range
Production notes
Use HTTPS.
Use secure cookies.
Set MEDIASOUP_ANNOUNCED_IP to the public IP or reachable hostname.
Do not use 127.0.0.1 for mediasoup announced IP in production.
Store recordings in object storage for production.
E2EE rooms disable server-side recording.
