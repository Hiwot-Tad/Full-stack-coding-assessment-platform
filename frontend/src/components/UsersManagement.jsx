import { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export default function UsersManagement({ token, user }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: (user && user.role === 'recruiter') ? 'candidate' : 'candidate' }); // Default to candidate for recruiters, safely access user.role
  const [editing, setEditing] = useState(null);
  const [expandedUserId, setExpandedUserId] = useState(null);

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const loadUsers = async () => {
    const { data } = await axios.get(`${API_BASE}/auth/users`, auth);
    setUsers(data.users || []);
  };

  useEffect(() => {
    (async () => {
      try {
        await loadUsers();
      } catch (e) {
        setError(e.response?.data?.error || e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]); // Re-load users if the user (and thus their role) changes

  const submitCreate = async (e) => {
    e.preventDefault();
    const payload = user.role === 'recruiter' ? { ...form, role: 'candidate' } : form;
    try {
      await axios.post(`${API_BASE}/auth/users`, payload, auth);
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', role: user.role === 'recruiter' ? 'candidate' : 'candidate' });
      await loadUsers();
    } catch (e) {
      alert('Failed to create user: ' + (e.response?.data?.error || e.message));
    }
  };

  const submitUpdate = async (e) => {
    e.preventDefault();
    const payload = user.role === 'recruiter' && editing.role !== 'candidate' ? { ...editing, role: 'candidate' } : editing; // Recruiters can only update candidate roles
    try {
      await axios.put(`${API_BASE}/auth/users/${editing.id}`, payload, auth);
      setEditing(null);
      await loadUsers();
    } catch (e) {
      alert('Failed to update user: ' + (e.response?.data?.error || e.message));
    }
  };

  const removeUser = async (id, targetUserRole) => {
    if (user.role === 'recruiter' && targetUserRole !== 'candidate') {
      alert('Recruiters can only delete users with the role \'candidate\'.');
      return;
    }
    if (!confirm('Delete this user?')) return;
    try {
      await axios.delete(`${API_BASE}/auth/users/${id}`, auth);
      await loadUsers();
    } catch (e) {
      alert('Failed to delete user: ' + (e.response?.data?.error || e.message));
    }
  };

  if (loading) return <div className="card"><div>Loading users…</div></div>;
  if (error) return <div className="card"><div className="muted">{error}</div></div>;

  // Safely access user.role by checking if user is defined
  const isRecruiter = user?.role === 'recruiter';
  const isAdmin = user?.role === 'admin';

  return (
    <div className="admin-wrapper">
      <div className="card toolbar">
        <div className="toolbar__title">Users</div>
        <div className="toolbar__actions">
          <button className="btn btn--view" onClick={() => { setShowCreate(true); setEditing(null); }}>Create User</button>
        </div>
      </div>

      {showCreate && (
        <div className="card" style={{ display: 'grid', placeItems: 'center' }}>
          <div className="auth-form" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ color: '#111827', fontSize: '1.1rem' }}>Create User</h2>
              <button className="btn btn--ghost btn--sm" onClick={() => setShowCreate(false)}>Close</button>
            </div>
            <form onSubmit={submitCreate}>
              <input
                type="text"
                placeholder="Full name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
              />
              <input
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
              />
              <input
                type="password"
                placeholder="Temporary password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
              />
              <select 
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}
                disabled={isRecruiter} // Disable if recruiter
              >
                <option value="candidate">Candidate</option>
                {isAdmin && <option value="recruiter">Recruiter</option>}
                {isAdmin && <option value="admin">Admin</option>}
              </select>
              <button className="btn btn--view" type="submit">Create user</button>
            </form>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3>All Users</h3>
        <ul className="list">
          {users.map(u => (
            <li key={u.id} className="list-item" style={{ display: 'block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{u.name}</strong> <span className="muted">({u.email})</span>
                  <div className="muted">Role: {u.role}</div>
                </div>
                <div className="row">
                  <button className="btn btn--view" onClick={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}>
                    {expandedUserId === u.id ? 'Hide' : 'Details'}
                  </button>
                </div>
              </div>

              {expandedUserId === u.id && (
                <div className="card" style={{ marginTop: '0.75rem' }}>
                  <div className="toolbar">
                    <div className="toolbar__title">User Details</div>
                    <div className="toolbar__actions">
                      {!editing && <button className="btn btn--view" onClick={() => setEditing({ ...u, password: '' })} disabled={isRecruiter && u.role !== 'candidate'}>Edit</button>}
                      {!editing && <button className="btn btn--danger" onClick={() => removeUser(u.id, u.role)} disabled={isRecruiter && u.role !== 'candidate'}>Delete</button>}
                      <button className="btn btn--ghost btn--sm" onClick={() => { setExpandedUserId(null); setEditing(null); }}>Close</button>
                    </div>
                  </div>
                  {!editing && (
                    <div className="section">
                      <div><strong>Name:</strong> {u.name}</div>
                      <div><strong>Email:</strong> {u.email}</div>
                      <div><strong>Role:</strong> {u.role}</div>
                    </div>
                  )}
                  {editing?.id === u.id && (
                    <div className="auth-form" style={{ maxWidth: 460, marginTop: '0.5rem' }}>
                      <form onSubmit={submitUpdate}>
                        <input type="text" placeholder="Full name" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
                        <input type="email" placeholder="Email address" value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} />
                        <input type="password" placeholder="Password (leave blank to keep)" value={editing.password} onChange={e => setEditing({ ...editing, password: e.target.value })} />
                        <select 
                          value={editing.role}
                          onChange={e => setEditing({ ...editing, role: e.target.value })}
                          disabled={isRecruiter && editing.role !== 'candidate'} // Disable role change if recruiter and target is not candidate
                        >
                          <option value="candidate">Candidate</option>
                          {isAdmin && <option value="recruiter">Recruiter</option>}
                          {isAdmin && <option value="admin">Admin</option>}
                        </select>
                        <button className="btn btn--view" type="submit">Save</button>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
