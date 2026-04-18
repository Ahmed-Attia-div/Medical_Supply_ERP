import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * GlobalErrorBoundary
 *
 * Wraps the entire app tree. Catches any unhandled render/lifecycle error.
 * Shows a clean recovery UI instead of a blank screen.
 *
 * Usage in App.tsx:
 *   <GlobalErrorBoundary>
 *     <RouterProvider ... />
 *   </GlobalErrorBoundary>
 */
export class GlobalErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // In production you'd send this to Sentry/LogRocket
        console.error('[GlobalErrorBoundary]', error, info.componentStack);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div
                    dir="rtl"
                    className="min-h-screen flex items-center justify-center bg-background p-6"
                >
                    <div className="max-w-md w-full rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center shadow-lg">
                        {/* Icon */}
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-8 w-8 text-destructive"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        </div>

                        <h1 className="mb-2 text-xl font-bold text-foreground">
                            حدث خطأ غير متوقع
                        </h1>
                        <p className="mb-1 text-sm text-muted-foreground">
                            واجه التطبيق مشكلة وتعذّر عليه الاستمرار.
                        </p>
                        {this.state.error && (
                            <pre className="mb-4 mt-3 max-h-28 overflow-auto rounded bg-muted p-3 text-right text-xs text-muted-foreground">
                                {this.state.error.message}
                            </pre>
                        )}
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={this.handleReset}
                                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                            >
                                حاول مجدداً
                            </button>
                            <button
                                onClick={() => window.location.assign('/')}
                                className="rounded-lg border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
                            >
                                الرجوع إلى الرئيسية
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
