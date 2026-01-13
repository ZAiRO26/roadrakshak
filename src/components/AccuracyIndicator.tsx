import { useGpsStore } from '../stores/gpsStore';

export function AccuracyIndicator() {
    const { accuracy, error } = useGpsStore();

    if (error) {
        return (
            <div className="accuracy-dot poor" title={error} />
        );
    }

    const getAccuracyClass = () => {
        if (accuracy === null) return 'poor';
        if (accuracy <= 10) return 'good';
        if (accuracy <= 50) return 'medium';
        return 'poor';
    };

    const getTitle = () => {
        if (accuracy === null) return 'Acquiring GPS...';
        return `GPS accuracy: ±${Math.round(accuracy)}m`;
    };

    return (
        <div
            className={`accuracy-dot ${getAccuracyClass()}`}
            title={getTitle()}
            aria-label={getTitle()}
        />
    );
}
