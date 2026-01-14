/**
 * useBackgroundMode.ts - Auto-enable background mode when driving
 * 
 * Integrates BackgroundKeepAlive with speed detection:
 * - Enables when speed > 10 km/h
 * - Disables when speed drops to 0 for 2+ minutes
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useGpsStore } from '../stores/gpsStore';
import { useAppStore } from '../stores/appStore';
import { enableBackgroundMode, disableBackgroundMode, isBackgroundModeEnabled } from '../services/BackgroundKeepAlive';

const DRIVING_THRESHOLD = 10; // km/h - consider driving above this speed
const STOP_TIMEOUT = 120000; // 2 minutes of 0 speed before disabling

export function useBackgroundMode() {
    const { speed } = useGpsStore();
    const { backgroundModeEnabled, setBackgroundModeEnabled } = useAppStore();
    const [isActive, setIsActive] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const stopTimerRef = useRef<number | null>(null);

    /**
     * Toggle background mode setting
     */
    const toggleBackgroundMode = useCallback(() => {
        const newEnabled = !backgroundModeEnabled;
        setBackgroundModeEnabled(newEnabled);

        if (!newEnabled) {
            // Disable immediately if user turns it off
            disableBackgroundMode();
            setIsActive(false);
            setToastMessage('🔋 Background Mode OFF');
        } else {
            setToastMessage('🔋 Background Mode ON (Experimental)');
            // Will auto-activate when driving starts
        }
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    }, [backgroundModeEnabled, setBackgroundModeEnabled]);

    /**
     * Force enable background mode (for manual trigger)
     */
    const forceEnable = useCallback(() => {
        if (backgroundModeEnabled) {
            enableBackgroundMode();
            setIsActive(true);
            console.log('[useBackgroundMode] Manually enabled');
        }
    }, [backgroundModeEnabled]);

    /**
     * Auto-enable when driving detected
     */
    useEffect(() => {
        if (!backgroundModeEnabled) {
            return;
        }

        // Driving detected
        if (speed !== null && speed > DRIVING_THRESHOLD) {
            // Clear any pending stop timer
            if (stopTimerRef.current) {
                clearTimeout(stopTimerRef.current);
                stopTimerRef.current = null;
            }

            // Enable background mode if not already
            if (!isActive && !isBackgroundModeEnabled()) {
                console.log('[useBackgroundMode] Speed > 10 km/h, enabling background mode');
                enableBackgroundMode();
                setIsActive(true);
            }
        }
        // Stopped
        else if (speed !== null && speed < 2 && isActive) {
            // Start timer to disable after 2 minutes of being stopped
            if (!stopTimerRef.current) {
                console.log('[useBackgroundMode] Speed < 2 km/h, starting stop timer');
                stopTimerRef.current = window.setTimeout(() => {
                    console.log('[useBackgroundMode] Stopped for 2 minutes, disabling background mode');
                    disableBackgroundMode();
                    setIsActive(false);
                    stopTimerRef.current = null;
                }, STOP_TIMEOUT);
            }
        }
    }, [speed, backgroundModeEnabled, isActive]);

    /**
     * Cleanup on unmount
     */
    useEffect(() => {
        return () => {
            if (stopTimerRef.current) {
                clearTimeout(stopTimerRef.current);
            }
        };
    }, []);

    return {
        backgroundModeEnabled,
        isActive,
        toggleBackgroundMode,
        forceEnable,
        showToast,
        toastMessage,
    };
}
