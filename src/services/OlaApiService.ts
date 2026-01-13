/**
 * Ola Maps API Service
 * 
 * Documentation: https://maps.olakrutrim.com/docs
 * 
 * This service integrates with Ola Maps Roads API for:
 * - Speed Limits: Get speed limit for a road segment
 * - Snap to Road: Match GPS coordinates to road network
 */

// API Configuration
const OLA_API_KEY = import.meta.env.VITE_OLA_API_KEY || '';
const OLA_API_BASE = 'https://api.olamaps.io';

interface SpeedLimitResponse {
    speedLimit: number;
    roadName: string;
    roadType: string;
}

interface SnapToRoadResponse {
    snappedPoints: Array<{
        location: {
            latitude: number;
            longitude: number;
        };
        originalIndex: number;
        placeId: string;
    }>;
}

/**
 * Get speed limit for a specific location
 * Uses Ola Maps Roads API - Speed Limits endpoint
 */
export async function getSpeedLimit(
    lat: number,
    lng: number
): Promise<SpeedLimitResponse | null> {
    // If no API key configured, return mock data
    if (!OLA_API_KEY) {
        console.warn('Ola Maps API key not configured. Using mock data.');
        return getMockSpeedLimitResponse(lat, lng);
    }

    try {
        // Ola API uses api_key as query parameter
        const url = `${OLA_API_BASE}/routing/v1/speedLimits?path=${lat},${lng}&api_key=${OLA_API_KEY}`;

        const response = await fetch(url, {
            headers: {
                'X-Request-Id': crypto.randomUUID(),
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Ola API error:', response.status, errorText);
            // Fall back to mock data on API error
            return getMockSpeedLimitResponse(lat, lng);
        }

        const data = await response.json();

        // Parse the response based on Ola's API structure
        if (data.speedLimits && data.speedLimits.length > 0) {
            const limit = data.speedLimits[0];
            return {
                speedLimit: limit.speedLimit || limit.speed_limit || 50,
                roadName: limit.roadName || limit.road_name || 'Unknown Road',
                roadType: limit.roadType || limit.road_type || 'local',
            };
        }

        // No speed limit data, use mock
        return getMockSpeedLimitResponse(lat, lng);
    } catch (error) {
        console.error('Failed to fetch speed limit from Ola:', error);
        return getMockSpeedLimitResponse(lat, lng);
    }
}

/**
 * Snap GPS coordinates to nearest road
 * Useful for getting more accurate road position
 */
export async function snapToRoad(
    points: Array<{ lat: number; lng: number }>
): Promise<SnapToRoadResponse | null> {
    if (!OLA_API_KEY) {
        console.warn('Ola Maps API key not configured.');
        return null;
    }

    try {
        const path = points.map(p => `${p.lat},${p.lng}`).join('|');
        const url = `${OLA_API_BASE}/routing/v1/snapToRoad?path=${path}&api_key=${OLA_API_KEY}`;

        const response = await fetch(url, {
            headers: {
                'X-Request-Id': crypto.randomUUID(),
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Ola API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to snap to road:', error);
        return null;
    }
}

/**
 * Get Ola Maps tile URL for MapLibre
 * Ola provides vector tiles compatible with MapLibre GL JS
 */
export function getOlaMapStyle(): string {
    if (OLA_API_KEY) {
        // Ola Maps vector tile style
        return `https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json?api_key=${OLA_API_KEY}`;
    }
    // Fallback to CARTO tiles
    return 'https://demotiles.maplibre.org/style.json';
}

// Mock response for development/fallback
function getMockSpeedLimitResponse(lat: number, lng: number): SpeedLimitResponse {
    // Check if in Delhi region
    const isInDelhi = lat >= 28.4 && lat <= 28.9 && lng >= 76.8 && lng <= 77.5;

    if (isInDelhi) {
        // Simulate different road types based on coordinates
        const seed = Math.abs(Math.sin(lat * 1000 + lng * 1000));

        if (seed > 0.8) {
            return { speedLimit: 80, roadName: 'National Highway 48', roadType: 'highway' };
        } else if (seed > 0.6) {
            return { speedLimit: 60, roadName: 'Ring Road', roadType: 'arterial' };
        } else if (seed > 0.4) {
            return { speedLimit: 50, roadName: 'Outer Ring Road', roadType: 'arterial' };
        } else if (seed > 0.2) {
            return { speedLimit: 40, roadName: 'Sector Road', roadType: 'collector' };
        } else {
            return { speedLimit: 30, roadName: 'Local Street', roadType: 'local' };
        }
    }

    // Default for other areas
    return { speedLimit: 50, roadName: 'State Highway', roadType: 'highway' };
}

/**
 * Check if Ola Maps API is configured and working
 */
export function isOlaApiConfigured(): boolean {
    return Boolean(OLA_API_KEY);
}
