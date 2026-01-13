import { useAppStore } from '../stores/appStore';

export function AlertBanner() {
    const { activeAlert, setActiveAlert } = useAppStore();

    if (!activeAlert) return null;

    const icons: Record<string, string> = {
        camera: '📷',
        police: '🚔',
        speeding: '⚠️',
    };

    return (
        <div
            className={`alert-banner ${activeAlert.type}`}
            onClick={() => setActiveAlert(null)}
            role="alert"
            aria-live="assertive"
        >
            <span style={{ fontSize: '24px' }}>{icons[activeAlert.type]}</span>
            <span>{activeAlert.message}</span>
            <button
                style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    setActiveAlert(null);
                }}
                aria-label="Dismiss alert"
            >
                ✕
            </button>
        </div>
    );
}
