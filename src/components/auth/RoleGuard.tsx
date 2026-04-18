
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { RolePermissions } from '@/types/roles';

interface RoleGuardProps {
    permission: keyof RolePermissions;
    redirectTo?: string;
}

export const RoleGuard = ({ permission, redirectTo = '/dashboard' }: RoleGuardProps) => {
    const { hasPermission, isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (!hasPermission(permission)) {
        return <Navigate to={redirectTo} replace />;
    }

    return <Outlet />;
};
