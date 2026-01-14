/**
 * CameraCorrectionsStore.ts - IndexedDB storage for user camera corrections
 * Stores updated lat/lng when user clicks "Snap to Me"
 */

const DB_NAME = 'zairo-maps-db';
const DB_VERSION = 1;
const STORE_NAME = 'camera_corrections';

interface CameraCorrection {
    cameraId: string;
    originalLat: number;
    originalLng: number;
    correctedLat: number;
    correctedLng: number;
    timestamp: number;
}

let db: IDBDatabase | null = null;

/**
 * Open the IndexedDB database
 */
async function openDB(): Promise<IDBDatabase> {
    if (db) return db;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('[CameraCorrections] Failed to open DB:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;

            // Create store for camera corrections
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, { keyPath: 'cameraId' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                console.log('[CameraCorrections] Created IndexedDB store');
            }
        };
    });
}

/**
 * Save a camera correction to IndexedDB
 */
export async function saveCameraCorrection(
    cameraId: string,
    originalLat: number,
    originalLng: number,
    correctedLat: number,
    correctedLng: number
): Promise<void> {
    const database = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const correction: CameraCorrection = {
            cameraId,
            originalLat,
            originalLng,
            correctedLat,
            correctedLng,
            timestamp: Date.now(),
        };

        const request = store.put(correction);

        request.onsuccess = () => {
            console.log(`[CameraCorrections] Saved correction for ${cameraId}`);
            resolve();
        };

        request.onerror = () => {
            console.error('[CameraCorrections] Failed to save:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Get a camera correction from IndexedDB
 */
export async function getCameraCorrection(cameraId: string): Promise<CameraCorrection | null> {
    const database = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(cameraId);

        request.onsuccess = () => {
            resolve(request.result || null);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Get all camera corrections
 */
export async function getAllCorrections(): Promise<CameraCorrection[]> {
    const database = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            resolve(request.result || []);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Delete a camera correction
 */
export async function deleteCorrection(cameraId: string): Promise<void> {
    const database = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(cameraId);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

export type { CameraCorrection };
