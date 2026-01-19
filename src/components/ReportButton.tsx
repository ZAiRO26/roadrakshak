import { useState, useCallback } from 'react';
import { useGpsStore } from '../stores/gpsStore';
import { useAppStore } from '../stores/appStore';
import { reportPolice } from '../services/FirebaseService';

interface ReportButtonProps {
    isNavigating?: boolean;
}

export function ReportButton({ isNavigating = false }: ReportButtonProps) {
    const [isReporting, setIsReporting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const { latitude, longitude } = useGpsStore();
    const { addPoliceReport } = useAppStore();

    const handleReport = useCallback(async () => {
        if (latitude === null || longitude === null) {
            alert('Unable to get your location. Please enable GPS.');
            return;
        }

        setIsReporting(true);
        try {
            const report = await reportPolice(latitude, longitude);
            if (report) {
                addPoliceReport(report);
                setShowConfirm(true);
                setTimeout(() => setShowConfirm(false), 2000);
            }
        } catch (error) {
            console.error('Failed to report:', error);
            alert('Failed to report. Please try again.');
        } finally {
            setIsReporting(false);
        }
    }, [latitude, longitude, addPoliceReport]);

    return (
        <>
            <button
                className={`report-btn ${isNavigating ? 'report-btn--navigating' : ''}`}
                onClick={handleReport}
                disabled={isReporting}
                title="Report police checkpoint"
                aria-label="Report police"
                style={{
                    opacity: isReporting ? 0.7 : 1,
                    transform: showConfirm ? 'scale(1.2)' : 'scale(1)',
                }}
            >
                {isReporting ? '⏳' : showConfirm ? '✓' : '🚔'}
            </button>

            {showConfirm && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: '110px',
                        right: '20px',
                        background: 'var(--color-success)',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontWeight: '500',
                        zIndex: 1001,
                        animation: 'fadeInUp 0.3s ease',
                    }}
                >
                    Reported! Thanks for helping 🙏
                </div>
            )}

            <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
        </>
    );
}
