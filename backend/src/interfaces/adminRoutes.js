import express from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../infrastructure/prismaClient.js';

const router = express.Router();

const requireAdmin = (req, res, next) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const secret = process.env.JWT_SECRET || "code_assesment";
    const payload = jwt.verify(token, secret);
    if (!['admin', 'recruiter'].includes(payload.role)) return res.status(403).json({ error: 'Forbidden' });
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// KPIs: problems count, users (candidates) count, assignments count, pending submissions count, pass rate
router.get('/stats', requireAdmin, async (_req, res) => {
  try {
    const [problemsCount, candidatesCount, assignmentsCount, submissions, passedSubmissions] = await Promise.all([
      prisma.problems.count(),
      prisma.users.count({ where: { role: 'candidate' } }),
      prisma.assignments.count(),
      prisma.submissions.count(),
      prisma.submissions.count({ where: { status: 'Passed' } })
    ]);

    const passRate = submissions > 0 ? Math.round((passedSubmissions / submissions) * 100) : 0;

    res.json({ problemsCount, candidatesCount, assignmentsCount, submissionsCount: submissions, passRate });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Recent submissions
router.get('/recent-submissions', requireAdmin, async (_req, res) => {
  try {
    const recent = await prisma.submissions.findMany({
      orderBy: { created_at: 'desc' },
      take: 10,
      select: {
        id: true,
        score: true,
        status: true,
        created_at: true,
        candidate: { select: { id: true, name: true, email: true } },
        problem: { select: { id: true, title: true } },
      }
    });
    res.json({ recent });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

// List users with a quick counts of their submissions
router.get('/users', requireAdmin, async (_req, res) => {
  try {
    const users = await prisma.users.findMany({
      select: { id: true, name: true, email: true, role: true }
    });
    res.json({ users });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Submissions for a specific user (candidate)
router.get('/users/:id/submissions', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const subs = await prisma.submissions.findMany({
      where: { candidate_id: id },
      orderBy: { created_at: 'desc' },
      include: { problem: { select: { id: true, title: true } } }
    });
    res.json({ submissions: subs });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Submission details with results and candidate code
router.get('/submissions/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const sub = await prisma.submissions.findUnique({
      where: { id },
      include: {
        candidate: { select: { id: true, name: true, email: true } },
        problem: { select: { id: true, title: true } },
        results: {
          include: { testcase: { select: { id: true, input: true, output: true, category: true, is_hidden: true } } },
          orderBy: { id: 'asc' }
        }
      }
    });
    if (!sub) return res.status(404).json({ error: 'Not found' });
    res.json({ submission: sub });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});