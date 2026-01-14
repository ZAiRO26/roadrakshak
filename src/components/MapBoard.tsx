import { useEffect, useRef, useState, useCallback } from 'react';
import { OlaMaps } from 'olamaps-web-sdk';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useGpsStore } from '../stores/gpsStore';
import { useAppStore } from '../stores/appStore';
import { useSmoothPosition } from '../hooks/useSmoothPosition';
import { getAllOfficialCameras, mergeCamerasWithPriority } from '../services/CameraLoader';
import { getUserCamerasAsNodes } from '../services/OverrideService';
import type { CameraNode } from '../types/camera';
import { CAMERA_CORRECTED_EVENT } from './SnapToMeButton';
import { USER_CAMERA_ADDED_EVENT } from './AddCameraButton';

export interface MapControls {
    zoomIn: () => void;
    zoomOut: () => void;
    recenterToUser: () => void;
    flyTo: (lat: number, lng: number, zoom?: number) => void;
}

interface MapBoardProps {
    onMapReady?: (map: any) => void;
    onMapControlsReady?: (controls: MapControls) => void;
    routeGeometry?: GeoJSON.LineString | null;
}

// Default center: Delhi, India
const DEFAULT_CENTER: [number, number] = [77.2090, 28.6139];
const DEFAULT_ZOOM = 12;

// Get API key once at module level
const API_KEY = import.meta.env.VITE_OLA_API_KEY || '';

