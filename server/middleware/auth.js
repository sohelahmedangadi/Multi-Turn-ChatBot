import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db/store.js';

export const SALT_ROUNDS = 10;

// Precomputed valid bcrypt hash used to equalize execution timing for non-existent users
export const DUMMY_HASH = '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8/W7jYVjLqjM8Q3H3N.6dE2aK3r7Gy';

/**
 * Parses cookies from incoming request headers
 */
export function parseCookies(req) {
  if (!req || !req.headers || !req.headers.cookie) return {};
  const list = {};
  const rc = req.headers.cookie;
  rc.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      const name = parts.shift().trim();
      const value = decodeURIComponent(parts.join('=')).trim();
      list[name] = value;
    }
  });
  return list;
}

/**
 * Generates cryptographically secure CSRF token
 */
export function generateCsrfToken() {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Validates and retrieves the JWT_SECRET from environment.
 * Fails fast if missing, empty, or shorter than 32 characters.
 */
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is missing or empty. A secure secret of at least 32 characters is required.'
    );
  }
  if (secret.length < 32) {
    throw new Error(
      `FATAL: JWT_SECRET is too short (${secret.length} chars). JWT_SECRET must be at least 32 characters for HMAC SHA-256 security.`
    );
  }
  return secret;
}

export async function hashPassword(plainPassword) {
  return await bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(plainPassword, hash) {
  return await bcrypt.compare(plainPassword, hash);
}

/**
 * Common easily guessable passwords list
 */
const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  'password1234',
  '1234567890',
  '12345678901',
  '123456789012',
  '0123456789',
  'qwertyuiop',
  'qwerty12345',
  'admin12345',
  'administrator',
  'letmein123',
  'welcome123',
  'welcome1234',
  'changeme123',
  'iloveyou123',
  'monkey1234',
  'dragon1234',
  'sunshine123',
  'princess123',
  'master1234',
  'trustno123',
  'football123',
  'supersecret1',
]);

/**
 * Enforces password rules:
 * - Minimum length: 10 characters
 * - Reject common passwords
 * - Reject > 72 bytes (bcrypt silently truncates passwords beyond 72 bytes)
 * - Reject repeated single characters
 */
export function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required and must be a string.' };
  }

  // Min length: 10 chars
  if (password.length < 10) {
    return { valid: false, error: 'Password must be at least 10 characters long.' };
  }

  // Max 72 bytes (bcrypt truncates silently beyond 72 bytes)
  const byteLength = Buffer.byteLength(password, 'utf8');
  if (byteLength > 72) {
    return {
      valid: false,
      error: `Password exceeds maximum allowed length of 72 bytes (${byteLength} bytes provided).`,
    };
  }

  // Reject common passwords
  const lower = password.toLowerCase().trim();
  if (COMMON_PASSWORDS.has(lower)) {
    return {
      valid: false,
      error: 'Password is too common or easily guessable. Please choose a more complex password.',
    };
  }

  // Reject repeated single character (e.g. "aaaaaaaaaa", "1111111111")
  if (/^(.)\1+$/.test(password)) {
    return {
      valid: false,
      error: 'Password cannot consist solely of a repeated single character.',
    };
  }

  return { valid: true };
}

/**
 * Generate signed JWT token including tokenVersion for revocation
 */
export function generateToken(user, options = {}) {
  const id = user.id || user.userId;
  const tokenVersion = user.tokenVersion !== undefined ? user.tokenVersion : 1;
  return jwt.sign(
    {
      id,
      userId: id,
      username: user.username,
      email: user.email,
      tokenVersion,
    },
    getJwtSecret(),
    { expiresIn: options.expiresIn || '15m' }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

/**
 * Authenticate JWT middleware with user persistence, tokenVersion revocation check,
 * and dual Bearer / httpOnly cookie + CSRF protection support.
 */
export async function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;
  let isCookieAuth = false;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else {
    const cookies = parseCookies(req);
    if (cookies.cosmo_auth_token) {
      token = cookies.cosmo_auth_token;
      isCookieAuth = true;
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication token is required.' });
  }

  // If authenticated via cookie on state-mutating requests, enforce CSRF protection
  if (isCookieAuth && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const cookies = parseCookies(req);
    const csrfHeader = req.headers['x-csrf-token'];
    const csrfCookie = cookies.cosmo_csrf_token;
    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      return res.status(403).json({
        error: 'CSRF token missing or invalid. Cookie authentication requires a matching X-CSRF-Token header.',
      });
    }
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const userId = decoded.id || decoded.userId;

    // Check if user exists in database (reject token for a deleted user)
    const user = await db.findUserById(userId);
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists or has been deleted.' });
    }

    // Token revocation check via tokenVersion
    const currentVersion = user.tokenVersion !== undefined ? user.tokenVersion : 1;
    const tokenVersionInJwt = decoded.tokenVersion !== undefined ? decoded.tokenVersion : 1;
    if (tokenVersionInJwt !== currentVersion) {
      return res.status(401).json({ error: 'Authentication token has been revoked. Please log in again.' });
    }

    req.user = {
      ...decoded,
      id: user.id,
      userId: user.id,
      username: user.username,
      email: user.email,
      tokenVersion: currentVersion,
    };
    req.isCookieAuth = isCookieAuth;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Authentication token has expired.', expired: true });
    }
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}

