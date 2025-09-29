import { useEffect, useState } from 'react';
import axios from 'axios';
import ProblemEditForm from './ProblemEditForm.jsx'; // Import ProblemEditForm

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export default function ProblemDetails({ token, problem, onBack, onUpdateProblem }) {
  const [testcases, setTestcases] = useState(problem.allTestcases || []);
  const [editingTestcaseId, setEditingTestcaseId] = useState(null);
  const [editForm, setEditForm] = useState({ input: '', output: '', is_hidden: false, category: 'normal' });
  const [showAddTestcaseForm, setShowAddTestcaseForm] = useState(false);
  const [newTestcaseForm, setNewTestcaseForm] = useState({ input: '', output: '', is_hidden: true, category: 'normal' });
  const [showEditProblemForm, setShowEditProblemForm] = useState(false); // New state for editing problem details
  const [showStatement, setShowStatement] = useState(false); // New state for toggling statement visibility (default to false)
  const [showConstraints, setShowConstraints] = useState(false); // New state for toggling constraints visibility (default to false)
  const [showTestcases, setShowTestcases] = useState(false); // New state for toggling testcases visibility (default to false)

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  // Function to load all testcases (initially from prop, can be refreshed)
  const loadTestcases = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/problems/${problem.id}/all-testcases`, auth);
      setTestcases(data.testcases || []);
    } catch (e) {
      console.error('Failed to load testcases:', e);
      alert('Failed to load testcases: ' + (e.response?.data?.error || e.message));
    }
  };

  useEffect(() => {
    if (problem?.id) {
      loadTestcases();
    }
  }, [problem?.id]);

  const handleEditClick = (testcase) => {
    setEditingTestcaseId(testcase.id);
    setEditForm({ input: testcase.input, output: testcase.output, is_hidden: testcase.is_hidden, category: testcase.category });
  };

  const handleSaveEdit = async (testcaseId) => {
    try {
      await axios.put(`${API_BASE}/testcases/${testcaseId}`, editForm, auth);
      alert('Testcase updated successfully');
      setEditingTestcaseId(null);
      loadTestcases(); // Refresh the list
      onUpdateProblem(problem.id); // Notify parent to potentially refresh problem data
    } catch (e) {
      alert('Failed to update testcase: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleCancelEdit = () => {
    setEditingTestcaseId(null);
  };

  const handleDeleteTestcase = async (testcaseId) => {
    if (!window.confirm('Are you sure you want to delete this testcase?')) return;
    try {
      await axios.delete(`${API_BASE}/problems/testcases/${testcaseId}`, auth);
      alert('Testcase deleted successfully');
      loadTestcases();
      onUpdateProblem(problem.id);
    } catch (e) {
      alert('Failed to delete testcase: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleAddTestcase = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/problems/${problem.id}/testcases`, newTestcaseForm, auth);
      alert('Testcase added successfully');
      setShowAddTestcaseForm(false);
      setNewTestcaseForm({ input: '', output: '', is_hidden: true, category: 'normal' });
      loadTestcases();
      onUpdateProblem(problem.id);
    } catch (e) {
      alert('Failed to add testcase: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleDeleteProblem = async () => {
    console.log('Delete Problem button clicked.');
    if (!window.confirm(`Are you sure you want to delete the problem "${problem.title}"?\nThis will also delete all associated testcases, assignments, submissions, and submission results.`)) {
      console.log('Delete cancelled by user.');
      return;
    }
    console.log(`Attempting to delete problem ID: ${problem.id}`);
    try {
      await axios.delete(`${API_BASE}/problems/${problem.id}`, auth);
      console.log(`Problem "${problem.title}" deleted successfully.`);
      alert(`Problem "${problem.title}" deleted successfully.`);
      onBack(); // Go back to the problem list
    } catch (e) {
      console.error('Failed to delete problem:', e);
      alert(`Failed to delete problem: ${e.response?.data?.error || e.message}`);
    }
  };

  return (
    <div className="problem-details-view">
      <div className="toolbar">
        <div className="toolbar__title">{problem.title}</div>
        <div className="toolbar__actions">
          <button className="btn btn--ghost" onClick={onBack}>Back to Problems</button>
          <button className="btn btn--view" onClick={() => setShowEditProblemForm(true)}>Edit Problem Details</button>
          <button className="btn btn--danger" onClick={handleDeleteProblem}>Delete Problem</button>
        </div>
      </div>

      {showEditProblemForm ? (
        <ProblemEditForm 
          problem={problem} 
          onClose={() => setShowEditProblemForm(false)} 
          onSave={() => {
            setShowEditProblemForm(false);
            onUpdateProblem(problem.id); // Refresh the current problem details in AdminPanel
          }}
        />
      ) : (
        <div className="card stack">
          <h3 className="collapsible-header" onClick={() => setShowStatement(!showStatement)}>
            Problem Statement {showStatement ? '▼' : '►'}
          </h3>
          {showStatement && <p>{problem.statement}</p>}

          <h3 className="collapsible-header" onClick={() => setShowConstraints(!showConstraints)}>
            Constraints {showConstraints ? '▼' : '►'}
          </h3>
          {showConstraints && (
            <pre>{problem.constraints?.text || (problem.constraints && JSON.stringify(problem.constraints, null, 2)) || 'No constraints provided'}</pre>
          )}

          <h3 className="collapsible-header" onClick={() => setShowTestcases(!showTestcases)}>
            Test Cases ({testcases.length}) {showTestcases ? '▼' : '►'}
          </h3>
          {showTestcases && (
            <>
              <div className="toolbar">
                <button className="btn btn--view" onClick={() => setShowAddTestcaseForm(true)}>Add Manual Testcase</button>
                {testcases.length === 0 ? (
                  <button 
                    className="btn btn--view" 
                    onClick={() => onUpdateProblem(problem.id, { generate: true })} // Signal AdminPanel to generate
                  >Generate AI Testcases</button>
                ) : (
                  <button 
                    className="btn btn--view" 
                    onClick={() => onUpdateProblem(problem.id, { generate: true })} // Signal AdminPanel to regenerate
                  >Regenerate AI Testcases</button>
                )}
              </div>

              {showAddTestcaseForm && (
                <div className="card stack">
                  <h4>Add New Testcase</h4>
                  <form onSubmit={handleAddTestcase} className="form-stack">
                    <div className="field">
                      <label>Input:</label>
                      <input type="text" placeholder="Input" value={newTestcaseForm.input} onChange={(e) => setNewTestcaseForm({...newTestcaseForm, input: e.target.value})} required />
                    </div>
                    <div className="field">
                      <label>Expected Output:</label>
                      <input type="text" placeholder="Expected Output" value={newTestcaseForm.output} onChange={(e) => setNewTestcaseForm({...newTestcaseForm, output: e.target.value})} required />
                    </div>
                    <div className="field">
                      <label>
                        <input type="checkbox" checked={newTestcaseForm.is_hidden} onChange={(e) => setNewTestcaseForm({...newTestcaseForm, is_hidden: e.target.checked})} />
                        Hidden Testcase
                      </label>
                    </div>
                    <div className="field">
                      <label>Category:</label>
                      <select value={newTestcaseForm.category} onChange={(e) => setNewTestcaseForm({...newTestcaseForm, category: e.target.value})}>
                        <option value="normal">Normal</option>
                        <option value="edge">Edge</option>
                        <option value="random">Random</option>
                      </select>
                    </div>
                    <div className="form-actions">
                      <button type="submit" className="btn btn--primary">Add Testcase</button>
                      <button type="button" className="btn btn--ghost" onClick={() => setShowAddTestcaseForm(false)}>Cancel</button>
                    </div>
                  </form>
                </div>
              )}

              <div className="testcases-list">
                {testcases.length === 0 && <div className="card empty">No test cases available.</div>}
                {testcases.map((testcase, index) => (
                  <div key={testcase.id} className={`testcase-item card ${editingTestcaseId === testcase.id ? 'testcase-item--editing' : ''}`}>
                    {editingTestcaseId === testcase.id ? (
                      <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(testcase.id); }} className="form-stack">
                        <div className="field">
                          <label>Input:</label>
                          <textarea value={editForm.input} onChange={(e) => setEditForm({...editForm, input: e.target.value})} required></textarea>
                        </div>
                        <div className="field">
                          <label>Expected Output:</label>
                          <textarea value={editForm.output} onChange={(e) => setEditForm({...editForm, output: e.target.value})} required></textarea>
                        </div>
                        <div className="field">
                          <label>
                            <input type="checkbox" checked={editForm.is_hidden} onChange={(e) => setEditForm({...editForm, is_hidden: e.target.checked})} />
                            Hidden
                          </label>
                        </div>
                        <div className="field">
                          <label>Category:</label>
                          <select value={editForm.category} onChange={(e) => setEditForm({...editForm, category: e.target.value})}>
                            <option value="normal">Normal</option>
                            <option value="edge">Edge</option>
                            <option value="random">Random</option>
                          </select>
                        </div>
                        <div className="form-actions">
                          <button type="submit" className="btn btn--primary">Save</button>
                          <button type="button" className="btn btn--ghost" onClick={handleCancelEdit}>Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <p><strong>Test Case {index + 1}</strong></p>
                        <p><strong>Input:</strong> <pre>{testcase.input}</pre></p>
                        <p><strong>Output:</strong> <pre>{testcase.output}</pre></p>
                        <p><strong>Category:</strong> {testcase.category}</p>
                        <p><strong>Visibility:</strong> {testcase.is_hidden ? 'Hidden' : 'Visible'}</p>
                        <p><strong>Generated By:</strong> {testcase.generated_by || 'Manual'}</p>
                        <div className="item-actions">
                          <button className="btn btn--ghost" onClick={() => handleEditClick(testcase)}>Edit</button>
                          <button className="btn btn--danger" onClick={() => handleDeleteTestcase(testcase.id)}>Delete</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
