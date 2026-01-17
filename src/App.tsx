import { useEffect, useState } from 'react';
import './index.css';
import { MapBoard } from './components/MapBoard';
import type { MapControls as MapControlMethods } from './components/MapBoard';
import { Speedometer } from './components/Speedometer';
import { Controls } from './components/Controls';
import { ReportButton } from './components/ReportButton';
import { AlertBanner } from './components/AlertBanner';
import { LoadingScreen } from './components/LoadingScreen';
import { AccuracyIndicator } from './components/AccuracyIndicator';
import { NavigationMode } from './components/NavigationMode';
import { MapControls } from './components/MapControls';
import { SnapToMeButton } from './components/SnapToMeButton';
import { AddCameraButton } from './components/AddCameraButton';
import { OverspeedOverlay } from './components/OverspeedOverlay';
import { useGPS } from './hooks/useGPS';
import { useSpeedLimit } from './hooks/useSpeedLimit';
import { useAlerts } from './hooks/useAlerts';
import { useAppStore } from './stores/appStore';
import { fetchSpeedCameras } from './services/OverpassService';
import { initFirebase, subscribeToPoliceReports } from './services/FirebaseService';

function App() {
  const { theme, setCameras, setPoliceReports, setLoading } = useAppStore();
  const [routeGeometry, setRouteGeometry] = useState<GeoJSON.LineString | null>(null);
  const [showGpsWarning, setShowGpsWarning] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [destination, setDestination] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [mapControlMethods, setMapControlMethods] = useState<MapControlMethods | null>(null);

  // Initialize GPS tracking
  const { latitude, longitude, error: gpsError } = useGPS();

  // Fetch and track speed limits
  useSpeedLimit();

  // Monitor for alerts
  useAlerts();

  // Set theme on document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Initialize Firebase on mount
  useEffect(() => {
    initFirebase();
  }, []);

  // Show GPS warning banner after 3 seconds if no GPS
  useEffect(() => {
    if (gpsError) {
      const timer = setTimeout(() => setShowGpsWarning(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [gpsError]);

  // Fetch cameras when location is available (or use default Delhi location)
  useEffect(() => {
    const lat = latitude ?? 28.6139; // Default to Delhi
    const lng = longitude ?? 77.2090;

    const loadCameras = async () => {
      try {
        const cameras = await fetchSpeedCameras(lat, lng, 10);
        setCameras(cameras);
        console.log(`Loaded ${cameras.length} speed cameras`);
      } catch (error) {
        console.error('Failed to load cameras:', error);
      }
    };

    loadCameras();
  }, [latitude, longitude, setCameras]);

  // Subscribe to police reports when location is available
  useEffect(() => {
    const lat = latitude ?? 28.6139;
    const lng = longitude ?? 77.2090;

    const unsubscribe = subscribeToPoliceReports(
      lat,
      lng,
      5, // 5km radius
      (reports) => {
        setPoliceReports(reports);
      }
    );

    return () => unsubscribe();
  }, [latitude, longitude, setPoliceReports]);

  // Handle map ready
  const handleMapReady = () => {
    setLoading(false);
  };

  return (
    <div className="app">
      {/* OVERSPEED WARNING - Red screen overlay */}
      <OverspeedOverlay />

      {/* Loading screen */}
      <LoadingScreen />

      {/* Navigation mode - search, directions, and turn-by-turn */}
      <NavigationMode
        onRouteCalculated={setRouteGeometry}
        onNavigationStart={() => setIsNavigating(true)}
        onNavigationEnd={() => setIsNavigating(false)}
        onDestinationChange={setDestination}
        isNavigating={isNavigating}
        flyToLocation={(lat, lng) => mapControlMethods?.flyTo(lat, lng)}
      />

      {/* Map controls - zoom +/- and recenter */}
      {mapControlMethods && (
        <MapControls
          onZoomIn={() => mapControlMethods.zoomIn()}
          onZoomOut={() => mapControlMethods.zoomOut()}
          onRecenter={() => mapControlMethods.recenterToUser()}
          isNavigating={isNavigating}
        />
      )}

      {/* Main map with route */}
      <MapBoard
        onMapReady={handleMapReady}
        onMapControlsReady={setMapControlMethods}
        routeGeometry={routeGeometry}
        isNavigating={isNavigating}
        destination={destination}
      />

      {/* GPS Warning Banner (non-blocking) */}
      {showGpsWarning && gpsError && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1002,
            background: 'rgba(234, 179, 8, 0.95)',
            color: '#000',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            maxWidth: '90%',
          }}
        >
          <span style={{ fontSize: '20px' }}>📍</span>
          <span style={{ fontSize: '14px' }}>GPS unavailable - showing demo mode</span>
          <button
            onClick={() => setShowGpsWarning(false)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              marginLeft: '8px'
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Alert banner */}
      <AlertBanner />

      {/* Snap Fix - data tuner button (only visible near cameras) */}
      <SnapToMeButton />

      {/* Add Camera FAB - always visible */}
      <AddCameraButton />

      {/* GPS accuracy indicator */}
      <div className="theme-toggle">
        <AccuracyIndicator />
      </div>

      {/* Control buttons */}
      <Controls isNavigating={isNavigating} />

      {/* Speed display */}
      <Speedometer />

      {/* Report button */}
      <ReportButton />
    </div>
  );
}

export default App;
