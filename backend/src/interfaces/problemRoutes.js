import express from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../infrastructure/prismaClient.js';
import { runCodeViaJudge0, languageKeyToId } from '../infrastructure/judge0.js';
import { generateTestcases } from '../infrastructure/aiTestcaseGenerator.js';

const router = express.Router();

const requireAuth = (roles = []) => (req, res, next) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({ error: 'Missing token' });
    }
    
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET not set' });
    }
    
    const payload = jwt.verify(token, secret);
    
    if (roles.length && !roles.includes(payload.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token: ' + e.message });
  }
};

// List problems (admin/recruiter)
router.get('/', requireAuth(['admin', 'recruiter', 'candidate']), async (req, res) => {
  try {
    const problems = await prisma.problems.findMany({
      select: {
        id: true,
        title: true,
        reference_language: true,
        time_limit_minutes: true,
        assigns: {
          where: { user_id: req.user.id },
          select: { user_id: true }
        },
        _count: {
          select: {
            tests: {
              where: { generated_by: 'AI' }
            }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    const problemsWithAssignmentStatus = problems.map(problem => ({
      ...problem,
      assigned: problem.assigns.length > 0,
      ai_generated_testcases_count: problem._count.tests // Expose the count
    }));

    res.json({ problems: problemsWithAssignmentStatus });
  } catch (e) {
    console.error('Failed to fetch problems:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// List problems assigned to the authenticated candidate
router.get('/assigned', requireAuth(['candidate']), async (req, res) => {
  try {
    const assigned = await prisma.assignments.findMany({
      where: { user_id: req.user.sub },
      include: {
        problem: true,
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { assigned_at: 'desc' }
    });
    
    // For each assigned problem, find the latest submitted submission and its score
    const problemsWithSubmissionInfo = await Promise.all(assigned.map(async (assignment) => {
      const latestSubmission = await prisma.submissions.findFirst({
        where: { 
          candidate_id: req.user.sub, 
          problem_id: assignment.problem.id, 
          submission_status: 'submitted' 
        },
        orderBy: { created_at: 'desc' },
        select: { id: true, score: true }
      });

      return {
        ...assignment.problem,
        assigned: true, // Always true for assigned problems
        submitted: !!latestSubmission, // True if a submitted submission exists
        latest_submission_score: latestSubmission?.score || null,
        latest_submission_id: latestSubmission?.id || null,
      };
    }));

    res.json({ problems: problemsWithSubmissionInfo });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create problem (admin/recruiter)
router.post('/', requireAuth(['admin', 'recruiter']), async (req, res) => {
  try {
    const { title, statement, constraints, reference_solution, reference_language, time_limit_minutes } = req.body;
    if (!title || !statement || !reference_solution || !reference_language || !time_limit_minutes) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingProblem = await prisma.problems.findFirst({ where: { title } });
    if (existingProblem) {
      return res.status(409).json({ error: 'A problem with this title already exists.' });
    }
    
    // Handle constraints as string or object
    let constraintsData = constraints;
    if (typeof constraints === 'string') {
      try {
        // Try to parse as JSON, if it fails, store as string
        constraintsData = JSON.parse(constraints);
      } catch (e) {
        // If not valid JSON, store as plain text
        constraintsData = { text: constraints };
      }
    }
    
    const problem = await prisma.problems.create({
      data: {
        title,
        statement,
        constraints: constraintsData,
        reference_solution,
        reference_language,
        time_limit_minutes,
        created_by: req.user.sub
      }
    });
    res.json({ problem });
  } catch (e) {
    console.error('Problem creation error:', e);
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

// Get problem for candidate (visible testcases only)
router.get('/:id', requireAuth(['admin', 'recruiter', 'candidate']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const problem = await prisma.problems.findUnique({
      where: { id },
      include: {
        tests: {
          where: { is_hidden: false }, // Only visible testcases for candidates
          select: { id: true, input: true, output: true }
        },
        _count: {
          select: { tests: { where: { generated_by: 'AI' } } }
        }
      }
    });

    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    const visibleTestcases = problem.tests;
    delete problem.tests; // Remove tests from main problem object for candidates

    res.json({ 
      problem: { 
        ...problem,
        ai_generated_testcases_count: problem._count.tests // Expose the count
      },
      visibleTestcases 
    });
  } catch (e) {
    console.error('Failed to fetch problem by ID:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update problem (admin/recruiter)
router.put('/:id', requireAuth(['admin', 'recruiter']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, statement, constraints, reference_solution, reference_language, time_limit_minutes } = req.body;

    let constraintsData = constraints;
    if (typeof constraints === 'string') {
      try { constraintsData = JSON.parse(constraints); } catch (_e) { constraintsData = { text: constraints }; }
    }

    const updated = await prisma.problems.update({
      where: { id },
      data: {
        ...(title != null ? { title } : {}),
        ...(statement != null ? { statement } : {}),
        ...(constraints != null ? { constraints: constraintsData } : {}),
        ...(reference_solution != null ? { reference_solution } : {}),
        ...(reference_language != null ? { reference_language } : {}),
        ...(time_limit_minutes != null ? { time_limit_minutes } : {})
      }
    });
    res.json({ problem: updated });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete problem (admin/recruiter)
router.delete('/:id', requireAuth(['admin', 'recruiter']), async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid problem ID' });
    }

    const problemExists = await prisma.problems.findUnique({ where: { id } });
    if (!problemExists) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    await prisma.$transaction(async (tx) => {
      // Delete dependent records first due to foreign key constraints
      await tx.submission_results.deleteMany({ where: { submission: { problem_id: id } } });
      await tx.submissions.deleteMany({ where: { problem_id: id } });
      await tx.testcases.deleteMany({ where: { problem_id: id } });
      await tx.assignments.deleteMany({ where: { problem_id: id } });
      await tx.problems.delete({ where: { id } });
    });

    res.status(204).send(); // No content for successful deletion
  } catch (e) {
    console.error('Failed to delete problem:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

// Get all testcases for a problem (admin/recruiter)
router.get('/:id/all-testcases', requireAuth(['admin', 'recruiter']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const testcases = await prisma.testcases.findMany({ where: { problem_id: id }, orderBy: [{ category: 'asc' }, { created_at: 'asc' }] });
    res.json({ testcases });
  } catch (e) {
    console.error('Failed to fetch all testcases:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add a new testcase to a problem (admin/recruiter)
router.post('/:id/testcases', requireAuth(['admin', 'recruiter']), async (req, res) => {
  try {
    const problem_id = Number(req.params.id);
    const { input, output, is_hidden, category } = req.body;
    const newTestcase = await prisma.testcases.create({
      data: { problem_id, input, output, is_hidden, category, generated_by: 'Manual' }
    });
    res.status(201).json({ testcase: newTestcase });
  } catch (e) {
    console.error('Failed to add testcase:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a testcase (admin/recruiter)
router.put('/testcases/:id', requireAuth(['admin', 'recruiter']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { input, output, is_hidden, category } = req.body;

    const existingSubmissionResults = await prisma.submission_results.count({
      where: { testcase_id: id }
    });

    if (existingSubmissionResults > 0) {
      return res.status(400).json({ error: 'Cannot edit this testcase as it has associated submissions. Please create a new testcase or regenerate testcases for this problem.' });
    }

    const updatedTestcase = await prisma.testcases.update({
      where: { id },
      data: { input, output, is_hidden, category }
    });
    res.json({ testcase: updatedTestcase });
  } catch (e) {
    console.error('Failed to update testcase:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a testcase (admin/recruiter)
router.delete('/testcases/:id', requireAuth(['admin', 'recruiter']), async (req, res) => {
  try {
    const id = Number(req.params.id);

    const existingSubmissionResults = await prisma.submission_results.count({
      where: { testcase_id: id }
    });

    if (existingSubmissionResults > 0) {
      return res.status(400).json({ error: 'Cannot delete this testcase as it has associated submissions.' });
    }

    await prisma.testcases.delete({
      where: { id }
    });
    res.status(204).send(); // No content for successful deletion
  } catch (e) {
    console.error('Failed to delete testcase:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI-powered testcase generation
router.post('/:id/generate-testcases', requireAuth(['admin', 'recruiter']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    const problem = await prisma.problems.findUnique({ where: { id } });
    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    // Get counts from request body
    const { normalCount = 3, edgeCount = 2, randomCount = 2 } = req.body || {};

    // Generate testcase inputs using AI
    const generatedInputs = await generateTestcases({
      problemStatement: problem.statement,
      constraints: problem.constraints,
      normalCount,
      edgeCount,
      randomCount
    });
    
    const sanitize = (s) => String(s).trim().replace(/^\"|^\'|\"$|\'$/g, '');
    const all = [
      ...generatedInputs.normal.map((i) => ({ input: sanitize(i), category: 'normal' })),
      ...generatedInputs.edge.map((i) => ({ input: sanitize(i), category: 'edge' })),
      ...generatedInputs.random.map((i) => ({ input: sanitize(i), category: 'random' })),
    ].filter((t) => t.input.length > 0);

    // Compute outputs by running the reference solution via Judge0
    const langKey = (problem.reference_language || '').toLowerCase();
    
    if (!languageKeyToId[langKey]) {
      return res.status(400).json({ error: 'Unsupported reference_language' });
    }

    const generated = [];
    for (const tc of all) {
      try {
        const run = await runCodeViaJudge0({ languageKey: langKey, sourceCode: problem.reference_solution, stdin: tc.input });
        
        const statusOk = run?.status?.id === 3;
        const stdout = (run.stdout || '').trim();
        const hasError = Boolean(run.stderr) || Boolean(run.compile_output) || !stdout;
        
        if (statusOk && !hasError) {
          generated.push({ input: tc.input, output: stdout, category: tc.category, is_hidden: true, generated_by: 'ai' });
        } else {
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        // Add delay even on error to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Ensure up to 3 visible testcases, preferring normal -> edge -> random
    const pickVisible = (arr, needed) => {
      for (const g of arr) {
        if (needed.count >= 3) break;
        if (g.is_hidden) {
          g.is_hidden = false;
          needed.count += 1;
        }
      }
    };
    let needed = { count: 0 };
    pickVisible(generated.filter(g => g.category === 'normal'), needed);
    if (needed.count < 3) pickVisible(generated.filter(g => g.category === 'edge'), needed);
    if (needed.count < 3) pickVisible(generated.filter(g => g.category === 'random'), needed);

    await prisma.$transaction(async (tx) => {
      // Get IDs of existing testcases to delete associated submission results
      const existingTestcaseIds = await tx.testcases.findMany({
        where: { problem_id: id },
        select: { id: true }
      }).then(tcs => tcs.map(tc => tc.id));

      if (existingTestcaseIds.length > 0) {
        // Remove existing submission results for these testcases
        await tx.submission_results.deleteMany({ where: { testcase_id: { in: existingTestcaseIds } } });
      }

      // Remove existing testcases for fresh generation
      await tx.testcases.deleteMany({ where: { problem_id: id } });
      
      for (const g of generated) {
        await tx.testcases.create({ data: { problem_id: id, input: g.input, output: g.output, category: g.category, is_hidden: g.is_hidden, generated_by: g.generated_by } });
      }
    });

    const visible = await prisma.testcases.findMany({ where: { problem_id: id, is_hidden: false } });
    const hidden = await prisma.testcases.findMany({ where: { problem_id: id, is_hidden: true } });
    
    if (visible.length === 0) {
      return res.status(400).json({ error: 'No visible testcases generated. Ensure you provided at least 1 normal input and that the reference solution prints output.' });
    }
    
    res.json({ ok: true, counts: { visible: visible.length, hidden: hidden.length } });
  } catch (e) {
    console.error('Full error:', e);
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

// Assign problem to users
router.post('/:id/assign', requireAuth(['admin', 'recruiter']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { userIds = [] } = req.body || {};
    const assigns = [];
    await prisma.$transaction(async (tx) => {
      for (const uid of userIds) {
        const a = await tx.assignments.upsert({
          where: { problem_id_user_id: { problem_id: id, user_id: uid } },
          create: { problem_id: id, user_id: uid },
          update: {}
        });
        assigns.push(a);
      }
    });
    res.json({ ok: true, assigned: assigns.length });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// List assigned users for a problem
router.get('/:id/assigned-users', requireAuth(['admin', 'recruiter']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const assigns = await prisma.assignments.findMany({
      where: { problem_id: id },
      include: { user: { select: { id: true, name: true, email: true, role: true } } }
    });
    res.json({ assigned: assigns.map(a => ({ id: a.user.id, name: a.user.name, email: a.user.email, role: a.user.role })) });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Unassign a single user from a problem
router.delete('/:id/assign/:userId', requireAuth(['admin', 'recruiter']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = Number(req.params.userId);
    await prisma.assignments.delete({ where: { problem_id_user_id: { problem_id: id, user_id: userId } } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// List submissions for a problem (admin view)
router.get('/:id/submissions', requireAuth(['admin', 'recruiter']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const subs = await prisma.submissions.findMany({
      where: { problem_id: id },
      orderBy: { created_at: 'desc' },
      include: {
        candidate: { select: { id: true, name: true, email: true } },
        results: true // Include all submission results
      },
      select: {
        id: true,
        code: true,
        language: true,
        passed_count: true,
        total_count: true,
        status: true,
        submission_status: true,
        created_at: true,
        score: true, // Include score
        evaluation: true, // Include evaluation
        candidate: { select: { id: true, name: true, email: true } },
      }
    });
    res.json({ submissions: subs });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});
