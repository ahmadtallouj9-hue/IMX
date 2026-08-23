/** Ciphertext prefix used by client E2E (imx1.<iv>.<ct>). */
export function isEncryptedBody(body: string | null | undefined): boolean {
  return typeof body === 'string' && body.startsWith('imx1.');
}

/** Safe notification / conversation-list preview — never leak ciphertext or plaintext of encrypted msgs. */
export function messagePreview(
  type: string,
  body: string | null | undefined,
): string {
  if (type === 'AUDIO') return '🎤 Voice message';
  if (type === 'IMAGE') return '📷 Photo';
  if (type === 'VIDEO') return '🎬 Video';
  if (type === 'FILE') return '📎 File';
  if (isEncryptedBody(body)) return '🔒 Encrypted message';
  if (body && body.trim()) return body.slice(0, 100);
  return 'Sent an attachment';
}
