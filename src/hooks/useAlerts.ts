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

    const playAlert = useCallback((type: 'camera' | 'police' | 'speeding', message?: string) => {
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

        // Text-to-Speech announcement
        if (message && 'speechSynthesis' in window) {
            try {
                // Cancel any ongoing speech
                window.speechSynthesis.cancel();

                const utterance = new SpeechSynthesisUtterance(message);
                utterance.rate = 1.1; // Slightly faster
                utterance.pitch = 1.0;
                utterance.volume = 0.8;

                // Try to use a Hindi voice if available, fallback to default
                const voices = window.speechSynthesis.getVoices();
                const hindiVoice = voices.find(v => v.lang.includes('hi') || v.lang.includes('IN'));
                const englishVoice = voices.find(v => v.lang.includes('en'));
                utterance.voice = hindiVoice || englishVoice || null;

                window.speechSynthesis.speak(utterance);
            } catch (e) {
                console.warn('Text-to-Speech not available:', e);
            }
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
                    const speedingMessage = `Slow down! Speed limit is ${currentSpeedLimit} kilometers per hour`;
                    setActiveAlert({
                        id: alertId,
                        type: 'speeding',
                        message: speedingMessage,
                    });
                    playAlert('speeding', speedingMessage);
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
                        const cameraMessage = `Speed camera ahead in ${Math.round(distance)} meters`;
                        setActiveAlert({
                            id: alertId,
                            type: 'camera',
                            message: cameraMessage,
                            distance: Math.round(distance),
                        });
                        playAlert('camera', cameraMessage);
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
                        const policeMessage = `Police checkpoint ahead in ${Math.round(distance)} meters`;
                        setActiveAlert({
                            id: alertId,
                            type: 'police',
                            message: policeMessage,
                            distance: Math.round(distance),
                        });
                        playAlert('police', policeMessage);
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
