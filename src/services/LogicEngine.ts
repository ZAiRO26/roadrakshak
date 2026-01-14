/**
 * LogicEngine.ts - Smart validation for GPS and speed limit data
 * Filters out bad data to prevent wrong road snapping
 */

import * as turf from '@turf/turf';

// Thresholds
const HEADING_DIFF_THRESHOLD = 25; // degrees - reject if car vs road heading differs more
const HIGH_SPEED_THRESHOLD = 70; // km/h - if driving faster, likely on main road
const LOW_ROAD_TYPES = ['service', 'residential', 'living_street', 'track', 'path'];

export interface ValidationParams {
    carHeading: number | null;
    carSpeed: number;
    roadHeading?: number;
    roadType?: string;
    roadName?: string;
}

export interface SpeedLimitResult {
    isValid: boolean;
    reason?: string;
}

/**
 * Normalize angle to 0-360 range
 */
export function normalizeAngle(angle: number): number {
    return ((angle % 360) + 360) % 360;
}

/**
 * Calculate the smallest difference between two angles
 * Returns value between 0-180
 */
export function angleDifference(angle1: number, angle2: number): number {
    const diff = Math.abs(normalizeAngle(angle1) - normalizeAngle(angle2));
    return diff > 180 ? 360 - diff : diff;
}

/**
 * Calculate bearing between two points
 */
export function calculateBearing(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number }
): number {
    const point1 = turf.point([from.lng, from.lat]);
    const point2 = turf.point([to.lng, to.lat]);
    return turf.bearing(point1, point2);
}

/**
 * Validate heading match between car direction and road direction
 * Rule: If car heading differs from road heading by > 25°, reject
 */
export function validateHeading(
    carHeading: number | null,
    roadHeading: number | undefined
): SpeedLimitResult {
    // If either heading is unknown, can't validate - assume valid
    if (carHeading === null || roadHeading === undefined) {
        return { isValid: true };
    }

    const diff = angleDifference(carHeading, roadHeading);

    // Roads can go both ways, so also check opposite direction
    const oppositeDiff = angleDifference(carHeading, roadHeading + 180);
    const minDiff = Math.min(diff, oppositeDiff);

    if (minDiff > HEADING_DIFF_THRESHOLD) {
        return {
            isValid: false,
            reason: `Heading mismatch: car ${Math.round(carHeading)}° vs road ${Math.round(roadHeading)}° (diff: ${Math.round(minDiff)}°)`,
        };
    }

    return { isValid: true };
}

/**
 * Speed gate validation
 * Rule: If car speed > 70 km/h and road type is "service" or "residential", reject
 * (User is likely on the highway, not service road)
 */
export function validateSpeedGate(
    carSpeed: number,
    roadType: string | undefined
): SpeedLimitResult {
    if (!roadType) {
        return { isValid: true };
    }

    const normalizedType = roadType.toLowerCase();
    const isLowSpeedRoad = LOW_ROAD_TYPES.some(t => normalizedType.includes(t));

    if (carSpeed > HIGH_SPEED_THRESHOLD && isLowSpeedRoad) {
        return {
            isValid: false,
            reason: `Speed gate: ${carSpeed} km/h on "${roadType}" - likely on main road`,
        };
    }

    return { isValid: true };
}

/**
 * Main validation function - combines all checks
 */
export function shouldAcceptSpeedLimit(params: ValidationParams): SpeedLimitResult {
    const { carHeading, carSpeed, roadHeading, roadType } = params;

    // Check 1: Heading validation
    const headingResult = validateHeading(carHeading, roadHeading);
    if (!headingResult.isValid) {
        console.log('[LogicEngine] Rejected:', headingResult.reason);
        return headingResult;
    }

    // Check 2: Speed gate validation
    const speedGateResult = validateSpeedGate(carSpeed, roadType);
    if (!speedGateResult.isValid) {
        console.log('[LogicEngine] Rejected:', speedGateResult.reason);
        return speedGateResult;
    }

    return { isValid: true };
}

/**
 * Check if camera is facing the user (for alert filtering)
 * Returns true if we should alert, false if camera faces away
 */
export function isCameraFacingUser(
    userHeading: number | null,
    cameraDirection: number | undefined
): boolean {
    // If camera has no direction tag, assume it faces all directions
    if (cameraDirection === undefined) {
        return true;
    }

    // If user heading is unknown, assume facing for safety
    if (userHeading === null) {
        return true;
    }

    // Camera faces opposite direction if difference > 90°
    // (User is approaching camera from behind)
    const diff = angleDifference(userHeading, cameraDirection);

    // If camera direction is roughly opposite to user's direction, skip alert
    // Camera at 90° means we're approaching it
    // Camera at 180° means it's facing away (catches traffic from other side)
    return diff <= 90;
}

/**
 * Interpolate between two positions for smooth animation
 */
export function interpolatePosition(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
    progress: number // 0 to 1
): { lat: number; lng: number } {
    const clampedProgress = Math.max(0, Math.min(1, progress));

    return {
        lat: from.lat + (to.lat - from.lat) * clampedProgress,
        lng: from.lng + (to.lng - from.lng) * clampedProgress,
    };
}

/**
 * Check if speed is too low for reliable heading
 * At low speeds, GPS heading becomes unreliable
 */
export function isHeadingReliable(speedKmh: number): boolean {
    return speedKmh >= 5;
}
