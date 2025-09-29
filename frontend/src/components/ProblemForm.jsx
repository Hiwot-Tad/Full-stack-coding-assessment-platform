import { useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export default function ProblemForm({ token, onCreated, onGenerateTestcases }) {
  const [form, setForm] = useState({
    title: '',
    statement: '',
    constraints: '{"note":"describe input/output format here"}',
    reference_solution: '',
    reference_language: 'python',
    time_limit_minutes: 30
  });

  const [testcaseCounts, setTestcaseCounts] = useState({
    normalCount: 3,
    edgeCount: 2,
    randomCount: 2
  });

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const submit = async (e) => {
    e.preventDefault();

    // Frontend validation for reference language and solution mismatch
    const { reference_language, reference_solution } = form;
    let languageMismatchWarning = null;

    if (reference_language === 'python' && !reference_solution.includes('print(')) {
      languageMismatchWarning = `Python solution should typically contain 'print('.`;
    } else if (reference_language === 'javascript' && !reference_solution.includes('console.log(')) {
      languageMismatchWarning = `JavaScript solution should typically contain 'console.log('.`;
    } else if (reference_language === 'java' && !reference_solution.includes('System.out.println(')) {
      languageMismatchWarning = `Java solution should typically contain 'System.out.println('.`;
    } else if (reference_language === 'cpp' && !reference_solution.includes('std::cout <<')) {
      languageMismatchWarning = `C++ solution should typically contain 'std::cout <<'.`;
    }

    if (languageMismatchWarning && !window.confirm(`Warning: It looks like your reference solution might not match the selected language (${reference_language}).\n\n${languageMismatchWarning}\n\nDo you want to proceed anyway?`)) {
      return; // Stop submission if user cancels
    }
    
    try {
      const payload = {
        ...form,
        constraints: form.constraints // Send as string instead of parsing JSON
      };
      const { data } = await axios.post(`${API_BASE}/problems`, payload, auth);
      
      // Auto-generate testcases after problem creation
      if (onGenerateTestcases && data.problem) {
        await onGenerateTestcases(data.problem.id, testcaseCounts);
      }
      
      setForm({ ...form, title: '', statement: '', reference_solution: '' });
      onCreated?.(data.problem);
      alert('Problem created and testcases generated');
    } catch (e) {
      let errorMessage = 'Failed to create problem: ' + (e.response?.data?.error || e.message);
      if (e.response?.status === 409) {
        errorMessage = 'Problem with this title already exists. Please choose a different title.';
      }
      alert(errorMessage);
    }
  };

  return (
    <div className="card stack">
      <div className="toolbar">
        <div className="toolbar__title">Create Problem</div>
      </div>
      <form onSubmit={submit} className="form-grid">
        <div className="field">
          <label className="field__label">Title</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </div>
        <div className="field">
          <label className="field__label">Time Limit (minutes)</label>
          <input type="number" min={1} value={form.time_limit_minutes} onChange={(e) => setForm({ ...form, time_limit_minutes: Number(e.target.value) })} required />
        </div>
        <div className="field full">
          <label className="field__label">Statement</label>
          <textarea rows={4} value={form.statement} onChange={(e) => setForm({ ...form, statement: e.target.value })} required />
        </div>
        <div className="field full">
          <label className="field__label">Constraints</label>
          <textarea rows={3} value={form.constraints} onChange={(e) => setForm({ ...form, constraints: e.target.value })} placeholder="Enter any constraints, rules, or requirements for this problem..." />
          <div className="field__hint">You can enter any text describing constraints, input bounds, or formatting rules. JSON is optional.</div>
        </div>
        <div className="field">
          <label className="field__label">Reference Language</label>
          <select value={form.reference_language} onChange={(e) => setForm({ ...form, reference_language: e.target.value })}>
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
          </select>
        </div>
        <div className="field full">
          <label className="field__label">Reference Solution</label>
          <textarea rows={8} value={form.reference_solution} onChange={(e) => setForm({ ...form, reference_solution: e.target.value })} required />
        </div>
        
        <div className="field full">
          <div className="section">
            <div className="section__title">AI Testcase Generation</div>
            <div className="section__subtitle">Specify how many testcases of each type to generate automatically</div>
            <div className="form-grid">
              <div className="field">
                <label className="field__label">Normal Testcases</label>
                <input 
                  type="number" 
                  min={1} 
                  max={10} 
                  value={testcaseCounts.normalCount} 
                  onChange={(e) => setTestcaseCounts({ ...testcaseCounts, normalCount: Number(e.target.value) })}
                />
                <div className="field__hint">Standard test cases</div>
              </div>
              <div className="field">
                <label className="field__label">Edge Testcases</label>
                <input 
                  type="number" 
                  min={1} 
                  max={10} 
                  value={testcaseCounts.edgeCount} 
                  onChange={(e) => setTestcaseCounts({ ...testcaseCounts, edgeCount: Number(e.target.value) })}
                />
                <div className="field__hint">Boundary values</div>
              </div>
              <div className="field">
                <label className="field__label">Random Testcases</label>
                <input 
                  type="number" 
                  min={1} 
                  max={10} 
                  value={testcaseCounts.randomCount} 
                  onChange={(e) => setTestcaseCounts({ ...testcaseCounts, randomCount: Number(e.target.value) })}
                />
                <div className="field__hint">Random valid inputs</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="actions">
          <button type="submit" className="btn">Create</button>
        </div>
      </form>
    </div>
  );
}
