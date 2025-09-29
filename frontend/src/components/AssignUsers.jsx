import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export default function AssignUsers({ users, problem, onAssign }) {
  const [selected, setSelected] = useState([]);
  const [assigned, setAssigned] = useState([]);

  const candidatesOnly = useMemo(() => (users || []).filter(u => u.role === 'candidate'), [users]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const { data } = await axios.get(`${API_BASE}/problems/${problem.id}/assigned-users`, { headers: { Authorization: `Bearer ${token}` } });
        if (!mounted) return;
        setAssigned(data.assigned || []);
      } catch (_e) {}
    })();
    return () => { mounted = false; };
  }, [problem?.id]);

  const isAssigned = (id) => assigned.some(a => a.id === id);

  const toggle = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const unassign = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE}/problems/${problem.id}/assign/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
      setAssigned(prev => prev.filter(a => a.id !== userId));
    } catch (_e) {}
  };

  return (
    <div className="card">
      <h3>Assign Users to: {problem.title}</h3>
      <div className="list">
        {candidatesOnly.map(u => (
          <div key={u.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>
              {!isAssigned(u.id) && (
                <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} />
              )}
              <span style={{ marginLeft: 8 }}>{u.name} ({u.email}) - {u.role}</span>
            </label>
            {isAssigned(u.id) ? (
              <div className="row" style={{ gap: 8 }}>
                <div className="badge success">Assigned</div>
                <button className="btn btn--view" onClick={() => unassign(u.id)}>Unassign</button>
              </div>
            ) : (
              <div className="badge">Not Assigned</div>
            )}
          </div>
        ))}
      </div>
      <div className="actions">
        <button className="btn btn--view" onClick={() => onAssign?.(problem.id, selected)} disabled={!selected.length}>Assign Selected</button>
      </div>
    </div>
  );
}
