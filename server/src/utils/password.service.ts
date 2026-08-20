import bcrypt from 'bcryptjs';
import { env } from '../config';

/**
 * Password hashing service using bcrypt.
 * - hashPassword: creates a salted hash (default 12 rounds)
 * - comparePassword: verifies a plaintext password against a hash
 * - validatePasswordLength: checks minimum length requirements from env
 */
export class PasswordService {
  static readonly SALT_ROUNDS = 12;

  static async hashPassword(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, this.SALT_ROUNDS);
  }

  static async comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  static validatePasswordLength(password: string): { valid: boolean; message?: string } {
    if (password.length < env.PASSWORD_MIN_LENGTH) {
      return { valid: false, message: `Password must be at least ${env.PASSWORD_MIN_LENGTH} characters` };
    }
    return { valid: true };
  }
}
