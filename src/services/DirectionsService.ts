/**
 * Ola Maps Directions API Service
 * 
 * Provides turn-by-turn navigation routing using Ola Maps Directions API
 */

const OLA_API_KEY = import.meta.env.VITE_OLA_API_KEY || '';
const OLA_API_BASE = 'https://api.olamaps.io';

export interface RouteStep {
    instruction: string;
    distance: number; // meters
    duration: number; // seconds
    maneuver: string;
    name: string;
}

export interface RouteInfo {
    distance: number; // total meters
    duration: number; // total seconds
    geometry: GeoJSON.LineString;
    steps: RouteStep[];
}

export interface DirectionsResponse {
    routes: RouteInfo[];
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
}

/**
 * Get directions between two points
 */
export async function getDirections(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    waypoints?: Array<{ lat: number; lng: number }>
): Promise<DirectionsResponse | null> {
    if (!OLA_API_KEY) {
        console.warn('Ola Maps API key not configured. Cannot get directions.');
        return null;
    }

    try {
        // Build waypoints string if provided
        let waypointsParam = '';
        if (waypoints && waypoints.length > 0) {
            waypointsParam = `&waypoints=${waypoints.map(w => `${w.lat},${w.lng}`).join('|')}`;
        }

        const url = `${OLA_API_BASE}/routing/v1/directions?` +
            `origin=${origin.lat},${origin.lng}` +
            `&destination=${destination.lat},${destination.lng}` +
            waypointsParam +
            `&mode=driving` +
            `&alternatives=false` +
            `&steps=true` +
            `&overview=full` +
            `&language=en` +
            `&api_key=${OLA_API_KEY}`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'X-Request-Id': crypto.randomUUID(),
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Directions API error:', response.status, errorText);
            return null;
        }

        const data = await response.json();

        // Parse Ola's response format
        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];

            return {
                routes: [{
                    distance: route.distance || route.legs?.reduce((sum: number, leg: { distance: number }) => sum + leg.distance, 0) || 0,
                    duration: route.duration || route.legs?.reduce((sum: number, leg: { duration: number }) => sum + leg.duration, 0) || 0,
                    geometry: decodePolyline(route.geometry || route.overview_polyline?.points),
                    steps: parseSteps(route.legs || []),
                }],
                origin,
                destination,
            };
        }

        return null;
    } catch (error) {
        console.error('Failed to get directions:', error);
        return null;
    }
}

/**
 * Decode polyline string to GeoJSON LineString
 */
function decodePolyline(encoded: string): GeoJSON.LineString {
    if (!encoded) {
        return { type: 'LineString', coordinates: [] };
    }

    const coordinates: [number, number][] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
        let shift = 0;
        let result = 0;
        let byte: number;

        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        const dlat = result & 1 ? ~(result >> 1) : result >> 1;
        lat += dlat;

        shift = 0;
        result = 0;

        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        const dlng = result & 1 ? ~(result >> 1) : result >> 1;
        lng += dlng;

        coordinates.push([lng / 1e5, lat / 1e5]);
    }

    return {
        type: 'LineString',
        coordinates,
    };
}

/**
 * Parse route legs into steps
 */
function parseSteps(legs: Array<{
    steps?: Array<{
        html_instructions?: string;
        instruction?: string;
        distance?: { value: number };
        duration?: { value: number };
        maneuver?: string;
        name?: string;
    }>
}>): RouteStep[] {
    const steps: RouteStep[] = [];

    for (const leg of legs) {
        if (leg.steps) {
            for (const step of leg.steps) {
                steps.push({
                    instruction: step.html_instructions || step.instruction || '',
                    distance: step.distance?.value || 0,
                    duration: step.duration?.value || 0,
                    maneuver: step.maneuver || 'straight',
                    name: step.name || '',
                });
            }
        }
    }

    return steps;
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format duration for display
 */
export function formatDuration(seconds: number): string {
    if (seconds < 60) {
        return `${Math.round(seconds)} sec`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hours} hr ${remainingMins} min`;
}

/**
 * Check if directions API is available
 */
export function isDirectionsAvailable(): boolean {
    return Boolean(OLA_API_KEY);
}
