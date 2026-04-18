import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Clock, AlertTriangle } from 'lucide-react';

export function SessionTimer() {
    const { sessionExpiresIn } = useAuth();

    if (!sessionExpiresIn || sessionExpiresIn > 60) return null; // Only show when less than 1 hour

    const isWarning = sessionExpiresIn <= 10; // Red warning when less than 10 minutes
    const isCritical = sessionExpiresIn <= 5; // Critical when less than 5 minutes

    const hours = Math.floor(sessionExpiresIn / 60);
    const minutes = sessionExpiresIn % 60;

    return (
        <div
            className={`fixed bottom-4 left-4 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium transition-all ${isCritical
                ? 'bg-red-500 text-white animate-pulse'
                : isWarning
                    ? 'bg-orange-500 text-white'
                    : 'bg-blue-500 text-white'
                }`}
            style={{ zIndex: 9999 }}
        >
            {isCritical ? (
                <AlertTriangle className="w-4 h-4" />
            ) : (
                <Clock className="w-4 h-4" />
            )}
            <span>
                {isCritical && 'تحذير! '}
                الجلسة ستنتهي خلال:{' '}
                {hours > 0 && `${hours} ساعة و`}
                {minutes} دقيقة
            </span>
        </div>
    );
}
