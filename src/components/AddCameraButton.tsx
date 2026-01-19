/**
 * AddCameraButton.tsx - FAB for adding new cameras with auto-sync speed limit
 * Auto-fetches road speed limit from OSM API, allows user to edit
 */

import { useState, useCallback, useRef } from 'react';
import { useGpsStore } from '../stores/gpsStore';
import { addNewCamera, getUserCameraCount } from '../services/OverrideService';
import { fetchRoadLimit } from '../hooks/useSpeedLimit';

// Event to trigger map marker refresh
export const USER_CAMERA_ADDED_EVENT = 'user-camera-added';

interface AddCameraButtonProps {
    isNavigating?: boolean;
}

export function AddCameraButton({ isNavigating = false }: AddCameraButtonProps) {
    const { latitude, longitude } = useGpsStore();
    const [isAdding, setIsAdding] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [speedLimit, setSpeedLimit] = useState('60');
    const [cameraType, setCameraType] = useState<'SPEED_CAM' | 'RED_LIGHT_CAM'>('SPEED_CAM');
    const [autoFetched, setAutoFetched] = useState(false);

    // Rate limiting: prevent spamming
    const lastAddedTime = useRef<number>(0);

    const handleOpenModal = useCallback(async () => {
        if (latitude === null || longitude === null) {
            alert('GPS not available. Please enable location services.');
            return;
        }

        // Show modal immediately with loading state
        setShowModal(true);
        setCameraType('SPEED_CAM');
        setAutoFetched(false);
        setIsFetching(true);
        setSpeedLimit('...');

        try {
            // Auto-fetch road speed limit from API
            const limit = await fetchRoadLimit(latitude, longitude);
            if (limit !== null) {
                setSpeedLimit(String(limit));
                setAutoFetched(true);
                console.log(`[AddCameraButton] Auto-filled speed limit: ${limit}`);
            } else {
                setSpeedLimit('60'); // Default fallback
            }
        } catch (error) {
            console.error('[AddCameraButton] Failed to fetch speed limit:', error);
            setSpeedLimit('60');
        } finally {
            setIsFetching(false);
        }
    }, [latitude, longitude]);

    const handleAddCamera = useCallback(() => {
        if (latitude === null || longitude === null) return;

        // Rate Limiting: 5-second cooldown
        const now = Date.now();
        if (now - lastAddedTime.current < 5000) {
            setToastMessage('⚠️ Please wait a few seconds before reporting again.');
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
            return;
        }

        setIsAdding(true);
        setShowModal(false);

        const limit = cameraType === 'RED_LIGHT_CAM' ? null : parseInt(speedLimit) || null;

        // Add the camera with speed limit
        const id = addNewCamera(latitude, longitude, limit, cameraType);
        lastAddedTime.current = Date.now(); // Update timestamp
        console.log(`[AddCameraButton] Added camera ${id} with limit ${limit}`);

        // Dispatch event to refresh map markers
        window.dispatchEvent(new CustomEvent(USER_CAMERA_ADDED_EVENT, {
            detail: { id, lat: latitude, lng: longitude, type: cameraType, limit }
        }));

        setIsAdding(false);

        // Show toast
        const limitText = limit ? `${limit} km/h` : 'No limit';
        setToastMessage(`📷 Camera Added!\n${cameraType === 'RED_LIGHT_CAM' ? '🚦 Red Light' : `🏎️ ${limitText}`}`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    }, [latitude, longitude, speedLimit, cameraType]);

    return (
        <>
            {/* Main FAB Button */}
            <button
                className="add-camera-fab"
                style={isNavigating ? { bottom: '250px' } : undefined}
                onClick={handleOpenModal}
                disabled={isAdding || latitude === null}
                title="Report new camera"
            >
                {isAdding ? '⏳' : '📷+'}
            </button>

            {/* Speed Limit Modal */}
            {showModal && (
                <div className="speed-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="speed-modal" onClick={e => e.stopPropagation()}>
                        <h3>📷 Add New Camera</h3>

                        {/* Camera Type Toggle */}
                        <div className="type-toggle">
                            <button
                                className={`toggle-btn ${cameraType === 'SPEED_CAM' ? 'active' : ''}`}
                                onClick={() => setCameraType('SPEED_CAM')}
                            >
                                📷 Speed Camera
                            </button>
                            <button
                                className={`toggle-btn ${cameraType === 'RED_LIGHT_CAM' ? 'active' : ''}`}
                                onClick={() => setCameraType('RED_LIGHT_CAM')}
                            >
                                🚦 Red Light
                            </button>
                        </div>

                        {/* Speed Limit Input (only for speed cameras) */}
                        {cameraType === 'SPEED_CAM' && (
                            <div className="speed-input-group">
                                <label>
                                    Speed Limit (km/h)
                                    {isFetching && <span className="fetching"> ⏳ Fetching...</span>}
                                    {autoFetched && !isFetching && <span className="auto-filled"> ✓ Auto-filled</span>}
                                </label>
                                <input
                                    type="number"
                                    value={speedLimit}
                                    onChange={e => {
                                        setSpeedLimit(e.target.value);
                                        setAutoFetched(false);
                                    }}
                                    placeholder="60"
                                    min="20"
                                    max="120"
                                    disabled={isFetching}
                                />
                                <div className="quick-limits">
                                    {[40, 50, 60, 80, 100].map(limit => (
                                        <button
                                            key={limit}
                                            className={`quick-btn ${speedLimit === String(limit) ? 'active' : ''}`}
                                            onClick={() => {
                                                setSpeedLimit(String(limit));
                                                setAutoFetched(false);
                                            }}
                                            disabled={isFetching}
                                        >
                                            {limit}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={() => setShowModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="save-btn"
                                onClick={handleAddCamera}
                                disabled={isFetching}
                            >
                                📍 Add Camera
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast notification */}
            {showToast && (
                <div className="add-camera-toast">
                    {toastMessage}
                    <br />
                    <span className="toast-sub">Total: {getUserCameraCount()} personal cameras</span>
                </div>
            )}

            <style>{`
                .add-camera-fab {
                    position: fixed;
                    right: 20px;
                    bottom: 260px;
                    z-index: 999;
                    
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
            transition: transform 0.2s, box-shadow 0.2s, bottom 0.3s cubic-bezier(0.16, 1, 0.3, 1);
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

            /* During navigation, move camera FAB up to clear bottom panel */
            .add-camera-fab--navigating {
                bottom: 280px;
                }

            /* Modal Overlay */
            .speed-modal-overlay {
                position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            z-index: 2000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s ease;
                }

            @keyframes fadeIn {
                from {opacity: 0; }
            to {opacity: 1; }
                }

            /* Modal */
            .speed-modal {
                background: linear-gradient(135deg, #1e1e2e 0%, #2d2d3d 100%);
            padding: 24px;
            border-radius: 20px;
            width: 320px;
            max-width: 90%;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
            animation: slideUp 0.3s ease;
                }

            @keyframes slideUp {
                from {
                opacity: 0;
            transform: translateY(30px);
                    }
            to {
                opacity: 1;
            transform: translateY(0);
                    }
                }

            .speed-modal h3 {
                color: white;
            margin: 0 0 20px;
            font-size: 18px;
            text-align: center;
                }

            /* Type Toggle */
            .type-toggle {
                display: flex;
            gap: 8px;
            margin-bottom: 20px;
                }

            .toggle-btn {
                flex: 1;
            padding: 12px 8px;
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            background: transparent;
            color: rgba(255, 255, 255, 0.7);
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
                }

            .toggle-btn.active {
                border - color: #8b5cf6;
            background: rgba(139, 92, 246, 0.2);
            color: white;
                }

            /* Speed Input */
            .speed-input-group {
                margin - bottom: 20px;
                }

            .speed-input-group label {
                display: block;
            color: rgba(255, 255, 255, 0.7);
            font-size: 14px;
            margin-bottom: 8px;
                }

            .speed-input-group .fetching {
                color: #f59e0b;
            font-size: 12px;
                }

            .speed-input-group .auto-filled {
                color: #10b981;
            font-size: 12px;
                }

            .speed-input-group input {
                width: 100%;
            padding: 14px;
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            font-size: 24px;
            font-weight: 700;
            text-align: center;
            outline: none;
                }

            .speed-input-group input:focus {
                border - color: #8b5cf6;
                }

            .speed-input-group input:disabled {
                opacity: 0.5;
                }

            /* Quick Limits */
            .quick-limits {
                display: flex;
            gap: 6px;
            margin-top: 12px;
                }

            .quick-btn {
                flex: 1;
            padding: 10px 4px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            background: transparent;
            color: rgba(255, 255, 255, 0.7);
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s;
                }

            .quick-btn:hover:not(:disabled) {
                background: rgba(139, 92, 246, 0.2);
            border-color: #8b5cf6;
                }

            .quick-btn.active {
                background: #8b5cf6;
            border-color: #8b5cf6;
            color: white;
                }

            .quick-btn:disabled {
                opacity: 0.5;
            cursor: not-allowed;
                }

            /* Action Buttons */
            .modal-actions {
                display: flex;
            gap: 12px;
                }

            .cancel-btn, .save-btn {
                flex: 1;
            padding: 14px;
            border: none;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.15s;
                }

            .cancel-btn {
                background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.7);
                }

            .save-btn {
                background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
            color: white;
                }

            .save-btn:disabled {
                opacity: 0.5;
            cursor: not-allowed;
                }

            .cancel-btn:hover, .save-btn:hover:not(:disabled) {
                transform: scale(1.02);
                }

            /* Toast */
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
            white-space: pre-line;

            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            animation: slideDown 0.3s ease;
                }

            .toast-sub {
                font - size: 12px;
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

            /* Tablet responsive (768px - 1024px) */
            @media (min-width: 481px) and (max-width: 1024px) {
                    .add - camera - fab {
                bottom: 160px;
            right: 16px;
            width: 52px;
            height: 52px;
            font-size: 18px;
                    }
                }

                /* Mobile responsive (< 480px) */
            @media (max-width: 480px) {
                    .add - camera - fab {
                bottom: 140px;
            right: 16px;
            width: 50px;
            height: 50px;
            font-size: 16px;
                    }
                }
            `}</style >
        </>
    );
}

export default AddCameraButton;
