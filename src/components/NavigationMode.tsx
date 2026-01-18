import { useState, useCallback, useEffect } from 'react';
import { autocomplete, parseCoordinates, geocode } from '../services/PlacesService';
import { getDirections, formatDistance, formatDuration, isDirectionsAvailable } from '../services/DirectionsService';
import type { RouteInfo } from '../services/DirectionsService';
import { useGpsStore } from '../stores/gpsStore';

interface Suggestion {
    place_id: string;
    description: string;
    main_text: string;
    secondary_text: string;
    lat?: number;
    lng?: number;
}

interface NavigationModeProps {
    onRouteCalculated: (geometry: GeoJSON.LineString | null) => void;
    onNavigationStart: () => void;
    onNavigationEnd: () => void;
    onDestinationChange: (dest: { lat: number; lng: number; name: string } | null) => void;
    isNavigating: boolean;
    flyToLocation: (lat: number, lng: number) => void;
}

export function NavigationMode({
    onRouteCalculated,
    onNavigationStart,
    onNavigationEnd,
    onDestinationChange,
    isNavigating,
    flyToLocation,
}: NavigationModeProps) {
    // Search state
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Selected destination
    const [destination, setDestination] = useState<{ lat: number; lng: number; name: string } | null>(null);

    // Route state
    const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
    const [routeError, setRouteError] = useState<string | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);

    // Auto-rerouting state
    const [isRerouting, setIsRerouting] = useState(false);
    const [showReroutingToast, setShowReroutingToast] = useState(false);

    const { latitude, longitude } = useGpsStore();

    // Debounced search
    useEffect(() => {
        if (!query.trim()) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        // Check if coordinates
        const coords = parseCoordinates(query);
        if (coords) {
            setSuggestions([{
                place_id: 'coords',
                description: `${coords.lat}, ${coords.lng}`,
                main_text: 'Go to coordinates',
                secondary_text: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
                lat: coords.lat,
                lng: coords.lng,
            }]);
            setShowSuggestions(true);
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoading(true);
            try {
                const results = await autocomplete(
                    query,
                    latitude && longitude ? { lat: latitude, lng: longitude } : undefined
                );

                const mapped = results.map(r => ({
                    place_id: r.place_id,
                    description: r.description,
                    main_text: r.structured_formatting?.main_text || r.description.split(',')[0],
                    secondary_text: r.structured_formatting?.secondary_text || '',
                    lat: r.geometry?.location?.lat,
                    lng: r.geometry?.location?.lng,
                }));

                setSuggestions(mapped);
                setShowSuggestions(mapped.length > 0);
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query, latitude, longitude]);

    // Handle suggestion selection - fetch coordinates if missing
    const handleSelectDestination = useCallback(async (suggestion: Suggestion) => {
        setIsLoading(true);
        setShowSuggestions(false);
        setQuery(suggestion.main_text);

        let lat = suggestion.lat;
        let lng = suggestion.lng;

        // If coordinates missing, fetch from geocode/details API
        if (!lat || !lng) {
            console.log('Fetching coordinates for place_id:', suggestion.place_id);
            const details = await geocode(suggestion.place_id);
            if (details?.geometry?.location) {
                lat = details.geometry.location.lat;
                lng = details.geometry.location.lng;
                console.log('Geocoded coordinates:', { lat, lng });
            } else {
                console.error('Failed to geocode place');
                setRouteError('Could not get location coordinates');
                setIsLoading(false);
                return;
            }
        }

        const dest = {
            lat: lat!,
            lng: lng!,
            name: suggestion.main_text,
        };
        setDestination(dest);
        onDestinationChange(dest); // Notify parent for marker
        flyToLocation(lat!, lng!);
        setIsLoading(false);
    }, [flyToLocation, onDestinationChange]);

    // Get directions to destination
    const handleGetDirections = useCallback(async () => {
        if (!destination) {
            console.error('handleGetDirections: No destination set');
            return;
        }
        if (latitude === null || longitude === null) {
            setRouteError('GPS location not available');
            return;
        }
        if (!isDirectionsAvailable()) {
            setRouteError('Directions service unavailable');
            return;
        }

        console.log('=== CALLING GET DIRECTIONS ===');
        console.log('Origin (user GPS):', { lat: latitude, lng: longitude });
        console.log('Destination:', destination);

        setIsLoading(true);
        setRouteError(null);

        try {
            const result = await getDirections(
                { lat: latitude, lng: longitude },
                { lat: destination.lat, lng: destination.lng }
            );

            console.log('getDirections result:', result);

            if (result && result.routes.length > 0) {
                setRouteInfo(result.routes[0]);
                setCurrentStepIndex(0);
                onRouteCalculated(result.routes[0].geometry);
            } else {
                console.error('No routes in result:', result);
                setRouteError('No route found');
                onRouteCalculated(null);
            }
        } catch (err) {
            setRouteError('Failed to get directions');
            console.error('Directions error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [destination, latitude, longitude, onRouteCalculated]);

    // Start navigation
    const handleStartNavigation = useCallback(() => {
        if (routeInfo) {
            onNavigationStart();
        }
    }, [routeInfo, onNavigationStart]);

    // Exit navigation
    const handleExitNavigation = useCallback(() => {
        setDestination(null);
        onDestinationChange(null); // Clear destination marker
        setRouteInfo(null);
        setCurrentStepIndex(0);
        setQuery('');
        onRouteCalculated(null);
        onNavigationEnd();
    }, [onRouteCalculated, onNavigationEnd, onDestinationChange]);

    // Navigate to next step
    const handleNextStep = useCallback(() => {
        if (routeInfo && currentStepIndex < routeInfo.steps.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
        }
    }, [routeInfo, currentStepIndex]);

    // Calculate distance from point to line segment (Haversine-based)
    const pointToLineDistance = useCallback((
        point: [number, number],
        lineStart: [number, number],
        lineEnd: [number, number]
    ): number => {
        const R = 6371000; // Earth's radius in meters
        const toRad = (deg: number) => deg * (Math.PI / 180);

        // Haversine distance between two points
        const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        // Simple perpendicular distance approximation
        const d1 = haversine(point[1], point[0], lineStart[1], lineStart[0]);
        const d2 = haversine(point[1], point[0], lineEnd[1], lineEnd[0]);
        return Math.min(d1, d2);
    }, []);

    // Auto-rerouting: detect deviation from route
    useEffect(() => {
        if (!isNavigating || !routeInfo || !latitude || !longitude || isRerouting) return;
        if (!destination) return;

        const routeCoords = routeInfo.geometry.coordinates;
        if (routeCoords.length < 2) return;

        // Find minimum distance to any segment of the route
        let minDistance = Infinity;
        for (let i = 0; i < routeCoords.length - 1; i++) {
            const dist = pointToLineDistance(
                [longitude, latitude],
                routeCoords[i] as [number, number],
                routeCoords[i + 1] as [number, number]
            );
            minDistance = Math.min(minDistance, dist);
        }

        // If deviation > 50 meters, trigger reroute
        if (minDistance > 50) {
            console.log(`[Navigation] Off-route by ${Math.round(minDistance)}m - Rerouting...`);
            setIsRerouting(true);
            setShowReroutingToast(true);

            // Recalculate route from current position
            getDirections(
                { lat: latitude, lng: longitude },
                { lat: destination.lat, lng: destination.lng }
            ).then(result => {
                if (result && result.routes.length > 0) {
                    setRouteInfo(result.routes[0]);
                    setCurrentStepIndex(0);
                    onRouteCalculated(result.routes[0].geometry);
                    console.log('[Navigation] Reroute complete');
                }
            }).catch(err => {
                console.error('[Navigation] Reroute failed:', err);
            }).finally(() => {
                setIsRerouting(false);
                setTimeout(() => setShowReroutingToast(false), 2000);
            });
        }
    }, [latitude, longitude, isNavigating, routeInfo, destination, isRerouting, pointToLineDistance, onRouteCalculated]);

    // Get maneuver icon
    const getManeuverIcon = (maneuver: string = '') => {
        const icons: Record<string, string> = {
            'turn-left': '⬅️', 'turn-right': '➡️',
            'turn-slight-left': '↖️', 'turn-slight-right': '↗️',
            'uturn-left': '↩️', 'uturn-right': '↪️',
            'straight': '⬆️', 'merge': '🔀', 'roundabout': '🔄',
            'arrive': '🏁',
        };
        return icons[maneuver] || '➡️';
    };

    // NAVIGATION ACTIVE UI - PHASE 29: Minimalist Silent Co-Pilot
    if (isNavigating && routeInfo) {
        const step = routeInfo.steps[currentStepIndex];
        const distanceToTurn = step?.distance || 0;

        return (
            <>
                {/* MINIMAL TURN PILL - Floating top-left, glassmorphism */}
                <div className="nav-turn-pill" onClick={handleNextStep}>
                    <span className="pill-arrow">{getManeuverIcon(step?.maneuver)}</span>
                    <span className="pill-distance">{formatDistance(distanceToTurn)}</span>
                </div>

                {/* BOTTOM TRIP INFO PANEL - Glassmorphic floating */}
                <div className="nav-bottom-panel">
                    <div className="nav-trip-stats">
                        <div className="trip-stat">
                            <span className="stat-value-big">{formatDuration(routeInfo.duration)}</span>
                            <span className="stat-label-small">ETA</span>
                        </div>
                        <div className="trip-divider" />
                        <div className="trip-stat">
                            <span className="stat-value-big">{formatDistance(routeInfo.distance)}</span>
                            <span className="stat-label-small">Distance</span>
                        </div>
                        <div className="trip-divider" />
                        <div className="trip-stat destination">
                            <span className="stat-value-dest">📍 {destination?.name}</span>
                        </div>
                    </div>
                    <button className="nav-end-trip-btn" onClick={handleExitNavigation}>
                        ❌ End Trip
                    </button>
                </div>

                {/* REROUTING TOAST */}
                {showReroutingToast && (
                    <div className="rerouting-toast">
                        <span className="rerouting-spinner">🔄</span>
                        <span>Rerouting...</span>
                    </div>
                )}

                <style>{navigationActiveStyles}</style>
            </>
        );
    }

    // ROUTE PREVIEW UI (after destination selected, before navigation starts)
    if (destination && routeInfo) {
        return (
            <div className="route-preview">
                <div className="route-header">
                    <div className="route-dest">
                        <span className="dest-icon">📍</span>
                        <span className="dest-name">{destination.name}</span>
                    </div>
                    <button className="route-close" onClick={handleExitNavigation}>✕</button>
                </div>

                <div className="route-summary">
                    <div className="route-stat">
                        <span className="stat-value">{formatDuration(routeInfo.duration)}</span>
                        <span className="stat-label">Travel time</span>
                    </div>
                    <div className="route-stat">
                        <span className="stat-value">{formatDistance(routeInfo.distance)}</span>
                        <span className="stat-label">Distance</span>
                    </div>
                </div>

                <button className="start-nav-btn" onClick={handleStartNavigation}>
                    🚗 Start Navigation
                </button>

                <style>{routePreviewStyles}</style>
            </div>
        );
    }

    // SEARCH UI (default)
    return (
        <div className="nav-search-container" onClick={e => e.stopPropagation()}>
            <div className="nav-search-bar">
                <span className="search-icon">🔍</span>
                <input
                    type="text"
                    placeholder="Search destination..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    className="search-input"
                />
                {isLoading && <span className="loading-icon">⏳</span>}
            </div>

            {showSuggestions && suggestions.length > 0 && (
                <div className="search-suggestions">
                    {suggestions.map((s, i) => (
                        <div
                            key={s.place_id + i}
                            className="suggestion-item"
                            onClick={() => handleSelectDestination(s)}
                        >
                            <span className="suggestion-pin">📍</span>
                            <div className="suggestion-text">
                                <div className="suggestion-main">{s.main_text}</div>
                                {s.secondary_text && <div className="suggestion-sub">{s.secondary_text}</div>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Selected destination - get directions */}
            {destination && !routeInfo && (
                <div className="destination-selected">
                    <div className="dest-info">
                        <span>📍 {destination.name}</span>
                        <button onClick={() => { setDestination(null); setQuery(''); }}>✕</button>
                    </div>
                    <button className="get-directions-btn" onClick={handleGetDirections} disabled={isLoading}>
                        {isLoading ? '⏳ Loading...' : '🧭 Get Directions'}
                    </button>
                    {routeError && <div className="route-error">{routeError}</div>}
                </div>
            )}

            <style>{searchStyles}</style>
        </div>
    );
}

// Styles
const searchStyles = `
.nav-search-container {
    position: fixed;
    top: 16px;
    left: 16px;
    right: 16px;
    z-index: 1000;
    max-width: 500px;
}
.nav-search-bar {
    display: flex;
    align-items: center;
    background: white;
    border-radius: 28px;
    padding: 12px 18px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.18);
    gap: 12px;
    transition: box-shadow 0.2s, transform 0.2s;
}
.nav-search-bar:focus-within {
    box-shadow: 0 6px 28px rgba(0,0,0,0.25);
    transform: translateY(-1px);
}
[data-theme="dark"] .nav-search-bar {
    background: rgba(30, 41, 59, 0.98);
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}
.search-icon, .loading-icon { font-size: 18px; opacity: 0.6; }
.search-input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 16px;
    background: transparent;
    color: inherit;
}
.search-suggestions {
    margin-top: 8px;
    background: white;
    border-radius: 16px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    overflow: hidden;
    max-height: 280px;
    overflow-y: auto;
}
[data-theme="dark"] .search-suggestions { background: rgba(30, 41, 59, 0.98); }
.suggestion-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    cursor: pointer;
    transition: background 0.15s;
}
.suggestion-item:hover { background: rgba(59, 130, 246, 0.1); }
.suggestion-pin { font-size: 18px; }
.suggestion-text { flex: 1; min-width: 0; }
.suggestion-main { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.suggestion-sub { font-size: 12px; opacity: 0.6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.destination-selected {
    margin-top: 12px;
    padding: 16px;
    background: white;
    border-radius: 16px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    animation: slideUp 0.3s ease-out;
}
@keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}
[data-theme="dark"] .destination-selected { background: rgba(30, 41, 59, 0.98); }
.dest-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    font-weight: 500;
}
.dest-info button {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    opacity: 0.6;
}
.get-directions-btn {
    width: 100%;
    padding: 16px;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 14px;
    background: linear-gradient(145deg, #3b82f6 0%, #2563eb 60%, #1d4ed8 100%);
    color: white;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.3px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 
        0 4px 16px rgba(59, 130, 246, 0.35),
        inset 0 1px 0 rgba(255,255,255,0.15);
}
.get-directions-btn:hover {
    box-shadow: 
        0 6px 24px rgba(59, 130, 246, 0.45),
        inset 0 1px 0 rgba(255,255,255,0.2);
    transform: translateY(-1px);
}
.get-directions-btn:active {
    transform: scale(0.97);
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}
.get-directions-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.route-error {
    margin-top: 8px;
    padding: 10px;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 8px;
    color: #ef4444;
    font-size: 13px;
}
`;

const routePreviewStyles = `
.route-preview {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: white;
    border-radius: 24px 24px 0 0;
    padding: 20px;
    padding-bottom: max(20px, env(safe-area-inset-bottom));
    box-shadow: 0 -8px 32px rgba(0,0,0,0.25);
    z-index: 1001;
    animation: slideUpPanel 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes slideUpPanel {
    from { opacity: 0; transform: translateY(100%); }
    to { opacity: 1; transform: translateY(0); }
}
[data-theme="dark"] .route-preview { background: #1e293b; }
.route-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}
.route-dest {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
    font-weight: 600;
}
.dest-icon { font-size: 22px; }
.route-close {
    background: rgba(0,0,0,0.1);
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 16px;
}
.route-summary {
    display: flex;
    gap: 24px;
    margin-bottom: 20px;
}
.route-stat { display: flex; flex-direction: column; }
.stat-value { font-size: 24px; font-weight: 700; color: #3b82f6; }
.stat-label { font-size: 12px; opacity: 0.6; }
.start-nav-btn {
    width: 100%;
    padding: 18px;
    border: 1px solid rgba(255,255,255,0.25);
    border-radius: 16px;
    background: linear-gradient(145deg, #22c55e 0%, #16a34a 60%, #15803d 100%);
    color: white;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 
        0 6px 24px rgba(34, 197, 94, 0.4),
        inset 0 1px 0 rgba(255,255,255,0.2);
}
.start-nav-btn:active { 
    transform: scale(0.96); 
    box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
}
`;

const navigationActiveStyles = `
/* PHASE 29: MINIMAL TURN PILL - Floating top-left, glassmorphism */
.nav-turn-pill {
    position: fixed;
    top: max(16px, env(safe-area-inset-top));
    left: 16px;
    z-index: 1001;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 18px;
    background: rgba(20, 20, 20, 0.85);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.nav-turn-pill:active {
    transform: scale(0.96);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}
.pill-arrow {
    font-size: 28px;
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
}
.pill-distance {
    font-size: 18px;
    font-weight: 700;
    color: white;
    letter-spacing: -0.5px;
}

/* BOTTOM TRIP INFO PANEL - Deep Glassmorphism for muted look */
.nav-bottom-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1001;
    background: rgba(20, 20, 20, 0.85);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    padding: 18px 20px;
    padding-bottom: max(18px, env(safe-area-inset-bottom));
    margin: 0 12px 12px 12px;
    border-radius: 20px;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.08);
}
.nav-trip-stats {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
}
.trip-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 60px;
}
.trip-stat.destination {
    flex: 1;
    align-items: flex-end;
    min-width: auto;
}
.stat-value-big {
    font-size: 18px;
    font-weight: 700;
    color: #60a5fa;
}
.stat-label-small {
    font-size: 11px;
    color: rgba(255,255,255,0.5);
    text-transform: uppercase;
}
.stat-value-dest {
    font-size: 14px;
    color: rgba(255,255,255,0.8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 150px;
}
.trip-divider {
    width: 1px;
    height: 30px;
    background: rgba(255,255,255,0.2);
}
.nav-end-trip-btn {
    width: 100%;
    padding: 16px;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 16px;
    background: linear-gradient(145deg, #ef4444 0%, #dc2626 60%, #b91c1c 100%);
    color: white;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 
        0 6px 20px rgba(239,68,68,0.4),
        inset 0 1px 0 rgba(255,255,255,0.15);
}
.nav-end-trip-btn:active {
    transform: scale(0.96);
    box-shadow: 0 2px 8px rgba(239,68,68,0.3);
}

/* Rerouting Toast */
.rerouting-toast {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1002;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    padding: 16px 28px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 16px;
    font-weight: 600;
    box-shadow: 0 8px 32px rgba(59,130,246,0.4);
    animation: toastPulse 1s ease-in-out infinite;
}
.rerouting-spinner {
    font-size: 24px;
    animation: spin 1s linear infinite;
}
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
@keyframes toastPulse {
    0%, 100% { transform: translate(-50%, -50%) scale(1); }
    50% { transform: translate(-50%, -50%) scale(1.02); }
}
`;

export default NavigationMode;
