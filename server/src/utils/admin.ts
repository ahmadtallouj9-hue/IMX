import { env } from '../config';

function parseList(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

const adminEmails = parseList(env.ADMIN_EMAILS);
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
