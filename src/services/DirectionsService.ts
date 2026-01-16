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

        // Ola Directions API requires POST method
        const url = `${OLA_API_BASE}/routing/v1/directions?` +
            `origin=${origin.lat},${origin.lng}` +
            `&destination=${destination.lat},${destination.lng}` +
            waypointsParam +
            `&api_key=${OLA_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-Request-Id': crypto.randomUUID(),
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Directions API error:', response.status, errorText.slice(0, 200));
            throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();

        // Check for API errors
        if (data.status && data.status !== 'OK' && data.status !== 'SUCCESS') {
            console.error('Directions API error status:', data.status);
            return null;
        }

        // Try multiple response formats
        let routesArray = data.routes;

        // Check if routes is nested under result
        if (!routesArray && data.result?.routes) {
            routesArray = data.result.routes;
        }

        // Check if there's a single route object instead of array
        if (!routesArray && data.route) {
            routesArray = [data.route];
        }

        // Parse Ola's response format
        if (routesArray && routesArray.length > 0) {
            const route = routesArray[0];

            // Parse geometry - handle multiple Ola Maps response formats
            let geometry: GeoJSON.LineString | null = null;
            let polylineString: string | null = null;

            // Try: route.geometry as encoded string
            if (typeof route.geometry === 'string' && route.geometry.length > 10) {
                polylineString = route.geometry;
            }
            // Try: route.geometry as GeoJSON
            else if (route.geometry && route.geometry.type === 'LineString') {
                geometry = route.geometry;
            }
            // Try: overview_polyline as direct string
            else if (typeof route.overview_polyline === 'string' && route.overview_polyline.length > 10) {
                polylineString = route.overview_polyline;
            }
            // Try: overview_polyline.points (Google format)
            else if (route.overview_polyline?.points) {
                polylineString = route.overview_polyline.points;
            }
            // Try: overview_polyline.encoded_polyline
            else if (route.overview_polyline?.encoded_polyline) {
                polylineString = route.overview_polyline.encoded_polyline;
            }
            // Try: Build from legs/steps
            else if (route.legs && route.legs.length > 0) {
                const allCoords: [number, number][] = [];
                for (const leg of route.legs) {
                    if (leg.steps) {
                        for (const step of leg.steps) {
                            if (step.polyline?.points) {
                                const stepGeom = decodePolyline(step.polyline.points);
                                allCoords.push(...(stepGeom.coordinates as [number, number][]));
                            } else if (step.start_location && step.end_location) {
                                allCoords.push([step.start_location.lng, step.start_location.lat]);
                            }
                        }
                    }
                    // Also check leg-level polyline
                    if (leg.polyline?.points) {
                        const legGeom = decodePolyline(leg.polyline.points);
                        allCoords.push(...(legGeom.coordinates as [number, number][]));
                    }
                }
                if (allCoords.length > 0) {
                    geometry = { type: 'LineString', coordinates: allCoords };
                }
            }

            // Decode polyline if we found one
            if (polylineString && !geometry) {
                geometry = decodePolyline(polylineString);
            }

            // Fallback: straight line
            if (!geometry || geometry.coordinates.length < 2) {
                console.warn('No valid route geometry, using straight line');
                geometry = {
                    type: 'LineString',
                    coordinates: [
                        [origin.lng, origin.lat],
                        [destination.lng, destination.lat]
                    ]
                };
            }

            return {
                routes: [{
                    distance: route.distance || route.legs?.reduce((sum: number, leg: { distance: number }) => sum + leg.distance, 0) || 0,
                    duration: route.duration || route.legs?.reduce((sum: number, leg: { duration: number }) => sum + leg.duration, 0) || 0,
                    geometry,
                    steps: parseSteps(route.legs || []),
                }],
                origin,
                destination,
            };
        }

        console.warn('No routes found in response. Response structure:', Object.keys(data));
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