export function MapBoard({ onMapReady, onMapControlsReady, routeGeometry }: MapBoardProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const olaMapsRef = useRef<OlaMaps | null>(null);
    const userMarkerRef = useRef<any>(null);
    const cameraMarkersRef = useRef<any[]>([]);
    const officialCameraMarkersRef = useRef<any[]>([]);
    const userCameraMarkersRef = useRef<any[]>([]);
    const policeMarkersRef = useRef<any[]>([]);
    const initializingRef = useRef(false);

    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [cameraRefreshTrigger, setCameraRefreshTrigger] = useState(0);

    // Use smooth position for animated marker (fixes jumping dot)
    const { latitude, longitude, heading } = useSmoothPosition();

    // Raw GPS for map centering (immediate response needed)
    const { latitude: rawLat, longitude: rawLng } = useGpsStore();

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

        // Use Ola Maps built-in dark style with labels
        // default-dark-standard includes POI labels unlike bolt-dark
        const styleUrl = `https://api.olamaps.io/tiles/vector/v1/styles/default-dark-standard/style.json`;

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

                    // Expose map control methods
                    onMapControlsReady?.({
                        zoomIn: () => map.zoomIn(),
                        zoomOut: () => map.zoomOut(),
                        recenterToUser: () => {
                            const lat = useGpsStore.getState().latitude;
                            const lng = useGpsStore.getState().longitude;
                            if (lat !== null && lng !== null) {
                                map.flyTo({ center: [lng, lat], zoom: 15, duration: 1000 });
                            }
                        },
                        flyTo: (lat: number, lng: number, zoom?: number) => {
                            map.flyTo({ center: [lng, lat], zoom: zoom || 14, duration: 1000 });
                        },
                    });
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
        // Use default-dark-standard for dark theme (includes labels)
        const styleName = theme === 'dark' ? 'default-dark-standard' : 'default-light-standard';
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

    // Follow user position (use raw GPS for centering, smooth for marker)
    useEffect(() => {
        if (mapRef.current && rawLat !== null && rawLng !== null && isMapLoaded) {
            updateUserMarker();
            mapRef.current.easeTo({
                center: [rawLng, rawLat],
                duration: 500,
            });
        }
    }, [rawLat, rawLng, isMapLoaded, updateUserMarker]);

    // Listen for camera events to refresh markers instantly
    useEffect(() => {
        const handleRefresh = () => {
            setCameraRefreshTrigger(prev => prev + 1);
        };

        window.addEventListener(CAMERA_CORRECTED_EVENT, handleRefresh);
        window.addEventListener(USER_CAMERA_ADDED_EVENT, handleRefresh);
        return () => {
            window.removeEventListener(CAMERA_CORRECTED_EVENT, handleRefresh);
            window.removeEventListener(USER_CAMERA_ADDED_EVENT, handleRefresh);
        };
    }, []);

    // User Camera markers (purple - user added)
    useEffect(() => {
        if (!mapRef.current || !isMapLoaded || !olaMapsRef.current) return;

        userCameraMarkersRef.current.forEach(marker => marker.remove());
        userCameraMarkersRef.current = [];

        const userCameras = getUserCamerasAsNodes();

        userCameras.forEach(camera => {
            const el = document.createElement('div');
            el.className = 'camera-marker camera-user';
            el.innerHTML = camera.type === 'RED_LIGHT_CAM' ? '🚦' : '📷';
            el.title = `👤 USER: ${camera.name}`;

            el.onclick = () => {
                alert(`👤 USER CAMERA\n\n📍 ${camera.name}\n📋 Type: ${camera.type === 'RED_LIGHT_CAM' ? 'Red Light Camera' : 'Speed Camera'}`);
            };

            const marker = olaMapsRef.current!.addMarker({
                element: el,
                anchor: 'center',
            })
                .setLngLat([camera.lng, camera.lat])
                .addTo(mapRef.current);

            userCameraMarkersRef.current.push(marker);
        });
    }, [isMapLoaded, cameraRefreshTrigger]);

    // OSM Camera markers (blue - lower priority)
    useEffect(() => {
        if (!mapRef.current || !isMapLoaded || !olaMapsRef.current) return;

        cameraMarkersRef.current.forEach(marker => marker.remove());
        cameraMarkersRef.current = [];

        // Convert OSM cameras to CameraNode format for merging
        const osmCameras: CameraNode[] = cameras.map((cam, idx) => ({
            id: `osm_${idx}`,
            lat: cam.lat,
            lng: cam.lng,
            type: 'SPEED_CAM' as const,
            source: 'OSM' as const,
            direction: cam.direction,
        }));

        // Merge with official cameras (official takes priority)
        const officialCameras = getAllOfficialCameras();
        const mergedOsmCameras = mergeCamerasWithPriority(officialCameras, osmCameras)
            .filter(c => c.source === 'OSM');

        mergedOsmCameras.forEach(camera => {
            const el = document.createElement('div');
            el.className = 'camera-marker camera-osm';
            el.innerHTML = '📷';
            el.title = 'Speed Camera (OSM)';

            const marker = olaMapsRef.current!.addMarker({
                element: el,
                anchor: 'center',
            })
                .setLngLat([camera.lng, camera.lat])
                .addTo(mapRef.current);

            cameraMarkersRef.current.push(marker);
        });
    }, [cameras, isMapLoaded]);

    // Official Camera markers (red - highest priority, rendered on top)
    // Re-renders when cameraRefreshTrigger changes (after user correction)
    useEffect(() => {
        if (!mapRef.current || !isMapLoaded || !olaMapsRef.current) return;

        officialCameraMarkersRef.current.forEach(marker => marker.remove());
        officialCameraMarkersRef.current = [];

        const officialCameras = getAllOfficialCameras();

        officialCameras.forEach(camera => {
            const el = document.createElement('div');
            el.className = `camera-marker camera-official ${camera.type === 'RED_LIGHT_CAM' ? 'red-light' : 'speed'}`;
            el.innerHTML = camera.type === 'RED_LIGHT_CAM' ? '🚦' : '📷';

            const limitText = camera.limit ? `Limit: ${camera.limit} km/h` : 'No speed limit';
            el.title = `⚠️ OFFICIAL: ${camera.name}\n${limitText}`;

            // Add click handler for popup
            el.onclick = () => {
                alert(`⚠️ OFFICIAL CAMERA\n\n📍 ${camera.name}\n🏎️ ${limitText}\n📋 Type: ${camera.type === 'RED_LIGHT_CAM' ? 'Red Light Camera' : 'Speed Camera'}`);
            };

            const marker = olaMapsRef.current!.addMarker({
                element: el,
                anchor: 'center',
            })
                .setLngLat([camera.lng, camera.lat])
                .addTo(mapRef.current);

            officialCameraMarkersRef.current.push(marker);
        });
    }, [isMapLoaded, cameraRefreshTrigger]);

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
          transition: transform 0.15s ease;
        }
        .camera-marker:hover, .police-marker:hover {
          transform: scale(1.3);
        }
        /* OSM cameras - blue tint */
        .camera-osm {
          filter: drop-shadow(0 2px 4px rgba(59, 130, 246, 0.5)) hue-rotate(200deg);
          z-index: 10;
        }
        /* Official cameras - red highlight, on top */
        .camera-official {
          filter: drop-shadow(0 2px 8px rgba(239, 68, 68, 0.8));
          z-index: 100;
          font-size: 28px;
        }
        .camera-official.speed {
          filter: drop-shadow(0 3px 10px rgba(239, 68, 68, 0.9)) brightness(1.1);
        }
        .camera-official.red-light {
          filter: drop-shadow(0 3px 10px rgba(251, 191, 36, 0.9));
        }
        /* User cameras - purple highlight */
        .camera-user {
          filter: drop-shadow(0 3px 10px rgba(139, 92, 246, 0.9)) brightness(1.1);
          z-index: 50;
          font-size: 26px;
        }
      `}</style>
        </>
    );
}

export default MapBoard;
