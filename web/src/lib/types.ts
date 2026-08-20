export type PublicUser = {
  id: string;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  isOnline?: boolean;
  lastSeenAt?: string | null;
  email?: string;
  createdAt?: string;
};

export type ChatTheme = 'chatter' | 'cove' | 'dusk' | 'ember' | 'moss' | 'midnight';

export type Conversation = {
  id: string;
  type: 'DIRECT' | 'GROUP' | string;
  title: string | null;
  imageUrl?: string | null;
  members: PublicUser[];
  lastMessage: { body: string | null; senderName: string; createdAt: string } | null;
  lastMessageAt: string;
  unreadCount: number;
  muted?: boolean;
  pinned?: boolean;
  theme?: ChatTheme | string;
  backgroundUrl?: string | null;
  myRole?: string;
};

export type ChatMessage = {
  id: string;
  clientMessageId?: string | null;
  body: string | null;
  type: string;
  status?: string;
  sender: PublicUser;
  replyToId?: string | null;
  conversationId: string;
  createdAt: string;
  updatedAt?: string;
  edited?: boolean;
  deletedAt?: string | null;
  readBy: Array<{ userId: string; readAt: string }>;
  attachments?: Array<{ id: string; url: string; kind: string; fileName?: string | null; mimeType?: string | null }>;
};

export type MessageGroup = {
  senderId: string;
  sender: PublicUser;
  messages: ChatMessage[];
};
