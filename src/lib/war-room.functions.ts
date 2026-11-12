// Public, read-only War Room feed (spectators need no login).
import { createServerFn } from "@tanstack/react-start";

export const getWarRoomFn = createServerFn({ method: "GET" }).handler(async () => {
  const { warRoomSnapshot } = await import("@/lib/war-room/snapshot.server");
  return warRoomSnapshot();
});
