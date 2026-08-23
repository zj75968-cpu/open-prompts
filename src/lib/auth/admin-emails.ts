function configuredAdminEmails(): string {
  return process.env.ADMIN_EMAIL?.trim() ?? '';
}

/** Comma- or semicolon-separated admin addresses configured by `ADMIN_EMAIL`. */
export function getAdminEmails(): string[] {
  const raw = configuredAdminEmails();
  if (!raw) return [];

  return raw
    .split(/[,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase().trim());
}