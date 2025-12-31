/**
 * Utility functions for generating user credentials
 */

/**
 * Generates a secure random password
 * @param length The length of the password (default: 12)
 * @returns A randomly generated password
 */
export function generatePassword(length: number = 12): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';

  // Ensure at least one uppercase, one lowercase, one number, and one special character
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special

  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Generates a unique member ID
 * @returns A formatted member ID like "YPF-2024-XXXX"
 */
export function generateMemberId(): string {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `YPF-${year}-${randomNum}`;
}