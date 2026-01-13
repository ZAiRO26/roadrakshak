import { useAppStore } from '../stores/appStore';

export function Controls() {
    const { theme, toggleTheme, isMuted, toggleMute, wakeLockActive } = useAppStore();

    return (
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

            {/* Wake lock indicator */}
            <button
                className={`control-btn ${wakeLockActive ? 'active' : ''}`}
                title={wakeLockActive ? 'Screen will stay on' : 'Screen may turn off'}
                aria-label="Wake lock status"
                style={{ cursor: 'default' }}
            >
                {wakeLockActive ? '🔒' : '🔓'}
            </button>
        </div>
    );
}
