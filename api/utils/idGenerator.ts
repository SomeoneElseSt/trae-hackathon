import { randomBytes } from 'crypto';

export class IdGenerator {
  /**
   * Generates a unique API ID with format: api_[8-char-random]
   */
  static generateApiId(): string {
    const randomString = randomBytes(4).toString('hex');
    return `api_${randomString}`;
  }
  
  /**
   * Generates a random string of specified length
   */
  static generateRandomString(length: number = 8): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }
  
  /**
   * Generates a UUID v4
   */
  static generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  /**
   * Validates if a string is a valid API ID format
   */
  static isValidApiId(apiId: string): boolean {
    return /^api_[a-f0-9]{8}$/.test(apiId);
  }
}