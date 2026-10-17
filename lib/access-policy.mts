// This installation's allowlist is private runtime configuration, never client data.
export function isAllowedEmail(email: unknown, configuredEmails: unknown): boolean {
  if (typeof email !== 'string' || typeof configuredEmails !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return configuredEmails.split(/[,;\n]/).some(value => value.trim().toLowerCase() === normalized);
}
