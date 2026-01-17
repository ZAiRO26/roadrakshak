/**
 * OverrideService.ts - Complete Local Camera Data Management
 * 
 * Storage Keys:
 * - CAMERA_OVERRIDES: Object { [id]: { lat, lng } } - For fixing official cameras
 * - USER_CAMERAS: Array [{ id, lat, lng, type, date }] - For new user-added cameras
 */

import type { CameraNode, OfficialCameraRaw } from '../types/camera';
import officialCamerasData from '../data/official_cameras.json';

const OVERRIDES_KEY = 'CAMERA_OVERRIDES';
const USER_CAMERAS_KEY = 'USER_CAMERAS';

// Type for override data (fixing official cameras)
interface CameraOverride {
    lat: number;
    lng: number;
    timestamp: number;
}

// Type for user-added cameras
interface UserCamera {
    id: string;
    lat: number;
    lng: number;
    type: 'SPEED_CAM' | 'RED_LIGHT_CAM';
    limit: number | null;
    timestamp: number;
    name?: string;
}

type OverrideMap = Record<string, CameraOverride>;

// Type assertion for imported JSON
const baseCameras = officialCamerasData as OfficialCameraRaw[];

// ============== OVERRIDES (Fixing existing cameras) ==============

/**
 * Get all overrides from localStorage
 */
function getOverrides(): OverrideMap {
    try {
        const data = localStorage.getItem(OVERRIDES_KEY);
        return data ? JSON.parse(data) : {};
    } catch (e) {
        console.warn('[OverrideService] Failed to load overrides:', e);
        return {};
    }
}

/**
 * Save all overrides to localStorage
 */
function setOverrides(overrides: OverrideMap): void {
    try {
        localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
    } catch (e) {
        console.error('[OverrideService] Failed to save overrides:', e);
    }
}

/**
 * Save a correction for an official camera
 */
export function saveCorrection(cameraId: string, newLat: number, newLng: number): void {
    const overrides = getOverrides();

    overrides[cameraId] = {
        lat: newLat,
        lng: newLng,
        timestamp: Date.now(),
    };

    setOverrides(overrides);
    console.log(`[OverrideService] Saved correction for ${cameraId}: (${newLat}, ${newLng})`);
}

/**
 * Get a single camera's override (if exists)
 */
export function getOverride(cameraId: string): CameraOverride | null {
    const overrides = getOverrides();
    return overrides[cameraId] || null;
}

/**
 * Delete a correction
 */
export function deleteCorrection(cameraId: string): void {
    const overrides = getOverrides();
    delete overrides[cameraId];
    setOverrides(overrides);
}

/**
 * Reset an official camera to its original position
 * (Same as deleteCorrection but with clear naming)
 */
export function resetOfficialCamera(cameraId: string): void {
    deleteCorrection(cameraId);
    console.log(`[OverrideService] Reset camera ${cameraId} to original position`);
}

/**
 * Check if an official camera has been overridden
 */
export function hasOverride(cameraId: string): boolean {
    return getOverride(cameraId) !== null;
}

/**
 * Get count of overrides
 */
export function getOverrideCount(): number {
    return Object.keys(getOverrides()).length;
}

// ============== USER CAMERAS (Adding new cameras) ==============

/**
 * Get all user cameras from localStorage
 */
