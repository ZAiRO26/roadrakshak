import { create } from 'zustand';

export interface GPSState {
    latitude: number | null;
    longitude: number | null;
    speed: number; // in km/h (smoothed)
    rawSpeed: number; // raw GPS speed
    heading: number | null;
    accuracy: number | null;
    timestamp: number | null;
    isTracking: boolean;
    error: string | null;
    lastPosition: { lat: number; lng: number } | null;
    isStationary: boolean; // true if user isn't moving
}

interface GPSActions {
    updatePosition: (position: GeolocationPosition) => void;
    setError: (error: string | null) => void;
    setTracking: (isTracking: boolean) => void;
    reset: () => void;
}

const initialState: GPSState = {
    latitude: null,
    longitude: null,
    speed: 0,
    rawSpeed: 0,
    heading: null,
    accuracy: null,
    timestamp: null,
    isTracking: false,
    error: null,
    lastPosition: null,
    isStationary: true,
};

// Speed smoothing configuration - PRO-GRADE GPS CALIBRATION (Phase 27)
const SPEED_HISTORY_SIZE = 5; // Number of readings for weighted average (more responsive)
const MIN_SPEED_THRESHOLD = 3; // km/h - speeds below this are considered stationary
const MAX_ACCURACY_FOR_SPEED = 30; // meters - ignore speed if accuracy is worse than this
const STATIONARY_SPEED_THRESHOLD = 5; // km/h - consistent threshold for "not moving"
const EMA_ALPHA = 0.7; // Exponential Moving Average factor (0.7 = responsive but smooth)

// Speed history for smoothing
let speedHistory: number[] = [];
let lastEmaSpeed: number = 0;

/**
 * Calculate smoothed speed using Exponential Moving Average (EMA)
 * EMA: smoothedSpeed = (alpha * newSpeed) + ((1 - alpha) * lastSpeed)
 * alpha = 0.7 means responsive but smooth (higher = more responsive, lower = smoother)
 */
function smoothSpeed(newSpeed: number, accuracy: number | null): number {
    // If accuracy is poor, don't trust the speed reading
    if (accuracy !== null && accuracy > MAX_ACCURACY_FOR_SPEED) {
        // Keep last EMA speed or return 0
        return lastEmaSpeed > 0 ? Math.round(lastEmaSpeed) : 0;
    }

    // Add new speed to history for threshold checks
    speedHistory.push(newSpeed);
    if (speedHistory.length > SPEED_HISTORY_SIZE) {
        speedHistory.shift();
    }

    // If speed is below minimum threshold (GPS drift when stopped), return 0
    if (newSpeed < MIN_SPEED_THRESHOLD) {
        // Check if we've been stationary for a while
        const recentReadings = speedHistory.slice(-3);
        const allLow = recentReadings.every(s => s < MIN_SPEED_THRESHOLD);
        if (allLow) {
            lastEmaSpeed = 0;
            return 0;
        }
    }

    // Apply Exponential Moving Average (EMA)
    // First reading: initialize EMA with raw speed
    if (lastEmaSpeed === 0 && newSpeed >= MIN_SPEED_THRESHOLD) {
        lastEmaSpeed = newSpeed;
        return Math.round(newSpeed);
    }

    // EMA formula: smoothed = alpha * new + (1 - alpha) * previous
    const emaSpeed = (EMA_ALPHA * newSpeed) + ((1 - EMA_ALPHA) * lastEmaSpeed);
    lastEmaSpeed = emaSpeed;

    // If EMA result is below threshold, return 0
    if (emaSpeed < MIN_SPEED_THRESHOLD) {
        return 0;
    }

    return Math.round(emaSpeed);
}

export const useGpsStore = create<GPSState & GPSActions>((set, get) => ({
    ...initialState,

    updatePosition: (position: GeolocationPosition) => {
        const { coords, timestamp } = position;
        const currentState = get();

        // Convert speed from m/s to km/h (GPS provides speed in m/s)
        const rawSpeedKmh = coords.speed !== null ? Math.round(coords.speed * 3.6) : 0;

        // Apply speed smoothing to reduce noise
        const smoothedSpeed = smoothSpeed(rawSpeedKmh, coords.accuracy);

        // Determine if stationary based on smoothed speed
        const isStationary = smoothedSpeed < STATIONARY_SPEED_THRESHOLD;

        set({
            latitude: coords.latitude,
            longitude: coords.longitude,
            speed: smoothedSpeed,
            rawSpeed: rawSpeedKmh,
            heading: coords.heading,
            accuracy: coords.accuracy,
            timestamp,
            lastPosition: currentState.latitude && currentState.longitude
                ? { lat: currentState.latitude, lng: currentState.longitude }
                : null,
            isStationary,
            error: null,
        });
    },

    setError: (error: string | null) => {
        set({ error });
    },

    setTracking: (isTracking: boolean) => {
        set({ isTracking });
        // Reset speed history and EMA when tracking starts
        if (isTracking) {
            speedHistory = [];
            lastEmaSpeed = 0;
        }
    },

    reset: () => {
        speedHistory = [];
        lastEmaSpeed = 0;
        set(initialState);
    },
}));
