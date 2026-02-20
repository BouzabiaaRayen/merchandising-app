import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="logo-container">
          <div className="logo-icon">📊</div>
          {!isCollapsed && (
            <div className="logo-text">
              <h1>MerchAdmin</h1>
              <p>MANAGEMENT SYSTEM</p>
            </div>
          )}
        </div>
      </div>
      <nav className="sidebar-nav">
        <NavLink 
          to="/dashboard" 
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          title="Dashboard"
        >
          <span className="nav-icon">📊</span>
          {!isCollapsed && <span>Dashboard</span>}
        </NavLink>
        <NavLink 
          to="/users" 
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          title="Team Management"
        >
          <span className="nav-icon">👥</span>
          {!isCollapsed && <span>Team Management</span>}
        </NavLink>
        <NavLink
          to="/visits"
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          title="Visits Control"
        >
          <span className="nav-icon">📍</span>
          {!isCollapsed && <span>Visits Control</span>}
        </NavLink>
        <NavLink
          to="/reports"
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          title="Reporting"
        >
          <span className="nav-icon">📈</span>
          {!isCollapsed && <span>Reporting</span>}
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          title="Settings"
        >
          <span className="nav-icon">⚙️</span>
          {!isCollapsed && <span>Settings</span>}
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        <button 
          className="collapse-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <span className="collapse-icon">{isCollapsed ? '→' : '←'}</span>
          {!isCollapsed && <span>Collapse Sidebar</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
