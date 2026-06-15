import { Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from '@/components/ui/sonner';
import { warmupBackend } from '@/lib/backend-api';
import { lazyWithRetry } from '@/lib/chunk-loading';
import { AdminLayout } from '@/layouts/AdminLayout';
import { SuperAdminLayout } from '@/layouts/SuperAdminLayout';
import { SiteMotion } from '@/components/motion/SiteMotion';
import { HomeRoute, PublicOnly, RequireRole } from '@/components/auth/RouteGuards';
const SettingsLayout = lazyWithRetry(() => import('@/components/settings/Layout'), { id: 'settings-layout' });
const AdminLoginPage = lazyWithRetry(() => import('@/pages/auth/AdminLogin'), { id: 'admin-login' });
const AdminSignupPage = lazyWithRetry(() => import('@/pages/auth/AdminSignup'), { id: 'admin-signup' });
const AdminPasswordResetPage = lazyWithRetry(() => import('@/pages/auth/AdminPasswordReset'), { id: 'admin-password-reset' });
const TechnicianLoginPage = lazyWithRetry(() => import('@/pages/auth/TechnicianLogin'), { id: 'technician-login' });
const TechnicianPasswordResetPage = lazyWithRetry(() => import('@/pages/auth/TechnicianPasswordReset'), { id: 'technician-password-reset' });
const TechnicianSignupPage = lazyWithRetry(() => import('@/pages/auth/TechnicianSignup'), { id: 'technician-signup' });
const MarketingHome = lazyWithRetry(() => import('@/pages/marketing/Home'), { id: 'marketing-home' });
const BookingPortalPage = lazyWithRetry(() => import('@/pages/public/BookingPortal'), { id: 'booking-portal' });

const AdminDashboard = lazyWithRetry(() => import('@/pages/admin/Dashboard'), { id: 'admin-dashboard' });
const JobsPage = lazyWithRetry(() => import('@/pages/admin/Jobs'), { id: 'admin-jobs' });
const JobDetailPage = lazyWithRetry(() => import('@/pages/admin/JobDetail'), { id: 'admin-job-detail' });
const InvoiceApprovalsPage = lazyWithRetry(() => import('@/pages/admin/InvoiceApprovals'), { id: 'admin-invoice-approvals' });
const IntakeQueuePage = lazyWithRetry(() => import('@/pages/admin/IntakeQueue'), { id: 'admin-intake-queue' });
const TechniciansPage = lazyWithRetry(() => import('@/pages/admin/Technicians'), { id: 'admin-technicians' });
const TechnicianAccountsPage = lazyWithRetry(() => import('@/pages/admin/TechnicianAccounts'), { id: 'admin-technician-accounts' });
const DealershipsPage = lazyWithRetry(() => import('@/pages/admin/Dealerships'), { id: 'admin-dealerships' });
const ServicesPage = lazyWithRetry(() => import('@/pages/admin/Services'), { id: 'admin-services' });
const ReportsPage = lazyWithRetry(() => import('@/pages/admin/Reports'), { id: 'admin-reports' });
const InvoiceHistoryPage = lazyWithRetry(() => import('@/pages/admin/InvoiceHistory'), { id: 'admin-invoice-history' });
const PlatformChatPage = lazyWithRetry(() => import('@/pages/admin/PlatformChat'), { id: 'admin-platform-chat' });
const TechnicianPreview = lazyWithRetry(() => import('@/pages/admin/TechnicianPreview'), { id: 'admin-technician-preview' });
const AdminAttendancePage = lazyWithRetry(() => import('@/pages/admin/Attendance'), { id: 'admin-attendance' });

const SettingsGeneralPage = lazyWithRetry(() => import('@/pages/settings'), { id: 'settings-general' });
const SettingsProfilePage = lazyWithRetry(() => import('@/pages/settings/profile'), { id: 'settings-profile' });
const SettingsNotificationsPage = lazyWithRetry(() => import('@/pages/settings/notifications'), { id: 'settings-notifications' });
const SettingsEmailPage = lazyWithRetry(() => import('@/pages/settings/email'), { id: 'settings-email' });
const SettingsBookingPage = lazyWithRetry(() => import('@/pages/settings/booking'), { id: 'settings-booking' });
const SettingsBillingPage = lazyWithRetry(() => import('@/pages/settings/billing'), { id: 'settings-billing' });
const SettingsLocationsPage = lazyWithRetry(() => import('@/pages/settings/locations'), { id: 'settings-locations' });
const SettingsRankingPage = lazyWithRetry(() => import('@/pages/settings/ranking'), { id: 'settings-ranking' });
const SettingsIntegrationsPage = lazyWithRetry(() => import('@/pages/settings/integrations'), { id: 'settings-integrations' });

const AvailableJobsPage = lazyWithRetry(() => import('@/pages/technician/AvailableJobs'), { id: 'technician-available-jobs' });
const MyJobsPage = lazyWithRetry(() => import('@/pages/technician/MyJobs'), { id: 'technician-my-jobs' });
const JobHistoryPage = lazyWithRetry(() => import('@/pages/technician/JobHistory'), { id: 'technician-job-history' });
const ProfilePage = lazyWithRetry(() => import('@/pages/technician/Profile'), { id: 'technician-profile' });
const TechnicianChatPage = lazyWithRetry(() => import('@/pages/technician/Chat'), { id: 'technician-chat' });
const TechnicianAttendancePage = lazyWithRetry(() => import('@/pages/technician/Attendance'), { id: 'technician-attendance' });

const SuperAdminDashboardPage = lazyWithRetry(() => import('@/pages/super-admin/Dashboard'), { id: 'super-admin-dashboard' });
const SuperAdminLoginPage = lazyWithRetry(() => import('@/pages/super-admin/Login'), { id: 'super-admin-login' });
const SuperAdminTenantsPage = lazyWithRetry(() => import('@/pages/super-admin/Tenants'), { id: 'super-admin-tenants' });
const SuperAdminTenantDetailPage = lazyWithRetry(() => import('@/pages/super-admin/TenantDetail'), { id: 'super-admin-tenant-detail' });
const SuperAdminPoliciesPage = lazyWithRetry(() => import('@/pages/super-admin/Policies'), { id: 'super-admin-policies' });
const SuperAdminAuditLogsPage = lazyWithRetry(() => import('@/pages/super-admin/AuditLogs'), { id: 'super-admin-audit-logs' });
const SuperAdminPlatformSettingsPage = lazyWithRetry(() => import('@/pages/super-admin/PlatformSettings'), { id: 'super-admin-platform-settings' });

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#07111f] text-sm text-slate-400">
      Loading NexusOps...
    </div>
  );
}

