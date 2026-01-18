/**
 * ErrorBoundary.tsx - React Error Boundary Component
 * 
 * PHASE 30.5: Safety net to catch React errors in child components.
 * Prevents full app crash if MapBoard or other components fail.
 */

import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error);
        console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div style={styles.container}>
                    <div style={styles.card}>
                        <div style={styles.icon}>⚠️</div>
                        <h2 style={styles.title}>Something went wrong</h2>
                        <p style={styles.message}>
                            The map encountered an error. Please reload the application.
                        </p>
                        <button style={styles.button} onClick={this.handleReload}>
                            🔄 Reload Application
                        </button>
                        <details style={styles.details}>
                            <summary style={styles.summary}>Error Details</summary>
                            <pre style={styles.errorText}>
                                {this.state.error?.message || 'Unknown error'}
                            </pre>
                        </details>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        zIndex: 10000,
    },
    card: {
        background: 'rgba(30, 30, 50, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '20px',
        padding: '40px',
        textAlign: 'center',
        maxWidth: '400px',
        margin: '20px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
    },
    icon: {
        fontSize: '64px',
        marginBottom: '20px',
    },
    title: {
        color: '#fff',
        fontSize: '24px',
        fontWeight: '700',
        margin: '0 0 12px 0',
    },
    message: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: '15px',
        lineHeight: '1.5',
        margin: '0 0 24px 0',
    },
    button: {
        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        color: '#fff',
        border: 'none',
        borderRadius: '12px',
        padding: '16px 32px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
    },
    details: {
        marginTop: '24px',
        textAlign: 'left',
    },
    summary: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: '13px',
        cursor: 'pointer',
    },
    errorText: {
        color: '#ef4444',
        fontSize: '12px',
        background: 'rgba(239, 68, 68, 0.1)',
        padding: '12px',
        borderRadius: '8px',
        overflow: 'auto',
        maxHeight: '100px',
        marginTop: '12px',
    },
};

export default ErrorBoundary;
