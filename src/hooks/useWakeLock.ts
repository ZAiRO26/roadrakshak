/**
 * useWakeLock.ts - Screen Wake Lock with Re-acquisition Strategy
 * 
 * Keeps screen awake while driving. Handles visibility change to re-acquire
 * lock when user returns to the app after minimizing.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAppStore } from '../stores/appStore';

export function useWakeLock() {
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);
    const { wakeLockActive, setWakeLockActive } = useAppStore();

    // Track user intent - should the lock be on?
    const [shouldBeLocked, setShouldBeLocked] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    /**
     * Request wake lock from the browser
     */
    const requestWakeLock = useCallback(async (): Promise<boolean> => {
        if (!('wakeLock' in navigator)) {
            console.warn('[WakeLock] API not supported in this browser');
            return false;
        }

        // Don't request if already have an active lock
        if (wakeLockRef.current !== null) {
            console.log('[WakeLock] Already have active lock');
            return true;
        }

        try {
            wakeLockRef.current = await navigator.wakeLock.request('screen');
            setWakeLockActive(true);
            console.log('[WakeLock] 🔒 Screen wake lock acquired');

            // Listen for release events (browser may release for various reasons)
            wakeLockRef.current.addEventListener('release', () => {
                console.log('[WakeLock] 🔓 Screen wake lock released');
                wakeLockRef.current = null;
                setWakeLockActive(false);
            });

            return true;
        } catch (err) {
            console.error('[WakeLock] Failed to acquire:', err);
            wakeLockRef.current = null;
            setWakeLockActive(false);
            return false;
        }
    }, [setWakeLockActive]);

    /**
     * Release wake lock
     */
    const releaseWakeLock = useCallback(async () => {
        if (wakeLockRef.current) {
            try {
                await wakeLockRef.current.release();
                console.log('[WakeLock] 🔓 Manually released');
            } catch (err) {
                console.error('[WakeLock] Release failed:', err);
            }
            wakeLockRef.current = null;
            setWakeLockActive(false);
        }
    }, [setWakeLockActive]);

    /**
     * Toggle wake lock on/off
     */
    const toggleWakeLock = useCallback(async () => {
        if (shouldBeLocked) {
            // Turn OFF
            setShouldBeLocked(false);
            await releaseWakeLock();
            setToastMessage('🔓 Screen Wake Lock OFF');
            setShowToast(true);
            setTimeout(() => setShowToast(false), 2000);
        } else {
            // Turn ON
            setShouldBeLocked(true);
            const success = await requestWakeLock();
            if (success) {
                setToastMessage('🔒 Screen Wake Lock ACTIVE');
            } else {
                setToastMessage('⚠️ Wake Lock not supported');
                setShouldBeLocked(false);
            }
            setShowToast(true);
            setTimeout(() => setShowToast(false), 2000);
        }
    }, [shouldBeLocked, requestWakeLock, releaseWakeLock]);

    /**
     * CRITICAL: Re-acquire wake lock when page becomes visible again
     * This handles the case when user minimizes/switches tabs and returns
     */
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible' && shouldBeLocked) {
                console.log('[WakeLock] Page visible, re-acquiring lock...');
                await requestWakeLock();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [shouldBeLocked, requestWakeLock]);

    /**
     * Also handle focus events for extra reliability
     */
    useEffect(() => {
        const handleFocus = async () => {
            if (shouldBeLocked && wakeLockRef.current === null) {
                console.log('[WakeLock] Window focused, re-acquiring lock...');
                await requestWakeLock();
            }
        };

        window.addEventListener('focus', handleFocus);
        return () => {
            window.removeEventListener('focus', handleFocus);
        };
    }, [shouldBeLocked, requestWakeLock]);

    /**
     * Clean up on unmount
     */
    useEffect(() => {
        return () => {
            if (wakeLockRef.current) {
                wakeLockRef.current.release().catch(() => { });
            }
        };
    }, []);

    return {
        wakeLockActive,
        shouldBeLocked,
        toggleWakeLock,
        requestWakeLock,
        releaseWakeLock,
        showToast,
        toastMessage,
    };
}
