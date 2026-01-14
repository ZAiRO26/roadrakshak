/**
 * SnapToMeButton.tsx - Button to correct camera location using current GPS
 * Only visible when within 1km of an official camera
 * Uses OverrideService for localStorage persistence
 */

import { useState, useEffect, useCallback } from 'react';
import { useGpsStore } from '../stores/gpsStore';
import { getNearestCorrectableCamera } from '../services/CameraLoader';
import { saveCorrection, getOverrideCount, copyMergedToClipboard } from '../services/OverrideService';

// Event to trigger map marker refresh
export const CAMERA_CORRECTED_EVENT = 'camera-location-corrected';

export function SnapToMeButton() {
    const { latitude, longitude } = useGpsStore();
    const [nearbyCamera, setNearbyCamera] = useState<{ name: string; id: string; distanceM: number } | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'info'>('success');
    const [overrideCount, setOverrideCount] = useState(0);

    // Update override count
    useEffect(() => {
        setOverrideCount(getOverrideCount());
    }, [showToast]); // Refresh count after each correction

    // Check for nearby camera every second
    useEffect(() => {
        if (latitude === null || longitude === null) return;

        const nearest = getNearestCorrectableCamera(latitude, longitude);

        if (nearest) {
            setNearbyCamera({
                name: nearest.camera.name || nearest.camera.id,
                id: nearest.camera.id,
                distanceM: nearest.distanceM,
            });
        } else {
            setNearbyCamera(null);
        }
    }, [latitude, longitude]);

    const handleSnapToMe = useCallback(async () => {
        if (!nearbyCamera || latitude === null || longitude === null) return;

        setIsUpdating(true);

        // Save correction to localStorage
        saveCorrection(nearbyCamera.id, latitude, longitude);

        // Dispatch event to refresh map markers
        window.dispatchEvent(new CustomEvent(CAMERA_CORRECTED_EVENT, {
            detail: { cameraId: nearbyCamera.id, lat: latitude, lng: longitude }
        }));

        setIsUpdating(false);

        // Show success toast
        setToastType('success');
        setToastMessage(`📍 Camera location corrected!\n${nearbyCamera.name}`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    }, [nearbyCamera, latitude, longitude]);

    const handleExport = useCallback(async () => {
        const success = await copyMergedToClipboard();

        setToastType('info');
        if (success) {
            setToastMessage(`📋 ${overrideCount} corrections copied!\nPaste into official_cameras.json`);
        } else {
            setToastMessage('📋 Check console for data');
        }
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
    }, [overrideCount]);

    return (
        <>
            {/* Snap to Me button - only visible near cameras */}
            {nearbyCamera && (
                <button
                    className="snap-to-me-btn"
                    onClick={handleSnapToMe}
                    disabled={isUpdating}
                    title={`Update ${nearbyCamera.name} location to your current position`}
                >
                    {isUpdating ? (
                        <span className="updating">⏳</span>
                    ) : (
                        <>
                            <span className="icon">📍</span>
                            <span className="text">UPDATE CAM</span>
                        </>
                    )}
                    <span className="distance">{nearbyCamera.distanceM}m away</span>
                </button>
            )}

            {/* Export button - only visible when there are corrections */}
            {overrideCount > 0 && (
                <button
                    className="export-btn"
                    onClick={handleExport}
                    title="Export all corrections to clipboard"
                >
                    <span className="icon">📤</span>
                    <span className="text">EXPORT ({overrideCount})</span>
                </button>
            )}

            {/* Toast notification */}
            {showToast && (
                <div className={`snap-toast ${toastType}`}>
                    {toastMessage}
                </div>
            )}

            <style>{`
                .snap-to-me-btn {
                    position: fixed;
                    bottom: 100px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 1000;
                    
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                    
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    border: none;
                    border-radius: 16px;
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                    
                    box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4);
                    animation: pulse-button 2s infinite;
                    transition: transform 0.15s;
                }
                
                .snap-to-me-btn:hover:not(:disabled) {
                    transform: translateX(-50%) scale(1.05);
                }
                
                .snap-to-me-btn:active:not(:disabled) {
                    transform: translateX(-50%) scale(0.95);
                }
                
                .snap-to-me-btn:disabled {
                    opacity: 0.7;
                    cursor: wait;
                }
                
                .snap-to-me-btn .icon {
                    font-size: 20px;
                }
                
                .snap-to-me-btn .text {
                    font-size: 14px;
                    letter-spacing: 0.5px;
                }
                
                .snap-to-me-btn .distance {
                    font-size: 11px;
                    opacity: 0.9;
                    font-weight: 400;
                }
                
                .snap-to-me-btn .updating {
                    font-size: 24px;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes pulse-button {
                    0%, 100% { box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4); }
                    50% { box-shadow: 0 4px 30px rgba(239, 68, 68, 0.7); }
                }
                
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                /* Export button */
                .export-btn {
                    position: fixed;
                    bottom: 24px;
                    left: 24px;
                    z-index: 1000;
                    
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    
                    padding: 10px 16px;
                    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
                    border: none;
                    border-radius: 12px;
                    color: white;
                    font-weight: 600;
                    font-size: 12px;
                    cursor: pointer;
                    
                    box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);
                    transition: transform 0.15s, box-shadow 0.15s;
                }
                
                .export-btn:hover {
                    transform: scale(1.05);
                    box-shadow: 0 6px 20px rgba(139, 92, 246, 0.5);
                }
                
                .export-btn:active {
                    transform: scale(0.95);
                }
                
                .export-btn .icon {
                    font-size: 16px;
                }
                
                /* Toast notification */
                .snap-toast {
                    position: fixed;
                    top: 80px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 2000;
                    
                    padding: 16px 24px;
                    color: white;
                    font-weight: 600;
                    border-radius: 12px;
                    white-space: pre-line;
                    text-align: center;
                    
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                    animation: slideDown 0.3s ease;
                }
                
                .snap-toast.success {
                    background: rgba(16, 185, 129, 0.95);
                }
                
                .snap-toast.info {
                    background: rgba(139, 92, 246, 0.95);
                }
                
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }
            `}</style>
        </>
    );
}

export default SnapToMeButton;
