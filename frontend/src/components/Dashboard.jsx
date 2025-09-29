import { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export default function Dashboard({ token, onNavigate }) {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [s, r] = await Promise.all([
          axios.get(`${API_BASE}/admin/stats`, auth),
          axios.get(`${API_BASE}/admin/recent-submissions`, auth)
        ]);
        if (!mounted) return;
        setStats(s.data);
        setRecent(r.data.recent || []);
      } catch (e) {
        setError(e.response?.data?.error || e.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="admin-wrapper">
      <div className="card toolbar">
        <div className="toolbar__title">Dashboard</div>
        <div className="toolbar__actions">
          <button className="btn btn--ghost" onClick={() => onNavigate?.('problems')}>Create Problem</button>
          <button className="btn btn--ghost" onClick={() => onNavigate?.('assignments')}>Assign Problems</button>
          <button className="btn btn--ghost" onClick={() => onNavigate?.('submissions')}>View Submissions</button>
        </div>
      </div>

      {loading && (
        <div className="card"><div>Loading dashboard…</div></div>
      )}

      {error && !loading && (
        <div className="card"><div className="muted">{error}</div></div>
      )}

      {!loading && !error && (
        <>
          <div className="kpi-grid">
            <div className="card kpi">
              <div className="kpi__icon" aria-hidden>📘</div>
              <div className="kpi__label">Problems</div>
              <div className="kpi__value">{stats?.problemsCount ?? 0}</div>
            </div>
            <div className="card kpi">
              <div className="kpi__icon" aria-hidden>👤</div>
              <div className="kpi__label">Candidates</div>
              <div className="kpi__value">{stats?.candidatesCount ?? 0}</div>
            </div>
            <div className="card kpi">
              <div className="kpi__icon" aria-hidden>📝</div>
              <div className="kpi__label">Assignments</div>
              <div className="kpi__value">{stats?.assignmentsCount ?? 0}</div>
            </div>
            <div className="card kpi">
              <div className="kpi__icon" aria-hidden>📊</div>
              <div className="kpi__label">Submissions</div>
              <div className="kpi__value">{stats?.submissionsCount ?? 0}</div>
            </div>
            <div className="card kpi">
              <div className="kpi__icon" aria-hidden>✅</div>
              <div className="kpi__label">Pass Rate</div>
              <div className="kpi__value">{(stats?.passRate ?? 0)}%</div>
            </div>
          </div>

          <div className="card" style={{ marginTop: '1rem' }}>
            <div className="toolbar" style={{ padding: 0 }}>
              <div className="toolbar__title">Overview</div>
            </div>
            <div className="mini-chart">
              <div className="bar" style={{ height: `${Math.min(stats?.problemsCount ?? 0, 10) * 8}px` }} title="Problems" />
              <div className="bar" style={{ height: `${Math.min(stats?.candidatesCount ?? 0, 10) * 8}px` }} title="Candidates" />
              <div className="bar" style={{ height: `${Math.min(stats?.assignmentsCount ?? 0, 10) * 8}px` }} title="Assignments" />
              <div className="bar" style={{ height: `${Math.min(stats?.submissionsCount ?? 0, 10) * 8}px` }} title="Submissions" />
              <div className="bar success" style={{ height: `${Math.min(stats?.passRate ?? 0, 100) * 0.6}px` }} title="Pass Rate" />
            </div>
          </div>

          {/* Charts Row */}
          <div className="charts-grid">
            {/* Pass vs Fail Pie */}
            <div className="card">
              <div className="toolbar" style={{ padding: 0 }}>
                <div className="toolbar__title">Pass vs Fail</div>
              </div>
              {(() => {
                const total = Number(stats?.submissionsCount || 0);
                const passRate = Number(stats?.passRate || 0);
                const passed = Math.round((passRate / 100) * total);
                const failed = Math.max(total - passed, 0);
                const passAngle = Math.min(Math.max(passRate, 0), 100) * 3.6; // degrees
                return (
                  <div className="chart-row">
                    <div
                      className="pie"
                      style={{
                        background: `conic-gradient(#dc2626 0 ${passAngle}deg, #fca5a5 ${passAngle}deg 360deg)`
                      }}
                      aria-label={`Passed ${passed}, Failed ${failed}`}
                    />
                    <div className="legend">
                      <div className="legend__item"><span className="swatch swatch--pass" /> Passed: {passed}</div>
                      <div className="legend__item"><span className="swatch swatch--fail" /> Failed: {failed}</div>
                      <div className="legend__item"><span className="swatch" /> Total: {total}</div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Assignments load chart (simple horizontal bars) */}
            <div className="card">
              <div className="toolbar" style={{ padding: 0 }}>
                <div className="toolbar__title">Workload</div>
              </div>
              <div className="hbar-list">
                <div className="hbar">
                  <div className="hbar__label">Assignments</div>
                  <div className="hbar__bar"><span style={{ width: `${Math.min(Number(stats?.assignmentsCount || 0), 100)}%` }} /></div>
                </div>
                <div className="hbar">
                  <div className="hbar__label">Problems</div>
                  <div className="hbar__bar alt"><span style={{ width: `${Math.min((Number(stats?.problemsCount || 0) * 10), 100)}%` }} /></div>
                </div>
                <div className="hbar">
                  <div className="hbar__label">Submissions</div>
                  <div className="hbar__bar"><span style={{ width: `${Math.min((Number(stats?.submissionsCount || 0)), 100)}%` }} /></div>
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: '1rem' }}>
            <div className="toolbar" style={{ padding: 0 }}>
              <div className="toolbar__title">Recent Submissions</div>
            </div>
            <ul className="list">
              {recent.length === 0 && (
                <li className="list-item"><span className="muted">No recent submissions.</span></li>
              )}
              {recent.map(item => (
                <li key={item.id} className="list-item">
                  <div>
                    <strong>#{item.id}</strong> • {item.candidate?.name || 'User'} ({item.candidate?.email}) on <strong>{item.problem?.title}</strong>
                    {item.score != null && <span style={{ marginLeft: '10px', fontWeight: 'bold' }}>Score: {item.score}%</span>}
                  </div>
                  <div className={`badge ${String(item.status || '').toLowerCase()}`}>{item.status}</div>
                  <div className="muted">{new Date(item.created_at).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <style>{`
        .kpi-grid { display: grid; grid-template-columns: repeat(5, minmax(160px, 1fr)); gap: 12px; }
        .kpi { display: flex; flex-direction: column; align-items: flex-start; padding: 12px; }
        .kpi__icon { font-size: 22px; margin-bottom: 6px; }
        .kpi__label { font-size: 12px; color: var(--muted, #777); }
        .kpi__value { font-size: 28px; font-weight: 700; margin-top: 4px; }
        .mini-chart { display: flex; align-items: flex-end; gap: 12px; height: 140px; padding: 12px 0; }
        .mini-chart .bar { width: 32px; background: #fca5a5; border-radius: 6px 6px 0 0; transition: height .3s ease; }
        .mini-chart .bar.success { background: #dc2626; }
        .charts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; margin-top: 12px; }
        .chart-row { display: flex; align-items: center; gap: 16px; padding: 12px 0; }
        .pie { width: 120px; height: 120px; border-radius: 50%; box-shadow: inset 0 0 0 8px rgba(0,0,0,0.05); }
        .legend { display: grid; gap: 4px; }
        .legend__item { display: flex; align-items: center; gap: 8px; }
        .swatch { width: 12px; height: 12px; border-radius: 3px; background: #dc2626; display: inline-block; opacity: 0.9; }
        .swatch--pass { background: #dc2626; }
        .swatch--fail { background: #fca5a5; }
        .hbar-list { display: grid; gap: 8px; padding: 8px 0; }
        .hbar { display: grid; grid-template-columns: 120px 1fr; align-items: center; gap: 12px; }
        .hbar__label { font-size: 12px; color: var(--muted, #777); }
        .hbar__bar { background: rgba(220,38,38,0.15); border-radius: 999px; height: 10px; position: relative; overflow: hidden; }
        .hbar__bar span { position: absolute; left: 0; top: 0; bottom: 0; background: #dc2626; border-radius: 999px; }
        .hbar__bar.alt { background: rgba(252,165,165,0.35); }
        .hbar__bar.alt span { background: #fca5a5; }
      `}</style>
    </div>
  );
}


