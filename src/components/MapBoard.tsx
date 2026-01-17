import { useEffect, useRef, useState, useCallback } from 'react';
import { OlaMaps } from 'olamaps-web-sdk';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useGpsStore } from '../stores/gpsStore';
import { useAppStore } from '../stores/appStore';
import { useSmoothPosition } from '../hooks/useSmoothPosition';
import { getAllOfficialCameras, mergeCamerasWithPriority } from '../services/CameraLoader';
import { getUserCamerasAsNodes, hasOverride } from '../services/OverrideService';
import type { CameraNode } from '../types/camera';
import { CAMERA_CORRECTED_EVENT } from './SnapToMeButton';
import { USER_CAMERA_ADDED_EVENT } from './AddCameraButton';
import { CameraPopup } from './CameraPopup';

// Event for camera deletion
export const CAMERA_DELETED_EVENT = 'camera-deleted';

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
    isNavigating?: boolean;  // Enable follow mode during navigation
    destination?: { lat: number; lng: number; name: string } | null;  // Destination marker
}

// Default center: Delhi, India
const DEFAULT_CENTER: [number, number] = [77.2090, 28.6139];
const DEFAULT_ZOOM = 12;

// Get API key once at module level
const API_KEY = import.meta.env.VITE_OLA_API_KEY || '';