/**
 * Optional JWT middleware with user persistence, tokenVersion revocation check,
 * and dual Bearer / httpOnly cookie + CSRF protection support.
 */
export async function optionalJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;
  let isCookieAuth = false;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else {
    const cookies = parseCookies(req);
    if (cookies.cosmo_auth_token) {
      token = cookies.cosmo_auth_token;
      isCookieAuth = true;
    }
  }

  if (token) {
    if (isCookieAuth && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const cookies = parseCookies(req);
      const csrfHeader = req.headers['x-csrf-token'];
      const csrfCookie = cookies.cosmo_csrf_token;
      if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
        return res.status(403).json({
          error: 'CSRF token missing or invalid. Cookie authentication requires a matching X-CSRF-Token header.',
        });
      }
    }

    try {
      const decoded = jwt.verify(token, getJwtSecret());
      const userId = decoded.id || decoded.userId;
      const user = await db.findUserById(userId);
      if (!user) {
        return res.status(401).json({ error: 'User no longer exists or has been deleted.' });
      }

      // Token revocation check via tokenVersion
      const currentVersion = user.tokenVersion !== undefined ? user.tokenVersion : 1;
      const tokenVersionInJwt = decoded.tokenVersion !== undefined ? decoded.tokenVersion : 1;
      if (tokenVersionInJwt !== currentVersion) {
        return res.status(401).json({ error: 'Authentication token has been revoked. Please log in again.' });
      }

      req.user = {
        ...decoded,
        id: user.id,
        userId: user.id,
        username: user.username,
        email: user.email,
        tokenVersion: currentVersion,
      };
      req.isCookieAuth = isCookieAuth;
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Authentication token has expired.', expired: true });
      }
      return res.status(401).json({ error: 'Invalid authentication token.' });
    }
  }
  next();
}

/**
 * Checks whether the current user owns a resource.
 */
export function checkResourceOwnership(resource, currentUserId) {
  if (!resource || !currentUserId) return false;
  const ownerId = resource.userId || resource.metadata?.userId;
  return Boolean(ownerId && ownerId === currentUserId);
}

/**
 * Reusable ownership validation helper.
 * Returns 404 (not 403) for other users' resources to prevent ID enumeration.
 */
export function assertResourceOwnership(res, resource, currentUserId, resourceName = 'Resource') {
  if (!resource) {
    res.status(404).json({ error: `${resourceName} not found.` });
    return false;
  }

  const ownerId = resource.userId || resource.metadata?.userId;
  if (!ownerId || ownerId !== currentUserId) {
    res.status(404).json({ error: `${resourceName} not found.` });
    return false;
  }

  return true;
}

// ==========================================
// LOGIN / REGISTER RATE LIMITER WITH PROGRESSIVE DELAYS & DOS PREVENTION
// ==========================================

const authAttemptStore = new Map();
const knownUserIps = new Map(); // normalizedEmail -> Set of known client IPs

export const AUTH_RATE_LIMIT_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 minutes
export const AUTH_MAX_ATTEMPTS = Number(process.env.AUTH_MAX_ATTEMPTS) || 5; // Base attempts before progressive delays begin
export const AUTH_IP_MAX_CEILING = Number(process.env.AUTH_IP_MAX_CEILING) || 30; // Separate higher per-IP ceiling across all accounts
export const AUTH_MAX_DELAY_SEC = Number(process.env.AUTH_MAX_DELAY_SEC) || 60; // Max progressive delay cap

export function resetAuthRateLimits() {
  authAttemptStore.clear();
  knownUserIps.clear();
}

export function addKnownUserIp(identifier, ip) {
  if (!identifier || !ip) return;
  const normEmail = identifier.trim().toLowerCase();
  const normIp = normalizeIp(ip);
  if (!knownUserIps.has(normEmail)) {
    knownUserIps.set(normEmail, new Set());
  }
  knownUserIps.get(normEmail).add(normIp);
}

