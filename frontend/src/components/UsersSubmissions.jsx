import { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

function SubmissionDetails({ token, submissionId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openTestIds, setOpenTestIds] = useState({});
  const [evaluationForm, setEvaluationForm] = useState(''); // New state for evaluation form
  const [showEvaluationForm, setShowEvaluationForm] = useState(false); // New state for evaluation form visibility
  const [submittingEvaluation, setSubmittingEvaluation] = useState(false); // New state for evaluation submission status
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const fetchSubmissionDetails = async () => {
    try {
      setLoading(true);
      setError('');
      // Changed API endpoint to the common /submissions/:id
      const res = await axios.get(`${API_BASE}/submissions/${submissionId}`, auth);
      setData(res.data.submission);
      setEvaluationForm(res.data.submission.evaluation || ''); // Initialize form with existing evaluation
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissionDetails();
  }, [submissionId, token]); // Re-fetch if submissionId or token changes

  const handleSaveEvaluation = async () => {
    setSubmittingEvaluation(true);
    try {
      // Ensure the score is sent as a number, not a string
      const scoreToSend = Number(evaluationForm);
      await axios.put(`${API_BASE}/submissions/${submissionId}/evaluate`, { score: scoreToSend }, auth);
      alert('Evaluation saved successfully!');
      setShowEvaluationForm(false);
      fetchSubmissionDetails(); // Refresh submission data after saving
    } catch (e) {
      alert('Failed to save evaluation: ' + (e.response?.data?.error || e.message));
    } finally {
      setSubmittingEvaluation(false);
    }
  };

  if (loading) return <div className="muted">Loading details…</div>;
  if (error) return <div className="muted">{error}</div>;
  if (!data) return null;

  const parseEvaluation = (evalString) => {
    if (!evalString) return <span className="muted">Unevaluated</span>;
    const match = evalString.match(/^SCORE:(\d+)$/);
    if (match) {
      return <span>Score: {match[1]}/100</span>;
    }
    return <span className="muted">Invalid Evaluation Format</span>; // Fallback for unexpected formats
  };

  return (
    <div className="card" style={{ marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div><strong>Problem:</strong> {data.problem?.title} (#{data.problem?.id})</div>
        <div className={`badge ${String(data.status || '').toLowerCase() === 'passed' ? 'success' : String(data.status || '').toLowerCase() === 'failed' ? 'failed' : String(data.status || '').toLowerCase() === 'partially passed' ? 'partially-passed' : 'info'}`}>{data.status}</div>
        {data.score != null && <span style={{ marginLeft: '10px', fontWeight: 'bold' }}>Score: {data.score}%</span>}
      </div>

      <div style={{ marginTop: '0.5rem' }}>
        <strong>Code:</strong>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{data.code}</pre>
      </div>

      <div style={{ marginTop: '0.5rem' }}>
        <h4 className="collapsible-header" onClick={() => setShowEvaluationForm(!showEvaluationForm)}>
          Recruiter Evaluation {showEvaluationForm ? '▼' : '►'}
        </h4>
        {showEvaluationForm && (
          <form onSubmit={(e) => { e.preventDefault(); handleSaveEvaluation(); }} className="form-stack">
            <div className="field full">
              <label>Evaluation Score (0-100):</label>
              <input 
                type="number"
                min="0"
                max="100"
                value={evaluationForm}
                onChange={(e) => setEvaluationForm(e.target.value)}
                placeholder="Enter score (0-100)"
                required
              />
            </div>
            <div className="form-actions">
              <button 
                type="submit" 
                className="btn btn--primary"
                disabled={submittingEvaluation}
              >{submittingEvaluation ? 'Saving...' : 'Save Evaluation'}</button>
            </div>
          </form>
        )}
        {!showEvaluationForm && (
          <div>
            <p><strong>Evaluation:</strong> {parseEvaluation(data.evaluation)}</p>
          </div>
        )}
      </div>

      <div style={{ marginTop: '0.5rem' }}>
        <strong>Testcases:</strong>
        <ul className="list">
          {data.results?.map(r => {
            const isOpen = !!openTestIds[r.id];
            return (
              <li key={r.id} className="list-item" style={{ display: 'block' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>#{r.testcase_id}</strong> • {r.testcase?.category} {r.testcase?.is_hidden ? '(hidden)' : ''}
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <div className={`badge ${String(r.status || '').toLowerCase() === 'passed' ? 'success' : String(r.status || '').toLowerCase() === 'failed' ? 'failed' : 'info'}`}>{r.status}</div>
                    <button className="btn btn--ghost" onClick={() => setOpenTestIds(prev => ({ ...prev, [r.id]: !prev[r.id] }))}>
                      {isOpen ? 'Hide' : 'Details'}
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <div><strong>Input:</strong> <pre>{r.testcase?.input}</pre></div>
                    <div><strong>Expected:</strong> <pre>{r.testcase?.output}</pre></div>
                    <div><strong>Actual:</strong> <pre>{r.actual_output}</pre></div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default function UsersSubmissions({ token }) {
  const [users, setUsers] = useState([]);
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [subsByUser, setSubsByUser] = useState({});
  const [expandedSubmissionIds, setExpandedSubmissionIds] = useState({}); // map submissionId -> true
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const loadUsers = async () => {
    const { data } = await axios.get(`${API_BASE}/admin/users`, auth);
    const candidateUsers = (data.users || []).filter(u => u.role !== 'admin' && u.role !== 'recruiter');

    const usersWithScores = await Promise.all(candidateUsers.map(async (user) => {
      const { submissions, totalScore } = await loadUserSubs(user.id);
      setSubsByUser(prev => ({ ...prev, [user.id]: submissions })); // Also cache submissions
      return { ...user, totalScore: totalScore };
    }));

    return usersWithScores;
  };

  const loadUserSubs = async (userId) => {
    const { data } = await axios.get(`${API_BASE}/admin/users/${userId}/submissions`, auth);
    const submissions = data.submissions || [];

    let totalEvaluatedScore = 0;
    let evaluatedSubmissionsCount = 0;

    const submissionsWithParsedEvaluation = submissions.map(s => {
      const match = s.evaluation?.match(/^SCORE:(\d+)$/);
      const score = match ? Number(match[1]) : null;
      
      if (score !== null) {
        totalEvaluatedScore += score;
        evaluatedSubmissionsCount += 1;
      }
      
      return { ...s, parsedScore: score };
    });

    // Return the submissions and the calculated total score and count
    return { 
      submissions: submissionsWithParsedEvaluation,
      totalScore: evaluatedSubmissionsCount > 0 ? Math.round(totalEvaluatedScore / evaluatedSubmissionsCount) : null
    };
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const u = await loadUsers();
        if (!mounted) return;
        setUsers(u);
      } catch (e) {
        setError(e.response?.data?.error || e.message);
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const toggleExpand = async (user) => {
    if (expandedUserId === user.id) { 
      setExpandedUserId(null);
      // Optionally clear the total score for this user when collapsing
      setUsers(prevUsers => prevUsers.map(u => u.id === user.id ? { ...u, totalScore: undefined } : u));
      return; 
    }
    setExpandedUserId(user.id);
    if (!subsByUser[user.id]) {
      const { submissions, totalScore } = await loadUserSubs(user.id);
      setSubsByUser(prev => ({ ...prev, [user.id]: submissions }));
      // Update the user's total score in the users state
      setUsers(prevUsers => prevUsers.map(u => u.id === user.id ? { ...u, totalScore: totalScore } : u));
    }
  };

  if (loading) return <div className="card"><div>Loading users…</div></div>;
  if (error) return <div className="card"><div className="muted">{error}</div></div>;

  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <h3>Users</h3>
      <ul className="list">
        {users.map(u => (
          <li key={u.id} className="list-item" style={{ display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div onClick={() => toggleExpand(u)} style={{ cursor: 'pointer' }}>
                <strong>{u.name}</strong> <span className="muted">({u.email})</span>
                {u.totalScore != null ? (
                  <span className={`badge score ${u.totalScore >= 80 ? 'score--high' : u.totalScore >= 50 ? 'score--medium' : 'score--low'}`} style={{ marginLeft: '10px' }}>Avg Score: {u.totalScore}/100</span>
                ) : (
                  <span className="badge unevaluated" style={{ marginLeft: '10px' }}>No Avg Score</span>
                )}
              </div>
              <button className="btn btn--view" onClick={() => toggleExpand(u)}>{expandedUserId === u.id ? 'Hide' : 'View'}</button>
            </div>
            {expandedUserId === u.id && (
              <div style={{ marginTop: '0.5rem' }}>
                <ul className="list">
                  {(subsByUser[u.id] || []).map(s => {
                    const isOpen = !!expandedSubmissionIds[s.id];
                    return (
                      <li key={s.id} className="list-item" style={{ display: 'block' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong>#{s.id}</strong> • {s.problem?.title}
                            <div className="muted">{new Date(s.created_at).toLocaleString()}</div>
                          </div>
                          <div className="row" style={{ gap: 8 }}>
                            <div className={`badge ${String(s.status || '').toLowerCase()}`}>{s.status}</div>
                            {s.parsedScore !== null ? (
                              <div className={`badge score ${s.parsedScore >= 80 ? 'score--high' : s.parsedScore >= 50 ? 'score--medium' : 'score--low'}`}>Score: {s.parsedScore}/100</div>
                            ) : (
                              <div className="badge unevaluated">Unevaluated</div>
                            )}
                            <button className="btn btn--view" onClick={() => setExpandedSubmissionIds(prev => ({ ...prev, [s.id]: !prev[s.id] }))}>
                              {isOpen ? 'Hide' : 'Open'}
                            </button>
                          </div>
                        </div>
                        {isOpen && (
                          <SubmissionDetails token={token} submissionId={s.id} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
