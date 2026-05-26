/**
 * useLocation — GPS локация на устройството.
 *
 * Обвива expo-location и предоставя:
 *   - currentLocation  — { lat, lng } | null
 *   - isTracking       — дали фоновото проследяване е активно
 *   - startTracking    — стартира GPS stream (за шофьори)
 *   - stopTracking     — спира GPS stream
 *   - requestPermission — заявка на разрешения
 *
 * Geofencing (за пътници): haversineDistance() може да се използва
 * за проверка дали шофьорът е <30м от дестинацията.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as ExpoLocation from 'expo-location';

export interface Coordinates {
  lat: number;
  lng: number;
}

interface UseLocationOptions {
  /** Callback при всяко GPS обновление (само когато tracking е активен) */
  onUpdate?: (coords: Coordinates) => void;
  /** Интервал в ms (по подразбиране: 3000мс = 3с) */
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

  // ── Заявка на разрешения ──────────────────────────────────────

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const { status: fg } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (fg !== 'granted') {
      setHasPermission(false);
      return false;
    }
    // Фоново разрешение е нужно само за шофьори (Driver App)
    setHasPermission(true);
    return true;
  }, []);

  // ── Еднократно взимане на локацията ──────────────────────────

  const getCurrentPosition = useCallback(async (): Promise<Coordinates | null> => {
    if (!hasPermission) return null;
    const loc = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.High,
    });
    const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
    setCurrentLocation(coords);
    return coords;
  }, [hasPermission]);

  // ── Стартиране на GPS стрийм ──────────────────────────────────

  const startTracking = useCallback(async () => {
    if (!hasPermission || isTracking) return;

    watchRef.current = await ExpoLocation.watchPositionAsync(
      {
        accuracy: ExpoLocation.Accuracy.High,
        timeInterval: intervalMs,
        distanceInterval: 5, // минимум 5м промяна
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

  // ── Спиране на GPS стрийм ─────────────────────────────────────

  const stopTracking = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
    setIsTracking(false);
  }, []);

  // Автоматично почистване
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

// ── Haversine разстояние (метри) ──────────────────────────────────
// Използва се за geofencing проверка (<30м от дестинацията)

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
