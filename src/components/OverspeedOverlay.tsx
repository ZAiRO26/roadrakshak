/**
 * OverspeedOverlay.tsx - Visual overspeed warning
 * 
 * Full-screen red overlay when user exceeds speed limit.
 * Uses pointer-events: none to allow interaction with underlying UI.
 */

import { useGpsStore } from '../stores/gpsStore';
import { useAppStore } from '../stores/appStore';

export function OverspeedOverlay() {
    const speed = useGpsStore(state => state.speed);
    const currentSpeedLimit = useAppStore(state => state.currentSpeedLimit);

    // Speed is ALREADY in km/h from gpsStore (no conversion needed!)
    const currentSpeedKmh = speed;

    // Check if overspeeding:
    // 1. Speed limit must be valid (not null, not 0)
    // 2. Current speed must exceed the limit
    const isOverspeeding = currentSpeedLimit !== null && currentSpeedLimit > 0 && currentSpeedKmh > currentSpeedLimit;

    // Don't render if not overspeeding
    if (!isOverspeeding) return null;

    return (
        <>
            <div className="overspeed-overlay" />

            <style>{`
                .overspeed-overlay {
                    position: fixed;
                    inset: 0;
                    width: 100vw;
                    height: 100vh;
                    background-color: rgba(255, 0, 0, 0.4);
                    z-index: 9999;
                    pointer-events: none;
                    animation: overspeedPulse 0.8s ease-in-out infinite;
                }

                @keyframes overspeedPulse {
                    0%, 100% { 
                        background-color: rgba(255, 0, 0, 0.3);
                    }
                    50% { 
                        background-color: rgba(255, 0, 0, 0.5);
                    }
                }
            `}</style>
        </>
    );
}

export default OverspeedOverlay;
