/**
 * RightControlPanel.tsx - Unified Right-Side Control Panel
 * 
 * PHASE 35: Consolidates all right-side controls into a single
 * flexbox container with organized groups for guaranteed alignment.
 */

import { useAppStore } from '../stores/appStore';
import { useWakeLock } from '../hooks/useWakeLock';
import { useBackgroundMode } from '../hooks/useBackgroundMode';

interface RightControlPanelProps {
    isNavigating?: boolean;
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    onRecenter?: () => void;
}

export function RightControlPanel({
    isNavigating = false,
    onZoomIn,
    onZoomOut,
    onRecenter,
}: RightControlPanelProps) {
    const { theme, toggleTheme, isMuted, toggleMute } = useAppStore();
    const { shouldBeLocked, toggleWakeLock, showToast: wakeLockToast, toastMessage: wakeLockMessage } = useWakeLock();
    const {
        backgroundModeEnabled,
        isActive: bgActive,
        toggleBackgroundMode,
        showToast: bgToast,
        toastMessage: bgMessage
    } = useBackgroundMode();

    return (
        <>
            <div className={`right-control-panel ${isNavigating ? 'right-control-panel--navigating' : ''}`}>
                {/* GROUP A: Settings (Theme, Audio, Lock, Flash) */}
                <div className="control-group settings-group">
                    <button
                        className={`unified-btn ${theme === 'dark' ? 'active' : ''}`}
                        onClick={toggleTheme}
                        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                    >
                        {theme === 'dark' ? '🌙' : '☀️'}
                    </button>
                    <button
                        className={`unified-btn ${isMuted ? '' : 'active'}`}
                        onClick={toggleMute}
                        title={isMuted ? 'Unmute alerts' : 'Mute alerts'}
                    >
                        {isMuted ? '🔇' : '🔊'}
                    </button>
                    <button
                        className={`unified-btn ${shouldBeLocked ? 'active' : ''}`}
                        onClick={toggleWakeLock}
                        title={shouldBeLocked ? 'Screen stays on' : 'Screen may turn off'}
                    >
                        {shouldBeLocked ? '🔒' : '🔓'}
                    </button>
                    <button
                        className={`unified-btn ${backgroundModeEnabled ? 'active' : ''} ${bgActive ? 'pulsing' : ''}`}
                        onClick={toggleBackgroundMode}
                        title={backgroundModeEnabled ? 'Background mode ON' : 'Background mode OFF'}
                    >
                        {backgroundModeEnabled ? (bgActive ? '📡' : '🔋') : '⚡'}
                    </button>
                </div>

                {/* GROUP B: Navigation Controls (Recenter, Zoom) */}
                {onZoomIn && onZoomOut && onRecenter && (
                    <div className="control-group nav-group">
                        <button
                            className="unified-btn recenter-btn"
                            onClick={onRecenter}
                            title="Return to my location"
                        >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                            </svg>
                        </button>
                        <div className="zoom-pill">
                            <button
                                className="unified-btn zoom-btn"
                                onClick={onZoomIn}
                                title="Zoom in"
                            >
                                +
                            </button>
                            <div className="zoom-divider" />
                            <button
                                className="unified-btn zoom-btn"
                                onClick={onZoomOut}
                                title="Zoom out"
                            >
                                −
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Toast Notifications */}
            {wakeLockToast && (
                <div className="unified-toast">{wakeLockMessage}</div>
            )}
            {bgToast && (
                <div className="unified-toast bg-toast">{bgMessage}</div>
            )}

            <style>{`
                /* === UNIFIED RIGHT CONTROL PANEL === */
                .right-control-panel {
                    position: fixed;
                    right: 12px;
                    top: max(80px, env(safe-area-inset-top) + 64px);
                    z-index: 1000;
                    
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    align-items: center;
                    
                    pointer-events: none;
                }
                
                .right-control-panel--navigating {
                    top: max(80px, env(safe-area-inset-top) + 64px);
                }
                
                .control-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    pointer-events: auto;
                    
                    background: rgba(20, 20, 30, 0.75);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border-radius: 28px;
                    padding: 6px;
                    
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
                }
                
                .unified-btn {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    border: none;
                    background: rgba(40, 40, 55, 0.9);
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
                }
                
                .unified-btn:hover {
                    transform: scale(1.08);
                    background: rgba(60, 60, 80, 0.95);
                }
                
                .unified-btn:active {
                    transform: scale(0.95);
                }
                
                .unified-btn.active {
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    box-shadow: 0 2px 12px rgba(59, 130, 246, 0.4);
                }
                
                .unified-btn.pulsing {
                    animation: pulseGlow 2s ease-in-out infinite;
                }
                
                @keyframes pulseGlow {
                    0%, 100% { box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3); }
                    50% { box-shadow: 0 2px 20px rgba(16, 185, 129, 0.7); }
                }
                
                /* Recenter button - Blue outline */
                .recenter-btn {
                    background: rgba(40, 40, 55, 0.9);
                }
                .recenter-btn svg {
                    color: #60a5fa;
                }
                
                /* Zoom pill - Unified +/- */
                .zoom-pill {
                    display: flex;
                    flex-direction: column;
                    background: rgba(40, 40, 55, 0.9);
                    border-radius: 12px;
                    overflow: hidden;
                }
                
                .zoom-pill .unified-btn {
                    border-radius: 0;
                    font-size: 22px;
                    font-weight: 300;
                    height: 40px;
                }
                
                .zoom-divider {
                    height: 1px;
                    background: rgba(255, 255, 255, 0.1);
                }
                
                /* Toast notifications */
                .unified-toast {
                    position: fixed;
                    top: 80px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 2000;
                    
                    padding: 12px 24px;
                    background: rgba(30, 30, 46, 0.95);
                    color: white;
                    font-weight: 600;
                    font-size: 14px;
                    border-radius: 12px;
                    
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                    animation: slideDown 0.3s ease;
                }
                
                .unified-toast.bg-toast {
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                }
                
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }
                
                /* Mobile responsive */
                @media (max-width: 480px) {
                    .right-control-panel {
                        right: 8px;
                    }
                    .unified-btn {
                        width: 40px;
                        height: 40px;
                        font-size: 16px;
                    }
                    .control-group {
                        padding: 4px;
                        gap: 6px;
                    }
                }
            `}</style>
        </>
    );
}

export default RightControlPanel;