export function isKnownUserIp(identifier, ip) {
  if (!identifier || !ip) return false;
  const normEmail = identifier.trim().toLowerCase();
  const normIp = normalizeIp(ip);
  const set = knownUserIps.get(normEmail);
  return Boolean(set && set.has(normIp));
}

function normalizeIp(ip) {
  if (!ip) return '127.0.0.1';
  let clean = String(ip).trim();
  if (clean.startsWith('::ffff:')) clean = clean.replace('::ffff:', '');
  if (clean === '::1') return '127.0.0.1';
  return clean;
}

function isPrivateOrLoopbackIp(ip) {
  const norm = normalizeIp(ip);
  if (norm === '127.0.0.1' || norm === 'localhost' || norm === '::1') return true;
  if (
    norm.startsWith('10.') ||
    norm.startsWith('192.168.') ||
    norm.startsWith('172.16.') ||
    norm.startsWith('172.31.')
  ) {
    return true;
  }
  return false;
}

/**
 * Securely extracts client IP.
 * - If connection is from loopback or trusted private proxy, honors X-Forwarded-For.
 * - External untrusted connections use remoteAddress to prevent IP spoofing.
 */
export function getSecureClientIp(req) {
  const trustProxy = req.app ? req.app.get('trust proxy') : false;
  const socketRemote = req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';

  if (isPrivateOrLoopbackIp(socketRemote)) {
    const forwarded = req.headers && req.headers['x-forwarded-for'];
    if (forwarded && typeof forwarded === 'string') {
      const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
      if (parts.length > 0) {
        return normalizeIp(parts[0]);
      }
    }
  }

  if (!trustProxy) {
    return normalizeIp(socketRemote);
  }

  return normalizeIp(socketRemote);
}

export function getProgressiveDelaySec(attempts) {
  if (attempts < AUTH_MAX_ATTEMPTS) return 0;
  // Progressive delays: 5th attempt = 1s (2^0), 6th = 2s (2^1), 7th = 4s (2^2), 8th = 8s (2^3)...
  return Math.min(AUTH_MAX_DELAY_SEC, Math.pow(2, attempts - AUTH_MAX_ATTEMPTS));
}

export function getAuthLockoutRecord(key) {
  const now = Date.now();
  const record = authAttemptStore.get(key);
  if (!record) return null;
  if (now - record.firstAttemptAt > AUTH_RATE_LIMIT_WINDOW_MS) {
    authAttemptStore.delete(key);
    return null;
  }
  return record;
}

export function recordAuthFailure(req, identifier = null, userExists = true) {
  const now = Date.now();
  const clientIp = getSecureClientIp(req);

  // 1. Record on IP for separate higher per-IP ceiling (e.g. 30 attempts)
  const ipKey = 'ip:' + clientIp;
  let ipRecord = authAttemptStore.get(ipKey);
  if (!ipRecord || (now - ipRecord.firstAttemptAt > AUTH_RATE_LIMIT_WINDOW_MS)) {
    ipRecord = {
      attempts: 1,
      firstAttemptAt: now,
      lastAttemptAt: now,
      lockedUntil: 0,
    };
  } else {
    ipRecord.attempts += 1;
    ipRecord.lastAttemptAt = now;
    if (ipRecord.attempts >= AUTH_IP_MAX_CEILING) {
      ipRecord.lockedUntil = now + AUTH_RATE_LIMIT_WINDOW_MS;
      console.warn(`[Auth Security] Lockout: Per-IP ceiling exceeded: ip=${clientIp}, attempts=${ipRecord.attempts}, lockedUntil=${new Date(ipRecord.lockedUntil).toISOString()}`);
    }
  }
  authAttemptStore.set(ipKey, ipRecord);

  // 2. Key lockouts on (email + IP) to prevent cross-IP denial of service
  // NEVER record email-specific records for unknown emails (prevents user enumeration & timing leaks)
  if (identifier && userExists) {
    const normEmail = identifier.trim().toLowerCase();
    const emailIpKey = 'email_ip:' + normEmail + '|' + clientIp;
    let emailIpRecord = authAttemptStore.get(emailIpKey);
    if (!emailIpRecord || (now - emailIpRecord.firstAttemptAt > AUTH_RATE_LIMIT_WINDOW_MS)) {
      emailIpRecord = {
        attempts: 1,
        firstAttemptAt: now,
        lastAttemptAt: now,
      };
    } else {
      emailIpRecord.attempts += 1;
      emailIpRecord.lastAttemptAt = now;
      if (emailIpRecord.attempts >= AUTH_MAX_ATTEMPTS) {
        const delaySec = getProgressiveDelaySec(emailIpRecord.attempts);
        console.warn(`[Auth Security] Lockout/Delay triggered: ip=${clientIp}, email=${normEmail}, attempts=${emailIpRecord.attempts}, delay=${delaySec}s`);
      }
    }
    authAttemptStore.set(emailIpKey, emailIpRecord);
  }
}

