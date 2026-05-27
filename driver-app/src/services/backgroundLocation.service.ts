/**
 * Background Location Service — background GPS stream for drivers.
 *
 * Uses expo-location + expo-task-manager for Android/iOS background location.
 * GPS data is sent to the WebSocket gateway every ~3 seconds.
 *
 * Architecture:
 *   expo-task-manager (background task)
 *     └── receives LocationObject
 *           └── emits driver:location to Socket.io
 *
 * In DEV_MODE: foreground-only (no real background registration).
 */
import * as Location    from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { io, Socket }   from 'socket.io-client';
import { API_BASE_URL } from '@cryptgo/shared';

export const BACKGROUND_LOCATION_TASK = 'CRYPTGO_DRIVER_LOCATION';

// Socket instance — shared between foreground and background
let _socket: Socket | null = null;
let _orderId: string | null = null;

/** Initialises the Socket.io connection (called on login) */
export function initDriverSocket(token: string) {
  if (_socket?.connected) return;
  _socket = io(API_BASE_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
  });
}

/** Closes the Socket.io connection (on logout / OFFLINE) */
export function destroyDriverSocket() {
  _socket?.disconnect();
  _socket = null;
}

/** Sets the active orderId for broadcast */
export function setActiveOrderId(orderId: string | null) {
  _orderId = orderId;
}

/** Emits position directly (foreground fallback) */
export function emitLocation(lat: number, lng: number) {
  _socket?.emit('driver:location', { lat, lng, orderId: _orderId ?? undefined });
}

// Background task definition
//
// expo-task-manager requires the definition to be at the top level of the file.

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

// Start / Stop background tracking

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
    timeInterval:         3_000,   // 3 seconds
    distanceInterval:     5,       // minimum 5m
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
