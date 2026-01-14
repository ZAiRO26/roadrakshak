/**
 * OverrideService.ts - Local camera override system
 * Uses localStorage for simple persistence of corrected camera locations
 */

import type { CameraNode, OfficialCameraRaw } from '../types/camera';
import officialCamerasData from '../data/official_cameras.json';

const STORAGE_KEY = 'CAMERA_OVERRIDES';

// Type for override data
interface CameraOverride {
    lat: number;
    lng: number;
    timestamp: number;
}

type OverrideMap = Record<string, CameraOverride>;

// Type assertion for imported JSON
const baseCameras = officialCamerasData as OfficialCameraRaw[];

/**
 * Get all overrides from localStorage
 */
function getOverrides(): OverrideMap {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    } catch (e) {
        console.error('[OverrideService] Failed to save overrides:', e);
    }
}

/**
 * Save a correction for a camera
 * @param cameraId - The camera ID to correct
 * @param newLat - New latitude from user's GPS
 * @param newLng - New longitude from user's GPS
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
 * Get count of overrides
 */
export function getOverrideCount(): number {
    return Object.keys(getOverrides()).length;
}

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
 * Get merged camera list (base + overrides)
 * This is the main function to use for getting cameras
 */
export function getMergedCameras(): CameraNode[] {
    return baseCameras.map(convertWithOverride);
}

/**
 * Export all merged data as JSON string
 * For copying to clipboard and updating official_cameras.json
 */
export function exportMergedData(): string {
    const merged = baseCameras.map(raw => {
        const override = getOverride(raw.id);
        return {
            ...raw,
            lat: override?.lat ?? raw.lat,
            lng: override?.lng ?? raw.lng,
        };
    });

    return JSON.stringify(merged, null, 2);
}

/**
 * Copy merged data to clipboard
 */
export async function copyMergedToClipboard(): Promise<boolean> {
    try {
        const data = exportMergedData();
        await navigator.clipboard.writeText(data);
        console.log('[OverrideService] Merged data copied to clipboard');
        console.log(data); // Also log to console
        return true;
    } catch (e) {
        console.error('[OverrideService] Failed to copy to clipboard:', e);
        // Fallback: log to console
        console.log('[OverrideService] Data (copy manually):');
        console.log(exportMergedData());
        return false;
    }
}

/**
 * Clear all overrides (reset to original)
 */
export function clearAllOverrides(): void {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[OverrideService] All overrides cleared');
}

export default {
    saveCorrection,
    getOverride,
    deleteCorrection,
    getOverrideCount,
    getMergedCameras,
    exportMergedData,
    copyMergedToClipboard,
    clearAllOverrides,
};