export function MapBoard({ onMapReady, onMapControlsReady, routeGeometry, isNavigating, destination }: MapBoardProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const olaMapsRef = useRef<OlaMaps | null>(null);
    const userMarkerRef = useRef<any>(null);
    const cameraMarkersRef = useRef<any[]>([]);
    const officialCameraMarkersRef = useRef<any[]>([]);
    const userCameraMarkersRef = useRef<any[]>([]);
    const policeMarkersRef = useRef<any[]>([]);
    const destinationMarkerRef = useRef<any>(null);
    const initializingRef = useRef(false);

    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [cameraRefreshTrigger, setCameraRefreshTrigger] = useState(0);
    const [selectedCamera, setSelectedCamera] = useState<(CameraNode & { hasOverride?: boolean }) | null>(null);

    // Free Roam Mode - controls whether map follows user
    const [isAutoFollow, setIsAutoFollow] = useState(true);
    const isAutoFollowRef = useRef(true); // Ref to track current value for closures
    const pauseFollowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastCenteredPositionRef = useRef<{ lat: number; lng: number } | null>(null);

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
                    console.log('Ola Map loaded successfully');
                    setIsMapLoaded(true);
                    setLoading(false);
                    onMapReady?.(map);

                    // Expose map control methods with smart camera
                    onMapControlsReady?.({
                        zoomIn: () => map.zoomIn(),
                        zoomOut: () => map.zoomOut(),
                        recenterToUser: () => {
                            const gpsState = useGpsStore.getState();
                            const lat = gpsState.latitude;
                            const lng = gpsState.longitude;
                            const userHeading = gpsState.heading || 0;

                            if (lat !== null && lng !== null) {
                                // Clear any pending auto-resume timer
                                if (pauseFollowTimeoutRef.current) {
                                    clearTimeout(pauseFollowTimeoutRef.current);
                                    pauseFollowTimeoutRef.current = null;
                                }

                                // Re-enable auto-follow
                                setIsAutoFollow(true);

                                // Use 3D view if navigating, 2D otherwise
                                // Note: We use mapRef to store isNavigating for recenter access
                                map.flyTo({
                                    center: [lng, lat],
                                    zoom: isNavigating ? 18 : 15,
                                    pitch: isNavigating ? 60 : 0,
                                    bearing: isNavigating ? userHeading : 0,
                                    duration: 1000,
                                    essential: true
                                });
                            }
                        },
                        flyTo: (lat: number, lng: number, zoom?: number) => {
                            map.flyTo({ center: [lng, lat], zoom: zoom || 14, duration: 1000 });
                        },
                    });

                    // === SMART AUTO-FOLLOW: Track user interactions ===

                    // Helper: Start auto-resume timer (10 seconds)
                    const startAutoResumeTimer = () => {
                        if (pauseFollowTimeoutRef.current) {
                            clearTimeout(pauseFollowTimeoutRef.current);
                        }
                        pauseFollowTimeoutRef.current = setTimeout(() => {
                            // Re-enable auto-follow
                            setIsAutoFollow(true);
                            isAutoFollowRef.current = true;
                            pauseFollowTimeoutRef.current = null;

                            // IMMEDIATELY snap camera back to user's current GPS location
                            const gpsState = useGpsStore.getState();
                            const lat = gpsState.latitude;
                            const lng = gpsState.longitude;
                            const userHeading = gpsState.heading || 0;

                            if (lat !== null && lng !== null && map) {
                                // Use 3D view if navigating, 2D otherwise
                                map.easeTo({
                                    center: [lng, lat],
                                    zoom: isNavigating ? 18 : 15,
                                    pitch: isNavigating ? 60 : 0,
                                    bearing: isNavigating ? userHeading : 0,
                                    duration: 1000,
                                });
                            }
                        }, 10000); // 10 second timeout
                    };

                    // On dragstart/mousedown/touchstart: Disable auto-follow
                    const handleInteractionStart = () => {
                        setIsAutoFollow(false);
                        isAutoFollowRef.current = false; // Update ref for closure access
                        // Clear any pending timer since user is actively interacting
                        if (pauseFollowTimeoutRef.current) {
                            clearTimeout(pauseFollowTimeoutRef.current);
                            pauseFollowTimeoutRef.current = null;
                        }
                    };

                    // On dragend/mouseup/touchend/moveend: Start 10-second timer
                    const handleInteractionEnd = () => {
                        // Always start the timer after interaction ends
                        // (The timer will re-enable auto-follow after 10 seconds)
                        startAutoResumeTimer();
                    };

                    // Register interaction listeners
                    map.on('dragstart', handleInteractionStart);
                    map.on('mousedown', handleInteractionStart);
                    map.on('touchstart', handleInteractionStart);

                    map.on('dragend', handleInteractionEnd);
                    map.on('mouseup', handleInteractionEnd);
                    map.on('touchend', handleInteractionEnd);

                    // Refresh camera markers on viewport change (debounced)
                    let moveEndTimeout: ReturnType<typeof setTimeout> | null = null;
                    map.on('moveend', () => {
                        // Also handle interaction end
                        handleInteractionEnd();

                        // Debounce to prevent rapid re-renders during pan/zoom
                        if (moveEndTimeout) clearTimeout(moveEndTimeout);
                        moveEndTimeout = setTimeout(() => {
                            setCameraRefreshTrigger(prev => prev + 1);
                        }, 300); // 300ms debounce
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

    // Follow user position - Enhanced for navigation mode with auto-follow control
    useEffect(() => {
        if (!mapRef.current || rawLat === null || rawLng === null || !isMapLoaded) return;

        // Always update user marker position (no throttle for dot)
        updateUserMarker();

        // Calculate distance from last centered position (5m threshold to prevent micro-jitter)
        const calcDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
            const R = 6371000; // Earth's radius in meters
            const dLat = (lat2 - lat1) * (Math.PI / 180);
            const dLng = (lng2 - lng1) * (Math.PI / 180);
            const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
                Math.sin(dLng / 2) ** 2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        // Check if we should update based on movement (5m threshold in normal mode)
        const lastPos = lastCenteredPositionRef.current;
        const movedDistance = lastPos ? calcDistance(lastPos.lat, lastPos.lng, rawLat, rawLng) : Infinity;
        const THRESHOLD = isNavigating ? 2 : 5; // 2m for nav, 5m for normal

        if (movedDistance < THRESHOLD && lastPos) {
            return; // Haven't moved enough, skip center update
        }

        if (isNavigating) {
            // NAVIGATION MODE: Always follow, but with auto-resume after 10s if paused
            if (!isAutoFollow) {
                // User dragged during navigation - auto-resume after 10 seconds
                if (pauseFollowTimeoutRef.current) {
                    clearTimeout(pauseFollowTimeoutRef.current);
                }
                pauseFollowTimeoutRef.current = setTimeout(() => {
                    setIsAutoFollow(true);
                }, 10000);
                return;
            }

            // NAVIGATION MODE: 3D Driver's View - Tilted & Rotated
            mapRef.current.easeTo({
                center: [rawLng, rawLat],
                zoom: 18,           // Closer view for navigation
                bearing: heading || 0,  // Rotate map so car faces UP
                pitch: 60,          // 3D "Horizon" view
                duration: 600,      // Smoother following
            });
            lastCenteredPositionRef.current = { lat: rawLat, lng: rawLng };
        } else {
            // NORMAL MODE: Only center if auto-follow is enabled
            if (!isAutoFollow) return;

            mapRef.current.easeTo({
                center: [rawLng, rawLat],
                bearing: 0,
                pitch: 0,
                duration: 500,
            });
            lastCenteredPositionRef.current = { lat: rawLat, lng: rawLng };
        }
    }, [rawLat, rawLng, heading, isMapLoaded, isNavigating, isAutoFollow, updateUserMarker]);

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
            // Use purple map pin for USER cameras (distinct from official camera icons)
            el.innerHTML = '📍';
            el.title = `👤 USER: ${camera.name}${camera.limit ? ` (${camera.limit} km/h)` : ''}`;

            el.onclick = () => {
                setSelectedCamera({ ...camera, hasOverride: false });
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

        // Get current map bounds for viewport filtering (performance optimization)
        const bounds = mapRef.current.getBounds();
        const padding = 0.02; // ~2km buffer zone
        const visibleCameras = officialCameras.filter(camera => {
            return camera.lat >= bounds.getSouth() - padding &&
                camera.lat <= bounds.getNorth() + padding &&
                camera.lng >= bounds.getWest() - padding &&
                camera.lng <= bounds.getEast() + padding;
        });

        // Only render visible cameras (reduces DOM nodes from 900+ to ~50)
        visibleCameras.forEach(camera => {
            const el = document.createElement('div');

            // Determine marker class and icon based on type
            const isPolicePost = camera.type === 'POLICE_POST';
            const isRedLight = camera.type === 'RED_LIGHT_CAM';
            const isAiCam = camera.type === 'AI_CAM';

            if (isPolicePost) {
                el.className = 'camera-marker camera-police';
                el.innerHTML = '🚓';
            } else if (isAiCam) {
                el.className = 'camera-marker camera-ai';
                el.innerHTML = '👁️';
            } else {
                el.className = `camera-marker camera-official ${isRedLight ? 'red-light' : 'speed'}`;
                el.innerHTML = isRedLight ? '🚦' : '📷';
            }

            const limitText = camera.limit
                ? `Limit: ${camera.limit} km/h`
                : (isPolicePost ? 'Police Checkpoint' : (isAiCam ? 'AI Enforcement Zone' : 'No speed limit'));
            const isFixed = hasOverride(camera.id);
            const typeLabel = isPolicePost
                ? '👮 HSP CHECKPOINT'
                : (isAiCam ? '🤖 AI ENFORCEMENT' : '⚠️ OFFICIAL');
            el.title = `${typeLabel}: ${camera.name}\n${limitText}${isFixed ? ' (📍 Fixed)' : ''}`;

            // Add click handler for popup
            el.onclick = () => {
                setSelectedCamera({ ...camera, hasOverride: isFixed });
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

    // Destination marker - Big red pin at destination
    useEffect(() => {
        if (!mapRef.current || !isMapLoaded || !olaMapsRef.current) return;

        // Remove existing destination marker
        if (destinationMarkerRef.current) {
            destinationMarkerRef.current.remove();
            destinationMarkerRef.current = null;
        }

        // If no destination, nothing to render
        if (!destination) return;

        // Create destination marker element
        const el = document.createElement('div');
        el.className = 'destination-marker';
        el.innerHTML = '📍';
        el.title = destination.name;

        const marker = olaMapsRef.current.addMarker({
            element: el,
            anchor: 'bottom',
        })
            .setLngLat([destination.lng, destination.lat])
            .addTo(mapRef.current);

        destinationMarkerRef.current = marker;

        // Cleanup on unmount
        return () => {
            if (destinationMarkerRef.current) {
                destinationMarkerRef.current.remove();
                destinationMarkerRef.current = null;
            }
        };
    }, [destination, isMapLoaded]);

    // Display route with enhanced styling
    // This function adds route layers - called on routeGeometry change and after style loads
    const addRouteLayers = useCallback(() => {
        if (!mapRef.current || !routeGeometry || routeGeometry.coordinates.length === 0) return;

        const map = mapRef.current;

        // Wait for style to be loaded
        if (!map.isStyleLoaded()) {
            map.once('style.load', addRouteLayers);
            return;
        }

        const routeData = {
            type: 'Feature' as const,
            properties: {},
            geometry: routeGeometry,
        };

        try {
            if (map.getSource('route')) {
                // Update existing source
                map.getSource('route').setData(routeData);
            } else {
                // Add new source and layers
                map.addSource('route', {
                    type: 'geojson',
                    data: routeData,
                });

                // Outer glow/outline layer (thicker, darker)
                map.addLayer({
                    id: 'route-outline',
                    type: 'line',
                    source: 'route',
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round',
                    },
                    paint: {
                        'line-color': '#1a56db',  // Darker blue for outline
                        'line-width': 12,
                        'line-opacity': 0.5,
                    },
                });

                // Inner main route line (brighter blue)
                map.addLayer({
                    id: 'route',
                    type: 'line',
                    source: 'route',
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round',
                    },
                    paint: {
                        'line-color': '#4285F4',  // Google Maps blue
                        'line-width': 7,
                        'line-opacity': 0.95,
                    },
                });
            }
        } catch (e) {
            console.warn('Failed to add route layers:', e);
        }
    }, [routeGeometry]);

    // Route layer management
    useEffect(() => {
        if (!mapRef.current || !isMapLoaded) return;

        const map = mapRef.current;

        // If no route geometry, remove existing route layers
        if (!routeGeometry || routeGeometry.coordinates.length === 0) {
            try {
                if (map.getLayer('route')) map.removeLayer('route');
                if (map.getLayer('route-outline')) map.removeLayer('route-outline');
                if (map.getSource('route')) map.removeSource('route');
            } catch (e) {
                // Ignore errors during cleanup
            }
            return;
        }

        // Add route layers
        addRouteLayers();

        // Re-add route layers after style changes (theme switch)
        const handleStyleLoad = () => {
            addRouteLayers();
        };
        map.on('style.load', handleStyleLoad);

        return () => {
            map.off('style.load', handleStyleLoad);
        };
    }, [routeGeometry, isMapLoaded, addRouteLayers]);

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
        /* User cameras - purple pin with strong glow */
        .camera-user {
          filter: drop-shadow(0 4px 15px rgba(139, 92, 246, 1)) brightness(1.2);
          z-index: 60;
          font-size: 30px;
          cursor: pointer;
        }
        /* Police checkpoints - blue glow */
        .camera-police {
          filter: drop-shadow(0 3px 12px rgba(59, 130, 246, 0.9)) brightness(1.1);
          z-index: 40;
          font-size: 26px;
          cursor: pointer;
        }
        /* AI Cameras - yellow/black warning */
        .camera-ai {
          filter: drop-shadow(0 4px 15px rgba(234, 179, 8, 1)) brightness(1.3);
          z-index: 70;
          font-size: 28px;
          cursor: pointer;
        }
        /* Destination marker - Large red pin */
        .destination-marker {
          font-size: 48px;
          z-index: 100;
          filter: drop-shadow(0 4px 12px rgba(239, 68, 68, 0.8));
          animation: destinationBounce 0.6s ease-out;
          transform-origin: bottom center;
        }
        @keyframes destinationBounce {
          0% { transform: translateY(-30px) scale(0.5); opacity: 0; }
          60% { transform: translateY(5px) scale(1.1); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>

            {/* Camera Popup */}
            {selectedCamera && (
                <CameraPopup
                    camera={selectedCamera}
                    onClose={() => setSelectedCamera(null)}
                    onAction={() => {
                        setCameraRefreshTrigger(prev => prev + 1);
                        window.dispatchEvent(new CustomEvent(CAMERA_DELETED_EVENT));
                    }}
                />
            )}
        </>
    );
}

export default MapBoard;
