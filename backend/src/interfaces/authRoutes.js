import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../infrastructure/prismaClient.js';

const router = express.Router();

const signToken = (user) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Server misconfiguration: JWT_SECRET not set');
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    secret,
    { expiresIn: '7d' }
  );
};

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: 'Missing fields' });
    const existing = await prisma.users.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });
    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.users.create({ data: { name, email, password_hash, role } });
    const token = signToken(user);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    console.log('=== LOGIN ATTEMPT ===');
    console.log('Request body:', req.body);
    const { email, password } = req.body;
    
    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    console.log('Looking for user with email:', email);
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) {
      console.log('User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log('User found:', { id: user.id, name: user.name, role: user.role });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      console.log('Password mismatch');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log('Login successful, generating token');
    const token = signToken(user);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    console.log('=== LOGIN ERROR ===');
    console.error('Login error:', e);
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

router.get('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET not set' });
    const payload = jwt.verify(token, secret);
    const user = await prisma.users.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// List users (admin/recruiter)
router.get('/users', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET not set' });
    const payload = jwt.verify(token, secret);
    if (!['admin', 'recruiter'].includes(payload.role)) return res.status(403).json({ error: 'Forbidden' });

    let whereClause = {};
    if (payload.role === 'recruiter') {
      whereClause = { role: 'candidate' };
    }
    
    const users = await prisma.users.findMany({ where: whereClause, select: { id: true, name: true, email: true, role: true } });
    res.json({ users });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

// Admin-only user management (CRUD)
// Create
router.post('/users', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET not set' });
    const payload = jwt.verify(token, secret);
    if (!['admin', 'recruiter'].includes(payload.role)) return res.status(403).json({ error: 'Forbidden' });

    let { name, email, password, role } = req.body;

    if (payload.role === 'recruiter') {
      if (role && role !== 'candidate') {
        return res.status(403).json({ error: 'Recruiters can only create users with the role \'candidate\'.' });
      }
      role = 'candidate'; // Force role to 'candidate' for recruiters
    }
    
    if (!name || !email || !password || !role) return res.status(400).json({ error: 'Missing fields' });
    const existing = await prisma.users.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });
    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.users.create({ data: { name, email, password_hash, role } });
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update
router.put('/users/:id', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET not set' });
    const payload = jwt.verify(token, secret);
    if (!['admin', 'recruiter'].includes(payload.role)) return res.status(403).json({ error: 'Forbidden' });

    const id = Number(req.params.id);
    const { name, email, password, role } = req.body;

    const targetUser = await prisma.users.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (payload.role === 'recruiter') {
      if (targetUser.role !== 'candidate') {
        return res.status(403).json({ error: 'Recruiters can only update users with the role \'candidate\'.' });
      }
      if (role && role !== 'candidate') {
        return res.status(403).json({ error: 'Recruiters cannot change a candidate\'s role to a non-candidate role.' });
      }
    }
    
    const data = {};
    if (name != null) data.name = name;
    if (email != null) data.email = email;
    if (role != null) data.role = role;
    if (password) data.password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.users.update({ where: { id }, data });
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete
router.delete('/users/:id', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const secret = process.env.JWT_SECRET || "code_assesment";
    const payload = jwt.verify(token, secret);
    if (!['admin', 'recruiter'].includes(payload.role)) return res.status(403).json({ error: 'Forbidden' });

    const id = Number(req.params.id);

    const targetUser = await prisma.users.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (payload.role === 'recruiter') {
      if (targetUser.role !== 'candidate') {
        return res.status(403).json({ error: 'Recruiters can only delete users with the role \'candidate\'.' });
      }
    }
    
    await prisma.users.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});
