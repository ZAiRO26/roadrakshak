import { useEffect, useRef, useState, useCallback } from 'react';
import { OlaMaps } from 'olamaps-web-sdk';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useGpsStore } from '../stores/gpsStore';
import { useAppStore } from '../stores/appStore';

interface MapBoardProps {
    onMapReady?: (map: any) => void;
    routeGeometry?: GeoJSON.LineString | null;
}

// Default center: Delhi, India
const DEFAULT_CENTER: [number, number] = [77.2090, 28.6139];
const DEFAULT_ZOOM = 12;

// Get API key once at module level
const API_KEY = import.meta.env.VITE_OLA_API_KEY || '';

export function MapBoard({ onMapReady, routeGeometry }: MapBoardProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const olaMapsRef = useRef<OlaMaps | null>(null);
    const userMarkerRef = useRef<any>(null);
    const cameraMarkersRef = useRef<any[]>([]);
    const policeMarkersRef = useRef<any[]>([]);
    const initializingRef = useRef(false);

    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const { latitude, longitude, heading } = useGpsStore();
    const { theme, cameras, policeReports, setLoading } = useAppStore();

    // Initialize Ola Maps ONCE using SDK v2 async pattern
    useEffect(() => {
        // Guard against double initialization
        if (!mapContainerRef.current || mapRef.current || initializingRef.current) return;

        initializingRef.current = true;

        if (!API_KEY) {
            console.error('Ola Maps API key not found!');
            setLoading(false);
            initializingRef.current = false;
            return;
        }

        // Initialize OlaMaps SDK once
        const olaMaps = new OlaMaps({
            apiKey: API_KEY,
        });
        olaMapsRef.current = olaMaps;

        // Use Ola Maps built-in dark style
        // Available styles: bolt-dark, default-dark-standard, eclipse-dark-lite, etc.
        // User's custom "olamap dark" style is not accessible via public API
        const styleUrl = `https://api.olamaps.io/tiles/vector/v1/styles/bolt-dark/style.json`;

        // Async initialization as per SDK v2 docs
        const initMap = async () => {
            try {
                console.log('Initializing Ola Map with style:', styleUrl);

                const map = await olaMaps.init({
                    style: styleUrl,
                    container: mapContainerRef.current!,
                    center: DEFAULT_CENTER,
                    zoom: DEFAULT_ZOOM,
                });

                map.on('load', () => {
                    console.log('Ola Map loaded successfully with custom style');
                    setIsMapLoaded(true);
                    setLoading(false);
                    onMapReady?.(map);
                });

                map.on('error', (e: any) => {
                    console.error('Map error:', e);
                });

                mapRef.current = map;
            } catch (error) {
                console.error('Failed to initialize Ola Maps:', error);
                setLoading(false);
                initializingRef.current = false;
            }
        };

        initMap();

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                initializingRef.current = false;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty dependency array - initialize only once

    // Handle theme change separately (don't reinitialize map)
    useEffect(() => {
        if (!mapRef.current || !isMapLoaded) return;

        const styleName = theme === 'dark' ? 'bolt-dark' : 'default-light-standard';
        const styleUrl = `https://api.olamaps.io/tiles/vector/v1/styles/${styleName}/style.json?api_key=${API_KEY}`;

        try {
            mapRef.current.setStyle(styleUrl);
        } catch (e) {
            console.warn('Failed to change map style:', e);
        }
    }, [theme, isMapLoaded]);

    // Update user position marker
    const updateUserMarker = useCallback(() => {
        if (!mapRef.current || !isMapLoaded || !olaMapsRef.current || latitude === null || longitude === null) return;

        if (!userMarkerRef.current) {
            const el = document.createElement('div');
            el.className = 'user-marker';
            el.innerHTML = `
                <div class="user-marker-pulse"></div>
                <div class="user-marker-dot"></div>
            `;

            userMarkerRef.current = olaMapsRef.current.addMarker({
                element: el,
                anchor: 'center',
                offset: [0, 0],
            })
                .setLngLat([longitude, latitude])
                .addTo(mapRef.current);
        } else {
            userMarkerRef.current.setLngLat([longitude, latitude]);
        }

        if (heading !== null && userMarkerRef.current) {
            const markerEl = userMarkerRef.current.getElement();
            if (markerEl) {
                markerEl.style.transform = `rotate(${heading}deg)`;
            }
        }
    }, [latitude, longitude, heading, isMapLoaded]);

    // Follow user position
    useEffect(() => {
        if (mapRef.current && latitude !== null && longitude !== null && isMapLoaded) {
            updateUserMarker();
            mapRef.current.easeTo({
                center: [longitude, latitude],
                duration: 500,
            });
        }
    }, [latitude, longitude, isMapLoaded, updateUserMarker]);

    // Camera markers
    useEffect(() => {
        if (!mapRef.current || !isMapLoaded || !olaMapsRef.current) return;

        cameraMarkersRef.current.forEach(marker => marker.remove());
        cameraMarkersRef.current = [];

        cameras.forEach(camera => {
            const el = document.createElement('div');
            el.className = 'camera-marker';
            el.innerHTML = '📷';
            el.title = 'Speed Camera';

            const marker = olaMapsRef.current!.addMarker({
                element: el,
                anchor: 'center',
            })
                .setLngLat([camera.lng, camera.lat])
                .addTo(mapRef.current);

            cameraMarkersRef.current.push(marker);
        });
    }, [cameras, isMapLoaded]);

    // Police markers
    useEffect(() => {
        if (!mapRef.current || !isMapLoaded || !olaMapsRef.current) return;

        policeMarkersRef.current.forEach(marker => marker.remove());
        policeMarkersRef.current = [];

        policeReports.forEach(report => {
            const el = document.createElement('div');
            el.className = 'police-marker';
            el.innerHTML = '🚔';
            el.title = `Police checkpoint (${report.confirmations} confirmations)`;

            const marker = olaMapsRef.current!.addMarker({
                element: el,
                anchor: 'center',
            })
                .setLngLat([report.lng, report.lat])
                .addTo(mapRef.current);

            policeMarkersRef.current.push(marker);
        });
    }, [policeReports, isMapLoaded]);

    // Display route
    useEffect(() => {
        if (!mapRef.current || !isMapLoaded || !routeGeometry) return;

        const map = mapRef.current;

        if (map.getSource('route')) {
            map.getSource('route').setData({
                type: 'Feature',
                properties: {},
                geometry: routeGeometry,
            });
        } else {
            map.addSource('route', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: routeGeometry,
                },
            });

            map.addLayer({
                id: 'route',
                type: 'line',
                source: 'route',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round',
                },
                paint: {
                    'line-color': '#4285F4',
                    'line-width': 6,
                    'line-opacity': 0.8,
                },
            });
        }
    }, [routeGeometry, isMapLoaded]);

    return (
        <>
            <div
                ref={mapContainerRef}
                id="ola-map-container"
                style={{
                    width: '100%',
                    height: '100%',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                }}
            />
            <style>{`
        .user-marker {
          width: 24px;
          height: 24px;
          position: relative;
        }
        .user-marker-dot {
          width: 16px;
          height: 16px;
          background: #4285F4;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
        .user-marker-pulse {
          width: 40px;
          height: 40px;
          background: rgba(66, 133, 244, 0.3);
          border-radius: 50%;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
        }
        .camera-marker, .police-marker {
          font-size: 24px;
          cursor: pointer;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }
        .camera-marker:hover, .police-marker:hover {
          transform: scale(1.2);
        }
      `}</style>
        </>
    );
}

export default MapBoard;
