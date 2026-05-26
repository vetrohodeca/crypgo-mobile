/**
 * useWebSocket — Socket.io връзка с CrypGo backend.
 *
 * Автентикира се с JWT access token.
 * Връща:
 *   - socket    — io() инстанцията (или null ако не е свързана)
 *   - connected — boolean статус
 *   - joinOrder  — влизане в стая за реално-времен tracking
 *   - leaveOrder — излизане от стаята
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../api/api.client';

interface UseWebSocketOptions {
  token: string | null;
  onDriverLocation?: (data: {
    driverId: string;
    lat: number;
    lng: number;
    timestamp: number;
  }) => void;
  onOrderArrived?: (data: { orderId: string; driverId: string }) => void;
  onError?: (data: { message: string }) => void;
}

export function useWebSocket({
  token,
  onDriverLocation,
  onOrderArrived,
  onError,
}: UseWebSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const socket = io(API_BASE_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    if (onDriverLocation) socket.on('driver:location', onDriverLocation);
    if (onOrderArrived)   socket.on('order:arrived',   onOrderArrived);
    if (onError)          socket.on('error',           onError);

    return () => {
      socket.off('driver:location');
      socket.off('order:arrived');
      socket.off('error');
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /** Влизане в стаята на поръчката (получаване на GPS updates) */
  const joinOrder = useCallback((orderId: string) => {
    socketRef.current?.emit('join:order', orderId);
  }, []);

  /** Излизане от стаята */
  const leaveOrder = useCallback((orderId: string) => {
    socketRef.current?.emit('leave:order', orderId);
  }, []);

  /**
   * Изпращане на GPS позиция (само за шофьори).
   * orderId е опционален — ако е зададен, позицията се broadcast-ва към пътника.
   */
  const sendDriverLocation = useCallback(
    (lat: number, lng: number, orderId?: string) => {
      socketRef.current?.emit('driver:location', { lat, lng, orderId });
    },
    [],
  );

  return {
    socket: socketRef.current,
    connected,
    joinOrder,
    leaveOrder,
    sendDriverLocation,
  };
}
