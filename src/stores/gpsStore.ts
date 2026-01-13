import { create } from 'zustand';

export interface GPSState {
    latitude: number | null;
    longitude: number | null;
    speed: number; // in km/h
    heading: number | null;
    accuracy: number | null;
    timestamp: number | null;
    isTracking: boolean;
    error: string | null;
    lastPosition: { lat: number; lng: number } | null;
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
    heading: null,
    accuracy: null,
    timestamp: null,
    isTracking: false,
    error: null,
    lastPosition: null,
};

export const useGpsStore = create<GPSState & GPSActions>((set, get) => ({
    ...initialState,

    updatePosition: (position: GeolocationPosition) => {
        const { coords, timestamp } = position;
        const currentState = get();

        // Convert speed from m/s to km/h (GPS provides speed in m/s)
        const speedKmh = coords.speed !== null ? Math.round(coords.speed * 3.6) : 0;

        set({
            latitude: coords.latitude,
            longitude: coords.longitude,
            speed: speedKmh,
            heading: coords.heading,
            accuracy: coords.accuracy,
            timestamp,
            lastPosition: currentState.latitude && currentState.longitude
                ? { lat: currentState.latitude, lng: currentState.longitude }
                : null,
            error: null,
        });
    },

    setError: (error: string | null) => {
        set({ error });
    },

    setTracking: (isTracking: boolean) => {
        set({ isTracking });
    },

    reset: () => {
        set(initialState);
    },
}));
