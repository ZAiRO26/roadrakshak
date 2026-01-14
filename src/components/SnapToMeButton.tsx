/**
 * SnapToMeButton.tsx - Button to correct camera location using current GPS
 * Only visible when within 1km of an official camera
 */

import { useState, useEffect } from 'react';
import { useGpsStore } from '../stores/gpsStore';
import { getNearestCorrectableCamera, correctCameraLocation, loadCorrections } from '../services/CameraLoader';

export function SnapToMeButton() {
    const { latitude, longitude } = useGpsStore();
    const [nearbyCamera, setNearbyCamera] = useState<{ name: string; id: string; distanceM: number } | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    // Load corrections on mount
    useEffect(() => {
        loadCorrections();
    }, []);

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

    const handleSnapToMe = async () => {
        if (!nearbyCamera || latitude === null || longitude === null) return;

        setIsUpdating(true);

        const result = await correctCameraLocation(nearbyCamera.id, latitude, longitude);

        setIsUpdating(false);

        if (result.success) {
            setToastMessage(`📍 Camera location corrected!\n${nearbyCamera.name}`);
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);

            // Force map to refresh markers
            window.dispatchEvent(new CustomEvent('camera-corrected', {
                detail: { cameraId: nearbyCamera.id, lat: latitude, lng: longitude }
            }));
        } else {
            setToastMessage('❌ Failed to save correction');
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
        }
    };

    // Don't render if no nearby camera
    if (!nearbyCamera) return null;

    return (
        <>
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

            {showToast && (
                <div className="snap-toast">
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
                
                .snap-toast {
                    position: fixed;
                    top: 80px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 2000;
                    
                    padding: 16px 24px;
                    background: rgba(16, 185, 129, 0.95);
                    color: white;
                    font-weight: 600;
                    border-radius: 12px;
                    white-space: pre-line;
                    text-align: center;
                    
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                    animation: slideDown 0.3s ease;
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
