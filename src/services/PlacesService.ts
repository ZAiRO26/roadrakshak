// Ola Maps Places API Service
// Provides address autocomplete and geocoding

const API_BASE = 'https://api.olamaps.io/places/v1';

interface AutocompleteResult {
    place_id: string;
    description: string;
    structured_formatting: {
        main_text: string;
        secondary_text: string;
    };
    geometry?: {
        location: {
            lat: number;
            lng: number;
        };
    };
}

interface PlaceDetails {
    place_id: string;
    name: string;
    formatted_address: string;
    geometry: {
        location: {
            lat: number;
            lng: number;
        };
    };
}

export async function autocomplete(
    query: string,
    location?: { lat: number; lng: number }
): Promise<AutocompleteResult[]> {
    const apiKey = import.meta.env.VITE_OLA_API_KEY;

    if (!apiKey || !query.trim()) {
        return [];
    }

    try {
        const params = new URLSearchParams({
            input: query,
            api_key: apiKey,
        });

        // Add location bias if available
        if (location) {
            params.append('location', `${location.lat},${location.lng}`);
        }

        const response = await fetch(`${API_BASE}/autocomplete?${params}`);

        if (!response.ok) {
            console.error('Places autocomplete failed:', response.status);
            return [];
        }

        const data = await response.json();

        // Map the response to our format
        if (data.predictions) {
            return data.predictions.map((p: any) => ({
                place_id: p.place_id || p.reference,
                description: p.description,
                structured_formatting: p.structured_formatting || {
                    main_text: p.description.split(',')[0],
                    secondary_text: p.description.split(',').slice(1).join(',').trim(),
                },
                geometry: p.geometry,
            }));
        }

        return [];
    } catch (error) {
        console.error('Places autocomplete error:', error);
        return [];
    }
}

export async function geocode(placeId: string): Promise<PlaceDetails | null> {
    const apiKey = import.meta.env.VITE_OLA_API_KEY;

    if (!apiKey || !placeId) {
        return null;
    }

    try {
        const params = new URLSearchParams({
            place_id: placeId,
            api_key: apiKey,
        });

        const response = await fetch(`${API_BASE}/details?${params}`);

        if (!response.ok) {
            console.error('Place details failed:', response.status);
            return null;
        }

        const data = await response.json();

        if (data.result) {
            return {
                place_id: data.result.place_id,
                name: data.result.name,
                formatted_address: data.result.formatted_address,
                geometry: data.result.geometry,
            };
        }

        return null;
    } catch (error) {
        console.error('Place details error:', error);
        return null;
    }
}

// Simple text-based geocoding for coordinates like "28.6139,77.2090"
export function parseCoordinates(input: string): { lat: number; lng: number } | null {
    const parts = input.split(',').map(s => s.trim());
    if (parts.length === 2) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { lat, lng };
        }
    }
    return null;
}
