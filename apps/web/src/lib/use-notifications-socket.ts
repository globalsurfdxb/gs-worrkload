"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "@/store/auth-store";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** In mock mode there is no server to connect to — skip realtime entirely. */
const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

/**
 * Opens a Socket.io connection to the `/notifications` namespace for the
 * lifetime of the calling component and invokes `onNotification` whenever
 * the server emits a `"notification"` event.
 *
 * Defensive by design: if there's no access token, or the socket fails to
 * connect/authenticate, this quietly no-ops instead of throwing — realtime
 * pushes are a nice-to-have, not something that should crash the page.
 */
export function useNotificationsSocket(onNotification: (notification: unknown) => void): void {
  const callbackRef = useRef(onNotification);
  callbackRef.current = onNotification;

  useEffect(() => {
    // Mock mode: no socket.io server exists, so attempting a connection would
    // only spam the console with connection errors.
    if (USE_MOCK_DATA) return;

    const accessToken = useAuthStore.getState().tokens?.accessToken;
    if (!accessToken) return;

    let socket: Socket | undefined;

    try {
      socket = io(`${API_ORIGIN}/notifications`, {
        auth: { token: accessToken },
        transports: ["websocket", "polling"],
      });

      socket.on("notification", (notification: unknown) => {
        callbackRef.current(notification);
      });

      // Swallow connection/auth errors — no realtime updates, but no crash.
      socket.on("connect_error", () => {});
      socket.on("error", () => {});
    } catch {
      // socket.io-client threw synchronously (unlikely) — just skip realtime.
      return;
    }

    return () => {
      socket?.disconnect();
    };
  }, []);
}
