/**
 * Background Location Service — фонов GPS стрийм за шофьори.
 *
 * Използва expo-location + expo-task-manager за Android/iOS background location.
 * GPS данните се изпращат към WebSocket gateway-а на всеки ~3с.
 *
 * Архитектура:
 *   expo-task-manager (background task)
 *     └── получава LocationObject
 *           └── изпраща driver:location към Socket.io
 *
 * В DEV_MODE: foreground-only (без реална background регистрация).
 */
import * as Location    from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { io, Socket }   from 'socket.io-client';
import { API_BASE_URL } from '@cryptgo/shared';

export const BACKGROUND_LOCATION_TASK = 'CRYPTGO_DRIVER_LOCATION';

// Socket инстанция — споделена между foreground и background
let _socket: Socket | null = null;
let _orderId: string | null = null;

/** Инициализира Socket.io връзката (извиква се при логин) */
export function initDriverSocket(token: string) {
  if (_socket?.connected) return;
  _socket = io(API_BASE_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
  });
}

/** Затваря Socket.io връзката (при logout / OFFLINE) */
export function destroyDriverSocket() {
  _socket?.disconnect();
  _socket = null;
}

/** Задава активния orderId за broadcast */
export function setActiveOrderId(orderId: string | null) {
  _orderId = orderId;
}

/** Изпраща позиция директно (foreground fallback) */
export function emitLocation(lat: number, lng: number) {
  _socket?.emit('driver:location', { lat, lng, orderId: _orderId ?? undefined });
}

// ── Background task definition ──────────────────────────────────
//
// expo-task-manager изисква дефиницията да е на top-level на файла.

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>) => {
  if (error) {
    console.warn('[BG Location] Task error:', error.message);
    return;
  }
  const locations = data?.locations;
  if (!locations?.length) return;

  const { latitude: lat, longitude: lng } = locations[0].coords;
  emitLocation(lat, lng);
});

// ── Start / Stop background tracking ────────────────────────────

export async function startBackgroundTracking(): Promise<boolean> {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== 'granted') {
    console.warn('[BG Location] Background permission denied — using foreground');
    return false;
  }

  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (isRegistered) return true;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy:             Location.Accuracy.High,
    timeInterval:         3_000,   // 3 секунди
    distanceInterval:     5,       // минимум 5м
    foregroundService: {
      notificationTitle:  'CrypGo Driver активен',
      notificationBody:   'GPS стрийм работи — клиентите ви виждат',
      notificationColor:  '#1a1a2e',
    },
    pausesUpdatesAutomatically: false,
  });

  return true;
}

export async function stopBackgroundTracking(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}