function getUserCameras(): UserCamera[] {
    try {
        const data = localStorage.getItem(USER_CAMERAS_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.warn('[OverrideService] Failed to load user cameras:', e);
        return [];
    }
}

/**
 * Save all user cameras to localStorage
 */
function setUserCameras(cameras: UserCamera[]): void {
    try {
        localStorage.setItem(USER_CAMERAS_KEY, JSON.stringify(cameras));
    } catch (e) {
        console.error('[OverrideService] Failed to save user cameras:', e);
    }
}

/**
 * Add a new user camera at current GPS location with speed limit
 */
export function addNewCamera(
    lat: number,
    lng: number,
    speedLimit: number | null = null,
    type: 'SPEED_CAM' | 'RED_LIGHT_CAM' = 'SPEED_CAM',
    name?: string
): string {
    const cameras = getUserCameras();
    const id = `user_cam_${Date.now()}`;

    cameras.push({
        id,
        lat,
        lng,
        type,
        limit: speedLimit,
        timestamp: Date.now(),
        name: name || `User Camera ${cameras.length + 1}`,
    });

    setUserCameras(cameras);
    console.log(`[OverrideService] Added new camera ${id}: (${lat}, ${lng}), limit: ${speedLimit}`);
    return id;
}

/**
 * Delete a user camera
 */
export function deleteUserCamera(cameraId: string): void {
    const cameras = getUserCameras().filter(c => c.id !== cameraId);
    setUserCameras(cameras);
}

/**
 * Get count of user cameras
 */
export function getUserCameraCount(): number {
    return getUserCameras().length;
}

// ============== MERGED DATA ==============

/**
 * Convert raw camera to CameraNode with override applied
 */
function convertWithOverride(raw: OfficialCameraRaw): CameraNode {
    const override = getOverride(raw.id);

    return {
        id: raw.id,
        lat: override?.lat ?? raw.lat,
        lng: override?.lng ?? raw.lng,
        type: raw.type,
        limit: raw.speed_limit,
        source: 'OFFICIAL',
        name: raw.name,
        city: raw.city,
    };
}

/**
 * Convert user camera to CameraNode
 */
function convertUserCamera(cam: UserCamera): CameraNode {
    return {
        id: cam.id,
        lat: cam.lat,
        lng: cam.lng,
        type: cam.type,
        limit: cam.limit,
        source: 'USER',
        name: cam.name || 'User Camera',
    };
}

/**
 * Get merged camera list: (Official + Overrides) + User Cameras
 * This is the main function to use for getting all cameras
 */
export function getMergedCameras(): CameraNode[] {
    // 1. Official cameras with overrides applied
    const officialWithOverrides = baseCameras.map(convertWithOverride);

    // 2. User-added cameras
    const userCameras = getUserCameras().map(convertUserCamera);

    // 3. Combine both
    return [...officialWithOverrides, ...userCameras];
}

/**
 * Get only user cameras as CameraNode[]
 */
export function getUserCamerasAsNodes(): CameraNode[] {
    return getUserCameras().map(convertUserCamera);
}

// ============== EXPORT ==============

/**
 * (DEPRECATED) Export all data including official cameras
 * Use exportUserDataOnly() instead for user-specific data
 */
export function exportMergedData(): string {
    // Fixed official cameras
    const fixedOfficial = baseCameras.map(raw => {
        const override = getOverride(raw.id);
        return {
            ...raw,
            lat: override?.lat ?? raw.lat,
            lng: override?.lng ?? raw.lng,
        };
    });

    // User cameras formatted as OfficialCameraRaw for consistency
    const userCams = getUserCameras().map(cam => ({
        id: cam.id,
        city: 'User Added',
        name: cam.name || 'User Camera',
        type: cam.type,
        speed_limit: cam.limit,
        lat: cam.lat,
        lng: cam.lng,
    }));

    // Combine all
    const allCameras = [...fixedOfficial, ...userCams];

    return JSON.stringify(allCameras, null, 2);
}

/**
 * Export ONLY user data (user-added cameras + corrections to official cameras)
 * This is what should be shared/backed up - NOT the entire official database!
 */
export function exportUserDataOnly(): { userCameras: UserCamera[]; corrections: { id: string; lat: number; lng: number; timestamp: number }[]; exportDate: string } {
    const userCameras = getUserCameras();
    const overrides = getOverrides();

    // Convert overrides to array format for export
    const corrections = Object.entries(overrides).map(([id, override]) => ({
        id,
        lat: override.lat,
        lng: override.lng,
        timestamp: override.timestamp,
    }));

    return {
        userCameras,
        corrections,
        exportDate: new Date().toISOString(),
    };
}

/**
 * Copy USER DATA ONLY to clipboard (not the entire database!)
 */
export async function copyMergedToClipboard(): Promise<{ success: boolean; counts: { overrides: number; userCameras: number } }> {
    const counts = {
        overrides: getOverrideCount(),
        userCameras: getUserCameraCount(),
    };

    // If no user data, alert and return
    if (counts.userCameras === 0 && counts.overrides === 0) {
        console.log('[OverrideService] No user data to export!');
        return { success: false, counts };
    }

    try {
        // Export ONLY user data, not the entire database!
        const userData = exportUserDataOnly();
        const dataStr = JSON.stringify(userData, null, 2);
        await navigator.clipboard.writeText(dataStr);
        console.log('[OverrideService] User data copied to clipboard');
        console.log(`Exported: ${counts.userCameras} cameras, ${counts.overrides} corrections`);
        return { success: true, counts };
    } catch (e) {
        console.error('[OverrideService] Failed to copy to clipboard:', e);
        console.log('[OverrideService] User Data (copy manually):');
        console.log(JSON.stringify(exportUserDataOnly(), null, 2));
        return { success: false, counts };
    }
}

// ============== RESET ==============

/**
 * Clear all overrides (reset fixes)
 */
export function clearAllOverrides(): void {
    localStorage.removeItem(OVERRIDES_KEY);
    console.log('[OverrideService] All overrides cleared');
}

/**
 * Clear all user cameras
 */
export function clearAllUserCameras(): void {
    localStorage.removeItem(USER_CAMERAS_KEY);
    console.log('[OverrideService] All user cameras cleared');
}

/**
 * Clear everything
 */
export function clearAll(): void {
    clearAllOverrides();
    clearAllUserCameras();
}

export default {
    // Overrides (fixes)
    saveCorrection,
    getOverride,
    deleteCorrection,
    resetOfficialCamera,
    hasOverride,
    getOverrideCount,
    // User cameras (additions)
    addNewCamera,
    deleteUserCamera,
    getUserCameraCount,
    getUserCamerasAsNodes,
    // Merged data
    getMergedCameras,
    exportMergedData,
    exportUserDataOnly,
    copyMergedToClipboard,
    // Reset
    clearAllOverrides,
    clearAllUserCameras,
    clearAll,
};
