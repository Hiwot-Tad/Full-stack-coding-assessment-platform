import { useEffect, useState } from 'react';
import axios from 'axios';
import ProblemForm from './ProblemForm.jsx';
import ProblemList from './ProblemList.jsx';
import AssignUsers from './AssignUsers.jsx';
import SubmissionsList from './SubmissionsList.jsx';
import UsersSubmissions from './UsersSubmissions.jsx';
import ProblemDetails from './ProblemDetails.jsx'; // Import ProblemDetails

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export default function AdminPanel({ token, page = 'problems', user }) {
  const [users, setUsers] = useState([]);
  const [problems, setProblems] = useState([]);
  const [selectedProblem, setSelectedProblem] = useState(null); // New state for selected problem
  const [showCreate, setShowCreate] = useState(false);

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const loadUsers = async () => {
    const { data } = await axios.get(`${API_BASE}/auth/users`, auth);
    setUsers(data.users || []);
  };

  const loadProblems = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/problems`, auth);
      setProblems(data.problems || []);
    } catch (e) {
      console.error('Failed to load problems:', e);
      alert('Failed to load problems: ' + (e.response?.data?.error || e.message));
      setProblems([]); // Ensure problems array is reset on error
    }
  };

  useEffect(() => {
    loadUsers();
    loadProblems();
  }, []);

  const handleCreated = async () => {
    await loadProblems();
  };

  const handleGenerate = async (problemId, testcaseCounts) => {
    try {
      await axios.post(`${API_BASE}/problems/${problemId}/generate-testcases`, testcaseCounts, auth);
      alert('Testcases generated successfully');
      loadProblems(); // Refresh problems to update testcase counts
      // After generation, automatically select the problem to show details with new testcases
      handleSelectProblem(problemId);
    } catch (e) {
      alert('Failed to generate testcases: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleUpdateProblem = async (problemId, options = {}) => {
    // This function can be called from ProblemDetails to trigger a refresh or regeneration
    if (options.generate) {
      await handleGenerate(problemId, { normalCount: 3, edgeCount: 2, randomCount: 2 }); // Default counts
    } else {
      // Just refresh the selected problem data if needed (e.g., after testcase edits)
      await handleSelectProblem(problemId);
    }
    loadProblems(); // Always refresh problem list to get latest metadata (like AI generated count)
  };

  const handleAssign = async (problemId, userIds) => {
    await axios.post(`${API_BASE}/problems/${problemId}/assign`, { userIds }, auth);
    alert('Assigned successfully');
  };

  const handleFetchSubmissions = async (problemId) => {
    const { data } = await axios.get(`${API_BASE}/problems/${problemId}/submissions`, auth);
    return data.submissions || [];
  };

  const handleSelectProblem = async (problemId) => {
    try {
      // Fetch full problem details
      const problemDetailsRes = await axios.get(`${API_BASE}/problems/${problemId}`, auth);
      const fullProblem = problemDetailsRes.data.problem;

      // Fetch all testcases for the problem
      const testcasesRes = await axios.get(`${API_BASE}/problems/${problemId}/all-testcases`, auth);
      const allTestcases = testcasesRes.data.testcases;

      setSelectedProblem({ ...fullProblem, allTestcases });
    } catch (e) {
      alert('Failed to load problem details or testcases: ' + (e.response?.data?.error || e.message));
      setSelectedProblem(null);
    }
  };

  if (page === 'problems') {
    return (
      <div className="admin-wrapper">
        <div className="card toolbar">
          <div className="toolbar__title">Problems</div>
          <div className="toolbar__actions">
            {!selectedProblem && <button className="btn btn--view" onClick={() => setShowCreate(true)}>Create New</button>}
            {selectedProblem && <button className="btn btn--ghost" onClick={() => setSelectedProblem(null)}>Back to List</button>}
          </div>
        </div>
        {showCreate && (
          <div className="card stack">
            <div className="toolbar">
              <div className="toolbar__title">Create Problem</div>
              <div className="toolbar__actions">
                <button className="btn btn--ghost" onClick={() => setShowCreate(false)}>Close</button>
              </div>
            </div>
            <ProblemForm 
              token={token} 
              onCreated={() => { setShowCreate(false); handleCreated(); }} 
              onGenerateTestcases={handleGenerate}
            />
          </div>
        )}

        {!showCreate && !selectedProblem && (
          <ProblemList problems={problems} onSelect={handleSelectProblem} onGenerate={handleGenerate} />
        )}

        {!showCreate && selectedProblem && (
          <ProblemDetails 
            token={token} 
            problem={selectedProblem} 
            onBack={() => setSelectedProblem(null)}
            onUpdateProblem={handleUpdateProblem}
          />
        )}
      </div>
    );
  }

  if (page === 'assignments') {
    return (
      <div className="admin-wrapper">
        <div className="card toolbar">
          <div className="toolbar__title">Assignments</div>
        </div>
        <ProblemList
          problems={problems}
          mode="assignments"
          users={users}
          onAssign={handleAssign}
          onSelect={() => {}}
          onGenerate={() => {}}
        />
      </div>
    );
  }

  if (page === 'submissions') {
    return (
      <div className="admin-wrapper">
        <div className="card toolbar">
          <div className="toolbar__title">Submissions</div>
        </div>
        <UsersSubmissions token={token} />
      </div>
    );
  }

  return null;
}
