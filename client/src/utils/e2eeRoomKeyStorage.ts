const STORAGE_PREFIX = "meetly:e2ee-room-key:";

function getStorageKey(roomId: string) {
  return `${STORAGE_PREFIX}${roomId}`;
}

export function saveStoredRoomKey(roomId: string, rawKeyBase64: string) {
  sessionStorage.setItem(getStorageKey(roomId), rawKeyBase64);
}

export function getStoredRoomKey(roomId: string) {
  return sessionStorage.getItem(getStorageKey(roomId));
}

export function clearStoredRoomKey(roomId: string) {
  sessionStorage.removeItem(getStorageKey(roomId));
}
