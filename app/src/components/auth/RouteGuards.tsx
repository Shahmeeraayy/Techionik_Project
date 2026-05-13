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

function AppLoadingScreen() {
  return (
    <div className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-[#05070b] px-6 text-white">
      <div className="marketing-aurora opacity-60" />
      <div className="marketing-grid" />
      <div className="relative w-full max-w-sm rounded-[32px] border border-white/10 bg-white/[0.045] p-6 text-center shadow-[0_34px_120px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-200 shadow-[0_0_22px_rgba(125,211,252,0.85)]" />
        </div>
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-100/70">NexusOps</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">Preparing workspace</h1>
        <div className="mt-6 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-[#4f7cff] to-[#22d3ee] admin-login-scan" />
        </div>
      </div>
    </div>
  );
}

function getLoginPathForRole(role: UserRole): string {
  return role === 'admin' ? ADMIN_LOGIN_PATH : TECHNICIAN_LOGIN_PATH;
}

export function RequireRole({ role, children }: { role: UserRole; children: ReactNode }) {
  const { user, isAuthenticated, isAuthLoading, hasBackendAdminToken, hasBackendTechnicianToken } = useAuth();
  const location = useLocation();

  if (isAuthLoading) {
    return <AppLoadingScreen />;
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
    return <AppLoadingScreen />;
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
    return <AppLoadingScreen />;
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

