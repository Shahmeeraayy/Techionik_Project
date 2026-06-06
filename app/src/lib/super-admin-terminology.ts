const portalTerminologyReplacements: Array<[RegExp, string]> = [
  [/\bTenants\b/g, 'Organizations'],
  [/\bTenant\b/g, 'Organization'],
  [/\btenants\b/g, 'organizations'],
  [/\btenant\b/g, 'organization'],
];

const internalTerminologyReplacements: Array<[RegExp, string]> = [
  [/\bOrganizations\b/g, 'Tenants'],
  [/\bOrganization\b/g, 'Tenant'],
  [/\borganizations\b/g, 'tenants'],
  [/\borganization\b/g, 'tenant'],
];

export function toOrganizationTerminology(text?: string | null) {
  if (!text) return '';

  return portalTerminologyReplacements.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text,
  );
}

export function toInternalTenantTerminology(text?: string | null) {
  if (!text) return '';

  return internalTerminologyReplacements.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text,
  );
}
