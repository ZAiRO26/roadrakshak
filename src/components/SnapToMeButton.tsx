/**
 * SnapToMeButton.tsx - Context-aware button to fix camera locations
 * Only visible when within 500m of an official camera
 * Uses OverrideService for localStorage persistence
 */

import { useState, useEffect, useCallback } from 'react';
import { useGpsStore } from '../stores/gpsStore';
import { getNearestCorrectableCamera } from '../services/CameraLoader';
import { saveCorrection, getOverrideCount, getUserCameraCount, copyMergedToClipboard } from '../services/OverrideService';

// Event to trigger map marker refresh
export const CAMERA_CORRECTED_EVENT = 'camera-location-corrected';

const SNAP_FIX_DISTANCE = 500; // meters - only show button within this range

export function SnapToMeButton() {
    const { latitude, longitude } = useGpsStore();
    const [nearbyCamera, setNearbyCamera] = useState<{ name: string; id: string; distanceM: number } | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'info'>('success');
    const [overrideCount, setOverrideCount] = useState(0);
    const [userCameraCount, setUserCameraCount] = useState(0);

    // Update counts
    useEffect(() => {
        setOverrideCount(getOverrideCount());
        setUserCameraCount(getUserCameraCount());
    }, [showToast]);

    // Check for nearby camera (within 500m)
    useEffect(() => {
        if (latitude === null || longitude === null) return;

        const nearest = getNearestCorrectableCamera(latitude, longitude);

        if (nearest && nearest.distanceM <= SNAP_FIX_DISTANCE) {
            setNearbyCamera({
                name: nearest.camera.name || nearest.camera.id,
                id: nearest.camera.id,
                distanceM: nearest.distanceM,
            });
        } else {
            setNearbyCamera(null);
        }
    }, [latitude, longitude]);

    const handleSnapFix = useCallback(async () => {
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
        setToastMessage(`✅ Camera Fixed!\n${nearbyCamera.name}`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    }, [nearbyCamera, latitude, longitude]);

    const handleExport = useCallback(async () => {
        const result = await copyMergedToClipboard();

        setToastType('info');
        if (result.success) {
            const total = result.counts.overrides + result.counts.userCameras;
            setToastMessage(`📋 ${total} changes exported!\n${result.counts.overrides} fixes + ${result.counts.userCameras} new cams`);
        } else {
            setToastMessage('📋 Check console for data');
        }
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
    }, []);

    const totalChanges = overrideCount + userCameraCount;

    return (
        <>
            {/* Snap Fix button - only visible within 500m of official camera */}
            {nearbyCamera && (
                <button
                    className="snap-fix-btn"
                    onClick={handleSnapFix}
                    disabled={isUpdating}
                    title={`Fix ${nearbyCamera.name} location to your current position`}
                >
                    {isUpdating ? (
                        <span className="updating">⏳</span>
                    ) : (
                        <>
                            <span className="icon">📍</span>
                            <span className="text">SNAP TO ME</span>
                            <span className="distance">{nearbyCamera.distanceM}m</span>
                        </>
                    )}
                </button>
            )}

            {/* Export button - only visible when there are changes */}
            {totalChanges > 0 && (
                <button
                    className="export-btn"
                    onClick={handleExport}
                    title="Export all changes to clipboard"
                >
                    <span className="icon">📤</span>
                    <span className="text">EXPORT ({totalChanges})</span>
                </button>
            )}

            {/* Toast notification */}
            {showToast && (
                <div className={`snap-toast ${toastType}`}>
                    {toastMessage}
                </div>
            )}

            <style>{`
                .snap-fix-btn {
                    position: fixed;
                    bottom: 220px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 50;
                    
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    
                    padding: 14px 28px;
                    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
                    border: none;
                    border-radius: 30px;
                    color: #1e1e2e;
                    font-weight: 700;
                    cursor: pointer;
                    
                    box-shadow: 0 4px 20px rgba(251, 191, 36, 0.5);
                    animation: pulse-fix 2s infinite;
                    transition: transform 0.15s;
                }
                
                .snap-fix-btn:hover:not(:disabled) {
                    transform: translateX(-50%) scale(1.05);
                }
                
                .snap-fix-btn:active:not(:disabled) {
                    transform: translateX(-50%) scale(0.95);
                }
                
                .snap-fix-btn:disabled {
                    opacity: 0.7;
                    cursor: wait;
                }
                
                .snap-fix-btn .icon {
                    font-size: 18px;
                }
                
                .snap-fix-btn .text {
                    font-size: 14px;
                    letter-spacing: 0.5px;
                }
                
                .snap-fix-btn .distance {
                    font-size: 11px;
                    opacity: 0.9;
                    font-weight: 400;
                    background: rgba(0,0,0,0.2);
                    padding: 3px 8px;
                    border-radius: 10px;
                }
                
                .snap-fix-btn .updating {
                    font-size: 24px;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes pulse-fix {
                    0%, 100% { box-shadow: 0 4px 20px rgba(245, 158, 11, 0.4); }
                    50% { box-shadow: 0 4px 30px rgba(245, 158, 11, 0.7); }
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
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    border: none;
                    border-radius: 12px;
                    color: white;
                    font-weight: 600;
                    font-size: 12px;
                    cursor: pointer;
                    
                    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
                    transition: transform 0.15s, box-shadow 0.15s;
                }
                
                .export-btn:hover {
                    transform: scale(1.05);
                    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.5);
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
                    background: rgba(59, 130, 246, 0.95);
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
