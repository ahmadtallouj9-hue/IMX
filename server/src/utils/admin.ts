import { env } from '../config';

/** Always-admin owner account (works even if Belmo sets ADMIN_EMAILS to blank). */
const OWNER_EMAILS = ['ahmadtallouj9@gmail.com'];

function parseList(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

const adminEmails = new Set([
  ...OWNER_EMAILS.map((e) => e.toLowerCase()),
  ...parseList(env.ADMIN_EMAILS),
]);
const adminUsernames = parseList(env.ADMIN_USERNAMES);

export function isAdminAccount(user: { email?: string | null; username?: string | null }): boolean {
  const email = user.email?.trim().toLowerCase();
  const username = user.username?.trim().toLowerCase();
  if (email && adminEmails.has(email)) return true;
  if (username && adminUsernames.has(username)) return true;
  return false;
}

export function adminConfigured(): boolean {
  return adminEmails.size > 0 || adminUsernames.size > 0;
}
