// src/modules/auth/auth.service.js
// All authentication business logic — credential checks, session eligibility, token rotation.

import bcrypt        from 'bcrypt';
import jwt           from 'jsonwebtoken';
import crypto        from 'crypto';
import prisma        from '../../config/prisma.js';
import { env }       from '../../config/env.js';
import { auditLog }  from '../../lib/audit.js';
import { unauthorized, forbidden, badRequest } from '../../lib/AppError.js';

const BCRYPT_ROUNDS = 12;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const PORTAL_NAMES = {
  SUPER_ADMIN: 'Super Administrator',
  ADMIN:       'Branch Administrator',
  ACCOUNTANT:  'Sales and Billing',
  STAFF:       'Staff / Stylist',
};

// ── Token helpers ────────────────────────────────────────────────────────────

const signAccessToken = (user) =>
  jwt.sign(
    { sub: user.id, role: user.role, branchId: user.branchId, staffId: user.staffId },
    env.jwtAccessSecret,
    { expiresIn: env.jwtAccessExpires }
  );

// jti makes every refresh token unique even when two are issued in the same second.
const signRefreshToken = (userId) =>
  jwt.sign({ sub: userId, jti: crypto.randomUUID() }, env.jwtRefreshSecret, { expiresIn: env.jwtRefreshExpires });

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const REFRESH_COOKIE = 'refreshToken';
export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   env.nodeEnv === 'production',
  sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
  maxAge:   REFRESH_TTL_MS,
  path:     '/',
};

const userInclude = { branch: { select: { name: true, isActive: true } }, staff: true };

/**
 * Shared session-eligibility rules (used by login, refresh and every authenticated request).
 * Mirrors the frontend mock: inactive branch or revoked staff portal access ends the session.
 * @returns {string|null} error message, or null when the user may hold a session
 */
export const sessionBlockReason = (user) => {
  if (!user || !user.isActive) return 'Account is inactive or no longer exists.';
  if (user.role !== 'SUPER_ADMIN') {
    if (!user.branch) return 'Access Denied: The assigned salon branch does not exist.';
    if (!user.branch.isActive) return `Access Denied: Branch '${user.branch.name}' is currently deactivated.`;
  }
  if (user.role === 'STAFF') {
    const staff = user.staff;
    if (!staff) return 'Access Denied: Account is not linked to an employee profile.';
    if (!staff.isActive) return `Access Denied: Employee '${staff.name}' is currently inactive.`;
    if (!staff.hasPortalAccess) return `Access Denied: Portal access has been revoked for employee '${staff.name}'.`;
    if (staff.branchId !== user.branchId) return 'Access Denied: Employee branch does not match login account branch.';
  }
  return null;
};

const issueRefreshToken = async (tx, userId, res) => {
  const refreshToken = signRefreshToken(userId);
  await tx.refreshToken.create({
    data: { userId, tokenHash: hashToken(refreshToken), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
  });
  res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
};

// ── Auth Service ─────────────────────────────────────────────────────────────

/**
 * Login — validates credentials, portal match and session eligibility, then issues tokens.
 * Identifier may be the email or the user id (same as the frontend mock).
 */
export const login = async ({ identifier, password, portal }, res) => {
  const user = await prisma.user.findFirst({
    where:   { OR: [{ email: identifier }, { id: identifier }] },
    include: userInclude,
  });

  // Same error for "not found" and "wrong password" — prevents user enumeration
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw unauthorized('INVALID_CREDENTIALS', 'Invalid login identifier or password. Please check your credentials.');
  }

  if (!user.isActive) {
    throw forbidden('ACCOUNT_DISABLED', `Account Disabled: The login credentials for '${user.email}' have been deactivated. Access denied.`);
  }

  if (portal !== user.role && !(user.role === 'SUPER_ADMIN' && portal === 'ADMIN')) {
    throw forbidden(
      'PORTAL_MISMATCH',
      `Portal Mismatch: The account '${user.email}' is designated as a ${PORTAL_NAMES[user.role]}. ` +
        `You selected the ${PORTAL_NAMES[portal]} portal. Please switch to the ${PORTAL_NAMES[user.role]} portal.`
    );
  }

  const blocked = sessionBlockReason(user);
  if (blocked) throw forbidden('SESSION_NOT_ALLOWED', blocked);

  await prisma.$transaction(async (tx) => {
    await issueRefreshToken(tx, user.id, res);
    await auditLog(tx, {
      userId: user.id, userName: user.name, action: 'LOGIN', entity: 'User', entityId: user.id, branchId: user.branchId,
    });
  });

  return { user, accessToken: signAccessToken(user) };
};

