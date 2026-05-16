import { createHash } from 'crypto';

export function hashLineUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex');
}
