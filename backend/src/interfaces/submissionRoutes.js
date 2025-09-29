import express from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../infrastructure/prismaClient.js';
import { runCodeViaJudge0 } from '../infrastructure/judge0.js';

const router = express.Router();

const requireAuth = (roles = []) => (req, res, next) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET not set' });
    const payload = jwt.verify(token, secret);
    if (roles.length && !roles.includes(payload.role)) return res.status(403).json({ error: 'Forbidden' });
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Create or update draft submission
router.post('/draft', requireAuth(['candidate']), async (req, res) => {
  try {
    const { problem_id, code, language } = req.body;
    if (!problem_id || !code || !language) return res.status(400).json({ error: 'Missing fields' });

    // Upsert draft for this candidate & problem
    const existing = await prisma.submissions.findFirst({
      where: { candidate_id: req.user.sub, problem_id, submission_status: 'draft' }
    });

    const submission = existing
      ? await prisma.submissions.update({ where: { id: existing.id }, data: { last_saved_code: code, language } })
      : await prisma.submissions.create({
          data: {
            candidate_id: req.user.sub,
            problem_id,
            code: code,
            last_saved_code: code,
            language,
            status: 'Running',
            submission_status: 'draft'
          }
        });

    res.json({ submission });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a single submission by ID (admin, recruiter, or candidate if their own)
router.get('/:id', requireAuth(['admin', 'recruiter', 'candidate']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const submission = await prisma.submissions.findUnique({
      where: { id },
      include: {
        candidate: { select: { id: true, name: true, email: true } },
        problem: { select: { id: true, title: true } },
        results: {
          include: {
            testcase: {
              select: {
                id: true,
                input: true,
                output: true,
                category: true,
                is_hidden: true
              }
            }
          }
        }
      }
    });

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Restrict access for candidates to only their own submissions
    if (req.user.role === 'candidate' && submission.candidate_id !== req.user.sub) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ submission });
  } catch (e) {
    console.error('Failed to fetch submission by ID:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Run code on visible testcases only (draft stage)
router.post('/:id/run', requireAuth(['candidate']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const sub = await prisma.submissions.findUnique({ where: { id } });
    if (!sub || sub.candidate_id !== req.user.sub) return res.status(404).json({ error: 'Not found' });
    if (sub.submission_status !== 'draft') return res.status(400).json({ error: 'Submission is locked' });

    const problem = await prisma.problems.findUnique({ where: { id: sub.problem_id } });
    const now = new Date();
    // Note: For simplicity we rely on client countdown + later we can add start_time/expire_time
    // and enforce here. Skipping strict enforcement in this first cut.

    const visibleTests = await prisma.testcases.findMany({ where: { problem_id: sub.problem_id, is_hidden: false } });
    if (visibleTests.length === 0) {
      return res.status(400).json({ error: 'No visible testcases for this problem. Ask the admin to generate testcases.' });
    }

    const results = [];
    for (const t of visibleTests) {
      const run = await runCodeViaJudge0({ languageKey: sub.language, sourceCode: sub.last_saved_code, stdin: t.input });
      const actual = (run.stdout || '').trim();
      const expected = (t.output || '').trim();
      results.push({
        testcase_id: t.id,
        expected,
        stdout: actual,
        stderr: run.stderr || '',
        status: actual === expected ? 'Passed' : 'Failed'
      });
    }

    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Final submit: lock, evaluate on all tests, store results
router.post('/:id/submit', requireAuth(['candidate']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const sub = await prisma.submissions.findUnique({ where: { id } });
    if (!sub || sub.candidate_id !== req.user.sub) return res.status(404).json({ error: 'Not found' });
    if (sub.submission_status !== 'draft') return res.status(400).json({ error: 'Already submitted' });

    const tests = await prisma.testcases.findMany({ where: { problem_id: sub.problem_id } });

    let passed = 0;
    const total = tests.length;
    const details = [];

    for (const t of tests) {
      const run = await runCodeViaJudge0({ languageKey: sub.language, sourceCode: sub.last_saved_code, stdin: t.input });
      const actual_output = (run.stdout || '').trim();
      const expected = (t.output || '').trim();
      const ok = actual_output === expected;
      if (ok) passed += 1;
      details.push({ testcase_id: t.id, actual_output, status: ok ? 'Passed' : 'Failed' });
    }

    const status = passed === total ? 'Passed' : passed > 0 ? 'Partially Passed' : 'Failed';
    const score = total > 0 ? Math.round((passed / total) * 100) : 0; // Calculate score

    const final = await prisma.$transaction(async (tx) => {
      const updated = await tx.submissions.update({
        where: { id: sub.id },
        data: {
          code: sub.last_saved_code,
          passed_count: passed,
          total_count: total,
          status,
          submission_status: 'submitted',
          score // Store the calculated score
        }
      });

      for (const d of details) {
        await tx.submission_results.create({
          data: {
            submission_id: sub.id,
            testcase_id: d.testcase_id,
            actual_output: d.actual_output,
            status: d.status
          }
        });
      }

      return updated;
    });

    res.json({ submission: final, passed_count: passed, total_count: total, status });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Add/update recruiter evaluation for a submission
router.put('/:id/evaluate', requireAuth(['admin', 'recruiter']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { score } = req.body;

    if (score === undefined || score === null) {
      return res.status(400).json({ error: 'Score is required' });
    }

    const parsedScore = Number(score);
    if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 100) {
      return res.status(400).json({ error: 'Score must be a number between 0 and 100' });
    }

    const evaluationString = `SCORE:${parsedScore}`;

    const updatedSubmission = await prisma.submissions.update({
      where: { id },
      data: { evaluation: evaluationString }
    });

    res.json({ submission: updatedSubmission });
  } catch (e) {
    console.error('Failed to update submission evaluation:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
