import { useAppStore } from '../stores/appStore';
import { useWakeLock } from '../hooks/useWakeLock';
import { useBackgroundMode } from '../hooks/useBackgroundMode';

export function Controls() {
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
            <div className="controls">
                {/* Theme toggle */}
                <button
                    className={`control-btn ${theme === 'dark' ? 'active' : ''}`}
                    onClick={toggleTheme}
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                    aria-label="Toggle theme"
                >
                    {theme === 'dark' ? '🌙' : '☀️'}
                </button>

                {/* Mute toggle */}
                <button
                    className={`control-btn ${isMuted ? '' : 'active'}`}
                    onClick={toggleMute}
                    title={isMuted ? 'Unmute alerts' : 'Mute alerts'}
                    aria-label="Toggle mute"
                >
                    {isMuted ? '🔇' : '🔊'}
                </button>

                {/* Wake lock toggle */}
                <button
                    className={`control-btn ${shouldBeLocked ? 'active' : ''}`}
                    onClick={toggleWakeLock}
                    title={shouldBeLocked ? 'Screen will stay on (click to disable)' : 'Screen may turn off (click to keep on)'}
                    aria-label="Toggle wake lock"
                >
                    {shouldBeLocked ? '🔒' : '🔓'}
                </button>

                {/* Background mode toggle */}
                <button
                    className={`control-btn ${backgroundModeEnabled ? 'active' : ''} ${bgActive ? 'pulsing' : ''}`}
                    onClick={toggleBackgroundMode}
                    title={backgroundModeEnabled
                        ? (bgActive ? 'Background mode ACTIVE (running)' : 'Background mode ON (waiting for driving)')
                        : 'Background mode OFF (enable for locked screen tracking)'
                    }
                    aria-label="Toggle background mode"
                >
                    {backgroundModeEnabled ? (bgActive ? '📡' : '🔋') : '⚡'}
                </button>
            </div>

            {/* Wake Lock Toast */}
            {wakeLockToast && (
                <div className="control-toast">
                    {wakeLockMessage}
                </div>
            )}

            {/* Background Mode Toast */}
            {bgToast && (
                <div className="control-toast bg-toast">
                    {bgMessage}
                </div>
            )}

            <style>{`
                .control-toast {
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

                .control-toast.bg-toast {
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                }
                
                .control-btn.pulsing {
                    animation: bgPulse 2s ease-in-out infinite;
                }
                
                @keyframes bgPulse {
                    0%, 100% { 
                        box-shadow: 0 2px 10px rgba(16, 185, 129, 0.3);
                    }
                    50% { 
                        box-shadow: 0 2px 20px rgba(16, 185, 129, 0.7);
                    }
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
            `}</style>
        </>
    );
}
