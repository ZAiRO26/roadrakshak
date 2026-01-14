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

        const apiKey = import.meta.env.VITE_OLA_API_KEY;

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: getMapStyle(theme),
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            pitch: 0,
            bearing: 0,
            attributionControl: false,
            // Transform ALL requests to add API key to Ola Maps endpoints
            transformRequest: (url: string) => {
                if (url.includes('olamaps.io') && apiKey) {
                    // Replace any placeholder key patterns (key=0.0.1, key=0.1, key=0.4.0, etc.)
                    let newUrl = url.replace(/[?&]key=[\d.]+/g, '');
                    // Add the real API key
                    if (newUrl.includes('?')) {
                        newUrl = `${newUrl}&api_key=${apiKey}`;
                    } else {
                        newUrl = `${newUrl}?api_key=${apiKey}`;
                    }
                    return { url: newUrl };
                }
                return { url };
            },
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

    // Update user position marker
    const updateUserMarker = useCallback(() => {
        if (!mapRef.current || !isMapLoaded || latitude === null || longitude === null) return;

        if (!userMarkerRef.current) {
            // Create user marker element
            const el = document.createElement('div');
            el.className = 'user-marker';
            el.innerHTML = `
                <div class="user-marker-pulse"></div>
                <div class="user-marker-dot"></div>
            `;

            userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat([longitude, latitude])
                .addTo(mapRef.current);
        } else {
            userMarkerRef.current.setLngLat([longitude, latitude]);
        }

        // Rotate marker based on heading
        if (heading !== null && userMarkerRef.current) {
            const markerEl = userMarkerRef.current.getElement();
            markerEl.style.transform = `rotate(${heading}deg)`;
        }
    }, [latitude, longitude, heading, isMapLoaded]);

    // AUTO-CENTER: Follow user position
    useEffect(() => {
        if (mapRef.current && latitude !== null && longitude !== null && isMapLoaded) {
            updateUserMarker();
            // Smooth pan to user location
            mapRef.current.easeTo({
                center: [longitude, latitude],
                duration: 500,
            });
        }
    }, [latitude, longitude, isMapLoaded, updateUserMarker]);

    // Update camera markers
    useEffect(() => {
        if (!mapRef.current || !isMapLoaded) return;

        // Clear existing camera markers
        cameraMarkersRef.current.forEach(marker => marker.remove());
        cameraMarkersRef.current = [];

        // Add new camera markers
        cameras.forEach(camera => {
            const el = document.createElement('div');
            el.className = 'camera-marker';
            el.innerHTML = '📷';
            el.title = 'Speed Camera';

            const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat([camera.lng, camera.lat])
                .addTo(mapRef.current!);

            cameraMarkersRef.current.push(marker);
        });
    }, [cameras, isMapLoaded]);

    // Update police markers
    useEffect(() => {
        if (!mapRef.current || !isMapLoaded) return;

        // Clear existing police markers
        policeMarkersRef.current.forEach(marker => marker.remove());
        policeMarkersRef.current = [];

        // Add new police markers
        policeReports.forEach(report => {
            const el = document.createElement('div');
            el.className = 'police-marker';
            el.innerHTML = '🚔';
            el.title = `Police checkpoint (${report.confirmations} confirmations)`;

            const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat([report.lng, report.lat])
                .addTo(mapRef.current!);

            policeMarkersRef.current.push(marker);
        });
    }, [policeReports, isMapLoaded]);

    // Display route if provided
    useEffect(() => {
        if (!mapRef.current || !isMapLoaded || !routeGeometry) return;

        const map = mapRef.current;

        // Add or update route layer
        if (map.getSource('route')) {
            (map.getSource('route') as maplibregl.GeoJSONSource).setData({
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

// Map styles - using OpenFreeMap (free, no API key needed)
// Note: Ola Maps style.json has internal reference issues causing "Map error: gt"
// OpenFreeMap works reliably and has global coverage
function getMapStyle(theme: 'dark' | 'light'): string {
    // OpenFreeMap styles that work reliably
    // Available: liberty (colorful), bright, positron (light), fiord (dark-ish)
    return theme === 'dark'
        ? 'https://tiles.openfreemap.org/styles/dark'
        : 'https://tiles.openfreemap.org/styles/positron';

    // TODO: Re-enable Ola Maps when they fix their style.json internal references
    // const apiKey = import.meta.env.VITE_OLA_API_KEY;
    // const styleName = theme === 'dark' ? 'default-dark-standard' : 'default-light-standard';
    // return `https://api.olamaps.io/tiles/vector/v1/styles/${styleName}/style.json?api_key=${apiKey}`;
}

export default MapBoard;
