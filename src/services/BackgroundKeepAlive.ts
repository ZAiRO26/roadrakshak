/**
 * BackgroundKeepAlive.ts - Silent Audio Loop for Background Execution
 * 
 * Uses the "Audio Session Hack" to keep the PWA JavaScript thread active
 * when the phone screen is off. This allows GPS tracking and TTS alerts
 * to continue in the background.
 * 
 * WARNING: This will show a media notification and use extra battery.
 */

// Base64 encoded silent MP3 (1 second of silence, ~2KB)
// This is a valid MP3 file with minimal data
const SILENT_AUDIO_BASE64 =
    'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA' +
    '//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7' +
    'u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7///' +
    '////////////////////////////////////////////////////////////////AAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/7UGQAAA' +
    'AAAaQAAAAAAAA0gAAAAABIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tSZAAP8AAAaQAAAAAAAA' +
    '0gAAAAAQAAAaQAAAAAAAA0gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/7UmQAD/' +
    'AAAGkAAAAAAAANIAAAAAMAAAaQAAAAAAAA0gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

// Audio element reference
let audioElement: HTMLAudioElement | null = null;
let isEnabled = false;

/**
 * Enable background mode by playing silent audio in a loop
 * This keeps the browser's audio session active and prevents
 * the JavaScript thread from being suspended
 */
export function enableBackgroundMode(): boolean {
    if (isEnabled && audioElement) {
        console.log('[BackgroundKeepAlive] Already enabled');
        return true;
    }

    try {
        // Create audio element
        audioElement = new Audio(SILENT_AUDIO_BASE64);
        audioElement.loop = true;
        audioElement.volume = 0.01; // Not 0 to avoid OS optimizations
        audioElement.preload = 'auto';

        // Handle interruptions (e.g., Spotify/other media taking over)
        audioElement.addEventListener('pause', handleInterruption);
        audioElement.addEventListener('ended', handleInterruption);

        // Handle errors
        audioElement.addEventListener('error', (e) => {
            console.error('[BackgroundKeepAlive] Audio error:', e);
        });

        // Start playing
        const playPromise = audioElement.play();

        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    console.log('[BackgroundKeepAlive] ✅ Background mode ENABLED');
                    isEnabled = true;
                })
                .catch((error) => {
                    console.error('[BackgroundKeepAlive] Failed to play:', error);
                    // User interaction might be needed first
                    isEnabled = false;
                });
        }

        return true;
    } catch (error) {
        console.error('[BackgroundKeepAlive] Failed to enable:', error);
        return false;
    }
}

/**
 * Handle audio interruption (try to resume)
 */
function handleInterruption() {
    if (isEnabled && audioElement && audioElement.paused) {
        console.log('[BackgroundKeepAlive] Audio interrupted, attempting resume...');
        setTimeout(() => {
            if (audioElement && isEnabled) {
                audioElement.play().catch(() => {
                    console.warn('[BackgroundKeepAlive] Could not resume after interruption');
                });
            }
        }, 1000);
    }
}

/**
 * Disable background mode
 */
export function disableBackgroundMode(): void {
    if (audioElement) {
        audioElement.pause();
        audioElement.removeEventListener('pause', handleInterruption);
        audioElement.removeEventListener('ended', handleInterruption);
        audioElement.src = '';
        audioElement = null;
    }
    isEnabled = false;
    console.log('[BackgroundKeepAlive] ❌ Background mode DISABLED');
}

/**
 * Check if background mode is enabled
 */
export function isBackgroundModeEnabled(): boolean {
    return isEnabled;
}

/**
 * Toggle background mode
 */
export function toggleBackgroundMode(): boolean {
    if (isEnabled) {
        disableBackgroundMode();
        return false;
    } else {
        enableBackgroundMode();
        return true;
    }
}

export default {
    enableBackgroundMode,
    disableBackgroundMode,
    isBackgroundModeEnabled,
    toggleBackgroundMode,
};
