import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@gridpulse/shared';
import { SERVER_URL } from './api';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

export function getSocket(): TypedSocket {
  if (!socket) {
    socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    }) as TypedSocket;
  }
  return socket;
}

/** Reconnect the socket with a new login token (or none, after logout). */
export function setSocketToken(token: string | null): void {
  const s = getSocket();
  const current = (s.auth as { token?: string | null } | undefined)?.token ?? null;
  if (current === token) return;
  s.auth = { token };
  s.disconnect().connect();
}
