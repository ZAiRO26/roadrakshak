import { useState, useCallback, useEffect } from 'react';
import { autocomplete, parseCoordinates } from '../services/PlacesService';
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
    isNavigating: boolean;
    flyToLocation: (lat: number, lng: number) => void;
}

export function NavigationMode({
    onRouteCalculated,
    onNavigationStart,
    onNavigationEnd,
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

    // Handle suggestion selection
    const handleSelectDestination = useCallback((suggestion: Suggestion) => {
        if (suggestion.lat && suggestion.lng) {
            setDestination({
                lat: suggestion.lat,
                lng: suggestion.lng,
                name: suggestion.main_text,
            });
            setQuery(suggestion.main_text);
            setShowSuggestions(false);
            flyToLocation(suggestion.lat, suggestion.lng);
        }
    }, [flyToLocation]);

    // Get directions to destination
    const handleGetDirections = useCallback(async () => {
        if (!destination) return;
        if (latitude === null || longitude === null) {
            setRouteError('GPS location not available');
            return;
        }
        if (!isDirectionsAvailable()) {
            setRouteError('Directions service unavailable');
            return;
        }

        setIsLoading(true);
        setRouteError(null);

        try {
            const result = await getDirections(
                { lat: latitude, lng: longitude },
                { lat: destination.lat, lng: destination.lng }
            );

            if (result && result.routes.length > 0) {
                setRouteInfo(result.routes[0]);
                setCurrentStepIndex(0);
                onRouteCalculated(result.routes[0].geometry);
            } else {
                setRouteError('No route found');
                onRouteCalculated(null);
            }
        } catch (err) {
            setRouteError('Failed to get directions');
            console.error(err);
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
        setRouteInfo(null);
        setCurrentStepIndex(0);
        setQuery('');
        onRouteCalculated(null);
        onNavigationEnd();
    }, [onRouteCalculated, onNavigationEnd]);

    // Navigate to next step
    const handleNextStep = useCallback(() => {
        if (routeInfo && currentStepIndex < routeInfo.steps.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
        }
    }, [routeInfo, currentStepIndex]);

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

    // NAVIGATION ACTIVE UI
    if (isNavigating && routeInfo) {
        const step = routeInfo.steps[currentStepIndex];
        return (
            <div className="navigation-active">
                {/* Current instruction */}
                <div className="nav-instruction" onClick={handleNextStep}>
                    <div className="nav-icon">{getManeuverIcon(step?.maneuver)}</div>
                    <div className="nav-text">
                        <div className="nav-main" dangerouslySetInnerHTML={{ __html: step?.instruction || 'Continue' }} />
                        <div className="nav-sub">{formatDistance(step?.distance || 0)}</div>
                    </div>
                    <div className="nav-step-count">{currentStepIndex + 1}/{routeInfo.steps.length}</div>
                </div>

                {/* Route summary */}
                <div className="nav-summary">
                    <span>📍 {destination?.name}</span>
                    <span>{formatDistance(routeInfo.distance)} • {formatDuration(routeInfo.duration)}</span>
                </div>

                {/* Exit button */}
                <button className="nav-exit-btn" onClick={handleExitNavigation}>
                    ✕ Exit Navigation
                </button>

                <style>{navigationActiveStyles}</style>
            </div>
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
    border-radius: 24px;
    padding: 10px 16px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.15);
    gap: 10px;
}
[data-theme="dark"] .nav-search-bar {
    background: rgba(30, 41, 59, 0.95);
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
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
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
    padding: 14px;
    border: none;
    border-radius: 12px;
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: white;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
}
.get-directions-btn:disabled { opacity: 0.6; }
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
    box-shadow: 0 -4px 24px rgba(0,0,0,0.2);
    z-index: 1001;
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
    padding: 16px;
    border: none;
    border-radius: 14px;
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: white;
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.2s;
}
.start-nav-btn:active { transform: scale(0.98); }
`;

const navigationActiveStyles = `
.navigation-active {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1001;
    background: linear-gradient(180deg, rgba(30,41,59,0.98) 0%, rgba(30,41,59,0.95) 100%);
    padding: 16px;
    padding-top: max(16px, env(safe-area-inset-top));
}
.nav-instruction {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: rgba(59, 130, 246, 0.2);
    border-radius: 16px;
    cursor: pointer;
    margin-bottom: 12px;
}
.nav-icon { font-size: 36px; }
.nav-text { flex: 1; }
.nav-main { font-size: 16px; font-weight: 600; color: white; }
.nav-sub { font-size: 13px; opacity: 0.7; color: white; margin-top: 4px; }
.nav-step-count { font-size: 12px; opacity: 0.5; color: white; }
.nav-summary {
    display: flex;
    justify-content: space-between;
    padding: 12px;
    background: rgba(255,255,255,0.1);
    border-radius: 10px;
    font-size: 13px;
    color: white;
    margin-bottom: 12px;
}
.nav-exit-btn {
    width: 100%;
    padding: 12px;
    border: 1px solid rgba(239, 68, 68, 0.5);
    border-radius: 10px;
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
}
`;

export default NavigationMode;
