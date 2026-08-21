import type { ChatMessage, MessageGroup } from './types';

const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function sortChronological(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function groupMessages(messages: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const message of sortChronological(messages)) {
    const last = groups[groups.length - 1];
    const lastMsg = last?.messages[last.messages.length - 1];
    const sameSender = last && last.senderId === message.sender.id;
    const close =
      sameSender &&
      lastMsg &&
      new Date(message.createdAt).getTime() - new Date(lastMsg.createdAt).getTime() < GROUP_WINDOW_MS;
    if (close && last) {
      last.messages.push(message);
    } else {
      groups.push({ senderId: message.sender.id, sender: message.sender, messages: [message] });
    }
  }
  return groups;
}

export function formatTime(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function sameCalendarDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export function newClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function receiptLabel(message: ChatMessage, myId: string): string | null {
  if (message.sender.id !== myId) return null;
  if (message.readBy.some((r) => r.userId !== myId) || message.status === 'READ') return 'Read';
  if (message.status === 'DELIVERED') return 'Delivered';
  return 'Sent';
}
