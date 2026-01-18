import { useState, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { getDirections, formatDistance, formatDuration, isDirectionsAvailable } from '../services/DirectionsService';
import type { RouteInfo } from '../services/DirectionsService';
import { useGpsStore } from '../stores/gpsStore';

interface NavigationPanelProps {
    onRouteCalculated: (geometry: GeoJSON.LineString | null) => void;
}

export function NavigationPanel({ onRouteCalculated }: NavigationPanelProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [destination, setDestination] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const { latitude, longitude } = useGpsStore();

    const handleSearch = useCallback(async () => {
        if (!destination.trim()) {
            setError('Please enter a destination');
            return;
        }

        if (latitude === null || longitude === null) {
            setError('GPS location not available');
            return;
        }

        if (!isDirectionsAvailable()) {
            setError('Directions API not configured');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // For now, parse destination as "lat,lng" format
            // In production, you'd use a geocoding API (Ola Places API)
            const coords = parseDestination(destination);

            if (!coords) {
                setError('Invalid destination format. Use: lat,lng (e.g., 28.5535,77.2588)');
                setIsLoading(false);
                return;
            }

            const result = await getDirections(
                { lat: latitude, lng: longitude },
                coords
            );

            if (result && result.routes.length > 0) {
                const route = result.routes[0];
                setRouteInfo(route);
                setCurrentStepIndex(0);
                onRouteCalculated(route.geometry);
            } else {
                setError('No route found');
                onRouteCalculated(null);
            }
        } catch (err) {
            setError('Failed to get directions');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [destination, latitude, longitude, onRouteCalculated]);

    const handleClearRoute = useCallback(() => {
        setRouteInfo(null);
        setCurrentStepIndex(0);
        setDestination('');
        onRouteCalculated(null);
    }, [onRouteCalculated]);

    const handleNextStep = useCallback(() => {
        if (routeInfo && currentStepIndex < routeInfo.steps.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
        }
    }, [routeInfo, currentStepIndex]);

    if (!isExpanded) {
        return (
            <button
                className="nav-toggle-btn"
                onClick={() => setIsExpanded(true)}
                title="Open Navigation"
            >
                🧭
            </button>
        );
    }

    return (
        <div className="navigation-panel">
            {/* Header */}
            <div className="nav-header">
                <span style={{ fontSize: '18px', fontWeight: 'bold' }}>🧭 Navigation</span>
                <button
                    className="nav-close-btn"
                    onClick={() => setIsExpanded(false)}
                >
                    ✕
                </button>
            </div>

            {/* Search */}
            <div className="nav-search">
                <input
                    type="text"
                    placeholder="Destination (lat,lng)"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="nav-input"
                />
                <button
                    className="nav-search-btn"
                    onClick={handleSearch}
                    disabled={isLoading}
                >
                    {isLoading ? '⏳' : '🔍'}
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="nav-error">{error}</div>
            )}

            {/* Route Info */}
            {routeInfo && (
                <div className="nav-route-info">
                    <div className="nav-route-summary">
                        <span>📍 {formatDistance(routeInfo.distance)}</span>
                        <span>⏱️ {formatDuration(routeInfo.duration)}</span>
                        <button
                            className="nav-clear-btn"
                            onClick={handleClearRoute}
                        >
                            Clear
                        </button>
                    </div>

                    {/* Current Step */}
                    {routeInfo.steps.length > 0 && (
                        <div className="nav-current-step" onClick={handleNextStep}>
                            <div className="step-icon">
                                {getManeuverIcon(routeInfo.steps[currentStepIndex]?.maneuver)}
                            </div>
                            <div className="step-content">
                                <div
                                    className="step-instruction"
                                    dangerouslySetInnerHTML={{
                                        __html: DOMPurify.sanitize(routeInfo.steps[currentStepIndex]?.instruction || 'Continue')
                                    }}
                                />
                                <div className="step-distance">
                                    {formatDistance(routeInfo.steps[currentStepIndex]?.distance || 0)}
                                </div>
                            </div>
                            <div className="step-counter">
                                {currentStepIndex + 1}/{routeInfo.steps.length}
                            </div>
                        </div>
                    )}

                    {/* Navigation Started Indicator */}
                    <div className="nav-active-indicator">
                        🚗 Navigation Active
                    </div>
                </div>
            )}

            {/* Quick Destinations */}
            {!routeInfo && (
                <div className="nav-quick-dest">
                    <div className="quick-dest-title">Quick Destinations</div>
                    <button
                        className="quick-dest-btn"
                        onClick={() => setDestination('28.6139,77.2090')}
                    >
                        📍 Connaught Place
                    </button>
                    <button
                        className="quick-dest-btn"
                        onClick={() => setDestination('28.5535,77.2588')}
                    >
                        📍 Noida Sector 18
                    </button>
                    <button
                        className="quick-dest-btn"
                        onClick={() => setDestination('28.4595,77.0266')}
                    >
                        📍 Gurugram Cyber Hub
                    </button>
                </div>
            )}

            <style>{`
        .nav-toggle-btn {
          position: fixed;
          top: 80px;
          left: 20px;
          z-index: 1000;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: none;
          background: rgba(30, 41, 59, 0.95);
          backdrop-filter: blur(10px);
          color: white;
          font-size: 24px;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          transition: transform 0.2s;
        }
        .nav-toggle-btn:hover {
          transform: scale(1.1);
        }
        .navigation-panel {
          position: fixed;
          top: 20px;
          left: 20px;
          z-index: 1001;
          width: 320px;
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(20px);
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          color: white;
        }
        [data-theme="light"] .navigation-panel {
          background: rgba(255, 255, 255, 0.95);
          color: #1e293b;
        }
        .nav-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .nav-close-btn {
          background: none;
          border: none;
          color: inherit;
          font-size: 18px;
          cursor: pointer;
          opacity: 0.7;
        }
        .nav-search {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }
        .nav-input {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.1);
          color: inherit;
          font-size: 14px;
        }
        [data-theme="light"] .nav-input {
          background: rgba(0, 0, 0, 0.05);
          border-color: rgba(0, 0, 0, 0.1);
        }
        .nav-search-btn {
          padding: 10px 14px;
          border: none;
          border-radius: 8px;
          background: #3b82f6;
          color: white;
          font-size: 16px;
          cursor: pointer;
        }
        .nav-error {
          padding: 8px 12px;
          background: rgba(239, 68, 68, 0.2);
          border-radius: 8px;
          color: #ef4444;
          font-size: 13px;
          margin-bottom: 12px;
        }
        .nav-route-summary {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px;
          background: rgba(59, 130, 246, 0.2);
          border-radius: 8px;
          margin-bottom: 12px;
        }
        .nav-clear-btn {
          margin-left: auto;
          padding: 4px 12px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 4px;
          background: transparent;
          color: inherit;
          font-size: 12px;
          cursor: pointer;
        }
        .nav-current-step {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: rgba(34, 197, 94, 0.2);
          border-radius: 12px;
          cursor: pointer;
          margin-bottom: 8px;
        }
        .step-icon {
          font-size: 28px;
        }
        .step-content {
          flex: 1;
        }
        .step-instruction {
          font-size: 14px;
          font-weight: 500;
        }
        .step-distance {
          font-size: 12px;
          opacity: 0.7;
          margin-top: 4px;
        }
        .step-counter {
          font-size: 12px;
          opacity: 0.5;
        }
        .nav-active-indicator {
          text-align: center;
          padding: 8px;
          background: rgba(34, 197, 94, 0.3);
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .nav-quick-dest {
          margin-top: 12px;
        }
        .quick-dest-title {
          font-size: 12px;
          opacity: 0.6;
          margin-bottom: 8px;
        }
        .quick-dest-btn {
          display: block;
          width: 100%;
          padding: 10px 12px;
          margin-bottom: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          background: transparent;
          color: inherit;
          text-align: left;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .quick-dest-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        [data-theme="light"] .quick-dest-btn {
          border-color: rgba(0, 0, 0, 0.1);
        }
        [data-theme="light"] .quick-dest-btn:hover {
          background: rgba(0, 0, 0, 0.05);
        }
      `}</style>
        </div>
    );
}

function parseDestination(input: string): { lat: number; lng: number } | null {
    // Parse "lat,lng" format
    const parts = input.split(',').map(s => s.trim());
    if (parts.length === 2) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
            return { lat, lng };
        }
    }
    return null;
}

function getManeuverIcon(maneuver: string = ''): string {
    const icons: Record<string, string> = {
        'turn-left': '⬅️',
        'turn-right': '➡️',
        'turn-slight-left': '↖️',
        'turn-slight-right': '↗️',
        'turn-sharp-left': '⤵️',
        'turn-sharp-right': '⤴️',
        'uturn-left': '↩️',
        'uturn-right': '↪️',
        'straight': '⬆️',
        'merge': '🔀',
        'roundabout': '🔄',
        'fork-left': '↙️',
        'fork-right': '↘️',
        'arrive': '🏁',
    };
    return icons[maneuver] || '➡️';
}
