import * as crypto from 'crypto';

export const generateVerificationCode = (): string => {
  return crypto.randomInt(100000, 1000000).toString();
};
