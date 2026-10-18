import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User, GridNode } from '../models';
import { generateToken, authenticateToken } from '../middleware/auth';

export function createAuthRouter(): Router {
  const router = Router();

  // POST /api/auth/register
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const { email, password, name, nodeId } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Email, password, and name are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      // Check if user already exists
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Validate nodeId if provided
      let validNodeId: mongoose.Types.ObjectId | null = null;
      if (nodeId) {
        if (!mongoose.Types.ObjectId.isValid(nodeId)) {
          return res.status(400).json({ error: 'Invalid nodeId' });
        }
        const nodeExists = await GridNode.findById(nodeId);
        if (!nodeExists) {
          return res.status(400).json({ error: 'Invalid nodeId' });
        }
        // One owner per house
        const owned = await User.findOne({ nodeId });
        if (owned) {
          return res.status(409).json({ error: 'This house already has an owner' });
        }
        validNodeId = new mongoose.Types.ObjectId(nodeId);
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create({
        email: email.toLowerCase(),
        passwordHash,
        name,
        nodeId: validNodeId,
        // Self-registration always creates a normal user. Admins are created by the seed script.
        role: 'user',
      });

      const token = generateToken({
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        nodeId: user.nodeId ? user.nodeId.toString() : null,
      });

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          nodeId: user.nodeId ? user.nodeId.toString() : null,
        },
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  // POST /api/auth/login
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = generateToken({
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        nodeId: user.nodeId ? user.nodeId.toString() : null,
      });

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          nodeId: user.nodeId ? user.nodeId.toString() : null,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // GET /api/auth/me
  router.get('/me', authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await User.findById(req.user.userId)
        .select('-passwordHash')
        .populate('nodeId', 'name emoji solarCapacityKw batteryCapacityKwh')
        .lean();

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      console.error('Fetch user error:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  return router;
}
