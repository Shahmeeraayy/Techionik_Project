import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from '@/components/ui/sonner';
import { warmupBackend } from '@/lib/backend-api';
import { AdminLayout } from '@/layouts/AdminLayout';
import { SuperAdminLayout } from '@/layouts/SuperAdminLayout';
import { SiteMotion } from '@/components/motion/SiteMotion';
import { HomeRoute, PublicOnly, RequireRole } from '@/components/auth/RouteGuards';
const SettingsLayout = lazy(() => import('@/components/settings/Layout'));
const AdminLoginPage = lazy(() => import('@/pages/auth/AdminLogin'));
const AdminSignupPage = lazy(() => import('@/pages/auth/AdminSignup'));
const TechnicianLoginPage = lazy(() => import('@/pages/auth/TechnicianLogin'));
const TechnicianPasswordResetPage = lazy(() => import('@/pages/auth/TechnicianPasswordReset'));
const TechnicianSignupPage = lazy(() => import('@/pages/auth/TechnicianSignup'));
const MarketingHome = lazy(() => import('@/pages/marketing/Home'));
const BookingPortalPage = lazy(() => import('@/pages/public/BookingPortal'));

const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const JobsPage = lazy(() => import('@/pages/admin/Jobs'));
const JobDetailPage = lazy(() => import('@/pages/admin/JobDetail'));
const InvoiceApprovalsPage = lazy(() => import('@/pages/admin/InvoiceApprovals'));
const IntakeQueuePage = lazy(() => import('@/pages/admin/IntakeQueue'));
const TechniciansPage = lazy(() => import('@/pages/admin/Technicians'));
const TechnicianAccountsPage = lazy(() => import('@/pages/admin/TechnicianAccounts'));
const DealershipsPage = lazy(() => import('@/pages/admin/Dealerships'));
const ServicesPage = lazy(() => import('@/pages/admin/Services'));
const ReportsPage = lazy(() => import('@/pages/admin/Reports'));
const InvoiceHistoryPage = lazy(() => import('@/pages/admin/InvoiceHistory'));
const PlatformChatPage = lazy(() => import('@/pages/admin/PlatformChat'));
const TechnicianPreview = lazy(() => import('@/pages/admin/TechnicianPreview'));
const AdminAttendancePage = lazy(() => import('@/pages/admin/Attendance'));

const SettingsGeneralPage = lazy(() => import('@/pages/settings'));
const SettingsProfilePage = lazy(() => import('@/pages/settings/profile'));
const SettingsNotificationsPage = lazy(() => import('@/pages/settings/notifications'));
const SettingsEmailPage = lazy(() => import('@/pages/settings/email'));
const SettingsBookingPage = lazy(() => import('@/pages/settings/booking'));
const SettingsBillingPage = lazy(() => import('@/pages/settings/billing'));
const SettingsLocationsPage = lazy(() => import('@/pages/settings/locations'));
const SettingsRankingPage = lazy(() => import('@/pages/settings/ranking'));
const SettingsIntegrationsPage = lazy(() => import('@/pages/settings/integrations'));

const AvailableJobsPage = lazy(() => import('@/pages/technician/AvailableJobs'));
const MyJobsPage = lazy(() => import('@/pages/technician/MyJobs'));
const JobHistoryPage = lazy(() => import('@/pages/technician/JobHistory'));
const ProfilePage = lazy(() => import('@/pages/technician/Profile'));
const TechnicianChatPage = lazy(() => import('@/pages/technician/Chat'));
const TechnicianAttendancePage = lazy(() => import('@/pages/technician/Attendance'));

const SuperAdminDashboardPage = lazy(() => import('@/pages/super-admin/Dashboard'));
const SuperAdminTenantsPage = lazy(() => import('@/pages/super-admin/Tenants'));
const SuperAdminTenantDetailPage = lazy(() => import('@/pages/super-admin/TenantDetail'));
const SuperAdminPoliciesPage = lazy(() => import('@/pages/super-admin/Policies'));
const SuperAdminAuditLogsPage = lazy(() => import('@/pages/super-admin/AuditLogs'));
const SuperAdminPlatformSettingsPage = lazy(() => import('@/pages/super-admin/PlatformSettings'));

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
          <Route path="/super-admin/login" element={<PublicOnly><AdminLoginPage /></PublicOnly>} />
          <Route path="/admin/login" element={<PublicOnly><AdminLoginPage /></PublicOnly>} />
          <Route path="/admin/signup" element={<PublicOnly><AdminSignupPage /></PublicOnly>} />
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
