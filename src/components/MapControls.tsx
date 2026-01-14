interface MapControlsProps {
    onZoomIn: () => void;
    onZoomOut: () => void;
    onRecenter: () => void;
}

export function MapControls({ onZoomIn, onZoomOut, onRecenter }: MapControlsProps) {
    return (
        <div className="map-controls">
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
                }
                .map-control-btn {
                    width: 44px;
                    height: 44px;
                    border-radius: 8px;
                    border: none;
                    background: white;
                    color: #374151;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                    transition: background 0.15s, transform 0.15s;
                }
                [data-theme="dark"] .map-control-btn {
                    background: rgba(30, 41, 59, 0.95);
                    color: white;
                }
                .map-control-btn:hover {
                    background: #f3f4f6;
                    transform: scale(1.05);
                }
                [data-theme="dark"] .map-control-btn:hover {
                    background: rgba(51, 65, 85, 0.95);
                }
                .map-control-btn:active {
                    transform: scale(0.95);
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
            `}</style>
        </div>
    );
}
