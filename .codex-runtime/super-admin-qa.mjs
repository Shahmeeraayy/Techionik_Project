import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:4173';
const outputDir = path.resolve('C:/Users/Tech/Desktop/NexusOps/.codex-runtime/qa-artifacts');
const superAdminEmail = 'root@nexusops.com';
const superAdminPassword = 'superadmin123';
const tenantOwnerEmail = 'owner+qaalpha@nexusops.local';
const tenantOwnerPassword = 'owner12345';

const result = {
  baseUrl,
  screenshots: [],
  consoleMessages: [],
  observations: [],
  checks: {},
};

await fs.mkdir(outputDir, { recursive: true });

function record(key, value) {
  result.checks[key] = value;
}

function observe(message, severity = 'info') {
  result.observations.push({ severity, message });
}

async function snap(page, name) {
  const filePath = path.join(outputDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  result.screenshots.push(filePath);
}

async function loginSuperAdmin(page, { expectFailure = false, email = superAdminEmail, password = superAdminPassword } = {}) {
  await page.goto(`${baseUrl}/super-admin/login`, { waitUntil: 'networkidle' });
  await page.fill('#super-admin-email', email);
  await page.fill('#super-admin-password', password);
  await page.getByRole('button', { name: /open command center/i }).click();

  if (expectFailure) {
    await page.waitForTimeout(800);
    return (await page.locator('text=/invalid|failed|request/i').first().textContent())?.trim() ?? null;
  }

  await page.waitForURL(/\/super-admin(?:\?.*)?$/, { timeout: 15000 });
}

async function loginTenantAdmin(page) {
  await page.goto(`${baseUrl}/admin/login`, { waitUntil: 'networkidle' });
  await page.fill('#admin-email', tenantOwnerEmail);
  await page.fill('#admin-password', tenantOwnerPassword);
  await page.getByRole('button', { name: /enter workspace/i }).click();
}

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
});

