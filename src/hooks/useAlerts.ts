import { useEffect, useCallback, useRef } from 'react';
import { useGpsStore } from '../stores/gpsStore';
import { useAppStore } from '../stores/appStore';
import { calculateDistance } from './useGPS';

const CAMERA_ALERT_DISTANCE = 500; // meters
const POLICE_ALERT_DISTANCE = 1000; // meters
const CHECK_INTERVAL = 1000; // 1 second

export function useAlerts() {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const lastAlertRef = useRef<string | null>(null);
    const cooldownRef = useRef<number>(0);

    const { latitude, longitude, speed } = useGpsStore();
    const {
        cameras,
        policeReports,
        currentSpeedLimit,
        isMuted,
        activeAlert,
        setActiveAlert
    } = useAppStore();

    // Initialize audio element
    useEffect(() => {
        audioRef.current = new Audio();
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    const playAlert = useCallback((type: 'camera' | 'police' | 'speeding') => {
        if (isMuted || !audioRef.current) return;

        // Different frequencies for different alerts
        const frequencies: Record<string, number> = {
            camera: 800,
            police: 600,
            speeding: 1000,
        };

        // Create a simple beep using Web Audio API
        try {
            const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = frequencies[type];
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {
            console.warn('Could not play alert sound:', e);
        }
    }, [isMuted]);

    // Check for alerts periodically
    useEffect(() => {
        if (latitude === null || longitude === null) return;

        const checkAlerts = () => {
            const now = Date.now();

            // Cooldown check - don't spam alerts
            if (now - cooldownRef.current < 5000) return;

            // Check speed limit
            if (currentSpeedLimit && speed > currentSpeedLimit) {
                const alertId = 'speeding';
                if (lastAlertRef.current !== alertId) {
                    setActiveAlert({
                        id: alertId,
                        type: 'speeding',
                        message: `Slow down! Speed limit is ${currentSpeedLimit} km/h`,
                    });
                    playAlert('speeding');
                    lastAlertRef.current = alertId;
                    cooldownRef.current = now;
                }
                return;
            }

            // Check cameras
            for (const camera of cameras) {
                const distance = calculateDistance(latitude, longitude, camera.lat, camera.lng);
                if (distance < CAMERA_ALERT_DISTANCE) {
                    const alertId = `camera-${camera.id}`;
                    if (lastAlertRef.current !== alertId) {
                        setActiveAlert({
                            id: alertId,
                            type: 'camera',
                            message: `Speed camera ahead - ${Math.round(distance)}m`,
                            distance: Math.round(distance),
                        });
                        playAlert('camera');
                        lastAlertRef.current = alertId;
                        cooldownRef.current = now;
                    }
                    return;
                }
            }

            // Check police reports
            for (const report of policeReports) {
                const distance = calculateDistance(latitude, longitude, report.lat, report.lng);
                if (distance < POLICE_ALERT_DISTANCE) {
                    const alertId = `police-${report.id}`;
                    if (lastAlertRef.current !== alertId) {
                        setActiveAlert({
                            id: alertId,
                            type: 'police',
                            message: `Police checkpoint ahead - ${Math.round(distance)}m`,
                            distance: Math.round(distance),
                        });
                        playAlert('police');
                        lastAlertRef.current = alertId;
                        cooldownRef.current = now;
                    }
                    return;
                }
            }

            // Clear alerts if none active
            if (activeAlert && now - cooldownRef.current > 10000) {
                setActiveAlert(null);
                lastAlertRef.current = null;
            }
        };

        const interval = setInterval(checkAlerts, CHECK_INTERVAL);
        checkAlerts(); // Run immediately

        return () => clearInterval(interval);
    }, [latitude, longitude, speed, cameras, policeReports, currentSpeedLimit, activeAlert, setActiveAlert, playAlert]);

    return {
        activeAlert,
        clearAlert: () => {
            setActiveAlert(null);
            lastAlertRef.current = null;
        },
    };
}
