import type { Meeting } from "../services/meetingApi";

export function getMeetingUrl(roomId: string) {
  return `${window.location.origin}/room/${roomId}`;
}

export function createInviteMessage(meeting: Meeting) {
  const title = meeting.title || "Meetly Meeting";
  const meetingUrl = getMeetingUrl(meeting.roomId);

  return [
    `You're invited to: ${title}`,
    "",
    `Join link: ${meetingUrl}`,
    `Passcode: ${meeting.passcode}`,
  ].join("\n");
}

export async function copyToClipboard(value: string) {
  await navigator.clipboard.writeText(value);
}
