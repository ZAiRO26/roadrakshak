import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../stores/appStore';

export function useWakeLock() {
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);
    const { wakeLockActive, setWakeLockActive } = useAppStore();

    const requestWakeLock = useCallback(async () => {
        if (!('wakeLock' in navigator)) {
            console.warn('Wake Lock API not supported');
            return false;
        }

        try {
            wakeLockRef.current = await navigator.wakeLock.request('screen');
            setWakeLockActive(true);

            wakeLockRef.current.addEventListener('release', () => {
                setWakeLockActive(false);
            });

            return true;
        } catch (err) {
            console.error('Failed to acquire wake lock:', err);
            setWakeLockActive(false);
            return false;
        }
    }, [setWakeLockActive]);

    const releaseWakeLock = useCallback(async () => {
        if (wakeLockRef.current) {
            await wakeLockRef.current.release();
            wakeLockRef.current = null;
            setWakeLockActive(false);
        }
    }, [setWakeLockActive]);

    // Re-acquire wake lock when page becomes visible again
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible' && !wakeLockRef.current) {
                await requestWakeLock();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [requestWakeLock]);

    return {
        wakeLockActive,
        requestWakeLock,
        releaseWakeLock,
    };
}
