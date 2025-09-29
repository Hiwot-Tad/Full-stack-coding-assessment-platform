import { useState } from 'react';
import TestcaseModal from './TestcaseModal.jsx';
import AssignUsers from './AssignUsers.jsx';
import SubmissionsList from './SubmissionsList.jsx';
import axios from 'axios';

// mode: 'problems' | 'assignments' | 'submissions'
export default function ProblemList({
  problems,
  mode = 'problems',
  onSelect,
  onGenerate,
  users = [],
  onAssign,
  fetchSubmissionsFor
}) {
  const [openFor, setOpenFor] = useState(null); // for testcase modal
  const [expandedId, setExpandedId] = useState(null); // dropdown per problem

  const showGenerate = mode === 'problems';
  const isAssignments = mode === 'assignments';
  const isSubmissions = mode === 'submissions';
  const isProblems = mode === 'problems';

  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <h3>Problems</h3>
      <ul className="list">
        {problems.map(p => (
          <li key={p.id} className="list-item" style={{ display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div onClick={() => onSelect(p.id)} style={{ cursor: 'pointer' }}>
                <strong>{p.title}</strong>
                <div className="muted">ID: {p.id} • Language: {p.reference_language} • Time: {p.time_limit_minutes}m</div>
              </div>
              <div className="row">
                {isProblems && (
                  <button className="btn btn--view" onClick={() => onSelect(p.id)}>
                    View Details
                  </button>
                )}
                {!isProblems && onSelect && false && (
                  <button className="btn" onClick={() => onSelect?.(p)}>Open</button>
                )}
                {(isAssignments || isSubmissions) && (
                  <button className="btn btn--view" onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                    {expandedId === p.id ? 'Hide' : 'View'}
                  </button>
                )}
              </div>
            </div>

            {expandedId === p.id && isProblems && (
              <div className="card" style={{ marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="muted">Problem #{p.id}</div>
                    <div><strong>{p.title}</strong></div>
                  </div>
                  <div className="row">
                    {/* The 'Generate Testcases' and 'Edit' buttons will now be in ProblemDetails */}
                    {/* <button className="btn" onClick={() => setOpenFor(p)}>Generate Testcases</button> */}
                    {/* <button className="btn btn--ghost" onClick={() => setEditingFor(p)}>Edit</button> */}
                  </div>
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <div><strong>Statement</strong></div>
                  <p style={{ marginTop: 6 }}>{p.statement}</p>
                  <div style={{ marginTop: 6 }}>
                    <strong>Constraints</strong>
                    <pre>{typeof p.constraints === 'object' ? JSON.stringify(p.constraints, null, 2) : String(p.constraints)}</pre>
                  </div>
                  <div className="muted">Language: {p.reference_language} • Time: {p.time_limit_minutes}m</div>
                </div>
              </div>
            )}

            {expandedId === p.id && isAssignments && (
              <div style={{ marginTop: '0.75rem' }}>
                <AssignUsers users={users} problem={p} onAssign={onAssign} />
              </div>
            )}

            {expandedId === p.id && isSubmissions && (
              <div style={{ marginTop: '0.75rem' }}>
                <SubmissionsList fetchSubmissions={() => fetchSubmissionsFor?.(p.id)} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {showGenerate && (
        <TestcaseModal
          open={!!openFor}
          onClose={() => setOpenFor(null)}
          onSubmit={(payload) => { onGenerate?.(openFor.id, payload); setOpenFor(null); }}
        />
      )}
    </div>
  );
}