/** Refresh — rotates the refresh token (httpOnly cookie) and returns a new access token. */
export const refresh = async (cookieToken, res) => {
  if (!cookieToken) throw unauthorized('MISSING_TOKEN', 'Refresh token required');

  let payload;
  try {
    payload = jwt.verify(cookieToken, env.jwtRefreshSecret);
  } catch {
    throw unauthorized('INVALID_TOKEN', 'Invalid or expired refresh token');
  }

  const stored = await prisma.refreshToken.findFirst({
    where: { userId: payload.sub, tokenHash: hashToken(cookieToken), revokedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!stored) throw unauthorized('TOKEN_REUSE', 'Refresh token already used or revoked');

  const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: userInclude });
  const blocked = sessionBlockReason(user);
  if (blocked) throw unauthorized('SESSION_NOT_ALLOWED', blocked);

  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    await issueRefreshToken(tx, user.id, res);
  });

  return { user, accessToken: signAccessToken(user) };
};

/** Logout — revokes the refresh token from the cookie. */
export const logout = async (cookieToken) => {
  if (!cookieToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(cookieToken), revokedAt: null },
    data:  { revokedAt: new Date() },
  });
};

/** Current user (me). */
export const getMe = async (userId) => prisma.user.findUnique({ where: { id: userId }, include: userInclude });

/** Change password — requires old password verification; revokes all sessions. */
export const changePassword = async (userId, { oldPassword, newPassword }) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!(await bcrypt.compare(oldPassword, user.passwordHash))) {
    throw unauthorized('INVALID_CREDENTIALS', 'Current password is incorrect');
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await auditLog(tx, { userId, userName: user.name, action: 'PASSWORD_CHANGED', entity: 'User', entityId: userId });
  });
};

/**
 * Forgot password — creates a reset token. Returns the frontend `PasswordResetResponse` shape.
 * Email delivery is not wired yet, so in development the token is returned as `simulatedToken`.
 */
export const forgotPassword = async ({ identifier, portal }) => {
  const user = await prisma.user.findFirst({ where: { email: identifier, ...(portal ? { role: portal } : {}) } });

  if (!user) {
    return {
      success:   false,
      userEmail: identifier,
      message:   `No active account matching '${identifier}' was found under the selected portal.`,
    };
  }
  if (!user.isActive) {
    return {
      success:   false,
      userEmail: identifier,
      message:   `Account '${identifier}' is deactivated. Please contact your system administrator.`,
    };
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });

  return {
    success:        true,
    userEmail:      user.email,
    simulatedToken: env.isDev ? rawToken : undefined,
    message:        `A secure password recovery link has been generated for ${user.email}.`,
  };
};

/** Reset password using a valid reset token. */
export const resetPassword = async ({ token, password }) => {
  const record = await prisma.passwordResetToken.findFirst({
    where:   { tokenHash: hashToken(token), usedAt: null, expiresAt: { gt: new Date() } },
    include: { user: true },
  });
  if (!record) throw badRequest('INVALID_RESET_TOKEN', 'Reset token is invalid or has expired');

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await tx.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    await tx.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await auditLog(tx, {
      userId: record.userId, userName: record.user.name, action: 'PASSWORD_RESET', entity: 'User', entityId: record.userId,
    });
  });
};

/** Hash a plain password — used by seed and user creation. */
export const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);
