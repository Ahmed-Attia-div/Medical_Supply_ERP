import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallbackUI?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * يلتقط جميع أخطاء React Runtime ويعرض واجهة احترافية
 * 
 * الاستخدام:
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        // تحديث الحالة لعرض fallback UI
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // تسجيل الخطأ للمراقبة
        console.error('❌ Error Boundary caught an error:', {
            error,
            errorInfo,
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString(),
        });

        // يمكنك إرسال الخطأ لخدمة مراقبة مثل Sentry
        // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });

        this.setState({ errorInfo });
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            // عرض واجهة مخصصة إذا تم توفيرها
            if (this.props.fallbackUI) {
                return this.props.fallbackUI;
            }

            // الواجهة الافتراضية
            return (
                <div className="min-h-screen flex items-center justify-center bg-background p-4">
                    <div className="max-w-2xl w-full">
                        {/* Card الرئيسي */}
                        <div className="bg-card border border-destructive rounded-2xl shadow-lg overflow-hidden">
                            {/* Header */}
                            <div className="bg-destructive/10 border-b border-destructive/20 p-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center">
                                        <AlertTriangle className="w-8 h-8 text-destructive" />
                                    </div>
                                    <div>
                                        <h1 className="text-2xl font-bold text-foreground">
                                            حدث خطأ غير متوقع
                                        </h1>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            عذراً، حدث خطأ أثناء تشغيل التطبيق
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-6 space-y-4">
                                {/* رسالة الخطأ */}
                                <div className="bg-muted/50 rounded-lg p-4 border border-border">
                                    <p className="text-sm font-medium text-foreground mb-2">
                                        تفاصيل الخطأ:
                                    </p>
                                    <p className="text-sm text-destructive font-mono break-all" dir="ltr">
                                        {this.state.error?.message || 'خطأ غير معروف'}
                                    </p>
                                </div>

                                {/* معلومات إضافية في بيئة التطوير */}
                                {import.meta.env.DEV && this.state.errorInfo && (
                                    <details className="bg-muted/30 rounded-lg p-4 border border-border">
                                        <summary className="text-sm font-medium text-foreground cursor-pointer hover:text-primary">
                                            عرض التفاصيل الفنية (للمطورين)
                                        </summary>
                                        <pre className="mt-3 text-xs text-muted-foreground overflow-auto max-h-64 p-3 bg-background rounded border border-border" dir="ltr">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    </details>
                                )}

                                {/* نصائح للمستخدم */}
                                <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                                    <p className="text-sm font-medium text-foreground mb-2">
                                        💡 جرب الحلول التالية:
                                    </p>
                                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                                        <li>إعادة تحميل الصفحة</li>
                                        <li>التحقق من اتصالك بالإنترنت</li>
                                        <li>مسح ذاكرة التخزين المؤقت للمتصفح</li>
                                        <li>إذا استمرت المشكلة، اتصل بالدعم الفني</li>
                                    </ul>
                                </div>
                            </div>

                            {/* Footer - أزرار الإجراءات */}
                            <div className="bg-muted/30 border-t border-border p-6">
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button
                                        onClick={this.handleReload}
                                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        إعادة تحميل الصفحة
                                    </button>

                                    <button
                                        onClick={this.handleGoHome}
                                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors font-medium"
                                    >
                                        <Home className="w-4 h-4" />
                                        العودة للصفحة الرئيسية
                                    </button>
                                </div>

                                {/* زر إعادة المحاولة (للتطوير) */}
                                {import.meta.env.DEV && (
                                    <button
                                        onClick={this.handleReset}
                                        className="w-full mt-3 px-6 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors text-sm"
                                    >
                                        إعادة المحاولة (بدون تحميل)
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* معلومات إضافية */}
                        <div className="mt-4 text-center">
                            <p className="text-xs text-muted-foreground">
                                نظام Wathqq Medical Org • الإصدار 1.0.0
                            </p>
                            <p className="text-xs text-muted-foreground mt-1" dir="ltr">
                                Error ID: {Date.now().toString(36).toUpperCase()}
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Hook لاستخدام Error Boundary بشكل Function Component
 * 
 * الاستخدام:
 * const { resetError } = useErrorBoundary();
 */
export function useErrorBoundary() {
    const [error, setError] = React.useState<Error | null>(null);

    const resetError = React.useCallback(() => {
        setError(null);
    }, []);

    React.useEffect(() => {
        if (error) {
            throw error;
        }
    }, [error]);

    return {
        error,
        setError,
        resetError,
    };
}
