import { useEffect, useRef, useCallback } from 'react';
import { useGpsStore } from '../stores/gpsStore';

interface UseGPSOptions {
    enableHighAccuracy?: boolean;
    maximumAge?: number;
    timeout?: number;
}

export function useGPS(options: UseGPSOptions = {}) {
    const watchIdRef = useRef<number | null>(null);
    const { updatePosition, setError, setTracking, isTracking } = useGpsStore();
    const { latitude, longitude, speed, heading, accuracy, error } = useGpsStore();

    const {
        enableHighAccuracy = true,
        maximumAge = 0,
        timeout = 10000,
    } = options;

    const startTracking = useCallback(() => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser');
            return;
        }

        if (watchIdRef.current !== null) {
            return; // Already tracking
        }

        const handleSuccess = (position: GeolocationPosition) => {
            updatePosition(position);
        };

        const handleError = (error: GeolocationPositionError) => {
            let message: string;
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    message = 'Location permission denied. Please enable GPS access.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    message = 'Location information unavailable.';
                    break;
                case error.TIMEOUT:
                    message = 'Location request timed out.';
                    break;
                default:
                    message = 'An unknown error occurred.';
            }
            setError(message);
        };

        watchIdRef.current = navigator.geolocation.watchPosition(
            handleSuccess,
            handleError,
            {
                enableHighAccuracy,
                maximumAge,
                timeout,
            }
        );

        setTracking(true);
    }, [enableHighAccuracy, maximumAge, timeout, updatePosition, setError, setTracking]);

    const stopTracking = useCallback(() => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
            setTracking(false);
        }
    }, [setTracking]);

    // Auto-start tracking on mount
    useEffect(() => {
        startTracking();
        return () => {
            stopTracking();
        };
    }, [startTracking, stopTracking]);

    return {
        latitude,
        longitude,
        speed,
        heading,
        accuracy,
        error,
        isTracking,
        startTracking,
        stopTracking,
    };
}

// Haversine distance calculation in meters
export function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}
