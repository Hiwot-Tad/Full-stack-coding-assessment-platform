import { useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export default function ProblemEditForm({ problem, onClose, onSave }) {
  const [form, setForm] = useState({
    title: problem.title,
    statement: problem.statement,
    constraints: typeof problem.constraints === 'object' ? JSON.stringify(problem.constraints, null, 2) : String(problem.constraints || ''),
    reference_language: problem.reference_language,
    reference_solution: problem.reference_solution,
    time_limit_minutes: problem.time_limit_minutes
  });

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form };
      const token = localStorage.getItem('token'); // Get token from localStorage
      await axios.put(`${API_BASE}/problems/${problem.id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      alert('Problem updated');
      onSave?.(); // Notify parent component of save
      onClose?.();
    } catch (e) {
      alert('Failed to update: ' + (e.response?.data?.error || e.message));
    }
  };

  return (
    <div className="card" style={{ marginTop: '0.75rem' }}>
      <div className="toolbar">
        <div className="toolbar__title">Edit Problem</div>
        <div className="toolbar__actions">
          <button className="btn btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
      <form onSubmit={save} className="form-grid">
        <div className="field">
          <label className="field__label">Title</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="field">
          <label className="field__label">Time Limit (minutes)</label>
          <input type="number" min={1} value={form.time_limit_minutes} onChange={(e) => setForm({ ...form, time_limit_minutes: Number(e.target.value) })} />
        </div>
        <div className="field full">
          <label className="field__label">Statement</label>
          <textarea rows={4} value={form.statement} onChange={(e) => setForm({ ...form, statement: e.target.value })} />
        </div>
        <div className="field full">
          <label className="field__label">Constraints</label>
          <textarea rows={3} value={form.constraints} onChange={(e) => setForm({ ...form, constraints: e.target.value })} />
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
          <textarea rows={8} value={form.reference_solution} onChange={(e) => setForm({ ...form, reference_solution: e.target.value })} />
        </div>
        <div className="actions">
          <button type="submit" className="btn">Save</button>
        </div>
      </form>
    </div>
  );
}
