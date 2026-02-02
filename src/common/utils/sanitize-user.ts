import { UserGetPayload } from 'generated/prisma/models';

export function sanitizeUser(user: UserGetPayload<any>) {
  const {
    password,
    verificationToken,
    passwordResetToken,
    verificationTokenExpiry,
    passwordResetTokenExpiry,
    ...safeUser
  } = user;
  return safeUser;
}

export function sanitizeUsers(users: UserGetPayload<any>[]) {
  return users.map(sanitizeUser);
}
