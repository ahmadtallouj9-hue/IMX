import type { ChatMessage, Conversation, PublicUser } from './types';

const DB_NAME = 'imx-offline-v1';
const DB_VERSION = 1;

export type OutboxItem = {
  id: string; // clientMessageId
  conversationId: string;
  body: string;
  clientMessageId: string;
  replyToId?: string | null;
  createdAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('conversations')) db.createObjectStore('conversations');
      if (!db.objectStoreNames.contains('messages')) db.createObjectStore('messages');
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
      }),
  );
}

function idbSet(store: string, key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

function idbDelete(store: string, key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

function idbGetAll<T>(store: string): Promise<T[]> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => resolve((req.result as T[]) ?? []);
        req.onerror = () => reject(req.error);
      }),
  );
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export async function cacheConversations(conversations: Conversation[]): Promise<void> {
  try {
    await idbSet('conversations', 'all', conversations);
  } catch {
    /* ignore */
  }
}

export async function readCachedConversations(): Promise<Conversation[] | null> {
  try {
    return (await idbGet<Conversation[]>('conversations', 'all')) ?? null;
  } catch {
    return null;
  }
}

export async function cacheMessages(conversationId: string, messages: ChatMessage[]): Promise<void> {
  try {
    await idbSet('messages', conversationId, messages);
  } catch {
    /* ignore */
  }
}

export async function readCachedMessages(conversationId: string): Promise<ChatMessage[] | null> {
  try {
    return (await idbGet<ChatMessage[]>('messages', conversationId)) ?? null;
  } catch {
    return null;
  }
}

export async function cacheUser(user: PublicUser): Promise<void> {
  try {
    await idbSet('meta', 'user', user);
  } catch {
    /* ignore */
  }
}

export async function readCachedUser(): Promise<PublicUser | null> {
  try {
    return (await idbGet<PublicUser>('meta', 'user')) ?? null;
  } catch {
    return null;
  }
}

export async function clearCachedUser(): Promise<void> {
  try {
    await idbDelete('meta', 'user');
  } catch {
    /* ignore */
  }
}

export async function enqueueOutbox(item: OutboxItem): Promise<void> {
  try {
    await openDb().then(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction('outbox', 'readwrite');
          tx.objectStore('outbox').put(item);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        }),
    );
  } catch {
    /* ignore */
  }
}

export async function readOutbox(): Promise<OutboxItem[]> {
  try {
    const items = await idbGetAll<OutboxItem>('outbox');
    return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } catch {
    return [];
  }
}

export async function dequeueOutbox(id: string): Promise<void> {
  try {
    await idbDelete('outbox', id);
  } catch {
    /* ignore */
  }
}

export async function outboxCount(): Promise<number> {
  try {
    return (await readOutbox()).length;
  } catch {
    return 0;
  }
}