export function recordAuthSuccess(req, identifier = null) {
  const clientIp = getSecureClientIp(req);
  if (identifier) {
    const normEmail = identifier.trim().toLowerCase();
    // Clear failed attempts for this email + IP on successful login
    authAttemptStore.delete('email_ip:' + normEmail + '|' + clientIp);
    // Add clientIp to known IPs for this user
    addKnownUserIp(normEmail, clientIp);
  }
}

/**
 * Middleware: Enforces auth rate limiting with DoS protection:
 * - Key lockouts on (email + IP)
 * - Separate higher per-IP ceiling (30 attempts)
 * - Progressive delays (1s, 2s, 4s...) rather than hard lock
 * - Never reveals lock state for unknown emails (timing & messages stay identical)
 * - Successful login from a previously seen IP/device bypasses per-email delay
 * - Logs all lockouts
 */
export async function authRateLimiter(req, res, next) {
  const now = Date.now();
  const clientIp = getSecureClientIp(req);
  const ipKey = 'ip:' + clientIp;

  // 1. Separate higher per-IP ceiling check (30 attempts per 15 min)
  const ipRecord = getAuthLockoutRecord(ipKey);
  if (ipRecord && (ipRecord.lockedUntil > now || ipRecord.attempts >= AUTH_IP_MAX_CEILING)) {
    const retryAfterSec = Math.max(1, Math.ceil(((ipRecord.lockedUntil || (ipRecord.firstAttemptAt + AUTH_RATE_LIMIT_WINDOW_MS)) - now) / 1000));
    res.setHeader('Retry-After', retryAfterSec);
    res.setHeader('X-RateLimit-Limit', AUTH_IP_MAX_CEILING);
    res.setHeader('X-RateLimit-Remaining', 0);
    console.warn(`[Auth Security] Lockout: Request blocked by per-IP ceiling: ip=${clientIp}, attempts=${ipRecord.attempts}, retryAfter=${retryAfterSec}s`);
    return res.status(429).json({
      error: 'Too many requests from this IP address. Please try again later.',
      retryAfter: retryAfterSec,
    });
  }

  // 2. Identify email / username
  const rawEmail = req.body?.email || req.body?.emailOrUsername || req.body?.username || '';
  if (!rawEmail) {
    return next();
  }

  const normEmail = rawEmail.trim().toLowerCase();

  // 3. Never reveal lock state for unknown emails
  let user = null;
  try {
    user = (await db.findUserByEmail(normEmail)) || (await db.findUserByUsername(normEmail));
  } catch (err) {
    // Proceed if DB lookup encounters an issue
  }

  if (!user) {
    // Unknown email: bypass per-email rate limit check so timing and messages stay identical to standard 401
    return next();
  }

  // 4. Successful login from a previously seen IP/device bypasses per-email delay
  const isPreviouslySeen =
    isKnownUserIp(user.email, clientIp) ||
    (Array.isArray(user.knownIps) && user.knownIps.includes(clientIp));

  if (isPreviouslySeen) {
    return next();
  }

  // 5. Enforce progressive delays (1s, 2s, 4s...) on (email + IP)
  const emailIpKey = 'email_ip:' + user.email.toLowerCase() + '|' + clientIp;
  const emailIpRecord = getAuthLockoutRecord(emailIpKey);

  if (emailIpRecord && emailIpRecord.attempts >= AUTH_MAX_ATTEMPTS) {
    const delaySec = getProgressiveDelaySec(emailIpRecord.attempts);
    const requiredDelayMs = delaySec * 1000;
    const elapsed = now - emailIpRecord.lastAttemptAt;

    if (elapsed < requiredDelayMs) {
      const retryAfterSec = Math.max(1, Math.ceil((requiredDelayMs - elapsed) / 1000));
      res.setHeader('Retry-After', retryAfterSec);
      res.setHeader('X-RateLimit-Limit', AUTH_MAX_ATTEMPTS);
      res.setHeader('X-RateLimit-Remaining', 0);
      console.warn(`[Auth Security] Lockout: Progressive delay in effect: email=${user.email}, ip=${clientIp}, attempts=${emailIpRecord.attempts}, retryAfter=${retryAfterSec}s`);
      return res.status(429).json({
        error: `Too many authentication attempts. Please wait ${retryAfterSec} second${retryAfterSec > 1 ? 's' : ''} before trying again.`,
        retryAfter: retryAfterSec,
      });
    }
  }

  next();
}
