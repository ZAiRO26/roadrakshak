/**
 * LegalDisclaimer.tsx - Legal Safety Warning Modal
 * 
 * PHASE 31: Shows blocking modal on first app launch to protect developer
 * from liability. User must accept terms before using the app.
 */

import { useState, useEffect } from 'react';

const TERMS_KEY = 'hasAcceptedTerms';
const TERMS_VERSION = '1.0'; // Bump this to force re-acceptance if terms change

export function LegalDisclaimer() {
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        // Check if user has accepted terms
        const acceptedVersion = localStorage.getItem(TERMS_KEY);
        if (acceptedVersion !== TERMS_VERSION) {
            setShowModal(true);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem(TERMS_KEY, TERMS_VERSION);
        setShowModal(false);
    };

    if (!showModal) return null;

    return (
        <div className="legal-overlay">
            <div className="legal-modal">
                {/* Warning Icon */}
                <div className="legal-icon">⚠️</div>

                {/* Title */}
                <h2 className="legal-title">Safety Warning</h2>

                {/* Disclaimer Text */}
                <div className="legal-content">
                    <p>
                        <strong>This app is for informational reference only.</strong>
                    </p>
                    <ul>
                        <li>Speed camera data may be <strong>inaccurate, outdated, or incomplete</strong>.</li>
                        <li>Speed limits shown may not reflect actual road conditions.</li>
                        <li>GPS accuracy varies and may show incorrect positions.</li>
                        <li><strong>Always follow posted road signs and traffic laws.</strong></li>
                    </ul>
                    <p className="legal-warning">
                        🚗 The developer is <strong>NOT responsible</strong> for traffic violations,
                        fines, accidents, or any damages arising from use of this app.
                    </p>
                    <p className="legal-focus">
                        <strong>KEEP YOUR EYES ON THE ROAD.</strong><br />
                        Do not interact with this app while driving.
                    </p>
                </div>

                {/* Accept Button */}
                <button className="legal-accept-btn" onClick={handleAccept}>
                    ✓ I Understand & Accept
                </button>

                <p className="legal-footer">
                    By tapping accept, you agree to these terms.
                </p>
            </div>

            <style>{`
                .legal-overlay {
                    position: fixed;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0, 0, 0, 0.9);
                    z-index: 99999;
                    padding: 20px;
                }

                .legal-modal {
                    background: linear-gradient(145deg, #1e1e2e 0%, #2d2d3d 100%);
                    border-radius: 24px;
                    padding: 32px;
                    max-width: 420px;
                    width: 100%;
                    max-height: 90vh;
                    overflow-y: auto;
                    box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    text-align: center;
                }

                .legal-icon {
                    font-size: 64px;
                    margin-bottom: 16px;
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }

                .legal-title {
                    color: #fbbf24;
                    font-size: 28px;
                    font-weight: 800;
                    margin: 0 0 20px 0;
                }

                .legal-content {
                    text-align: left;
                    color: rgba(255, 255, 255, 0.85);
                    font-size: 14px;
                    line-height: 1.6;
                }

                .legal-content p {
                    margin: 0 0 12px 0;
                }

                .legal-content ul {
                    margin: 0 0 16px 0;
                    padding-left: 20px;
                }

                .legal-content li {
                    margin-bottom: 8px;
                }

                .legal-warning {
                    background: rgba(239, 68, 68, 0.15);
                    border: 1px solid rgba(239, 68, 68, 0.4);
                    border-radius: 12px;
                    padding: 12px 16px;
                    color: #fca5a5;
                    font-size: 13px;
                    margin: 16px 0;
                }

                .legal-focus {
                    background: rgba(34, 197, 94, 0.15);
                    border: 1px solid rgba(34, 197, 94, 0.4);
                    border-radius: 12px;
                    padding: 12px 16px;
                    color: #86efac;
                    font-size: 14px;
                    text-align: center;
                }

                .legal-accept-btn {
                    width: 100%;
                    padding: 18px;
                    margin-top: 24px;
                    border: none;
                    border-radius: 16px;
                    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                    color: white;
                    font-size: 18px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: transform 0.2s, box-shadow 0.2s;
                    box-shadow: 0 8px 24px rgba(34, 197, 94, 0.4);
                }

                .legal-accept-btn:hover {
                    transform: scale(1.02);
                }

                .legal-accept-btn:active {
                    transform: scale(0.98);
                }

                .legal-footer {
                    margin-top: 16px;
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.4);
                }
            `}</style>
        </div>
    );
}

export default LegalDisclaimer;
