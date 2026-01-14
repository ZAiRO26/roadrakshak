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

// Speed smoothing configuration
const SPEED_HISTORY_SIZE = 5; // Number of readings to average
const MIN_SPEED_THRESHOLD = 3; // km/h - speeds below this are considered stationary
const MAX_ACCURACY_FOR_SPEED = 30; // meters - ignore speed if accuracy is worse than this
const STATIONARY_SPEED_THRESHOLD = 5; // km/h - consistent threshold for "not moving"

// Speed history for smoothing
let speedHistory: number[] = [];

/**
 * Calculate smoothed speed using weighted moving average
 * Recent readings have more weight
 */
function smoothSpeed(newSpeed: number, accuracy: number | null): number {
    // If accuracy is poor, don't trust the speed reading
    if (accuracy !== null && accuracy > MAX_ACCURACY_FOR_SPEED) {
        // Keep last known speed or return 0
        return speedHistory.length > 0 ? speedHistory[speedHistory.length - 1] : 0;
    }

    // Add new speed to history
    speedHistory.push(newSpeed);

    // Keep only recent readings
    if (speedHistory.length > SPEED_HISTORY_SIZE) {
        speedHistory.shift();
    }

    // If all readings are below threshold, return 0 (stationary)
    const allBelowThreshold = speedHistory.every(s => s < MIN_SPEED_THRESHOLD);
    if (allBelowThreshold) {
        return 0;
    }

    // Weighted average - recent readings have more weight
    let weightedSum = 0;
    let totalWeight = 0;
    speedHistory.forEach((speed, index) => {
        const weight = index + 1; // More recent = higher weight
        weightedSum += speed * weight;
        totalWeight += weight;
    });

    const avgSpeed = weightedSum / totalWeight;

    // If average is below threshold, return 0
    if (avgSpeed < MIN_SPEED_THRESHOLD) {
        return 0;
    }

    return Math.round(avgSpeed);
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
        // Reset speed history when tracking starts
        if (isTracking) {
            speedHistory = [];
        }
    },

    reset: () => {
        speedHistory = [];
        set(initialState);
    },
}));
