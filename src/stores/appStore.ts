import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SpeedCamera {
    id: string;
    lat: number;
    lng: number;
    direction?: number;
}

export interface PoliceReport {
    id: string;
    lat: number;
    lng: number;
    timestamp: number;
    confirmations: number;
}

export interface Alert {
    id: string;
    type: 'camera' | 'police' | 'speeding';
    message: string;
    distance?: number;
}

interface AppState {
    // Theme
    theme: 'dark' | 'light';
    toggleTheme: () => void;

    // Speed limit
    currentSpeedLimit: number | null;
    currentRoadName: string | null;
    setSpeedLimit: (limit: number | null, roadName: string | null) => void;

    // Alerts
    isMuted: boolean;
    toggleMute: () => void;
    activeAlert: Alert | null;
    setActiveAlert: (alert: Alert | null) => void;

    // Cameras
    cameras: SpeedCamera[];
    setCameras: (cameras: SpeedCamera[]) => void;

    // Police reports
    policeReports: PoliceReport[];
    setPoliceReports: (reports: PoliceReport[]) => void;
    addPoliceReport: (report: PoliceReport) => void;

    // App state
    isLoading: boolean;
    setLoading: (loading: boolean) => void;
    wakeLockActive: boolean;
    setWakeLockActive: (active: boolean) => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            // Theme - default dark
            theme: 'dark',
            toggleTheme: () => {
                const newTheme = get().theme === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', newTheme);
                set({ theme: newTheme });
            },

            // Speed limit
            currentSpeedLimit: null,
            currentRoadName: null,
            setSpeedLimit: (limit, roadName) => {
                set({ currentSpeedLimit: limit, currentRoadName: roadName });
            },

            // Alerts
            isMuted: false,
            toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
            activeAlert: null,
            setActiveAlert: (alert) => set({ activeAlert: alert }),

            // Cameras
            cameras: [],
            setCameras: (cameras) => set({ cameras }),

            // Police reports
            policeReports: [],
            setPoliceReports: (reports) => set({ policeReports: reports }),
            addPoliceReport: (report) => {
                set((state) => ({
                    policeReports: [...state.policeReports, report],
                }));
            },

            // App state
            isLoading: true,
            setLoading: (loading) => set({ isLoading: loading }),
            wakeLockActive: false,
            setWakeLockActive: (active) => set({ wakeLockActive: active }),
        }),
        {
            name: 'roadrakshak-settings',
            partialize: (state) => ({
                theme: state.theme,
                isMuted: state.isMuted,
            }),
        }
    )
);
