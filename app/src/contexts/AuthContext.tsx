import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User, UserRole } from '@/types';
import { currentUser, technicianUser } from '@/mock/data';
import {
  safeGetItem,
  safeParseJSON,
  safeSetItem,
  safeRemoveItem,
  safeRemoveItemFromScopes,
  type StorageScope,
} from '@/lib/storage';
import {
  approveAdminTechnicianSignupRequest,
  clearStoredTechnicianToken,
  clearStoredAdminToken,
  createTechnicianSignupRequest,
  fetchAdminToken,
  fetchAdminTechnicianPasswordResetRequests,
  fetchDevTechnicianToken,
  fetchTechnicianToken,
  fetchTechnicianMeProfile,
  fetchAdminTechnicianSignupRequests,
  fetchAdminTechnicians,
  getStoredAdminToken,
  getStoredTechnicianToken,
  rejectAdminTechnicianSignupRequest,
  resolveAdminTechnicianPasswordResetRequest,
  setStoredAdminToken,
  setStoredTechnicianToken,
  signupAdminOwner,
  updateAdminTechnician,
} from '@/lib/backend-api';

type TechnicianAccount = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  password?: string;
  avatar?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
};

type TechnicianSignupRequest = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  password: string;
  status?: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  requestedAt: string;
  updatedAt: string;
};

type TechnicianPasswordResetRequest = {
  id: string;
  technicianId: string;
  technicianName?: string;
  technicianEmail: string;
  technicianPhone?: string;
  status: 'PENDING' | 'RESOLVED';
  requestedAt: string;
  reviewedAt?: string;
  remarks?: string;
  updatedAt: string;
};

export type TechnicianAccountSummary = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
};

export type TechnicianSignupRequestSummary = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status?: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  requestedAt: string;
  updatedAt: string;
};

export type TechnicianPasswordResetRequestSummary = {
  id: string;
  technicianId: string;
  technicianName?: string;
  technicianEmail: string;
  technicianPhone?: string;
  status: 'PENDING' | 'RESOLVED';
  requestedAt: string;
  reviewedAt?: string;
  remarks?: string;
  updatedAt: string;
};

export type TechnicianSignupInput = {
  name: string;
  email: string;
  phone?: string;
  password: string;
};

export type TechnicianAccountUpdateInput = {
  name: string;
  email: string;
  phone?: string;
  password?: string;
};

export type AdminSignupInput = {
  companyName: string;
  workspaceSlug: string;
  fullName: string;
  email: string;
  password: string;
  remember?: boolean;
};

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isTechnician: boolean;
  isAuthLoading: boolean;
  hasBackendAdminToken: boolean;
  hasBackendTechnicianToken: boolean;
  technicianAccounts: TechnicianAccountSummary[];
  pendingTechnicianRequests: TechnicianSignupRequestSummary[];
  rejectedTechnicianRequests: TechnicianSignupRequestSummary[];
  pendingTechnicianPasswordResetRequests: TechnicianPasswordResetRequestSummary[];
  syncAdminData: () => Promise<void>;
  login: (email: string, password: string, role?: UserRole, options?: { remember?: boolean }) => Promise<void>;
  signupAdmin: (input: AdminSignupInput) => Promise<void>;
  requestTechnicianSignup: (input: TechnicianSignupInput) => Promise<void>;
  approveTechnicianSignupRequest: (requestId: string) => Promise<void>;
  rejectTechnicianSignupRequest: (requestId: string, reason?: string) => Promise<void>;
  resolveTechnicianPasswordResetRequest: (requestId: string, remarks?: string) => Promise<void>;
  updateTechnicianAccount: (id: string, input: TechnicianAccountUpdateInput) => Promise<void>;
  setTechnicianAccountActive: (id: string, isActive: boolean) => Promise<void>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_STORAGE_KEY = 'sm_dispatch_auth_user';
