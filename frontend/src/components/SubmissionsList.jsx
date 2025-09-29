import { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export default function SubmissionsList({ token, fetchSubmissions }) {
  const [subs, setSubs] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [evaluationForm, setEvaluationForm] = useState('');
  const [showEvaluationForm, setShowEvaluationForm] = useState(false);
  const [submittingEvaluation, setSubmittingEvaluation] = useState(false);

  const loadSubmissions = async () => {
    const s = await fetchSubmissions();
    setSubs(s);
    // If a submission was previously selected, try to re-select it to refresh its data
    if (selectedSubmission) {
      const refreshedSub = s.find(sub => sub.id === selectedSubmission.id);
      if (refreshedSub) setSelectedSubmission(refreshedSub);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, [fetchSubmissions]); // Depend on fetchSubmissions

  const handleSelectSubmission = async (submissionId) => {
    try {
      const { data } = await axios.get(`${API_BASE}/submissions/${submissionId}`, { headers: { Authorization: `Bearer ${token}` } });
      setSelectedSubmission(data.submission);
      setEvaluationForm(data.submission.evaluation || ''); // Initialize form with existing evaluation
      setShowEvaluationForm(false);
    } catch (e) {
      alert('Failed to load submission details: ' + (e.response?.data?.error || e.message));
      setSelectedSubmission(null);
    }
  };

  const handleSaveEvaluation = async (submissionId) => {
    setSubmittingEvaluation(true);
    try {
      await axios.put(`${API_BASE}/submissions/${submissionId}/evaluate`, { evaluation: evaluationForm }, { headers: { Authorization: `Bearer ${token}` } });
      alert('Evaluation saved successfully!');
      setShowEvaluationForm(false);
      loadSubmissions(); // Refresh the list and selected submission
    } catch (e) {
      alert('Failed to save evaluation: ' + (e.response?.data?.error || e.message));
    } finally {
      setSubmittingEvaluation(false);
    }
  };

  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <h3>Submissions</h3>
      <ul className="list">
        {subs.length === 0 && <li className="list-item empty">No submissions yet.</li>}
        {subs.map(s => (
          <li key={s.id} className="list-item" onClick={() => handleSelectSubmission(s.id)} style={{ cursor: 'pointer' }}>
            <div>
              <strong>#{s.id}</strong> • {s.candidate?.name || 'User'} ({s.candidate?.email})
              {s.score != null && <span style={{ marginLeft: '10px', fontWeight: 'bold' }}>Score: {s.score}%</span>}
            </div>
            <div className={`badge ${s.status?.toLowerCase()}`}>{s.status}</div>
            <div className="muted">{new Date(s.created_at).toLocaleString()}</div>
          </li>
        ))}
      </ul>

      {selectedSubmission && (
        <div className="modal__backdrop">
          <div className="modal">
            <div className="modal__header">
              <h4>Submission Details #{selectedSubmission.id}</h4>
              <button className="btn btn--ghost" onClick={() => setSelectedSubmission(null)}>Close</button>
            </div>
            <div className="stack">
              <p><strong>Problem:</strong> {selectedSubmission.problem?.title}</p>
              <p><strong>Candidate:</strong> {selectedSubmission.candidate?.name} ({selectedSubmission.candidate?.email})</p>
              <p><strong>Language:</strong> {selectedSubmission.language}</p>
              <p><strong>Status:</strong> {selectedSubmission.status}</p>
              {selectedSubmission.score != null && <p><strong>Score:</strong> {selectedSubmission.score}%</p>}
              <p><strong>Submitted At:</strong> {new Date(selectedSubmission.created_at).toLocaleString()}</p>

              <h4 className="collapsible-header" onClick={() => setShowEvaluationForm(!showEvaluationForm)}>
                Recruiter Evaluation {showEvaluationForm ? '▼' : '►'}
              </h4>
              {showEvaluationForm && (
                <form onSubmit={(e) => { e.preventDefault(); handleSaveEvaluation(selectedSubmission.id); }} className="form-stack">
                  <div className="field full">
                    <label>Evaluation Comments:</label>
                    <textarea 
                      rows="6" 
                      value={evaluationForm}
                      onChange={(e) => setEvaluationForm(e.target.value)}
                      placeholder="Enter evaluation comments here..."
                    ></textarea>
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
              {!showEvaluationForm && selectedSubmission.evaluation && (
                <div>
                  <p><strong>Existing Evaluation:</strong></p>
                  <pre>{selectedSubmission.evaluation}</pre>
                </div>
              )}
              {!showEvaluationForm && !selectedSubmission.evaluation && (
                <p className="muted">No evaluation yet. Click the header to add one.</p>
              )}

              <h4>Code:</h4>
              <pre className="code-display">{selectedSubmission.code}</pre>

              <h4>Test Results:</h4>
              <div className="testcases-list">
                {selectedSubmission.results?.length === 0 && <div className="card empty">No test results available.</div>}
                {selectedSubmission.results?.map(r => (
                  <div key={r.id} className="testcase-item card">
                    <p><strong>Testcase ID:</strong> {r.testcase_id}</p>
                    <p><strong>Status:</strong> {r.status}</p>
                    <p><strong>Expected Output:</strong> <pre>{r.testcase?.output}</pre></p>
                    <p><strong>Actual Output:</strong> <pre>{r.actual_output}</pre></p>
                    {/* More details can be added here if needed, like expected output from testcase model */}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
