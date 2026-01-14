import { useAppStore } from '../stores/appStore';
import { useWakeLock } from '../hooks/useWakeLock';

export function Controls() {
    const { theme, toggleTheme, isMuted, toggleMute } = useAppStore();
    const { shouldBeLocked, toggleWakeLock, showToast, toastMessage } = useWakeLock();

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
            </div>

            {/* Wake Lock Toast */}
            {showToast && (
                <div className="wake-lock-toast">
                    {toastMessage}
                </div>
            )}

            <style>{`
                .wake-lock-toast {
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
