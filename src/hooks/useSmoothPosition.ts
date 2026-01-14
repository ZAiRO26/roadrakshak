/**
 * useSmoothPosition.ts - Smooth GPS position interpolation for marker animation
 * Prevents "jumping dot" by animating between GPS updates
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useGpsStore } from '../stores/gpsStore';
import { interpolatePosition, isHeadingReliable } from '../services/LogicEngine';

interface SmoothPosition {
    latitude: number | null;
    longitude: number | null;
    heading: number | null;
    isAnimating: boolean;
}

const ANIMATION_DURATION = 500; // ms - time to glide from old to new position

export function useSmoothPosition(): SmoothPosition {
    const { latitude, longitude, heading, speed } = useGpsStore();

    // Smooth animated position
    const [smoothLat, setSmoothLat] = useState<number | null>(null);
    const [smoothLng, setSmoothLng] = useState<number | null>(null);
    const [smoothHeading, setSmoothHeading] = useState<number | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);

    // Previous position for interpolation
    const prevPositionRef = useRef<{ lat: number; lng: number } | null>(null);
    const targetPositionRef = useRef<{ lat: number; lng: number } | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const animationStartRef = useRef<number>(0);

    // Last reliable heading (locked when speed < 5 km/h)
    const lastReliableHeadingRef = useRef<number | null>(null);

    // Animate position from prev to target
    const animatePosition = useCallback(() => {
        const prev = prevPositionRef.current;
        const target = targetPositionRef.current;

        if (!prev || !target) {
            setIsAnimating(false);
            return;
        }

        const now = performance.now();
        const elapsed = now - animationStartRef.current;
        const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

        // Ease-out cubic for smooth deceleration
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        const interpolated = interpolatePosition(prev, target, easeProgress);
        setSmoothLat(interpolated.lat);
        setSmoothLng(interpolated.lng);

        if (progress < 1) {
            animationFrameRef.current = requestAnimationFrame(animatePosition);
        } else {
            // Animation complete - set final position
            setSmoothLat(target.lat);
            setSmoothLng(target.lng);
            prevPositionRef.current = target;
            setIsAnimating(false);
        }
    }, []);

    // Handle new GPS position
    useEffect(() => {
        if (latitude === null || longitude === null) return;

        const newTarget = { lat: latitude, lng: longitude };

        // First position - set immediately
        if (prevPositionRef.current === null) {
            prevPositionRef.current = newTarget;
            targetPositionRef.current = newTarget;
            setSmoothLat(latitude);
            setSmoothLng(longitude);
            return;
        }

        // Cancel any ongoing animation
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        // Use current smooth position as starting point (for seamless transitions)
        if (smoothLat !== null && smoothLng !== null) {
            prevPositionRef.current = { lat: smoothLat, lng: smoothLng };
        }

        targetPositionRef.current = newTarget;
        animationStartRef.current = performance.now();
        setIsAnimating(true);
        animationFrameRef.current = requestAnimationFrame(animatePosition);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [latitude, longitude, animatePosition, smoothLat, smoothLng]);

    // Handle heading with bearing lock at low speeds
    useEffect(() => {
        if (heading === null) return;

        // Bearing Lock: Only update heading if speed >= 5 km/h
        if (isHeadingReliable(speed)) {
            lastReliableHeadingRef.current = heading;
            setSmoothHeading(heading);
        } else {
            // At low speed, keep last reliable heading (prevents spinning at traffic lights)
            // If we never had a reliable heading, use current
            if (lastReliableHeadingRef.current === null) {
                lastReliableHeadingRef.current = heading;
            }
            setSmoothHeading(lastReliableHeadingRef.current);
        }
    }, [heading, speed]);

    return {
        latitude: smoothLat,
        longitude: smoothLng,
        heading: smoothHeading,
        isAnimating,
    };
}

export default useSmoothPosition;
