/**
 * CameraLoader.ts - Unified camera data loader
 * Loads official cameras and provides radius-based filtering
 * Supports user corrections via IndexedDB
 */

import * as turf from '@turf/turf';
import type { CameraNode, OfficialCameraRaw } from '../types/camera';
import officialCamerasData from '../data/official_cameras.json';
import { getAllCorrections, saveCameraCorrection, type CameraCorrection } from './CameraCorrectionsStore';

// Type assertion for imported JSON
const officialCameras = officialCamerasData as OfficialCameraRaw[];

// Cache for corrections (loaded from IndexedDB)
let correctionsCache: Map<string, CameraCorrection> = new Map();

/**
 * Load corrections from IndexedDB into memory cache
 */
export async function loadCorrections(): Promise<void> {
    try {
        const corrections = await getAllCorrections();
        correctionsCache.clear();
        corrections.forEach(c => correctionsCache.set(c.cameraId, c));
        console.log(`[CameraLoader] Loaded ${corrections.length} corrections from IndexedDB`);
    } catch (e) {
        console.warn('[CameraLoader] Failed to load corrections:', e);
    }
}

/**
 * Apply correction to a camera if one exists
 */
function applyCorrectionToCamera(camera: CameraNode): CameraNode {
    const correction = correctionsCache.get(camera.id);
    if (correction) {
        return {
            ...camera,
            lat: correction.correctedLat,
            lng: correction.correctedLng,
        };
    }
    return camera;
}

/**
 * Convert raw official camera data to unified CameraNode format
 */
function convertOfficialCamera(raw: OfficialCameraRaw): CameraNode {
    return {
        id: raw.id,
        lat: raw.lat,
        lng: raw.lng,
        type: raw.type,
        limit: raw.speed_limit,
        source: 'OFFICIAL',
        name: raw.name,
        city: raw.city,
    };
}

/**
 * Get all official cameras (converted to CameraNode format)
 * Applies user corrections from IndexedDB if available
 */
export function getAllOfficialCameras(): CameraNode[] {
    return officialCameras
        .map(convertOfficialCamera)
        .map(applyCorrectionToCamera);
}

/**
 * Calculate distance between two points in kilometers
 */
function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const from = turf.point([lng1, lat1]);
    const to = turf.point([lng2, lat2]);
    return turf.distance(from, to, { units: 'kilometers' });
}

/**
 * Get cameras within a radius of user's location
 * @param userLat - User's latitude
 * @param userLng - User's longitude
 * @param radiusKm - Search radius in kilometers (default: 15km)
 * @param sources - Which sources to include (default: all)
 * @returns Array of nearby cameras sorted by distance
 */
export function getNearbyCameras(
    userLat: number,
    userLng: number,
    radiusKm: number = 15,
    sources: ('OFFICIAL' | 'OSM' | 'USER')[] = ['OFFICIAL', 'OSM', 'USER']
): CameraNode[] {
    const allCameras: CameraNode[] = [];

    // Add official cameras if requested
    if (sources.includes('OFFICIAL')) {
        allCameras.push(...getAllOfficialCameras());
    }

    // Filter by radius and calculate distances
    const nearbyCameras = allCameras
        .map(camera => ({
            camera,
            distance: getDistanceKm(userLat, userLng, camera.lat, camera.lng),
        }))
        .filter(({ distance }) => distance <= radiusKm)
        .sort((a, b) => a.distance - b.distance)
        .map(({ camera }) => camera);

    return nearbyCameras;
}

/**
 * Get the closest camera to user's location
 * @returns Closest camera with distance, or null if none found
 */
export function getClosestCamera(
    userLat: number,
    userLng: number,
    maxDistanceKm: number = 2
): { camera: CameraNode; distanceKm: number } | null {
    const cameras = getNearbyCameras(userLat, userLng, maxDistanceKm, ['OFFICIAL']);

    if (cameras.length === 0) return null;

    const closest = cameras[0];
    const distanceKm = getDistanceKm(userLat, userLng, closest.lat, closest.lng);

    return { camera: closest, distanceKm };
}

/**
 * Merge cameras from multiple sources, preferring OFFICIAL over OSM
 * If cameras are within 50m of each other, keep only the OFFICIAL one
 */
export function mergeCamerasWithPriority(
    officialCameras: CameraNode[],
    osmCameras: CameraNode[]
): CameraNode[] {
    const result: CameraNode[] = [...officialCameras];
    const DEDUP_RADIUS_KM = 0.05; // 50 meters

    for (const osmCamera of osmCameras) {
        // Check if there's an official camera within 50m
        const hasNearbyOfficial = officialCameras.some(official => {
            const distance = getDistanceKm(
                osmCamera.lat, osmCamera.lng,
                official.lat, official.lng
            );
            return distance <= DEDUP_RADIUS_KM;
        });

        // Only add OSM camera if no official camera is nearby
        if (!hasNearbyOfficial) {
            result.push(osmCamera);
        }
    }

    return result;
}

/**
 * Get camera statistics
 */
export function getCameraStats() {
    const all = getAllOfficialCameras();
    const speedCams = all.filter(c => c.type === 'SPEED_CAM');
    const redLightCams = all.filter(c => c.type === 'RED_LIGHT_CAM');

    return {
        total: all.length,
        speedCameras: speedCams.length,
        redLightCameras: redLightCams.length,
        cities: [...new Set(all.map(c => c.city))],
    };
}

/**
 * Correct a camera's location using user's current GPS position
 * Saves to IndexedDB and updates the in-memory cache
 */
export async function correctCameraLocation(
    cameraId: string,
    userLat: number,
    userLng: number
): Promise<{ success: boolean; camera?: CameraNode }> {
    // Find the original camera
    const originalCamera = officialCameras
        .map(convertOfficialCamera)
        .find(c => c.id === cameraId);

    if (!originalCamera) {
        console.error(`[CameraLoader] Camera ${cameraId} not found`);
        return { success: false };
    }

    try {
        // Save correction to IndexedDB
        await saveCameraCorrection(
            cameraId,
            originalCamera.lat,
            originalCamera.lng,
            userLat,
            userLng
        );

        // Update in-memory cache
        correctionsCache.set(cameraId, {
            cameraId,
            originalLat: originalCamera.lat,
            originalLng: originalCamera.lng,
            correctedLat: userLat,
            correctedLng: userLng,
            timestamp: Date.now(),
        });

        console.log(`[CameraLoader] Corrected camera ${cameraId}: (${originalCamera.lat}, ${originalCamera.lng}) -> (${userLat}, ${userLng})`);

        return {
            success: true,
            camera: {
                ...originalCamera,
                lat: userLat,
                lng: userLng,
            },
        };
    } catch (e) {
        console.error('[CameraLoader] Failed to save correction:', e);
        return { success: false };
    }
}

/**
 * Check if there's a correctable camera nearby (within 1km)
 */
export function getNearestCorrectableCamera(
    userLat: number,
    userLng: number
): { camera: CameraNode; distanceM: number } | null {
    const cameras = getNearbyCameras(userLat, userLng, 1, ['OFFICIAL']);

    if (cameras.length === 0) return null;

    const nearest = cameras[0];
    const distanceKm = getDistanceKm(userLat, userLng, nearest.lat, nearest.lng);

    return {
        camera: nearest,
        distanceM: Math.round(distanceKm * 1000),
    };
}

export default {
    getAllOfficialCameras,
    getNearbyCameras,
    getClosestCamera,
    mergeCamerasWithPriority,
    getCameraStats,
    loadCorrections,
    correctCameraLocation,
    getNearestCorrectableCamera,
};
