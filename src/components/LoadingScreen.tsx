import { useAppStore } from '../stores/appStore';

export function LoadingScreen() {
    const { isLoading } = useAppStore();

    if (!isLoading) return null;

    return (
        <div className="loading-overlay">
            <div style={{ fontSize: '48px' }}>🗺️</div>
            <div className="loading-spinner" />
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>Zairo Maps</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Navigate Smarter
            </div>
        </div>
    );
}
