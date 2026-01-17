interface MapControlsProps {
    onZoomIn: () => void;
    onZoomOut: () => void;
    onRecenter: () => void;
    isNavigating?: boolean;
}

export function MapControls({ onZoomIn, onZoomOut, onRecenter, isNavigating = false }: MapControlsProps) {
    return (
        <div className={`map-controls ${isNavigating ? 'map-controls--navigating' : ''}`}>
            {/* Recenter to current location */}
            <button
                className="map-control-btn recenter-btn"
                onClick={onRecenter}
                title="Return to my location"
            >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                </svg>
            </button>

            {/* Zoom controls */}
            <div className="zoom-controls">
                <button
                    className="map-control-btn zoom-btn"
                    onClick={onZoomIn}
                    title="Zoom in"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                </button>
                <button
                    className="map-control-btn zoom-btn"
                    onClick={onZoomOut}
                    title="Zoom out"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                </button>
            </div>

            <style>{`
                .map-controls {
                    position: fixed;
                    right: 16px;
                    top: 50%;
                    transform: translateY(-50%);
                    z-index: 1000;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    transition: top 0.3s ease, transform 0.3s ease;
                }
                /* During navigation, position below banner and settings controls */
                .map-controls--navigating {
                    top: 58%;
                }
                .map-control-btn {
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    background: white;
                    color: #374151;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 
                        0 4px 16px rgba(0, 0, 0, 0.15),
                        0 2px 4px rgba(0, 0, 0, 0.1),
                        inset 0 1px 0 rgba(255, 255, 255, 0.5);
                    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                }
                [data-theme="dark"] .map-control-btn {
                    background: rgba(30, 41, 59, 0.92);
                    color: white;
                    border-color: rgba(255, 255, 255, 0.12);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    box-shadow: 
                        0 4px 16px rgba(0, 0, 0, 0.35),
                        0 2px 4px rgba(0, 0, 0, 0.2),
                        inset 0 1px 0 rgba(255, 255, 255, 0.1);
                }
                .map-control-btn:hover {
                    background: #f0f4f8;
                    transform: scale(1.08);
                    box-shadow: 
                        0 6px 24px rgba(0, 0, 0, 0.18),
                        inset 0 1px 0 rgba(255, 255, 255, 0.5);
                }
                [data-theme="dark"] .map-control-btn:hover {
                    background: rgba(51, 65, 85, 0.95);
                    box-shadow: 
                        0 6px 24px rgba(0, 0, 0, 0.4),
                        inset 0 1px 0 rgba(255, 255, 255, 0.15);
                }
                .map-control-btn:active {
                    transform: scale(0.92);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                }
                .recenter-btn {
                    background: white;
                }
                .recenter-btn svg {
                    color: #3b82f6;
                }
                [data-theme="dark"] .recenter-btn svg {
                    color: #60a5fa;
                }
                .zoom-controls {
                    display: flex;
                    flex-direction: column;
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                }
                [data-theme="dark"] .zoom-controls {
                    background: rgba(30, 41, 59, 0.95);
                }
                .zoom-controls .map-control-btn {
                    border-radius: 0;
                    box-shadow: none;
                }
                .zoom-controls .map-control-btn:first-child {
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                }
                [data-theme="dark"] .zoom-controls .map-control-btn:first-child {
                    border-bottom-color: rgba(255, 255, 255, 0.1);
                }

                /* Tablet responsive (768px - 1024px) */
                @media (min-width: 481px) and (max-width: 1024px) {
                    .map-controls {
                        right: 14px;
                        gap: 10px;
                    }
                    .map-control-btn {
                        width: 40px;
                        height: 40px;
                    }
                }

                /* Mobile responsive (< 480px) */
                @media (max-width: 480px) {
                    .map-controls {
                        right: 12px;
                        gap: 8px;
                    }
                    .map-control-btn {
                        width: 38px;
                        height: 38px;
                    }
                }
            `}</style>
        </div>
    );
}
