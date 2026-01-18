/**
 * OverspeedOverlay.tsx - Visual overspeed warning
 * 
 * PHASE 29: Minimalist "Breathing Border" instead of scary red overlay.
 * Uses inset box-shadow for a subtle but noticeable pulsing red border.
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
            {/* Breathing Border - Subtle pulsing red border around screen */}
            <div className="overspeed-border" />

            <style>{`
                .overspeed-border {
                    position: fixed;
                    inset: 0;
                    width: 100vw;
                    height: 100vh;
                    z-index: 9999;
                    pointer-events: none;
                    /* Pulsing red border using inset box-shadow */
                    box-shadow: inset 0 0 0 12px rgba(255, 50, 50, 0.5);
                    animation: pulseRedBorder 2s ease-in-out infinite;
                    border-radius: 0;
                }

                @keyframes pulseRedBorder {
                    0%, 100% { 
                        box-shadow: inset 0 0 0 8px rgba(255, 50, 50, 0.4);
                    }
                    50% { 
                        box-shadow: inset 0 0 0 20px rgba(255, 50, 50, 0.7);
                    }
                }
            `}</style>
        </>
    );
}

export default OverspeedOverlay;
