import { z } from 'zod';

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may contain letters, numbers, and underscores only'),
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(50).optional(),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(128),
});

export const createConversationSchema = z.object({
  participantIds: z.array(z.string().min(1).max(64)).max(50).optional().default([]),
  title: z.string().trim().min(1).max(80).optional(),
});

export const sendMessageSchema = z.object({
  // Ciphertext is larger than plaintext (base64 + IV); allow room for encrypted bodies.
  body: z.string().max(16000).optional(),
  clientMessageId: z.string().min(1).max(80).optional(),
  replyToId: z.string().min(1).max(64).nullable().optional(),
  attachments: z.array(z.object({
    url: z.string().min(1).max(500).refine(
      (u) => {
        const path = u.includes('/uploads/') ? u.slice(u.indexOf('/uploads/')) : u;
        return /^\/uploads\/[A-Za-z0-9._-]+$/.test(path.split('?')[0].split('#')[0]);
      },
      { message: 'Attachment URL must be a local upload' },
    ),
    kind: z.string().min(1).max(20),
    mimeType: z.string().max(80).optional(),
    size: z.number().optional(),
    fileName: z.string().max(200).optional(),
  })).max(8).optional(),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(50).optional(),
  bio: z.string().max(200).optional(),
  avatarUrl: z.string().max(500).nullable().optional(),
});

export const chatPrefsSchema = z.object({
  muted: z.boolean().optional(),
  pinned: z.boolean().optional(),
  theme: z.enum(['chatter', 'cove', 'dusk', 'ember', 'moss', 'midnight']).optional(),
  backgroundUrl: z.string().max(500).nullable().optional(),
});

export const addMembersSchema = z.object({
  userIds: z.array(z.string().min(1).max(64)).min(1).max(50),
});
