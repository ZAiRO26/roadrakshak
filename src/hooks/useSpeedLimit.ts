import { useEffect, useRef, useCallback } from 'react';
import { useGpsStore } from '../stores/gpsStore';
import { useAppStore } from '../stores/appStore';
import { calculateDistance } from './useGPS';
import { shouldAcceptSpeedLimit, type ValidationParams } from '../services/LogicEngine';

// Cache for speed limit to avoid excessive API calls
interface SpeedLimitCache {
    limit: number;
    roadName: string;
    roadType?: string;
    roadHeading?: number;
    lat: number;
    lng: number;
    timestamp: number;
}

const CACHE_TTL = 60000; // 60 seconds
const MIN_DISTANCE_THRESHOLD = 50; // 50 meters before new API call

export function useSpeedLimit() {
    const cacheRef = useRef<SpeedLimitCache | null>(null);
    const lastCheckPositionRef = useRef<{ lat: number; lng: number } | null>(null);
    const lastValidLimitRef = useRef<{ limit: number; roadName: string } | null>(null);

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
            // Fetch speed limit from OpenStreetMap via Nominatim reverse geocoding
            const osmData = await fetchOSMSpeedLimit(lat, lng);

            // Get current car state for validation
            const carHeading = useGpsStore.getState().heading;
            const carSpeed = useGpsStore.getState().speed;

            // Validate with LogicEngine before accepting
            const validationParams: ValidationParams = {
                carHeading,
                carSpeed,
                roadHeading: osmData.roadHeading,
                roadType: osmData.roadType,
                roadName: osmData.roadName,
            };

            const validation = shouldAcceptSpeedLimit(validationParams);

            if (!validation.isValid) {
                console.log('[useSpeedLimit] Rejected limit, using fallback:', validation.reason);

                // Use last valid limit as fallback
                if (lastValidLimitRef.current) {
                    return {
                        ...lastValidLimitRef.current,
                        lat,
                        lng,
                        timestamp: Date.now(),
                    };
                }

                // No fallback available - use a safe default
                return null;
            }

            // Validation passed - accept this speed limit
            const result: SpeedLimitCache = {
                limit: osmData.limit,
                roadName: osmData.roadName,
                roadType: osmData.roadType,
                roadHeading: osmData.roadHeading,
                lat,
                lng,
                timestamp: Date.now(),
            };

            cacheRef.current = result;
            lastValidLimitRef.current = { limit: result.limit, roadName: result.roadName };
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

/**
 * Fetch speed limit and road info from OpenStreetMap
 */
async function fetchOSMSpeedLimit(lat: number, lng: number): Promise<{
    limit: number;
    roadName: string;
    roadType?: string;
    roadHeading?: number;
}> {
    try {
        // Use Nominatim for reverse geocoding
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'ZairoMaps/1.0 (contact@example.com)',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Nominatim error: ${response.status}`);
        }

        const data = await response.json();

        // Extract road info
        const roadName = data.address?.road ||
            data.address?.highway ||
            data.display_name?.split(',')[0] ||
            'Unknown Road';

        const roadType = data.type || data.class || undefined;

        // Determine speed limit based on road type and name
        const limit = inferSpeedLimit(roadName, roadType);

        return {
            limit,
            roadName,
            roadType,
            roadHeading: undefined, // Nominatim doesn't provide heading
        };
    } catch (error) {
        console.error('OSM fetch failed:', error);
        // Return fallback based on mock logic
        return getMockSpeedLimit(lat, lng);
    }
}

/**
 * Infer speed limit from road characteristics
 */
function inferSpeedLimit(roadName: string, roadType: string | undefined): number {
    const nameLower = roadName.toLowerCase();
    const typeLower = (roadType || '').toLowerCase();

    // Expressways / National Highways
    if (nameLower.includes('expressway') ||
        nameLower.includes('nh-') ||
        nameLower.includes('national highway') ||
        typeLower.includes('motorway')) {
        return 100;
    }

    // State Highways
    if (nameLower.includes('sh-') ||
        nameLower.includes('state highway') ||
        typeLower.includes('trunk')) {
        return 80;
    }

    // Main roads / Ring roads
    if (nameLower.includes('ring road') ||
        nameLower.includes('outer ring') ||
        nameLower.includes('inner ring') ||
        typeLower.includes('primary')) {
        return 60;
    }

    // Major city roads
    if (nameLower.includes('marg') ||
        nameLower.includes('road') ||
        typeLower.includes('secondary') ||
        typeLower.includes('tertiary')) {
        return 50;
    }

    // Service roads
    if (nameLower.includes('service') ||
        typeLower.includes('service')) {
        return 30;
    }

    // Residential
    if (typeLower.includes('residential') ||
        typeLower.includes('living_street')) {
        return 30;
    }

    // Default city speed
    return 40;
}

/**
 * Mock speed limit function - fallback when API fails
 */
function getMockSpeedLimit(lat: number, lng: number): {
    limit: number;
    roadName: string;
    roadType?: string;
    roadHeading?: number;
} {
    // Delhi coordinates range approximately: 28.4-28.9 lat, 76.8-77.4 lng
    const isInDelhi = lat >= 28.4 && lat <= 28.9 && lng >= 76.8 && lng <= 77.4;

    if (isInDelhi) {
        const roadIndex = Math.floor((lat * 100 + lng * 100) % 5);
        const roads = [
            { limit: 80, roadName: 'NH-48 (Delhi-Gurugram Expressway)', roadType: 'trunk' },
            { limit: 60, roadName: 'Ring Road', roadType: 'primary' },
            { limit: 50, roadName: 'Outer Ring Road', roadType: 'secondary' },
            { limit: 40, roadName: 'Mathura Road', roadType: 'tertiary' },
            { limit: 30, roadName: 'Local Road', roadType: 'residential' },
        ];
        return roads[roadIndex];
    }

    return { limit: 50, roadName: 'State Highway', roadType: 'secondary' };
}

/**
 * Fetch road speed limit for a specific location
 * Used for auto-filling speed limit when adding new cameras
 * @returns The speed limit in km/h or null if unavailable
 */
export async function fetchRoadLimit(lat: number, lng: number): Promise<number | null> {
    try {
        const result = await fetchOSMSpeedLimit(lat, lng);
        console.log(`[fetchRoadLimit] Got speed limit ${result.limit} for (${lat}, ${lng}) on ${result.roadName}`);
        return result.limit;
    } catch (error) {
        console.error('[fetchRoadLimit] Failed to fetch:', error);
        return null;
    }
}
