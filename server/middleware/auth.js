import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../db/store.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-capstone-jwt-secret-key-2025';
const SALT_ROUNDS = 10;

export async function hashPassword(plainPassword) {
  return await bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(plainPassword, hash) {
  return await bcrypt.compare(plainPassword, hash);
}

export function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export async function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication token is required.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}

export async function optionalJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch {
      // Continue as guest
    }
  }
  next();
}
