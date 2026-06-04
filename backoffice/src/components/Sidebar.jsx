import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Store, MapPin, FileText,
  BarChart3, TrendingUp, CalendarDays, AlertTriangle, Settings,
  ChevronLeft, ChevronRight, Zap,
} from 'lucide-react';
import './Sidebar.css';

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="logo-container">
          <div className="logo-icon"><Zap size={22} /></div>
          {!isCollapsed && (
            <div className="logo-text">
              <h1>MerchandisingTeam</h1>
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
          <span className="nav-icon"><LayoutDashboard size={18} /></span>
          {!isCollapsed && <span>Dashboard</span>}
        </NavLink>
        <NavLink 
          to="/users" 
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          title="Team Management"
        >
          <span className="nav-icon"><Users size={18} /></span>
          {!isCollapsed && <span>Team Management</span>}
        </NavLink>
        <NavLink
          to="/catalog"
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          title="Catalog"
        >
          <span className="nav-icon"><Store size={18} /></span>
          {!isCollapsed && <span>Catalog</span>}
        </NavLink>
        <NavLink
          to="/stores"
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          title="Stores"
        >
          <span className="nav-icon"><Store size={18} /></span>
          {!isCollapsed && <span>Stores</span>}
        </NavLink>
        <NavLink
          to="/visits-tracking"
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          title="Visits Tracking"
        >
          <span className="nav-icon"><MapPin size={18} /></span>
          {!isCollapsed && <span>Visits Tracking</span>}
        </NavLink>
        <NavLink
          to="/documents"
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          title="Documents"
        >
          <span className="nav-icon"><FileText size={18} /></span>
          {!isCollapsed && <span>Documents</span>}
        </NavLink>
        <NavLink
          to="/reports"
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          title="Reporting"
        >
          <span className="nav-icon"><BarChart3 size={18} /></span>
          {!isCollapsed && <span>Reporting</span>}
        </NavLink>
        <NavLink
          to="/performance"
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          title="Performance"
        >
          <span className="nav-icon"><TrendingUp size={18} /></span>
          {!isCollapsed && <span>Performance</span>}
        </NavLink>
        <NavLink
          to="/leave-requests"
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          title="Leave Requests"
        >
          <span className="nav-icon"><CalendarDays size={18} /></span>
          {!isCollapsed && <span>Leave Requests</span>}
        </NavLink>
        <NavLink
          to="/complaints"
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          title="Complaints"
        >
          <span className="nav-icon"><AlertTriangle size={18} /></span>
          {!isCollapsed && <span>Complaints</span>}
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          title="Settings"
        >
          <span className="nav-icon"><Settings size={18} /></span>
          {!isCollapsed && <span>Settings</span>}
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        <button 
          className="collapse-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <span className="collapse-icon">{isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</span>
          {!isCollapsed && <span>Collapse Sidebar</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
