import { describe, expect, it } from 'vitest';
import { getApiUrl, mediaUrl, toUploadPath } from './api';
import { groupMessages, initials, receiptLabel } from './messages';
import type { ChatMessage } from './types';

const sender = { id: 'a', username: 'ann', displayName: 'Ann' };
const other = { id: 'b', username: 'bob', displayName: 'Bob' };

function msg(partial: Partial<ChatMessage> & Pick<ChatMessage, 'id' | 'createdAt' | 'sender'>): ChatMessage {
  return {
    body: 'hi',
    type: 'TEXT',
    conversationId: 'c1',
    readBy: [],
    ...partial,
  };
}

describe('groupMessages', () => {
  it('groups consecutive messages from the same sender', () => {
    const groups = groupMessages([
      msg({ id: '1', sender, createdAt: '2026-01-01T10:00:00.000Z' }),
      msg({ id: '2', sender, createdAt: '2026-01-01T10:01:00.000Z' }),
      msg({ id: '3', sender: other, createdAt: '2026-01-01T10:02:00.000Z' }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].messages).toHaveLength(2);
    expect(groups[1].senderId).toBe('b');
  });
});

describe('initials', () => {
  it('uses two letters from a display name', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
  });
});

describe('mediaUrl', () => {
  it('rewrites stored upload hosts through the current API origin', () => {
    expect(toUploadPath('http://192.168.1.44:8080/uploads/a.png')).toBe('/uploads/a.png');
    expect(mediaUrl('http://192.168.1.44:8080/uploads/a.png')).toBe(`${getApiUrl()}/uploads/a.png`);
  });

  it('rejects unsafe avatar URLs', () => {
    expect(mediaUrl('javascript:alert(1)')).toBeUndefined();
    expect(mediaUrl('http://evil.example/uploads/../secret.png')).toBeUndefined();
    expect(mediaUrl('/uploads/note.svg')).toBeUndefined();
  });
});

describe('receiptLabel', () => {
  it('returns sent/delivered/read for own messages only', () => {
    const base = msg({ id: '1', sender, createdAt: '2026-01-01T10:00:00.000Z', status: 'SENT' });
    expect(receiptLabel(base, 'a')).toBe('Sent');
    expect(receiptLabel({ ...base, status: 'DELIVERED' }, 'a')).toBe('Delivered');
    expect(receiptLabel({ ...base, readBy: [{ userId: 'b', readAt: base.createdAt }] }, 'a')).toBe('Read');
    expect(receiptLabel(base, 'b')).toBeNull();
  });
});
