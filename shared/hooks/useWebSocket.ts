/**
 * useWebSocket — Socket.io connection to the CrypGo backend.
 *
 * Authenticates with a JWT access token.
 * Returns:
 *   - socket    — the io() instance (or null when not connected)
 *   - connected — boolean status
 *   - joinOrder  — join a room for real-time tracking
 *   - leaveOrder — leave the room
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
  /** Dropoff arrival — passenger confirms completion */
  onOrderArrived?: (data: { orderId: string; driverId: string }) => void;
  /** Pickup arrival — driver is outside waiting for the passenger */
  onDriverAtPickup?: (data: { orderId: string; driverId: string }) => void;
  onError?: (data: { message: string }) => void;
}

export function useWebSocket({
  token,
  onDriverLocation,
  onOrderArrived,
  onDriverAtPickup,
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

    if (onDriverLocation) socket.on('driver:location',      onDriverLocation);
    if (onOrderArrived)   socket.on('order:arrived',        onOrderArrived);
    if (onDriverAtPickup) socket.on('order:driver-at-pickup', onDriverAtPickup);
    if (onError)          socket.on('error',                onError);

    return () => {
      socket.off('driver:location');
      socket.off('order:arrived');
      socket.off('order:driver-at-pickup');
      socket.off('error');
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /** Join the order room (receive GPS updates) */
  const joinOrder = useCallback((orderId: string) => {
    socketRef.current?.emit('join:order', orderId);
  }, []);

  /** Leave the room */
  const leaveOrder = useCallback((orderId: string) => {
    socketRef.current?.emit('leave:order', orderId);
  }, []);

  /**
   * Send GPS position (drivers only).
   * orderId is optional — if provided, the position is broadcast to the passenger.
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