function App() {
  useEffect(() => { warmupBackend(); }, []);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AuthProvider>
        <SiteMotion>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<MarketingHome />} />
          <Route path="/book" element={<BookingPortalPage />} />
          <Route path="/book/status" element={<BookingPortalPage />} />
          <Route path="/book/:tenantSlug" element={<BookingPortalPage />} />
          <Route path="/book/:tenantSlug/status" element={<BookingPortalPage />} />

          {/* Login Portals */}
          <Route path="/login" element={<PublicOnly><AdminLoginPage /></PublicOnly>} />
          <Route path="/super-admin/login" element={<PublicOnly><SuperAdminLoginPage /></PublicOnly>} />
          <Route path="/admin/login" element={<PublicOnly><AdminLoginPage /></PublicOnly>} />
          <Route path="/admin/signup" element={<PublicOnly><AdminSignupPage /></PublicOnly>} />
          <Route path="/admin/reset-password/:requestId" element={<AdminPasswordResetPage />} />
          <Route path="/tech/login" element={<PublicOnly><TechnicianLoginPage /></PublicOnly>} />
          <Route path="/tech/signup" element={<PublicOnly><TechnicianSignupPage /></PublicOnly>} />
          <Route path="/tech/reset-password/:requestId" element={<TechnicianPasswordResetPage />} />

          <Route
            path="/settings/*"
            element={
              <RequireRole role="admin">
                <SettingsLayout>
                  <Routes>
                    <Route index element={<SettingsGeneralPage />} />
                    <Route path="profile" element={<SettingsProfilePage />} />
                    <Route path="notifications" element={<SettingsNotificationsPage />} />
                    <Route path="email" element={<SettingsEmailPage />} />
                    <Route path="booking" element={<SettingsBookingPage />} />
                    <Route path="billing" element={<SettingsBillingPage />} />
                    <Route path="locations" element={<SettingsLocationsPage />} />
                    <Route path="ranking" element={<SettingsRankingPage />} />
                    <Route path="integrations" element={<SettingsIntegrationsPage />} />
                    <Route path="*" element={<Navigate to="/settings" replace />} />
                  </Routes>
                </SettingsLayout>
              </RequireRole>
            }
          />

          <Route
            path="/super-admin/*"
            element={
              <RequireRole role="super_admin">
                <SuperAdminLayout>
                  <Routes>
                    <Route index element={<SuperAdminDashboardPage />} />
                    <Route path="tenants" element={<SuperAdminTenantsPage />} />
                    <Route path="tenants/:tenantId" element={<SuperAdminTenantDetailPage />} />
                    <Route path="policies" element={<SuperAdminPoliciesPage />} />
                    <Route path="settings" element={<SuperAdminPlatformSettingsPage />} />
                    <Route path="audit-logs" element={<SuperAdminAuditLogsPage />} />
                  </Routes>
                </SuperAdminLayout>
              </RequireRole>
            }
          />

          {/* Admin Preview Mode - Technician Portal Preview (No AdminLayout) */}
          <Route
            path="/admin/tech-preview/:techId/jobs"
            element={
              <RequireRole role="admin">
                <TechnicianPreview view="jobs" />
              </RequireRole>
            }
          />
          <Route
            path="/admin/tech-preview/:techId/current-job"
            element={
              <RequireRole role="admin">
                <TechnicianPreview view="current-job" />
              </RequireRole>
            }
          />
          <Route
            path="/admin/tech-preview/:techId/history"
            element={
              <RequireRole role="admin">
                <TechnicianPreview view="history" />
              </RequireRole>
            }
          />
          <Route
            path="/admin/tech-preview/:techId/chat"
            element={
              <RequireRole role="admin">
                <TechnicianChatPage />
              </RequireRole>
            }
          />
          <Route
            path="/admin/tech-preview/:techId/attendance"
            element={
              <RequireRole role="admin">
                <TechnicianAttendancePage />
              </RequireRole>
            }
          />
          {/* Backward compatibility aliases */}
          <Route
            path="/admin/tech-preview/:techId/available-jobs"
            element={
              <RequireRole role="admin">
                <Navigate to="../jobs" replace />
              </RequireRole>
            }
          />
          <Route
            path="/admin/tech-preview/:techId/my-jobs"
            element={
              <RequireRole role="admin">
                <Navigate to="../current-job" replace />
              </RequireRole>
            }
          />
          <Route
            path="/admin/tech-preview/:techId/assigned"
            element={
              <RequireRole role="admin">
                <Navigate to="../current-job" replace />
              </RequireRole>
            }
          />
          <Route
            path="/admin/tech-preview/:techId/schedule"
            element={
              <RequireRole role="admin">
                <Navigate to="../history" replace />
              </RequireRole>
            }
          />
          <Route
            path="/admin/tech-preview/:techId/profile"
            element={
              <RequireRole role="admin">
                <TechnicianPreview view="profile" />
              </RequireRole>
            }
          />
          <Route
            path="/admin/tech-preview/:techId/profile/settings"
            element={
              <RequireRole role="admin">
                <TechnicianPreview view="profile" />
              </RequireRole>
            }
          />
          {/* Default preview route redirects to jobs */}
          <Route
            path="/admin/tech-preview/:techId"
            element={
              <RequireRole role="admin">
                <Navigate to="jobs" replace />
              </RequireRole>
            }
          />

          {/* Admin Routes */}
          <Route
            path="/admin/*"
            element={
              <RequireRole role="admin">
                <AdminLayout>
                  <Routes>
                    <Route index element={<AdminDashboard />} />
                    <Route path="jobs" element={<JobsPage />} />
                    <Route path="jobs/:jobId" element={<JobDetailPage />} />
                    <Route path="invoice-approvals" element={<InvoiceApprovalsPage />} />
                    <Route path="approvals" element={<InvoiceApprovalsPage />} />
                    <Route path="intake" element={<IntakeQueuePage />} />
                    <Route path="invoices" element={<InvoiceHistoryPage />} />
                    <Route path="invoice-history" element={<InvoiceHistoryPage />} />
                    <Route path="chat" element={<PlatformChatPage />} />
                    <Route path="locations" element={<DealershipsPage />} />
                    <Route path="technicians" element={<TechniciansPage />} />
                    <Route path="technician-accounts" element={<TechnicianAccountsPage />} />
                    <Route path="accounts" element={<TechnicianAccountsPage />} />
                    <Route path="dealerships" element={<DealershipsPage />} />
                    <Route path="services" element={<ServicesPage />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="attendance" element={<AdminAttendancePage />} />
                    <Route path="settings/*" element={<Navigate to="/settings" replace />} />
                  </Routes>
                </AdminLayout>
              </RequireRole>
            }
          />

          {/* Technician Routes (No Layout - Mobile First) */}
          <Route
            path="/tech"
            element={
              <RequireRole role="technician">
                <Navigate to="/tech/jobs" replace />
              </RequireRole>
            }
          />
          {/* Backward compatibility aliases */}
          <Route
            path="/tech/assigned"
            element={
              <RequireRole role="technician">
                <Navigate to="/tech/current-job" replace />
              </RequireRole>
            }
          />
          <Route
            path="/tech/available-jobs"
            element={
              <RequireRole role="technician">
                <Navigate to="/tech/jobs" replace />
              </RequireRole>
            }
          />
          <Route
            path="/tech/my-jobs"
            element={
              <RequireRole role="technician">
                <Navigate to="/tech/current-job" replace />
              </RequireRole>
            }
          />
          <Route
            path="/tech/schedule"
            element={
              <RequireRole role="technician">
                <Navigate to="/tech/history" replace />
              </RequireRole>
            }
          />
          <Route
            path="/tech/jobs"
            element={
              <RequireRole role="technician">
                <AvailableJobsPage />
              </RequireRole>
            }
          />
          <Route
            path="/tech/current-job"
            element={
              <RequireRole role="technician">
                <MyJobsPage />
              </RequireRole>
            }
          />
          <Route
            path="/tech/history"
            element={
              <RequireRole role="technician">
                <JobHistoryPage />
              </RequireRole>
            }
          />
          <Route
            path="/tech/profile"
            element={
              <RequireRole role="technician">
                <ProfilePage />
              </RequireRole>
            }
          />
          <Route
            path="/tech/chat"
            element={
              <RequireRole role="technician">
                <TechnicianChatPage />
              </RequireRole>
            }
          />
          <Route
            path="/tech/attendance"
            element={
              <RequireRole role="technician">
                <TechnicianAttendancePage />
              </RequireRole>
            }
          />
          <Route
            path="/tech/profile/settings"
            element={
              <RequireRole role="technician">
                <ProfilePage />
              </RequireRole>
            }
          />
          {/* Catch-all for unknown technician routes */}
          <Route
            path="/tech/*"
            element={
              <RequireRole role="technician">
                <Navigate to="/tech/jobs" replace />
              </RequireRole>
            }
          />

          <Route path="*" element={<HomeRoute />} />
        </Routes>
        </Suspense>
        </SiteMotion>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
