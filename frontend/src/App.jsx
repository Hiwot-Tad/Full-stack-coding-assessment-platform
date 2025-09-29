import { useState, useEffect, useRef } from 'react';
import { Editor } from '@monaco-editor/react';
import axios from 'axios';
import './App.css';
import AdminPanel from './components/AdminPanel.jsx';
import AdminDashboard from './components/Dashboard.jsx';
import UsersManagement from './components/UsersManagement.jsx';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

const LANGUAGES = [
  { key: 'python', label: 'Python', template: 'def solution():\n    # Your code here\n    pass\n\n# Test your solution\nprint(solution())' },
  { key: 'javascript', label: 'JavaScript', template: 'function solution() {\n    // Your code here\n    return null;\n}\n\n// Test your solution\nconsole.log(solution());' },
  { key: 'java', label: 'Java', template: 'public class Solution {\n    public static void main(String[] args) {\n        // Your code here\n        System.out.println("Hello World");\n    }\n}' },
  { key: 'cpp', label: 'C++', template: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Your code here\n    cout << "Hello World" << endl;\n    return 0;\n}' }
];

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // New loading state
  const [activePage, setActivePage] = useState('problems');
  const [problem, setProblem] = useState(null);
  const [assignedProblems, setAssignedProblems] = useState([]);
  const [candidateView, setCandidateView] = useState('list'); // 'list' | 'solve'
  const [showCandidateIntro, setShowCandidateIntro] = useState(true);
  const [visibleTestcases, setVisibleTestcases] = useState([]);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [submission, setSubmission] = useState(null);
  const [runResults, setRunResults] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showTimer, setShowTimer] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '', role: 'candidate' });
  const [showRegister, setShowRegister] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const autoSaveRef = useRef(null);
  const currentProblemIdRef = useRef(null);

  // New: Load problem from session storage on refresh/initial load
  useEffect(() => {
    const savedProblemId = sessionStorage.getItem('lastProblemId');
    if (token && user?.role === 'candidate' && savedProblemId) {
      handleSelectProblem(Number(savedProblemId));
    }
  }, [token, user?.role]); // Depend on token and user role

  // Auto-save every 2 seconds
  useEffect(() => {
    if (code && submission && submission.submission_status === 'draft') {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
      autoSaveRef.current = setTimeout(() => {
        saveDraft();
      }, 2000);
    }
    return () => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    };
  }, [code]);

  // Timer countdown
  useEffect(() => {
    if (problem && problem.time_limit_minutes && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // Auto-submit when time runs out
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [problem, timeLeft]);

  // Load user on token change
  useEffect(() => {
    const checkUser = async () => {
      if (token) {
        await loadUser();
      }
      setLoading(false); // Set loading to false after checking token
    };
    checkUser();
  }, [token]);

  // Handle browser back button during active problem solving
  useEffect(() => {
    if (user && user.role === 'candidate' && candidateView === 'solve' && problem) {
      // Push a new state to history to capture the current problem-solving view
      window.history.pushState({ candidateView: 'solve', problemId: problem.id }, '', '');

      const handlePopState = (event) => {
        // If the user tries to go back while solving a problem
        if (window.confirm('You are about to leave the problem. Your current work will be submitted. Continue?')) {
          // User confirmed, proceed with submission
          handleSubmit();
          // The handleSubmit will eventually navigate to 'list', so no explicit pop needed here
        } else {
          // User cancelled, prevent navigation by pushing the current state back
          window.history.pushState({ candidateView: 'solve', problemId: problem.id }, '', '');
        }
      };

      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
        // When leaving the solve view, clean up the history state
        if (window.history.state && window.history.state.candidateView === 'solve') {
          window.history.back(); // Go back one step to remove the 'solve' state
        }
      };
    }
  }, [user, candidateView, problem]); // Depend on user, candidateView, and problem

  // Prevent navigation away and auto-submit if time runs out
  useEffect(() => {
    if (user && user.role === 'candidate' && candidateView === 'solve' && problem && submission && submission.submission_status === 'draft') {
      const handleBeforeUnload = (event) => {
        // Most browsers require a return value for custom messages to be shown
        const message = 'You are about to leave the problem. Your current work will be submitted.';
        event.returnValue = message; // Standard for browser to prompt
        return message; // For some older browsers
      };

      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [user, candidateView, problem, submission]);

  const loadUser = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(data.user);
      if (data.user.role === 'candidate') {
        setShowCandidateIntro(true);
        await loadAssignedProblems();
      } else {
        // Default admin/recruiter landing after successful login
        setActivePage('dashboard');
      }
    } catch (e) {
      console.error('Failed to load user:', e);
      setToken(null);
      localStorage.removeItem('token');
      // Don't set user to null here; it will be handled by !token in useEffect
    }
  };

  const loadAssignedProblems = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/problems/assigned`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const list = data.problems || [];
      setAssignedProblems(list);
      setCandidateView('list');
      setProblem(null);
    } catch (e) {
      console.error('Failed to load assigned problems:', e);
      setAssignedProblems([]);
      setCandidateView('list');
    }
  };

  const handleSelectProblem = async (problemId) => {
    // Store the problemId in session storage for refresh persistence
    sessionStorage.setItem('lastProblemId', problemId.toString());
    // mark the currently requested problem id
    currentProblemIdRef.current = problemId;
    // Clear any previous problem state to avoid showing stale testcases
    setVisibleTestcases([]);
    setRunResults(null);
    setProblem(null);
    await loadProblem(problemId);
    // only switch view after successful load of the intended problem
    if (currentProblemIdRef.current === problemId) {
    setCandidateView('solve');
    }
  };

  const loadProblem = async (problemId) => {
    try {
      const { data } = await axios.get(`${API_BASE}/problems/${problemId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Ignore late responses if the user selected another problem in the meantime
      if (currentProblemIdRef.current !== problemId) return;

      setProblem(data.problem);
      setVisibleTestcases(data.visibleTestcases);
      setTimeLeft(data.problem.time_limit_minutes * 60);
      
      // Load or create draft submission
      await loadOrCreateDraft(problemId);
    } catch (e) {
      console.error('Failed to load problem:', e);
    }
  };

  const loadOrCreateDraft = async (problemId) => {
    try {
      const currentLang = LANGUAGES.find(l => l.key === language);
      const initialCode = currentLang ? currentLang.template : '';
      
      const { data } = await axios.post(`${API_BASE}/submissions/draft`, {
        problem_id: problemId,
        code: initialCode,
        language
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSubmission(data.submission);
      setCode(data.submission.last_saved_code || initialCode);
    } catch (e) {
      console.error('Failed to load/create draft:', e);
    }
  };

  const saveDraft = async () => {
    if (!submission || submission.submission_status !== 'draft') return;
    
    try {
      await axios.post(`${API_BASE}/submissions/draft`, {
        problem_id: submission.problem_id,
        code,
        language
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {
      console.error('Failed to save draft:', e);
    }
  };

  const handleRun = async () => {
    if (!submission || submission.submission_status !== 'draft') return;
    
    setIsRunning(true);
    try {
      // ensure latest code is saved before running
      await axios.post(`${API_BASE}/submissions/draft`, {
        problem_id: submission.problem_id,
        code,
        language
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const { data } = await axios.post(`${API_BASE}/submissions/${submission.id}/run`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRunResults(data.results);
    } catch (e) {
      console.error('Failed to run code:', e);
      alert('Failed to run code. Check console for details.');
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!submission || submission.submission_status !== 'draft') return;
    
    const confirmed = window.confirm('After submission, you cannot modify your code. Are you sure?');
    if (!confirmed) return;
    
    setIsSubmitting(true);
    try {
      const { data } = await axios.post(`${API_BASE}/submissions/${submission.id}/submit`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSubmission(data.submission);
      setRunResults({
        final: true,
        passed_count: data.passed_count,
        total_count: data.total_count,
        status: data.status
      });
      // After brief delay, return to list view and refresh assignments
      setTimeout(async () => {
        setCandidateView('list');
        setProblem(null);
        setRunResults(null);
        await loadAssignedProblems();

        // Clear history state related to problem solving
        if (window.history.state && window.history.state.candidateView === 'solve') {
          window.history.back(); // Go back one step to remove the 'solve' state
        }
        // Clear last problem ID from session storage
        sessionStorage.removeItem('lastProblemId');
      }, 1200);
    } catch (e) {
      console.error('Failed to submit:', e);
      alert('Failed to submit. Check console for details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${API_BASE}/auth/login`, loginForm);
      setToken(data.token);
      localStorage.setItem('token', data.token);
    } catch (e) {
      alert('Login failed: ' + (e.response?.data?.error || 'Unknown error'));
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${API_BASE}/auth/register`, registerForm);
      setToken(data.token);
      localStorage.setItem('token', data.token);
    } catch (e) {
      alert('Registration failed: ' + (e.response?.data?.error || 'Unknown error'));
    }
  };

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    const langTemplate = LANGUAGES.find(l => l.key === newLang);
    if (langTemplate) {
      setCode(langTemplate.template);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="loading-container">Loading...</div>; // Show loading spinner
  }

  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-form">
          <h2>{showRegister ? 'Register' : 'Login'}</h2>
          
          {showRegister ? (
            <form onSubmit={handleRegister}>
              <input
                type="text"
                placeholder="Name"
                value={registerForm.name}
                onChange={(e) => setRegisterForm({...registerForm, name: e.target.value})}
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={registerForm.email}
                onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={registerForm.password}
                onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                required
              />
              <select
                value={registerForm.role}
                onChange={(e) => setRegisterForm({...registerForm, role: e.target.value})}
              >
                <option value="candidate">Candidate</option>
                <option value="recruiter">Recruiter</option>
                <option value="admin">Admin</option>
              </select>
              <button type="submit">Register</button>
            </form>
          ) : (
            <form onSubmit={handleLogin}>
              <input
                type="email"
                placeholder="Email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                required
              />
              <button type="submit">Login</button>
            </form>
          )}
          
          <div className="demo-credentials">
            <p>Demo admin: admin@example.com / admin123</p>
          </div>
        </div>
      </div>
    );
  }

  if (user.role !== 'candidate') {
    return (
      <div className="layout">
        <Sidebar
          user={user}
          active={activePage}
          onNavigate={setActivePage}
          onLogout={() => { setToken(null); localStorage.removeItem('token'); setUser(null); }}
        />
        <main className="content">
          <Topbar title={activePage.charAt(0).toUpperCase() + activePage.slice(1)} />
          <div className="admin-wrapper">
            {activePage === 'dashboard' ? (
              /* Lazy import avoided for simplicity */
              <AdminDashboard token={token} onNavigate={setActivePage} />
            ) : (
            <AdminPanel token={token} page={activePage} user={user} />
            )}
            {activePage === 'users' && (
              <UsersManagement token={token} user={user} />
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="assessment-container">
      {candidateView !== 'solve' && (
      <div className="header">
        <h1>Code Assessment</h1>
        <div className="user-info">
            <button onClick={() => { setToken(null); localStorage.removeItem('token'); setUser(null); }}>Logout</button>
          </div>
        </div>
      )}

      {showCandidateIntro && (
        <div className="welcome-hero welcome-hero--full">
          <div className="welcome-heading">
            <h1 className="welcome-main">Welcome, {user.name}</h1>
            <div className="welcome-subtitle">Your Online DSA Coding Assessment</div>
          </div>
          <div className="welcome-title">
            <span className="emoji">⚡</span>
            <h2>Read the instructions before you begin</h2>
            <span className="emoji">💻</span>
          </div>
          <div className="welcome-icons">⏱️ 🧠 ✅</div>
          <ul className="instructions-list">
            <li>At the start, you will see a list of problems with a specific time.</li>
            <li>Choose a problem, solve it, and finish within the given time.</li>
            <li>If time runs out, your code will be auto-submitted.</li>
            <li>Once submitted, a problem cannot be reopened or edited.</li>
            <li>After completing all problems, press “End Assessment” to finish.</li>
            <li>Do not switch tabs, open other apps, or use external devices/notes.</li>
            <li>Do not use AI tools or external help during the assessment.</li>
            <li>Use only the company laptop and internet provided.</li>
            <li>You may use pen and paper for rough work (if permitted).</li>
            <li>Manage your time wisely — partial marks may be given for some tests.</li>
            <li>Stay focused and do your best — good luck!</li>
          </ul>
          <div className="actions" style={{ justifyContent: 'center' }}>
            <button className="btn btn--view" onClick={() => setShowCandidateIntro(false)}>Start Assessment</button>
        </div>
      </div>
      )}

      {candidateView === 'list' && !showCandidateIntro && (
        <div className="problem-section">
          <div className="problem-header">
            <h2>Your Assigned Problems</h2>
          </div>
          <div className="assigned-list">
            {assignedProblems.length === 0 && (
              <div className="card empty">No problems assigned yet.</div>
            )}
            {assignedProblems.map((p) => (
              <div key={p.id} className={`problem-card ${p.submitted ? 'problem-card--submitted' : ''}`}>
                <div className="problem-card__header">
                  <div className="problem-card__left">
                    <div className="problem-card__title">{p.title}</div>
                    <div className="problem-card__time"><span className="tag time">⏱️ {p.time_limit_minutes} min</span></div>
                  </div>
                  <div className="problem-card__meta">
                    {p.submitted ? (
                      <span className="tag success">Submitted {p.latest_submission_score != null ? `(${p.latest_submission_score}%)` : ''}</span>
                    ) : (
                      <span className="tag info">Not submitted</span>
                    )}
                  </div>
                </div>
                <div className="problem-card__actions">
                  {!p.submitted && (
                    <button
                      className="btn btn--view"
                      onClick={() => handleSelectProblem(p.id)}
                    >Open</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="end-assessment">
            <button
              className="btn btn--danger"
              onClick={() => {
                alert('Assessment ended. Thank you!');
                setToken(null);
                localStorage.removeItem('token');
                setUser(null);
              }}
            >End Assessment</button>
          </div>
        </div>
      )}

      {candidateView === 'solve' && problem && (
        <div className="problem-section">
          <div className="problem-header">
            <h2>{problem.title}</h2>
            {showTimer && (
            <div className="timer">
              Time Left: {formatTime(timeLeft)}
            </div>
            )}
            <div>
              <button className="btn btn--view" onClick={() => setShowTimer(prev => !prev)}>
                {showTimer ? 'Hide time' : 'Show time'}
              </button>
            </div>
          </div>
          
          <div className="problem-statement">
            <h3>Problem Statement</h3>
            <p>{problem.statement}</p>
            
            <h3>Constraints</h3>
            <pre>{(() => {
              const c = problem.constraints;
              if (typeof c === 'string') return c;
              if (c && typeof c === 'object') return c.text || JSON.stringify(c, null, 2);
              return '';
            })()}</pre>
            
            <h3>Visible Test Cases</h3>
            <div className="testcases">
              {visibleTestcases.map((test, i) => (
                <div key={test.id} className="testcase">
                  <h4>Test Case {i + 1}</h4>
                  <div className="test-input">
                    <strong>Input:</strong>
                    <pre>{test.input}</pre>
                  </div>
                  <div className="test-output">
                    <strong>Expected Output:</strong>
                    <pre>{test.output}</pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {candidateView === 'solve' && (
        <div className="solve-split">
      <div className="editor-section">
        <div className="editor-header">
          <select value={language} onChange={(e) => handleLanguageChange(e.target.value)}>
            {LANGUAGES.map(lang => (
              <option key={lang.key} value={lang.key}>{lang.label}</option>
            ))}
          </select>
          
          <div className="editor-actions">
            <button 
              onClick={handleRun} 
              disabled={isRunning || !submission || submission.submission_status !== 'draft'}
            >
              {isRunning ? 'Running...' : 'Run'}
            </button>
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting || !submission || submission.submission_status !== 'draft'}
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
        </button>
          </div>
        </div>

        <div className="editor-container">
          <Editor
                height="520px"
            language={language}
            value={code}
            onChange={setCode}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              roundedSelection: false,
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
      </div>

          <div className="results-section solve-results">
          <h3>Results</h3>
            {!runResults && (
              <div className="muted">No results yet. Click Run to execute visible testcases.</div>
            )}
            {runResults && (
              runResults.final ? (
            <div className="final-results">
              <p><strong>Status:</strong> {runResults.status}</p>
              <p><strong>Passed:</strong> {runResults.passed_count}/{runResults.total_count}</p>
            </div>
          ) : (
            <div className="run-results">
              {runResults.map((result, i) => (
                <div key={i} className="result-item">
                  <h4>Test Case {i + 1}</h4>
                  <p><strong>Status:</strong> {result.status}</p>
                  {result.stdout && (
                    <div>
                      <strong>Output:</strong>
                      <pre>{result.stdout}</pre>
                    </div>
                  )}
                  {result.stderr && (
                    <div>
                      <strong>Error:</strong>
                      <pre>{result.stderr}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
              )
          )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;