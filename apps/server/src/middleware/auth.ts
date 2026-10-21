import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from '../models';

const DEV_FALLBACK_SECRET = 'gridpulse-dev-only-secret';
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  console.warn('⚠️  JWT_SECRET not set — using an insecure development secret');
}
const JWT_SECRET = process.env.JWT_SECRET || DEV_FALLBACK_SECRET;

/** Verify a JWT and return its user, or null if missing/invalid. */
export function verifyToken(token: string | undefined | null): AuthUser | null {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

export interface AuthUser {
  userId: string;
  email: string;
  role: 'user' | 'admin';
  nodeId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function generateToken(user: { id: string; email: string; role: string; nodeId?: string | null }): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      nodeId: user.nodeId || null,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Re-read the user's role and house from the database. A token only proves identity:
 * if an admin demotes someone or reassigns their house, that must take effect at once,
 * not when the token expires. Returns null if the user no longer exists.
 */
export async function loadCurrentUser(decoded: AuthUser): Promise<AuthUser | null> {
  if (!mongoose.Types.ObjectId.isValid(decoded.userId)) return null;
  const u = await User.findById(decoded.userId).select('email role nodeId').lean();
  if (!u) return null;
  return {
    userId: decoded.userId,
    email: u.email,
    role: u.role,
    nodeId: u.nodeId ? u.nodeId.toString() : null,
  };
}

export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  let current: AuthUser | null = null;
  try {
    current = await loadCurrentUser(decoded);
  } catch (error) {
    console.error('Auth lookup failed:', error);
    res.status(500).json({ error: 'Could not verify your account' });
    return;
  }
  if (!current) {
    res.status(401).json({ error: 'Account no longer exists' });
    return;
  }
  req.user = current;
  next();
}

/** True if the user is an admin or owns the given node. */
export function canAccessNode(user: AuthUser | undefined, nodeId: string): boolean {
  if (!user) return false;
  return user.role === 'admin' || (!!user.nodeId && user.nodeId === nodeId);
}

/** Route guard: the :nodeId param must belong to the logged-in user (or they're an admin). */
export function requireNodeAccess(req: Request, res: Response, next: NextFunction): void {
  const { nodeId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(nodeId)) {
    res.status(400).json({ error: 'Invalid nodeId' });
    return;
  }
  if (!canAccessNode(req.user, nodeId)) {
    res.status(403).json({ error: 'You can only access your own node' });
    return;
  }
  next();
}

export function requireRole(role: 'user' | 'admin') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.role !== role && req.user.role !== 'admin') {
      res.status(403).json({ error: `Requires ${role} permissions` });
      return;
    }

    next();
  };
}

export const requireAdmin = requireRole('admin');