const TECHNICIANS_STORAGE_KEY = 'sm_dispatch_technician_accounts';
const TECHNICIAN_SIGNUP_REQUESTS_STORAGE_KEY = 'sm_dispatch_technician_signup_requests';
const TECHNICIAN_REJECTED_SIGNUP_REQUESTS_STORAGE_KEY = 'sm_dispatch_technician_rejected_signup_requests';
const ADMIN_EMAIL = currentUser.email.toLowerCase();

const DEFAULT_TECHNICIAN_ACCOUNTS: TechnicianAccount[] = [
  {
    id: technicianUser.id,
    name: technicianUser.name,
    email: technicianUser.email.toLowerCase(),
    phone: technicianUser.phone,
    password: undefined,
    avatar: technicianUser.avatar,
    isActive: true,
    createdAt: technicianUser.createdAt,
    updatedAt: technicianUser.updatedAt,
  },
];

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function createId(prefix: 'tech' | 'req') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}`;
}

function toTechnicianUser(account: TechnicianAccount): User {
  return {
    id: account.id,
    name: account.name,
    role: 'technician',
    email: account.email,
    phone: account.phone,
    avatar: account.avatar ?? technicianUser.avatar,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

function toTechnicianSummary(account: TechnicianAccount): TechnicianAccountSummary {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    phone: account.phone,
    avatar: account.avatar,
    isActive: account.isActive,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    lastLoginAt: account.lastLoginAt,
  };
}

function toSignupRequestSummary(request: TechnicianSignupRequest): TechnicianSignupRequestSummary {
  return {
    id: request.id,
    name: request.name,
    email: request.email,
    phone: request.phone,
    status: request.status,
    rejectionReason: request.rejectionReason,
    requestedAt: request.requestedAt,
    updatedAt: request.updatedAt,
  };
}

function toPasswordResetRequestSummary(
  request: TechnicianPasswordResetRequest,
): TechnicianPasswordResetRequestSummary {
  return {
    id: request.id,
    technicianId: request.technicianId,
    technicianName: request.technicianName,
    technicianEmail: request.technicianEmail,
    technicianPhone: request.technicianPhone,
    status: request.status,
    requestedAt: request.requestedAt,
    reviewedAt: request.reviewedAt,
    remarks: request.remarks,
    updatedAt: request.updatedAt,
  };
}

function upsertTechnicianAccount(
  accounts: TechnicianAccount[],
  nextAccount: TechnicianAccount,
): TechnicianAccount[] {
  const existingIndex = accounts.findIndex((item) => item.id === nextAccount.id);
  if (existingIndex === -1) {
    return [nextAccount, ...accounts];
  }

  const next = [...accounts];
  next[existingIndex] = {
    ...next[existingIndex],
    ...nextAccount,
    createdAt: next[existingIndex].createdAt,
  };
  return next;
}

function mapBackendTechnicianAccounts(
  backendRows: Array<{
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    status: 'active' | 'deactivated';
  }>,
  previous: TechnicianAccount[],
): TechnicianAccount[] {
  const byId = new Map(previous.map((item) => [item.id, item]));
  return backendRows.map((row) => {
    const prev = byId.get(row.id);
    return {
      id: row.id,
      name: row.name,
      email: normalizeEmail(row.email),
      phone: row.phone ?? undefined,
      password: prev?.password,
      avatar: prev?.avatar ?? technicianUser.avatar,
      isActive: row.status === 'active',
      createdAt: prev?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginAt: prev?.lastLoginAt,
    };
  });
}

function mapBackendPendingRequests(
  backendRows: Array<{
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    status?: 'pending' | 'approved' | 'rejected';
    rejection_reason?: string | null;
    requested_at: string;
    updated_at: string;
  }>,
): TechnicianSignupRequest[] {
  return backendRows.map((row) => ({
    id: row.id,
    name: row.name,
    email: normalizeEmail(row.email),
    phone: row.phone ?? undefined,
    password: '',
    status: row.status ?? 'pending',
    rejectionReason: row.rejection_reason ?? undefined,
    requestedAt: row.requested_at,
    updatedAt: row.updated_at,
  }));
}

function mapBackendPasswordResetRequests(
  backendRows: Array<{
    id: string;
    technician_id: string;
    technician_name?: string | null;
    technician_email: string;
    technician_phone?: string | null;
    status: 'PENDING' | 'RESOLVED';
    requested_at: string;
    reviewed_at?: string | null;
    remarks?: string | null;
    updated_at: string;
  }>,
): TechnicianPasswordResetRequest[] {
  return backendRows.map((row) => ({
    id: row.id,
    technicianId: row.technician_id,
    technicianName: row.technician_name ?? undefined,
    technicianEmail: normalizeEmail(row.technician_email),
    technicianPhone: row.technician_phone ?? undefined,
    status: row.status,
    requestedAt: row.requested_at,
    reviewedAt: row.reviewed_at ?? undefined,
    remarks: row.remarks ?? undefined,
    updatedAt: row.updated_at,
  }));
}

function parseStoredUser(): { user: User | null; scope: StorageScope } {
  const scopes: StorageScope[] = ['local', 'session'];

  for (const scope of scopes) {
    const raw = safeGetItem(AUTH_STORAGE_KEY, scope);
    if (!raw) {
      continue;
    }

    try {
      return {
        user: JSON.parse(raw) as User,
        scope,
      };
    } catch {
      safeRemoveItem(AUTH_STORAGE_KEY, scope);
    }
  }

  return {
    user: null,
    scope: 'local',
  };
}

function parseStoredTechnicians(): TechnicianAccount[] {
  const parsed = safeParseJSON<Partial<TechnicianAccount>[]>(TECHNICIANS_STORAGE_KEY, []);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return DEFAULT_TECHNICIAN_ACCOUNTS;
  }

  const validAccounts = parsed
    .map((item): TechnicianAccount | null => {
      if (
        typeof item?.id !== 'string'
        || typeof item?.name !== 'string'
        || typeof item?.email !== 'string'
        || typeof item?.createdAt !== 'string'
        || typeof item?.updatedAt !== 'string'
      ) {
        return null;
      }

      return {
        id: item.id,
        name: item.name,
        email: normalizeEmail(item.email),
        phone: item.phone,
        password: typeof item.password === 'string' ? item.password : undefined,
        avatar: item.avatar,
        isActive: typeof item.isActive === 'boolean' ? item.isActive : true,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        lastLoginAt: typeof item.lastLoginAt === 'string' ? item.lastLoginAt : undefined,
      };
    })
    .filter((item): item is TechnicianAccount => item !== null)
    .filter((item, index, list) =>
      list.findIndex((candidate) => candidate.id === item.id) === index
    );

  return validAccounts.length > 0 ? validAccounts : DEFAULT_TECHNICIAN_ACCOUNTS;
}

function parseStoredSignupRequests(): TechnicianSignupRequest[] {
  const parsed = safeParseJSON<Partial<TechnicianSignupRequest>[]>(TECHNICIAN_SIGNUP_REQUESTS_STORAGE_KEY, []);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return [];
  }

  return parsed
    .map((item): TechnicianSignupRequest | null => {
      if (
        typeof item?.id !== 'string'
        || typeof item?.name !== 'string'
        || typeof item?.email !== 'string'
        || typeof item?.password !== 'string'
        || typeof item?.requestedAt !== 'string'
        || typeof item?.updatedAt !== 'string'
      ) {
        return null;
      }

      return {
        id: item.id,
        name: item.name,
        email: normalizeEmail(item.email),
        phone: item.phone,
        password: item.password,
        status: item.status,
        rejectionReason: item.rejectionReason,
        requestedAt: item.requestedAt,
        updatedAt: item.updatedAt,
      };
    })
    .filter((item): item is TechnicianSignupRequest => item !== null)
    .filter((item, index, list) =>
      list.findIndex((candidate) => candidate.id === item.id) === index
    );
}

function parseStoredRejectedSignupRequests(): TechnicianSignupRequest[] {
  const parsed = safeParseJSON<Partial<TechnicianSignupRequest>[]>(TECHNICIAN_REJECTED_SIGNUP_REQUESTS_STORAGE_KEY, []);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return [];
  }

  return parsed
    .map((item): TechnicianSignupRequest | null => {
      if (
        typeof item?.id !== 'string'
        || typeof item?.name !== 'string'
        || typeof item?.email !== 'string'
        || typeof item?.requestedAt !== 'string'
        || typeof item?.updatedAt !== 'string'
      ) {
        return null;
      }

      return {
        id: item.id,
        name: item.name,
        email: normalizeEmail(item.email),
        phone: item.phone,
        password: typeof item.password === 'string' ? item.password : '',
        status: 'rejected',
        rejectionReason: typeof item.rejectionReason === 'string' ? item.rejectionReason : undefined,
        requestedAt: item.requestedAt,
        updatedAt: item.updatedAt,
      };
    })
    .filter((item): item is TechnicianSignupRequest => item !== null)
    .filter((item, index, list) =>
      list.findIndex((candidate) => candidate.id === item.id) === index
    );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authStorageScope, setAuthStorageScope] = useState<StorageScope>('local');
  const [technicianAccounts, setTechnicianAccounts] = useState<TechnicianAccount[]>(DEFAULT_TECHNICIAN_ACCOUNTS);
  const [pendingTechnicianRequests, setPendingTechnicianRequests] = useState<TechnicianSignupRequest[]>([]);
  const [rejectedTechnicianRequests, setRejectedTechnicianRequests] = useState<TechnicianSignupRequest[]>([]);
  const [pendingTechnicianPasswordResetRequests, setPendingTechnicianPasswordResetRequests] = useState<TechnicianPasswordResetRequest[]>([]);
  const [hasBackendAdminToken, setHasBackendAdminToken] = useState<boolean>(false);
  const [hasBackendTechnicianToken, setHasBackendTechnicianToken] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const restoreAuthState = async () => {
      try {
        const restoredUser = parseStoredUser();
        const parsedTechnicians = parseStoredTechnicians();
        const parsedPendingRequests = parseStoredSignupRequests();
        const parsedRejectedRequests = parseStoredRejectedSignupRequests();
        const adminToken = getStoredAdminToken();
        const technicianToken = getStoredTechnicianToken();

        let nextUser = restoredUser.user;
        let nextTechnicians = parsedTechnicians;
        let nextHasBackendTechnicianToken = Boolean(technicianToken && technicianToken.trim());
        const shouldRestoreTechnicianFromToken =
          Boolean(technicianToken)
          && (!restoredUser.user || restoredUser.user.role === 'technician');

        if (shouldRestoreTechnicianFromToken && technicianToken) {
          try {
            const backendProfile = await fetchTechnicianMeProfile(technicianToken);
            const nowIso = new Date().toISOString();
            const restoredAccount: TechnicianAccount = {
              id: backendProfile.id,
              name: backendProfile.full_name || backendProfile.name,
              email: normalizeEmail(backendProfile.email),
              phone: backendProfile.phone ?? undefined,
              password: parsedTechnicians.find((item) => item.id === backendProfile.id)?.password,
              avatar: backendProfile.profile_picture_url ?? technicianUser.avatar,
              isActive: backendProfile.status === 'active',
              createdAt: parsedTechnicians.find((item) => item.id === backendProfile.id)?.createdAt ?? nowIso,
              updatedAt: nowIso,
              lastLoginAt: parsedTechnicians.find((item) => item.id === backendProfile.id)?.lastLoginAt ?? nowIso,
            };

            nextTechnicians = upsertTechnicianAccount(parsedTechnicians, restoredAccount);
            nextUser = toTechnicianUser(restoredAccount);
          } catch (error) {
            console.error('Failed to restore technician session from backend token.', error);
            clearStoredTechnicianToken();
            nextUser = null;
            nextHasBackendTechnicianToken = false;
          }
        }

        if (!isMounted) {
          return;
        }

        setUser(nextUser);
        setAuthStorageScope(restoredUser.scope);
        setTechnicianAccounts(nextTechnicians);
        setPendingTechnicianRequests(parsedPendingRequests);
        setRejectedTechnicianRequests(parsedRejectedRequests);
        setPendingTechnicianPasswordResetRequests([]);
        setHasBackendAdminToken(Boolean(adminToken && adminToken.trim()));
        setHasBackendTechnicianToken(nextHasBackendTechnicianToken);
      } catch (error) {
        console.error('Failed to restore auth session from storage.', error);
        if (!isMounted) {
          return;
        }
        setUser(null);
        setTechnicianAccounts(DEFAULT_TECHNICIAN_ACCOUNTS);
        setPendingTechnicianRequests([]);
        setRejectedTechnicianRequests([]);
        setPendingTechnicianPasswordResetRequests([]);
        setHasBackendAdminToken(false);
        setHasBackendTechnicianToken(false);
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    };

    void restoreAuthState();

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshBackendAdminData = useCallback(async () => {
    const token = getStoredAdminToken();
    if (!token) {
      return;
    }

    const [backendTechnicians, backendPending, backendRejected, backendPasswordResetRequests] = await Promise.all([
      fetchAdminTechnicians(token),
      fetchAdminTechnicianSignupRequests(token, 'pending'),
      fetchAdminTechnicianSignupRequests(token, 'rejected'),
      fetchAdminTechnicianPasswordResetRequests(token, 'PENDING'),
    ]);

    setTechnicianAccounts((prev) => mapBackendTechnicianAccounts(backendTechnicians, prev));
    setPendingTechnicianRequests(mapBackendPendingRequests(backendPending));
    setRejectedTechnicianRequests(mapBackendPendingRequests(backendRejected));
    setPendingTechnicianPasswordResetRequests(mapBackendPasswordResetRequests(backendPasswordResetRequests));
  }, []);

  useEffect(() => {
    if (isAuthLoading || user?.role !== 'technician') {
      return;
    }

    const account = technicianAccounts.find((item) => item.id === user.id);
    if (!account) {
      return;
    }

    if (!account.isActive) {
      setUser(null);
      return;
    }

    const synced = toTechnicianUser(account);
    const needsSync =
      user.name !== synced.name
      || user.email !== synced.email
      || user.phone !== synced.phone
      || user.updatedAt !== synced.updatedAt;

    if (needsSync) {
      setUser(synced);
    }
  }, [isAuthLoading, technicianAccounts, user]);

  useEffect(() => {
    if (user) {
      const alternateScope = authStorageScope === 'local' ? 'session' : 'local';
      safeRemoveItem(AUTH_STORAGE_KEY, alternateScope);
      safeSetItem(AUTH_STORAGE_KEY, JSON.stringify(user), authStorageScope);
      return;
    }

    safeRemoveItemFromScopes(AUTH_STORAGE_KEY);
  }, [authStorageScope, user]);

  useEffect(() => {
    safeSetItem(TECHNICIANS_STORAGE_KEY, JSON.stringify(technicianAccounts));
  }, [technicianAccounts]);

  useEffect(() => {
    safeSetItem(TECHNICIAN_SIGNUP_REQUESTS_STORAGE_KEY, JSON.stringify(pendingTechnicianRequests));
  }, [pendingTechnicianRequests]);

  useEffect(() => {
    safeSetItem(TECHNICIAN_REJECTED_SIGNUP_REQUESTS_STORAGE_KEY, JSON.stringify(rejectedTechnicianRequests));
  }, [rejectedTechnicianRequests]);

  useEffect(() => {
    if (!hasBackendAdminToken || user?.role !== 'admin') {
      return;
    }
    void refreshBackendAdminData();
  }, [hasBackendAdminToken, refreshBackendAdminData, user?.role]);

  useEffect(() => {
    if (user?.role !== 'admin' || hasBackendAdminToken) {
      return;
    }
    setUser(null);
  }, [hasBackendAdminToken, refreshBackendAdminData, user]);

  useEffect(() => {
    if (user?.role !== 'technician') {
      return;
    }
    if (hasBackendTechnicianToken) {
      return;
    }
    setUser(null);
  }, [hasBackendTechnicianToken, user?.role]);

  const login = useCallback(async (
    email: string,
    password: string,
    role: UserRole = 'admin',
    options?: { remember?: boolean },
  ) => {
    const normalizedEmail = normalizeEmail(email);
    const normalizedPassword = password.trim();
    const persistSession = options?.remember === true;
    const nextStorageScope: StorageScope = persistSession ? 'local' : 'session';

    if (!normalizedEmail || !normalizedPassword) {
      throw new Error('Email and password are required.');
    }

    if (role === 'admin') {
      const tokenResponse = await fetchAdminToken({
        email: normalizedEmail,
        password: normalizedPassword,
      });
      setStoredAdminToken(tokenResponse.access_token, persistSession);
      setHasBackendAdminToken(true);
      clearStoredTechnicianToken();
      setHasBackendTechnicianToken(false);
      setAuthStorageScope(nextStorageScope);
      await refreshBackendAdminData();

      setUser({
        ...currentUser,
        id: tokenResponse.user_id,
        name: tokenResponse.user_name,
        email: tokenResponse.user_email,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    try {
      let tokenResponse;
      try {
        tokenResponse = await fetchTechnicianToken({
          email: normalizedEmail,
          password: normalizedPassword,
        });
      } catch {
        tokenResponse = await fetchDevTechnicianToken({
          email: normalizedEmail,
          password: normalizedPassword,
        });
      }
      setStoredTechnicianToken(tokenResponse.access_token, persistSession);
      setHasBackendTechnicianToken(true);

      const backendProfile = await fetchTechnicianMeProfile(tokenResponse.access_token);
      const nowIso = new Date().toISOString();
      const backendAccount: TechnicianAccount = {
        id: backendProfile.id,
        name: backendProfile.full_name || backendProfile.name,
        email: normalizeEmail(backendProfile.email),
        phone: backendProfile.phone ?? undefined,
        password: normalizedPassword,
        avatar: backendProfile.profile_picture_url ?? technicianUser.avatar,
        isActive: backendProfile.status === 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: nowIso,
      };

      setAuthStorageScope(nextStorageScope);
      setTechnicianAccounts((prev) => {
        const existingIndex = prev.findIndex((item) => item.id === backendAccount.id);
        if (existingIndex === -1) {
          return [backendAccount, ...prev];
        }
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          ...backendAccount,
          createdAt: next[existingIndex].createdAt,
        };
        return next;
      });

      setUser({
        id: backendAccount.id,
        name: backendAccount.name,
        role: 'technician',
        email: backendAccount.email,
        phone: backendAccount.phone,
        avatar: backendAccount.avatar,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      return;
    } catch (error) {
      setHasBackendTechnicianToken(false);
      clearStoredTechnicianToken();
      throw (error instanceof Error ? error : new Error('Technician login failed.'));
    }
  }, [refreshBackendAdminData]);

  const requestTechnicianSignup = useCallback(async (input: TechnicianSignupInput) => {
    const name = input.name.trim();
    const email = normalizeEmail(input.email);
    const phone = input.phone?.trim();
    const password = input.password.trim();

    if (!name || !email || !password) {
      throw new Error('Name, email, and password are required.');
    }

    if (email === ADMIN_EMAIL) {
      throw new Error('This email is reserved for the admin account.');
    }

    await createTechnicianSignupRequest({
      name,
      email,
      phone,
      password,
    });

    const token = getStoredAdminToken();
    if (token) {
      await refreshBackendAdminData();
      return;
    }

    const now = new Date().toISOString();
    setPendingTechnicianRequests((prev) => [
      {
        id: createId('req'),
        name,
        email,
        phone,
        password,
        status: 'pending',
        requestedAt: now,
        updatedAt: now,
      },
      ...prev,
    ]);
  }, [refreshBackendAdminData]);

  const signupAdmin = useCallback(async (input: AdminSignupInput) => {
    const companyName = input.companyName.trim();
    const workspaceSlug = input.workspaceSlug.trim().toLowerCase();
    const fullName = input.fullName.trim();
    const email = normalizeEmail(input.email);
    const password = input.password.trim();
    const persistSession = input.remember === true;
    const nextStorageScope: StorageScope = persistSession ? 'local' : 'session';

    if (!companyName || !workspaceSlug || !fullName || !email || !password) {
      throw new Error('Company, workspace URL, full name, email, and password are required.');
    }

    const tokenResponse = await signupAdminOwner({
      company_name: companyName,
      workspace_slug: workspaceSlug,
      full_name: fullName,
      email,
      password,
    });

    setStoredAdminToken(tokenResponse.access_token, persistSession);
    setHasBackendAdminToken(true);
    clearStoredTechnicianToken();
    setHasBackendTechnicianToken(false);
    setAuthStorageScope(nextStorageScope);
    await refreshBackendAdminData();

    setUser({
      ...currentUser,
      id: tokenResponse.user_id,
      name: tokenResponse.user_name,
      email: tokenResponse.user_email,
      updatedAt: new Date().toISOString(),
    });
  }, [refreshBackendAdminData]);

  const approveTechnicianSignupRequest = useCallback(async (requestId: string) => {
    const token = getStoredAdminToken();
    if (token) {
      await approveAdminTechnicianSignupRequest(token, requestId);
      await refreshBackendAdminData();
      return;
    }

    const request = pendingTechnicianRequests.find((item) => item.id === requestId);
    if (!request) {
      throw new Error('Signup request not found.');
    }

    const duplicateAccount = technicianAccounts.some(
      (item) => normalizeEmail(item.email) === normalizeEmail(request.email)
    );
    if (duplicateAccount) {
      throw new Error('An account already exists with this email.');
    }

    const now = new Date().toISOString();
    const account: TechnicianAccount = {
      id: createId('tech'),
      name: request.name,
      email: normalizeEmail(request.email),
      phone: request.phone,
      password: request.password,
      avatar: technicianUser.avatar,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    setTechnicianAccounts((prev) => [...prev, account]);
    setPendingTechnicianRequests((prev) => prev.filter((item) => item.id !== requestId));
  }, [pendingTechnicianRequests, refreshBackendAdminData, technicianAccounts]);

  const rejectTechnicianSignupRequest = useCallback(async (requestId: string, reason?: string) => {
    const token = getStoredAdminToken();
    if (token) {
      await rejectAdminTechnicianSignupRequest(token, requestId, reason);
      await refreshBackendAdminData();
      return;
    }

    const request = pendingTechnicianRequests.find((item) => item.id === requestId);
    if (!request) {
      throw new Error('Signup request not found.');
    }

    setPendingTechnicianRequests((prev) => prev.filter((item) => item.id !== requestId));
    setRejectedTechnicianRequests((prev) => [
      {
        ...request,
        status: 'rejected',
        rejectionReason: reason?.trim() || undefined,
        updatedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  }, [pendingTechnicianRequests, refreshBackendAdminData]);

  const resolveTechnicianPasswordResetRequest = useCallback(async (requestId: string, remarks?: string) => {
    const token = getStoredAdminToken();
    if (!token) {
      throw new Error('Admin session is required to resolve password reset requests.');
    }

    await resolveAdminTechnicianPasswordResetRequest(token, requestId, remarks);
    await refreshBackendAdminData();
  }, [refreshBackendAdminData]);

  const updateTechnicianAccount = useCallback(async (id: string, input: TechnicianAccountUpdateInput) => {
    const token = getStoredAdminToken();
    if (token) {
      const existing = technicianAccounts.find((item) => item.id === id);
      if (!existing) {
        throw new Error('Technician account not found.');
      }
      const name = input.name.trim();
      const email = normalizeEmail(input.email);
      const phone = input.phone?.trim();
      const nextPassword = input.password?.trim();

      if (!name || !email) {
        throw new Error('Name and email are required.');
      }

      await updateAdminTechnician(token, id, {
        name,
        email,
        phone: phone || undefined,
        password: nextPassword || undefined,
      });

      setTechnicianAccounts((prev) =>
        prev.map((item) => (
          item.id === id
            ? {
              ...item,
              name,
              email,
              phone,
              password: nextPassword ? nextPassword : item.password,
              updatedAt: new Date().toISOString(),
              lastLoginAt: item.lastLoginAt,
            }
            : item
        ))
      );

      await refreshBackendAdminData();
      return;
    }

    const existing = technicianAccounts.find((item) => item.id === id);
    if (!existing) {
      throw new Error('Technician account not found.');
    }

    const name = input.name.trim();
    const email = normalizeEmail(input.email);
    const phone = input.phone?.trim();
    const nextPassword = input.password?.trim();

    if (!name || !email) {
      throw new Error('Name and email are required.');
    }
    if (email === ADMIN_EMAIL) {
      throw new Error('This email is reserved for the admin account.');
    }

    const duplicateEmail = technicianAccounts.some(
      (item) => item.id !== id && normalizeEmail(item.email) === email
    );
    if (duplicateEmail) {
      throw new Error('Another technician account already uses this email.');
    }

    const pendingConflict = pendingTechnicianRequests.some(
      (request) => normalizeEmail(request.email) === email
    );
    if (pendingConflict) {
      throw new Error('This email is already used by a pending signup request.');
    }

    const now = new Date().toISOString();
    const updated: TechnicianAccount = {
      ...existing,
      name,
      email,
      phone,
      password: nextPassword ? nextPassword : existing.password,
      updatedAt: now,
      lastLoginAt: existing.lastLoginAt,
    };

    setTechnicianAccounts((prev) =>
      prev.map((item) => (item.id === id ? updated : item))
    );
    if (user?.role === 'technician' && user.id === id) {
      setUser(toTechnicianUser(updated));
    }
  }, [pendingTechnicianRequests, refreshBackendAdminData, technicianAccounts, user]);

  const setTechnicianAccountActive = useCallback(async (id: string, isActive: boolean) => {
    const token = getStoredAdminToken();
    if (token) {
      await updateAdminTechnician(token, id, { status: isActive ? 'active' : 'deactivated' });
      await refreshBackendAdminData();
      if (!isActive && user?.role === 'technician' && user.id === id) {
        setUser(null);
      }
      return;
    }

    const existing = technicianAccounts.find((item) => item.id === id);
    if (!existing) {
      throw new Error('Technician account not found.');
    }

    const updated: TechnicianAccount = {
      ...existing,
      isActive,
      updatedAt: new Date().toISOString(),
      lastLoginAt: existing.lastLoginAt,
    };

    setTechnicianAccounts((prev) =>
      prev.map((item) => (item.id === id ? updated : item))
    );

    if (!isActive && user?.role === 'technician' && user.id === id) {
      setUser(null);
    }
  }, [refreshBackendAdminData, technicianAccounts, user]);

  const logout = useCallback(() => {
    setUser(null);
    setPendingTechnicianPasswordResetRequests([]);
    clearStoredAdminToken();
    clearStoredTechnicianToken();
    setHasBackendAdminToken(false);
    setHasBackendTechnicianToken(false);
  }, []);

  const switchRole = useCallback((role: UserRole) => {
    if (role === 'admin') {
      clearStoredTechnicianToken();
      setHasBackendTechnicianToken(false);
      setUser(null);
      return;
    }

    setUser(null);
  }, []);

  const syncAdminData = useCallback(async () => {
    await refreshBackendAdminData();
  }, [refreshBackendAdminData]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isTechnician: user?.role === 'technician',
    isAuthLoading,
    hasBackendAdminToken,
    hasBackendTechnicianToken,
    technicianAccounts: technicianAccounts.map(toTechnicianSummary),
    pendingTechnicianRequests: pendingTechnicianRequests.map(toSignupRequestSummary),
    rejectedTechnicianRequests: rejectedTechnicianRequests.map(toSignupRequestSummary),
    pendingTechnicianPasswordResetRequests: pendingTechnicianPasswordResetRequests.map(toPasswordResetRequestSummary),
    syncAdminData,
    login,
    signupAdmin,
    requestTechnicianSignup,
    approveTechnicianSignupRequest,
    rejectTechnicianSignupRequest,
    resolveTechnicianPasswordResetRequest,
    updateTechnicianAccount,
    setTechnicianAccountActive,
    logout,
    switchRole,
  };

  if (isAuthLoading) {
    return <div>Loading...</div>;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
