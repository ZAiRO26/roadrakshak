/**
 * CameraLoader.ts - Unified camera data loader
 * Loads official cameras with local overrides applied
 * Uses OverrideService for localStorage-based persistence
 */

import * as turf from '@turf/turf';
import type { CameraNode } from '../types/camera';
import { getMergedCameras, saveCorrection } from './OverrideService';

/**
 * Calculate distance between two points in kilometers
 */
function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const from = turf.point([lng1, lat1]);
    const to = turf.point([lng2, lat2]);
    return turf.distance(from, to, { units: 'kilometers' });
}

/**
 * Get all official cameras with local overrides applied
 */
export function getAllOfficialCameras(): CameraNode[] {
    return getMergedCameras();
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
    officialCamerasList: CameraNode[],
    osmCameras: CameraNode[]
): CameraNode[] {
    const result: CameraNode[] = [...officialCamerasList];
    const DEDUP_RADIUS_KM = 0.05; // 50 meters

    for (const osmCamera of osmCameras) {
        // Check if there's an official camera within 50m
        const hasNearbyOfficial = officialCamerasList.some(official => {
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
 * Saves to localStorage via OverrideService
 */
export function correctCameraLocation(
    cameraId: string,
    userLat: number,
    userLng: number
): { success: boolean; camera?: CameraNode } {
    // Find the camera
    const camera = getAllOfficialCameras().find(c => c.id === cameraId);

    if (!camera) {
        console.error(`[CameraLoader] Camera ${cameraId} not found`);
        return { success: false };
    }

    // Save correction via OverrideService
    saveCorrection(cameraId, userLat, userLng);

    return {
        success: true,
        camera: {
            ...camera,
            lat: userLat,
            lng: userLng,
        },
    };
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
    correctCameraLocation,
    getNearestCorrectableCamera,
};
