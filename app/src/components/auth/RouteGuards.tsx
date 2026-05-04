import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/types';

const defaultPathByRole: Record<UserRole, string> = {
  admin: '/admin',
  technician: '/tech/jobs',
};

const CANONICAL_LOGIN_PATH = '/login';
const ADMIN_LOGIN_PATH = '/admin/login';
const TECHNICIAN_LOGIN_PATH = '/tech/login';

function getLoginPathForRole(role: UserRole): string {
  return role === 'admin' ? ADMIN_LOGIN_PATH : TECHNICIAN_LOGIN_PATH;
}

export function RequireRole({ role, children }: { role: UserRole; children: ReactNode }) {
  const { user, isAuthenticated, isAuthLoading, hasBackendAdminToken, hasBackendTechnicianToken } = useAuth();
  const location = useLocation();

  if (isAuthLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to={getLoginPathForRole(role)}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (user.role !== role) {
    return <Navigate to={defaultPathByRole[user.role]} replace />;
  }

  if (role === 'admin' && !hasBackendAdminToken) {
    return (
      <Navigate
        to={ADMIN_LOGIN_PATH}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (role === 'technician' && !hasBackendTechnicianToken) {
    return (
      <Navigate
        to={TECHNICIAN_LOGIN_PATH}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <>{children}</>;
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isAuthLoading, hasBackendAdminToken, hasBackendTechnicianToken } = useAuth();

  if (isAuthLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated || !user) {
    return <>{children}</>;
  }

  if (user.role === 'admin' && !hasBackendAdminToken) {
    return <>{children}</>;
  }

  if (user.role === 'technician' && !hasBackendTechnicianToken) {
    return <>{children}</>;
  }

  return <Navigate to={defaultPathByRole[user.role]} replace />;
}

export function HomeRoute() {
  const { user, isAuthenticated, isAuthLoading, hasBackendAdminToken, hasBackendTechnicianToken } = useAuth();

  if (isAuthLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={CANONICAL_LOGIN_PATH} replace />;
  }

  if (user.role === 'admin' && !hasBackendAdminToken) {
    return <Navigate to={ADMIN_LOGIN_PATH} replace />;
  }

  if (user.role === 'technician' && !hasBackendTechnicianToken) {
    return <Navigate to={CANONICAL_LOGIN_PATH} replace />;
  }

  return <Navigate to={defaultPathByRole[user.role]} replace />;
}
