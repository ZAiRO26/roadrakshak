/**
 * CameraLoader.ts - Unified camera data loader
 * Loads official cameras and provides radius-based filtering
 */

import * as turf from '@turf/turf';
import type { CameraNode, OfficialCameraRaw } from '../types/camera';
import officialCamerasData from '../data/official_cameras.json';

// Type assertion for imported JSON
const officialCameras = officialCamerasData as OfficialCameraRaw[];

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
 */
export function getAllOfficialCameras(): CameraNode[] {
    return officialCameras.map(convertOfficialCamera);
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

export default {
    getAllOfficialCameras,
    getNearbyCameras,
    getClosestCamera,
    mergeCamerasWithPriority,
    getCameraStats,
};
