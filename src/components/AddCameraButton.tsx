/**
 * AddCameraButton.tsx - FAB for adding new cameras to personal database
 * Always visible, adds a purple user camera at current GPS
 */

import { useState, useCallback } from 'react';
import { useGpsStore } from '../stores/gpsStore';
import { addNewCamera, getUserCameraCount } from '../services/OverrideService';

// Event to trigger map marker refresh
export const USER_CAMERA_ADDED_EVENT = 'user-camera-added';

export function AddCameraButton() {
    const { latitude, longitude } = useGpsStore();
    const [isAdding, setIsAdding] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [cameraType, setCameraType] = useState<'SPEED_CAM' | 'RED_LIGHT_CAM'>('SPEED_CAM');
    const [showTypeMenu, setShowTypeMenu] = useState(false);

    const handleAddCamera = useCallback((type: 'SPEED_CAM' | 'RED_LIGHT_CAM') => {
        if (latitude === null || longitude === null) {
            alert('GPS not available. Please enable location services.');
            return;
        }

        setIsAdding(true);
        setCameraType(type);
        setShowTypeMenu(false);

        // Add the camera
        const id = addNewCamera(latitude, longitude, type);
        console.log(`[AddCameraButton] Added camera ${id}`);

        // Dispatch event to refresh map markers
        window.dispatchEvent(new CustomEvent(USER_CAMERA_ADDED_EVENT, {
            detail: { id, lat: latitude, lng: longitude, type }
        }));

        setIsAdding(false);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    }, [latitude, longitude]);

    const handleClick = useCallback(() => {
        setShowTypeMenu(!showTypeMenu);
    }, [showTypeMenu]);

    return (
        <>
            {/* Main FAB Button */}
            <button
                className="add-camera-fab"
                onClick={handleClick}
                disabled={isAdding || latitude === null}
                title="Add new camera to personal database"
            >
                {isAdding ? '⏳' : '📷+'}
            </button>

            {/* Type selection menu */}
            {showTypeMenu && (
                <div className="camera-type-menu">
                    <button
                        className="type-option speed"
                        onClick={() => handleAddCamera('SPEED_CAM')}
                    >
                        📷 Speed Camera
                    </button>
                    <button
                        className="type-option redlight"
                        onClick={() => handleAddCamera('RED_LIGHT_CAM')}
                    >
                        🚦 Red Light Camera
                    </button>
                    <button
                        className="type-option cancel"
                        onClick={() => setShowTypeMenu(false)}
                    >
                        ✕ Cancel
                    </button>
                </div>
            )}

            {/* Toast notification */}
            {showToast && (
                <div className="add-camera-toast">
                    📷 {cameraType === 'RED_LIGHT_CAM' ? 'Red Light' : 'Speed'} Camera Added!
                    <br />
                    <span className="toast-sub">Total: {getUserCameraCount()} personal cameras</span>
                </div>
            )}

            <style>{`
                .add-camera-fab {
                    position: fixed;
                    bottom: 180px;
                    right: 20px;
                    z-index: 1000;
                    
                    width: 56px;
                    height: 56px;
                    border-radius: 50%;
                    border: none;
                    
                    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
                    color: white;
                    font-size: 20px;
                    font-weight: 700;
                    
                    cursor: pointer;
                    box-shadow: 0 4px 20px rgba(139, 92, 246, 0.5);
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                
                .add-camera-fab:hover:not(:disabled) {
                    transform: scale(1.1);
                    box-shadow: 0 6px 25px rgba(139, 92, 246, 0.6);
                }
                
                .add-camera-fab:active:not(:disabled) {
                    transform: scale(0.95);
                }
                
                .add-camera-fab:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .camera-type-menu {
                    position: fixed;
                    bottom: 250px;
                    right: 20px;
                    z-index: 1001;
                    
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    
                    animation: slideUp 0.2s ease;
                }
                
                .type-option {
                    padding: 12px 20px;
                    border: none;
                    border-radius: 12px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    color: white;
                    text-align: left;
                    
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                    transition: transform 0.15s;
                }
                
                .type-option:hover {
                    transform: translateX(-5px);
                }
                
                .type-option.speed {
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                }
                
                .type-option.redlight {
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                }
                
                .type-option.cancel {
                    background: rgba(100, 100, 100, 0.9);
                }
                
                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .add-camera-toast {
                    position: fixed;
                    top: 80px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 2000;
                    
                    padding: 16px 24px;
                    background: rgba(139, 92, 246, 0.95);
                    color: white;
                    font-weight: 600;
                    border-radius: 12px;
                    text-align: center;
                    
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                    animation: slideDown 0.3s ease;
                }
                
                .toast-sub {
                    font-size: 12px;
                    opacity: 0.9;
                    font-weight: 400;
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

export default AddCameraButton;
