import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useGpsStore } from '../stores/gpsStore';
import { useAppStore } from '../stores/appStore';

interface MapBoardProps {
    onMapReady?: (map: maplibregl.Map) => void;
    routeGeometry?: GeoJSON.LineString | null;
}

// Default center: Delhi, India
const DEFAULT_CENTER: [number, number] = [77.2090, 28.6139];
const DEFAULT_ZOOM = 12;

export function MapBoard({ onMapReady, routeGeometry }: MapBoardProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const userMarkerRef = useRef<maplibregl.Marker | null>(null);
    const cameraMarkersRef = useRef<maplibregl.Marker[]>([]);
    const policeMarkersRef = useRef<maplibregl.Marker[]>([]);

    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const { latitude, longitude, heading } = useGpsStore();
    const { theme, cameras, policeReports, setLoading } = useAppStore();

    // Initialize map
    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: getMapStyle(theme),
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            pitch: 0,
            bearing: 0,
            attributionControl: false,
        });

        map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

        map.on('load', () => {
            console.log('Map loaded successfully');
            setIsMapLoaded(true);
            setLoading(false);
            onMapReady?.(map);
        });

        map.on('error', (e) => {
            console.error('Map error:', e);
        });

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, [onMapReady, setLoading]);

    // Update map style on theme change
    useEffect(() => {
        if (mapRef.current && isMapLoaded) {
            mapRef.current.setStyle(getMapStyle(theme));
        }
    }, [theme, isMapLoaded]);

    // Update route on map
    useEffect(() => {
        if (!mapRef.current || !isMapLoaded || !routeGeometry) return;

        const map = mapRef.current;

        // Remove existing route layer if present
        if (map.getLayer('route-line')) {
            map.removeLayer('route-line');
        }
        if (map.getSource('route')) {
            map.removeSource('route');
        }

        // Add route source and layer
        map.addSource('route', {
            type: 'geojson',
            data: {
                type: 'Feature',
                properties: {},
                geometry: routeGeometry,
            },
        });

        map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: {
                'line-join': 'round',
                'line-cap': 'round',
            },
            paint: {
                'line-color': '#3b82f6',
                'line-width': 6,
                'line-opacity': 0.8,
            },
        });
    }, [routeGeometry, isMapLoaded]);

    // Update user location and center map
    useEffect(() => {
        if (!mapRef.current || latitude === null || longitude === null) return;

        // Update or create user marker
        if (!userMarkerRef.current) {
            const el = document.createElement('div');
            el.className = 'user-marker';
            el.innerHTML = `
        <div class="user-marker-pulse"></div>
        <div class="user-marker-dot"></div>
        <div class="user-marker-direction"></div>
      `;

            userMarkerRef.current = new maplibregl.Marker({ element: el })
                .setLngLat([longitude, latitude])
                .addTo(mapRef.current);
        } else {
            userMarkerRef.current.setLngLat([longitude, latitude]);
        }

        // Rotate direction indicator if heading available
        if (heading !== null && userMarkerRef.current) {
            const directionEl = userMarkerRef.current.getElement().querySelector('.user-marker-direction') as HTMLElement;
            if (directionEl) {
                directionEl.style.transform = `rotate(${heading}deg)`;
            }
        }

        // Smooth pan to user location
        mapRef.current.easeTo({
            center: [longitude, latitude],
            bearing: heading || 0,
            duration: 1000,
        });
    }, [latitude, longitude, heading]);

    // Update camera markers
    const updateCameraMarkers = useCallback(() => {
        if (!mapRef.current || !isMapLoaded) return;

        // Clear existing markers
        cameraMarkersRef.current.forEach(marker => marker.remove());
        cameraMarkersRef.current = [];

        // Add new markers
        cameras.forEach(camera => {
            const el = document.createElement('div');
            el.className = 'camera-marker';
            el.innerHTML = '📷';
            el.style.fontSize = '24px';
            el.style.cursor = 'pointer';

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([camera.lng, camera.lat])
                .setPopup(new maplibregl.Popup({ offset: 25 }).setText('Speed Camera'))
                .addTo(mapRef.current!);

            cameraMarkersRef.current.push(marker);
        });
    }, [cameras, isMapLoaded]);

    useEffect(() => {
        updateCameraMarkers();
    }, [updateCameraMarkers]);

    // Update police markers
    const updatePoliceMarkers = useCallback(() => {
        if (!mapRef.current || !isMapLoaded) return;

        // Clear existing markers
        policeMarkersRef.current.forEach(marker => marker.remove());
        policeMarkersRef.current = [];

        // Add new markers
        policeReports.forEach(report => {
            const el = document.createElement('div');
            el.className = 'police-marker';
            el.innerHTML = '🚔';
            el.style.fontSize = '24px';
            el.style.cursor = 'pointer';
            el.style.opacity = '0.8';

            const ageMinutes = Math.floor((Date.now() - report.timestamp) / 60000);

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([report.lng, report.lat])
                .setPopup(
                    new maplibregl.Popup({ offset: 25 })
                        .setHTML(`
              <strong>Police Checkpoint</strong><br/>
              Reported ${ageMinutes} min ago<br/>
              ${report.confirmations} confirmations
            `)
                )
                .addTo(mapRef.current!);

            policeMarkersRef.current.push(marker);
        });
    }, [policeReports, isMapLoaded]);

    useEffect(() => {
        updatePoliceMarkers();
    }, [updatePoliceMarkers]);

    return (
        <>
            <div ref={mapContainerRef} className="map-container" />
            <style>{`
        .user-marker {
          position: relative;
          width: 24px;
          height: 24px;
        }
        .user-marker-pulse {
          position: absolute;
          width: 40px;
          height: 40px;
          left: -8px;
          top: -8px;
          background: rgba(59, 130, 246, 0.3);
          border-radius: 50%;
          animation: pulse 2s ease-in-out infinite;
        }
        .user-marker-dot {
          position: absolute;
          width: 16px;
          height: 16px;
          left: 4px;
          top: 4px;
          background: #3b82f6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .user-marker-direction {
          position: absolute;
          width: 0;
          height: 0;
          left: 8px;
          top: -12px;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 16px solid #3b82f6;
          transform-origin: center 20px;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.5); opacity: 0; }
        }
        .maplibregl-popup-content {
          padding: 10px 14px;
          font-size: 13px;
          border-radius: 8px;
        }
      `}</style>
        </>
    );
}

// Map styles - using Ola Maps vector tiles (with API key from .env)
// API endpoint: https://api.olamaps.io/tiles/vector/v1/styles/{style}/style.json
function getMapStyle(theme: 'dark' | 'light'): string {
    const apiKey = import.meta.env.VITE_OLA_API_KEY;

    if (!apiKey) {
        // Fallback to OpenFreeMap if no API key
        console.warn('Ola API key not found, using OpenFreeMap fallback');
        return theme === 'dark'
            ? 'https://tiles.openfreemap.org/styles/fiord'
            : 'https://tiles.openfreemap.org/styles/liberty';
    }

    // Ola Maps style URLs with API key
    // Available styles: default-light-standard, default-dark-standard, default-light-standard-sand, etc.
    const styleName = theme === 'dark'
        ? 'default-dark-standard'
        : 'default-light-standard';

    return `https://api.olamaps.io/tiles/vector/v1/styles/${styleName}/style.json?api_key=${apiKey}`;
}

