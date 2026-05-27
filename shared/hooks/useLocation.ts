/**
 * useLocation — Device GPS location.
 *
 * Wraps expo-location and provides:
 *   - currentLocation  — { lat, lng } | null
 *   - isTracking       — whether background tracking is active
 *   - startTracking    — starts the GPS stream (for drivers)
 *   - stopTracking     — stops the GPS stream
 *   - requestPermission — request permissions
 *
 * Geofencing (for passengers): haversineDistance() can be used
 * to check whether the driver is <30m from the destination.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as ExpoLocation from 'expo-location';

export interface Coordinates {
  lat: number;
  lng: number;
}

interface UseLocationOptions {
  /** Callback on every GPS update (only when tracking is active) */
  onUpdate?: (coords: Coordinates) => void;
  /** Interval in ms (default: 3000ms = 3s) */
  intervalMs?: number;
}

export function useLocation({
  onUpdate,
  intervalMs = 3_000,
}: UseLocationOptions = {}) {
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [isTracking, setIsTracking]           = useState(false);
  const [hasPermission, setHasPermission]     = useState(false);
  const watchRef = useRef<ExpoLocation.LocationSubscription | null>(null);

  // Request permissions

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const { status: fg } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (fg !== 'granted') {
      setHasPermission(false);
      return false;
    }
    // Background permission is only needed for drivers (Driver App)
    setHasPermission(true);
    return true;
  }, []);

  // One-time location fetch

  const getCurrentPosition = useCallback(async (): Promise<Coordinates | null> => {
    if (!hasPermission) return null;
    const loc = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.High,
    });
    const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
    setCurrentLocation(coords);
    return coords;
  }, [hasPermission]);

  // Start GPS stream

  const startTracking = useCallback(async () => {
    if (!hasPermission || isTracking) return;

    watchRef.current = await ExpoLocation.watchPositionAsync(
      {
        accuracy: ExpoLocation.Accuracy.High,
        timeInterval: intervalMs,
        distanceInterval: 5, // minimum 5m change
      },
      (location: ExpoLocation.LocationObject) => {
        const coords = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        };
        setCurrentLocation(coords);
        onUpdate?.(coords);
      },
    );

    setIsTracking(true);
  }, [hasPermission, isTracking, intervalMs, onUpdate]);

  // Stop GPS stream

  const stopTracking = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
    setIsTracking(false);
  }, []);

  // Automatic cleanup
  useEffect(() => () => { watchRef.current?.remove(); }, []);

  return {
    currentLocation,
    isTracking,
    hasPermission,
    requestPermission,
    getCurrentPosition,
    startTracking,
    stopTracking,
  };
}

// Haversine distance (metres)
// Used for geofencing check (<30m from destination)

export function haversineDistance(a: Coordinates, b: Coordinates): number {
  const R   = 6_371_000;
  const φ1  = (a.lat * Math.PI) / 180;
  const φ2  = (b.lat * Math.PI) / 180;
  const Δφ  = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ  = ((b.lng - a.lng) * Math.PI) / 180;
  const sin = Math.sin;
  const cos = Math.cos;
  const aa  = sin(Δφ / 2) ** 2 + cos(φ1) * cos(φ2) * sin(Δλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}
