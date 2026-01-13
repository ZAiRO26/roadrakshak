import { useEffect, useRef, useCallback } from 'react';
import { useGpsStore } from '../stores/gpsStore';
import { useAppStore } from '../stores/appStore';
import { calculateDistance } from './useGPS';

// Cache for speed limit to avoid excessive API calls
interface SpeedLimitCache {
    limit: number;
    roadName: string;
    lat: number;
    lng: number;
    timestamp: number;
}

const CACHE_TTL = 60000; // 60 seconds
const MIN_DISTANCE_THRESHOLD = 50; // 50 meters before new API call

export function useSpeedLimit() {
    const cacheRef = useRef<SpeedLimitCache | null>(null);
    const lastCheckPositionRef = useRef<{ lat: number; lng: number } | null>(null);

    const { latitude, longitude } = useGpsStore();
    const { currentSpeedLimit, currentRoadName, setSpeedLimit } = useAppStore();

    const fetchSpeedLimit = useCallback(async (lat: number, lng: number) => {
        // Check cache first
        if (cacheRef.current) {
            const { timestamp, lat: cachedLat, lng: cachedLng } = cacheRef.current;
            const distance = calculateDistance(lat, lng, cachedLat, cachedLng);
            const age = Date.now() - timestamp;

            if (age < CACHE_TTL && distance < MIN_DISTANCE_THRESHOLD) {
                return cacheRef.current;
            }
        }

        try {
            // TODO: Replace with actual Ola Maps API call when API key is available
            // For now, return mock data based on location patterns
            const mockLimit = getMockSpeedLimit(lat, lng);

            const result: SpeedLimitCache = {
                limit: mockLimit.limit,
                roadName: mockLimit.roadName,
                lat,
                lng,
                timestamp: Date.now(),
            };

            cacheRef.current = result;
            setSpeedLimit(result.limit, result.roadName);

            return result;
        } catch (error) {
            console.error('Failed to fetch speed limit:', error);
            return null;
        }
    }, [setSpeedLimit]);

    // Check if we should fetch new speed limit data
    useEffect(() => {
        if (latitude === null || longitude === null) return;

        const shouldFetch = () => {
            if (!lastCheckPositionRef.current) return true;

            const distance = calculateDistance(
                latitude,
                longitude,
                lastCheckPositionRef.current.lat,
                lastCheckPositionRef.current.lng
            );

            return distance >= MIN_DISTANCE_THRESHOLD;
        };

        if (shouldFetch()) {
            lastCheckPositionRef.current = { lat: latitude, lng: longitude };
            fetchSpeedLimit(latitude, longitude);
        }
    }, [latitude, longitude, fetchSpeedLimit]);

    return {
        speedLimit: currentSpeedLimit,
        roadName: currentRoadName,
        refetch: () => {
            if (latitude !== null && longitude !== null) {
                lastCheckPositionRef.current = null;
                fetchSpeedLimit(latitude, longitude);
            }
        },
    };
}

// Mock speed limit function - will be replaced with actual Ola API
function getMockSpeedLimit(lat: number, lng: number): { limit: number; roadName: string } {
    // Delhi coordinates range approximately: 28.4-28.9 lat, 76.8-77.4 lng
    const isInDelhi = lat >= 28.4 && lat <= 28.9 && lng >= 76.8 && lng <= 77.4;

    if (isInDelhi) {
        // Simulate different road types based on coordinate patterns
        const roadIndex = Math.floor((lat * 100 + lng * 100) % 5);
        const roads = [
            { limit: 80, roadName: 'NH-48 (Delhi-Gurugram Expressway)' },
            { limit: 60, roadName: 'Ring Road' },
            { limit: 50, roadName: 'Outer Ring Road' },
            { limit: 40, roadName: 'Mathura Road' },
            { limit: 30, roadName: 'Local Road' },
        ];
        return roads[roadIndex];
    }

    // Default for other areas
    return { limit: 50, roadName: 'State Highway' };
}
