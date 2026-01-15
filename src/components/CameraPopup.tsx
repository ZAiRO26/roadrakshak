/**
 * CameraPopup.tsx - Interactive popup for camera markers
 * Shows camera details with Delete/Reset action buttons
 */

import type { CameraNode } from '../types/camera';
import { deleteUserCamera, resetOfficialCamera } from '../services/OverrideService';

interface CameraPopupProps {
    camera: CameraNode & { hasOverride?: boolean };
    onClose: () => void;
    onAction: () => void; // Called after delete/reset to refresh markers
}

export function CameraPopup({ camera, onClose, onAction }: CameraPopupProps) {
    const isUser = camera.source === 'USER';
    const isPolice = camera.type === 'POLICE_POST';
    const isAiCam = camera.type === 'AI_CAM';
    const isFixed = camera.hasOverride === true;
    const limitText = camera.limit
        ? `${camera.limit} km/h`
        : (isPolice ? 'No speed limit' : (isAiCam ? 'AI Monitoring' : 'No limit set'));
    const typeText = camera.type === 'POLICE_POST'
        ? 'Police Checkpoint'
        : camera.type === 'RED_LIGHT_CAM'
            ? 'Red Light Camera'
            : camera.type === 'AI_CAM'
                ? 'AI Enforcement Camera'
                : 'Speed Camera';

    const handleDelete = () => {
        deleteUserCamera(camera.id);
        onAction();
        onClose();
    };

    const handleReset = () => {
        resetOfficialCamera(camera.id);
        onAction();
        onClose();
    };

    // Determine header style: user (purple), police (blue), ai (yellow), or official (red)
    const headerClass = isUser ? 'user' : (isPolice ? 'police' : (isAiCam ? 'ai' : 'official'));

    // Determine icon
    const icon = isPolice ? '🚓' : (isAiCam ? '👁️' : (camera.type === 'RED_LIGHT_CAM' ? '🚦' : '📷'));

    // Determine header text
    const headerText = isUser
        ? '👤 USER ADDED CAMERA'
        : (isPolice ? '👮 HSP CHECKPOINT' : (isAiCam ? '🤖 AI ENFORCEMENT ZONE' : '👮 OFFICIAL CAMERA'));

    return (
        <>
            <div className="popup-overlay" onClick={onClose} />
            <div className="camera-popup">
                {/* Header */}
                <div className={`popup-header ${headerClass}`}>
                    <span className="popup-icon">{icon}</span>
                    <span className="popup-source">
                        {headerText}
                        {isFixed && ' (Fixed)'}
                    </span>
                    <button className="popup-close" onClick={onClose}>✕</button>
                </div>

                {/* Content */}
                <div className="popup-content">
                    <div className="popup-row">
                        <span className="label">📍 Name</span>
                        <span className="value">{camera.name}</span>
                    </div>
                    <div className="popup-row">
                        <span className="label">🏎️ Limit</span>
                        <span className="value">{limitText}</span>
                    </div>
                    <div className="popup-row">
                        <span className="label">📋 Type</span>
                        <span className="value">{typeText}</span>
                    </div>
                    {isAiCam && (
                        <div className="popup-warning">
                            ⚠️ Checks: Seatbelt, Helmet, Phone, Lane
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="popup-actions">
                    {isUser ? (
                        <button className="action-btn delete" onClick={handleDelete}>
                            🗑️ DELETE CAMERA
                        </button>
                    ) : isFixed ? (
                        <button className="action-btn reset" onClick={handleReset}>
                            ↩️ RESET TO ORIGINAL
                        </button>
                    ) : (
                        <div className="no-action">
                            Use "FIX CAM HERE" button when nearby to correct position
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .popup-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 1500;
                }

                .camera-popup {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 1600;
                    
                    width: 300px;
                    max-width: 90vw;
                    background: linear-gradient(135deg, #1e1e2e 0%, #2d2d3d 100%);
                    border-radius: 16px;
                    overflow: hidden;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                    animation: popupSlide 0.2s ease;
                }

                @keyframes popupSlide {
                    from {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1);
                    }
                }

                .popup-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 14px 16px;
                    font-weight: 600;
                    color: white;
                }

                .popup-header.user {
                    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
                }

                .popup-header.official {
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                }

                .popup-header.police {
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                }

                .popup-header.ai {
                    background: linear-gradient(135deg, #eab308 0%, #ca8a04 100%);
                    color: #1e1e2e;
                }

                .popup-icon {
                    font-size: 20px;
                }

                .popup-source {
                    flex: 1;
                    font-size: 13px;
                }

                .popup-close {
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    color: white;
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .popup-close:hover {
                    background: rgba(255, 255, 255, 0.3);
                }

                .popup-content {
                    padding: 16px;
                }

                .popup-warning {
                    margin-top: 12px;
                    padding: 10px 12px;
                    background: rgba(239, 68, 68, 0.15);
                    border: 1px solid rgba(239, 68, 68, 0.4);
                    border-radius: 8px;
                    color: #fca5a5;
                    font-size: 12px;
                    font-weight: 600;
                    text-align: center;
                }

                .popup-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }

                .popup-row:last-child {
                    border-bottom: none;
                }

                .popup-row .label {
                    color: rgba(255, 255, 255, 0.7);
                    font-size: 13px;
                }

                .popup-row .value {
                    color: white;
                    font-weight: 500;
                    font-size: 13px;
                }

                .popup-actions {
                    padding: 16px;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                }

                .action-btn {
                    width: 100%;
                    padding: 14px;
                    border: none;
                    border-radius: 12px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: transform 0.15s, opacity 0.15s;
                }

                .action-btn:hover {
                    transform: scale(1.02);
                }

                .action-btn:active {
                    transform: scale(0.98);
                }

                .action-btn.delete {
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    color: white;
                }

                .action-btn.reset {
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                }

                .no-action {
                    text-align: center;
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 12px;
                    padding: 8px;
                }
            `}</style>
        </>
    );
}

export default CameraPopup;
