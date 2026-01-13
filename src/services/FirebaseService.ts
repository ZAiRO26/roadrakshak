import { initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import {
    getFirestore,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    onSnapshot,
    Timestamp,
    deleteDoc,
    doc,
    updateDoc,
    increment
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { PoliceReport } from '../stores/appStore';


// Firebase configuration - Replace with your actual config
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'roadrakshak-demo',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

/**
 * Initialize Firebase connection
 */
export function initFirebase(): boolean {
    if (!firebaseConfig.apiKey) {
        console.warn('Firebase not configured. Using local mock data.');
        return false;
    }

    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        return true;
    } catch (error) {
        console.error('Failed to initialize Firebase:', error);
        return false;
    }
}

/**
 * Report a police checkpoint at current location
 */
export async function reportPolice(
    lat: number,
    lng: number
): Promise<PoliceReport | null> {
    const report: PoliceReport = {
        id: `local-${Date.now()}`,
        lat,
        lng,
        timestamp: Date.now(),
        confirmations: 1,
    };

    if (!db) {
        // Store locally if Firebase not configured
        const localReports = getLocalReports();
        localReports.push(report);
        saveLocalReports(localReports);
        return report;
    }

    try {
        const docRef = await addDoc(collection(db, 'policeReports'), {
            lat,
            lng,
            timestamp: Timestamp.now(),
            confirmations: 1,
            expiresAt: Timestamp.fromMillis(Date.now() + 45 * 60 * 1000), // 45 minutes
        });

        return {
            ...report,
            id: docRef.id,
        };
    } catch (error) {
        console.error('Failed to report police:', error);
        return null;
    }
}

/**
 * Confirm a police report is still active
 */
export async function confirmPoliceReport(reportId: string): Promise<boolean> {
    if (!db) {
        const localReports = getLocalReports();
        const report = localReports.find(r => r.id === reportId);
        if (report) {
            report.confirmations++;
            report.timestamp = Date.now(); // Extend expiry
            saveLocalReports(localReports);
            return true;
        }
        return false;
    }

    try {
        const reportRef = doc(db, 'policeReports', reportId);
        await updateDoc(reportRef, {
            confirmations: increment(1),
            timestamp: Timestamp.now(),
            expiresAt: Timestamp.fromMillis(Date.now() + 45 * 60 * 1000),
        });
        return true;
    } catch (error) {
        console.error('Failed to confirm report:', error);
        return false;
    }
}

/**
 * Subscribe to police reports in a geographic area
 * Uses a simple bounding box query (Firebase GeoFire would be better for production)
 */
export function subscribeToPoliceReports(
    centerLat: number,
    centerLng: number,
    radiusKm: number = 5,
    callback: (reports: PoliceReport[]) => void
): () => void {
    const latOffset = radiusKm / 111;
    const lngOffset = radiusKm / (111 * Math.cos(centerLat * Math.PI / 180));

    const minLat = centerLat - latOffset;
    const maxLat = centerLat + latOffset;
    const minLng = centerLng - lngOffset;
    const maxLng = centerLng + lngOffset;

    if (!db) {
        // Return local reports filtered by location
        const checkLocal = () => {
            const localReports = getLocalReports();
            const now = Date.now();
            const filtered = localReports.filter(r => {
                const isInArea = r.lat >= minLat && r.lat <= maxLat && r.lng >= minLng && r.lng <= maxLng;
                const isNotExpired = now - r.timestamp < 45 * 60 * 1000;
                return isInArea && isNotExpired;
            });
            callback(filtered);
        };

        checkLocal();
        const interval = setInterval(checkLocal, 30000); // Check every 30 seconds
        return () => clearInterval(interval);
    }

    const now = Timestamp.now();
    const q = query(
        collection(db, 'policeReports'),
        where('lat', '>=', minLat),
        where('lat', '<=', maxLat),
        where('expiresAt', '>', now)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const reports: PoliceReport[] = [];

        snapshot.forEach((doc) => {
            const data = doc.data();
            // Additional lng filter (Firestore can only do range on one field)
            if (data.lng >= minLng && data.lng <= maxLng) {
                reports.push({
                    id: doc.id,
                    lat: data.lat,
                    lng: data.lng,
                    timestamp: data.timestamp.toMillis(),
                    confirmations: data.confirmations,
                });
            }
        });

        callback(reports);
    });

    return unsubscribe;
}

/**
 * Delete expired reports (for admin/cron use)
 */
export async function cleanupExpiredReports(): Promise<number> {
    if (!db) {
        const localReports = getLocalReports();
        const now = Date.now();
        const validReports = localReports.filter(r => now - r.timestamp < 45 * 60 * 1000);
        const removed = localReports.length - validReports.length;
        saveLocalReports(validReports);
        return removed;
    }

    try {
        const now = Timestamp.now();
        const q = query(
            collection(db, 'policeReports'),
            where('expiresAt', '<', now)
        );

        const snapshot = await getDocs(q);
        let count = 0;

        for (const docSnap of snapshot.docs) {
            await deleteDoc(doc(db, 'policeReports', docSnap.id));
            count++;
        }

        return count;
    } catch (error) {
        console.error('Failed to cleanup reports:', error);
        return 0;
    }
}

// Local storage helpers for offline/demo mode
const LOCAL_STORAGE_KEY = 'roadrakshak_police_reports';

function getLocalReports(): PoliceReport[] {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function saveLocalReports(reports: PoliceReport[]): void {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(reports));
    } catch (error) {
        console.error('Failed to save local reports:', error);
    }
}

/**
 * Check if Firebase is configured and connected
 */
export function isFirebaseConfigured(): boolean {
    return db !== null;
}
