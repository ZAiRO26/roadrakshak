import { useGpsStore } from '../stores/gpsStore';
import { useAppStore } from '../stores/appStore';

interface SpeedometerProps {
    isNavigating?: boolean;
}

export function Speedometer({ isNavigating = false }: SpeedometerProps) {
    const { speed } = useGpsStore();
    const { currentSpeedLimit, currentRoadName } = useAppStore();

    const isSpeeding = currentSpeedLimit !== null && speed > currentSpeedLimit;
    const speedDiff = currentSpeedLimit !== null ? speed - currentSpeedLimit : 0;

    return (
        <div
            className="speedometer"
            style={isNavigating ? {
                bottom: '250px',
                left: '12px',
                transform: 'none',
                alignItems: 'flex-start'
            } : undefined}
        >
            {/* Speed limit badge - NOW ABOVE speedometer */}
            {currentSpeedLimit !== null && (
                <div
                    className="speed-limit-badge"
                    style={{
                        borderColor: isSpeeding ? 'var(--color-danger)' : 'var(--color-success)',
                        boxShadow: isSpeeding
                            ? '0 0 12px rgba(239, 68, 68, 0.4)'
                            : '0 0 12px rgba(34, 197, 94, 0.3)',
                    }}
                >
                    {isSpeeding ? (
                        <span style={{ color: 'var(--color-danger)' }}>
                            +{speedDiff} over limit ({currentSpeedLimit})
                        </span>
                    ) : (
                        <span>
                            Limit: <strong>{currentSpeedLimit}</strong> km/h
                        </span>
                    )}
                </div>
            )}

            {/* Main speed display */}
            <div className={`speed-display ${isSpeeding ? 'speeding' : ''}`}>
                <span className="speed-value">{speed}</span>
                <span className="speed-unit">km/h</span>
            </div>

            {/* Road name - HIDE during navigation (trip panel shows destination) */}
            {currentRoadName && !isNavigating && (
                <div className="road-name" style={{ marginTop: '-4px' }}>{currentRoadName}</div>
            )}
        </div>
    );
}
