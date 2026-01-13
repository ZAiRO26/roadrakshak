import type { SpeedCamera } from '../stores/appStore';

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

// Query template for speed cameras in a bounding box
const buildOverpassQuery = (south: number, west: number, north: number, east: number): string => {
    return `
    [out:json][timeout:25];
    (
      node["highway"="speed_camera"](${south},${west},${north},${east});
      node["enforcement"="maxspeed"](${south},${west},${north},${east});
    );
    out body;
  `;
};

export interface OverpassNode {
    type: 'node';
    id: number;
    lat: number;
    lon: number;
    tags?: {
        direction?: string;
        maxspeed?: string;
        [key: string]: string | undefined;
    };
}

interface OverpassResponse {
    elements: OverpassNode[];
}

/**
 * Fetch speed cameras from OpenStreetMap via Overpass API
 * @param centerLat Center latitude
 * @param centerLng Center longitude  
 * @param radiusKm Radius in kilometers (default 5km)
 */
export async function fetchSpeedCameras(
    centerLat: number,
    centerLng: number,
    radiusKm: number = 5
): Promise<SpeedCamera[]> {
    // Calculate bounding box
    const latOffset = radiusKm / 111; // ~111km per degree of latitude
    const lngOffset = radiusKm / (111 * Math.cos(centerLat * Math.PI / 180));

    const south = centerLat - latOffset;
    const north = centerLat + latOffset;
    const west = centerLng - lngOffset;
    const east = centerLng + lngOffset;

    const query = buildOverpassQuery(south, west, north, east);

    try {
        const response = await fetch(OVERPASS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `data=${encodeURIComponent(query)}`,
        });

        if (!response.ok) {
            throw new Error(`Overpass API error: ${response.status}`);
        }

        const data: OverpassResponse = await response.json();

        return data.elements.map((node) => ({
            id: `osm-${node.id}`,
            lat: node.lat,
            lng: node.lon,
            direction: node.tags?.direction ? parseFloat(node.tags.direction) : undefined,
        }));
    } catch (error) {
        console.error('Failed to fetch speed cameras:', error);
        // Return mock data for Delhi if API fails
        return getMockCameras(centerLat, centerLng);
    }
}

// Mock camera data for development/fallback
function getMockCameras(centerLat: number, centerLng: number): SpeedCamera[] {
    // Only provide mock cameras if near Delhi
    const isNearDelhi = Math.abs(centerLat - 28.6) < 0.5 && Math.abs(centerLng - 77.2) < 0.5;

    if (!isNearDelhi) {
        return [];
    }

    // Some mock camera locations in Delhi
    return [
        { id: 'mock-1', lat: 28.6129, lng: 77.2295 },  // Near India Gate
        { id: 'mock-2', lat: 28.5562, lng: 77.1000 },  // Gurugram Highway
        { id: 'mock-3', lat: 28.6304, lng: 77.2177 },  // Connaught Place
        { id: 'mock-4', lat: 28.5733, lng: 77.2588 },  // Noida Link
        { id: 'mock-5', lat: 28.6448, lng: 77.2167 },  // Civil Lines
        { id: 'mock-6', lat: 28.5986, lng: 77.1889 },  // South Delhi
        { id: 'mock-7', lat: 28.6823, lng: 77.2162 },  // North Delhi
        { id: 'mock-8', lat: 28.6328, lng: 77.0773 },  // West Delhi
    ];
}

/**
 * Fetch cameras for a specific city bounding box
 */
export async function fetchCamerasForCity(city: 'delhi' | 'mumbai' | 'bangalore'): Promise<SpeedCamera[]> {
    const cityCoords: Record<string, { lat: number; lng: number }> = {
        delhi: { lat: 28.6139, lng: 77.2090 },
        mumbai: { lat: 19.0760, lng: 72.8777 },
        bangalore: { lat: 12.9716, lng: 77.5946 },
    };

    const coords = cityCoords[city];
    return fetchSpeedCameras(coords.lat, coords.lng, 15); // 15km radius for cities
}