try {
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await desktopContext.newPage();
  page.on('console', (message) => {
    const type = message.type();
    if (type === 'error' || type === 'warning') {
      result.consoleMessages.push({
        type,
        text: message.text(),
        url: page.url(),
      });
    }
  });

  await page.goto(`${baseUrl}/super-admin/login`, { waitUntil: 'networkidle' });
  await snap(page, '01-super-admin-login');
  record('superAdminLoginPageVisible', await page.getByText(/super admin/i).first().isVisible());

  const tenantLoginError = await loginSuperAdmin(page, {
    expectFailure: true,
    email: tenantOwnerEmail,
    password: tenantOwnerPassword,
  });
  record('tenantCredentialsRejectedBySuperAdminLogin', Boolean(tenantLoginError));
  record('tenantCredentialsRejectedMessage', tenantLoginError);

  await loginSuperAdmin(page);
  await snap(page, '02-super-admin-dashboard');
  record('dashboardUrl', page.url());
  record('dashboardHeading', (await page.getByRole('heading', { level: 2 }).first().textContent())?.trim() ?? null);
  record('dashboardHasMetrics', await page.getByText(/total tenants/i).first().isVisible());

  const mojibakeCount = await page.evaluate(() => {
    const text = document.body.innerText;
    return (text.match(/â€¢|â€”|â€¦/g) || []).length;
  });
  record('dashboardMojibakeCount', mojibakeCount);
  if (mojibakeCount > 0) {
    observe(`Dashboard text contains ${mojibakeCount} mojibake markers.`, 'warning');
  }

  await page.goto(`${baseUrl}/super-admin/tenants`, { waitUntil: 'networkidle' });
  await snap(page, '03-super-admin-tenants');
  record('tenantListVisible', await page.getByText(/tenant management/i).first().isVisible());
  await page.fill('input[placeholder*="Search business"]', 'no-such-tenant');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);
  record('tenantEmptyStateText', (await page.getByText(/no tenants matched/i).textContent())?.trim() ?? null);

  await page.goto(`${baseUrl}/super-admin/tenants?q=qa-tenant-alpha`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: /open/i }).first().click();
  await page.waitForURL(/\/super-admin\/tenants\/.+$/, { timeout: 15000 });
  await snap(page, '04-super-admin-tenant-detail');
  record('tenantDetailVisible', await page.getByText(/business profile/i).first().isVisible());

  const tenantDetailMojibakeCount = await page.evaluate(() => {
    const text = document.body.innerText;
    return (text.match(/â€¢|â€”|â€¦/g) || []).length;
  });
  record('tenantDetailMojibakeCount', tenantDetailMojibakeCount);
  if (tenantDetailMojibakeCount > 0) {
    observe(`Tenant detail text contains ${tenantDetailMojibakeCount} mojibake markers.`, 'warning');
  }

  await page.selectOption('#tenant-platform-status', 'suspended');
  await page.fill('#change-reason', 'QA suspension check');
  await page.getByRole('button', { name: /save status/i }).click();
  await page.waitForTimeout(1200);
  const confirmationVisible = await page.locator('[role="dialog"]').filter({ hasText: /suspend|confirm|archive/i }).count();
  record('dangerousActionConfirmationShown', confirmationVisible > 0);
  if (confirmationVisible === 0) {
    observe('Tenant status changes execute without a confirmation modal.', 'warning');
  }

  record('tenantStatusBadgeAfterSuspend', (await page.locator('text=/suspended/i').first().textContent())?.trim() ?? null);

  const blockedContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const blockedPage = await blockedContext.newPage();
  await loginTenantAdmin(blockedPage);
  await blockedPage.waitForTimeout(900);
  const blockedMessage = (await blockedPage.locator('text=/restricted|failed|forbidden|invalid/i').first().textContent())?.trim() ?? null;
  record('suspendedTenantAdminBlocked', Boolean(blockedMessage));
  record('suspendedTenantAdminBlockedMessage', blockedMessage);
  await blockedContext.close();

  await page.selectOption('#tenant-platform-status', 'trial');
  await page.fill('#change-reason', 'Restore after suspension QA');
  await page.getByRole('button', { name: /save status/i }).click();
  await page.waitForTimeout(1200);
  record('tenantStatusBadgeAfterRestore', (await page.locator('text=/trial/i').first().textContent())?.trim() ?? null);

  await page.getByRole('button', { name: /unlock sensitive data/i }).click();
  await page.fill('textarea', 'Investigating tenant audit and access behavior.');
  await page.getByRole('button', { name: /unlock tenant data/i }).click();
  await page.waitForTimeout(1200);
  await snap(page, '05-super-admin-break-glass');
  record('breakGlassTabsVisible', await page.getByRole('tab', { name: /tenant users/i }).isVisible());
  record('breakGlassUsersVisible', await page.getByText(/morgan vale/i).isVisible());

  const invalidTokenContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const invalidTokenPage = await invalidTokenContext.newPage();
  await loginSuperAdmin(invalidTokenPage);
  await invalidTokenPage.evaluate(() => {
    localStorage.setItem('sm_dispatch_super_admin_access_token', 'bad-token');
  });
  await invalidTokenPage.goto(`${baseUrl}/super-admin/tenants`, { waitUntil: 'networkidle' });
  await invalidTokenPage.waitForTimeout(1000);
  const invalidTokenError = (await invalidTokenPage.locator('text=/401|403|failed|sign in again|insufficient/i').first().textContent())?.trim() ?? null;
  record('invalidTokenCurrentUrl', invalidTokenPage.url());
  record('invalidTokenErrorText', invalidTokenError);
  record('invalidTokenRedirectedToLogin', /\/super-admin\/login/.test(invalidTokenPage.url()));
  if (!/\/super-admin\/login/.test(invalidTokenPage.url())) {
    observe('Invalid Super Admin token leaves the user on a protected route instead of redirecting to login.', 'warning');
  }
  await invalidTokenContext.close();

  const unauthorizedContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const unauthorizedPage = await unauthorizedContext.newPage();
  await loginTenantAdmin(unauthorizedPage);
  await unauthorizedPage.waitForURL(/\/admin/, { timeout: 15000 });
  await unauthorizedPage.goto(`${baseUrl}/super-admin`, { waitUntil: 'networkidle' });
  record('tenantAdminSuperAdminRedirectUrl', unauthorizedPage.url());
  record('tenantAdminBlockedFromSuperAdminUi', /\/admin/.test(unauthorizedPage.url()));
  await unauthorizedContext.close();

  const logoutContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const logoutPage = await logoutContext.newPage();
  await loginSuperAdmin(logoutPage);
  await logoutPage.locator('button').filter({ hasText: /platform owner/i }).click();
  await logoutPage.getByRole('menuitem', { name: /log out/i }).click();
  await logoutPage.waitForURL(/\/super-admin\/login/, { timeout: 15000 });
  record('logoutRedirectUrl', logoutPage.url());
  await logoutContext.close();

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();
  await loginSuperAdmin(mobilePage);
  await mobilePage.goto(`${baseUrl}/super-admin/tenants`, { waitUntil: 'networkidle' });
  await snap(mobilePage, '06-super-admin-mobile-tenants');
  record('mobileMenuButtonVisible', await mobilePage.getByRole('button', { name: /menu|close navigation/i }).first().isVisible());
  await mobileContext.close();

  await desktopContext.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
