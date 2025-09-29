import { useState } from 'react';

export default function TestcaseModal({ open, onClose, onSubmit }) {
  const [counts, setCounts] = useState({
    normalCount: 3,
    edgeCount: 2,
    randomCount: 2
  });

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    onSubmit(counts);
  };

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h3>Generate Testcases</h3>
          <button className="btn btn--ghost" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} className="form-grid">
          <div className="field">
            <label className="field__label">Normal Testcases</label>
            <input 
              type="number" 
              min={1} 
              max={10} 
              value={counts.normalCount} 
              onChange={(e) => setCounts({ ...counts, normalCount: Number(e.target.value) })}
            />
            <div className="field__hint">Standard test cases</div>
          </div>
          <div className="field">
            <label className="field__label">Edge Testcases</label>
            <input 
              type="number" 
              min={1} 
              max={10} 
              value={counts.edgeCount} 
              onChange={(e) => setCounts({ ...counts, edgeCount: Number(e.target.value) })}
            />
            <div className="field__hint">Boundary values</div>
          </div>
          <div className="field">
            <label className="field__label">Random Testcases</label>
            <input 
              type="number" 
              min={1} 
              max={10} 
              value={counts.randomCount} 
              onChange={(e) => setCounts({ ...counts, randomCount: Number(e.target.value) })}
            />
            <div className="field__hint">Random valid inputs</div>
          </div>
          <div className="actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn">Generate</button>
          </div>
        </form>
      </div>
    </div>
  );
}


