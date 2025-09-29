export default function Sidebar({ user, onLogout, active = 'problems', onNavigate }) {
  const nav = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'problems', label: 'Problems' },
    { key: 'assignments', label: 'Assignments' },
    { key: 'submissions', label: 'Submissions' },
    { key: 'users', label: 'Users' }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">AssessPro</div>
      <nav className="sidebar__nav">
        {nav.map(item => (
          <a
            key={item.key}
            className={`sidebar__link ${active === item.key ? 'sidebar__link--active' : ''}`}
            onClick={() => onNavigate?.(item.key)}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <div className="sidebar__footer">
        <div className="sidebar__user">
          <div className="sidebar__avatar">{user?.name?.[0] || 'U'}</div>
          <div>
            <div className="sidebar__name">{user?.name}</div>
            <div className="sidebar__role">{user?.role}</div>
          </div>
        </div>
        <button className="btn btn--danger" onClick={onLogout}>Logout</button>
      </div>
    </aside>
  );
}


