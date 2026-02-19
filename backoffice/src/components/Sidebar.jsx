import React from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>Menu</h1>
      </div>
      <nav className="sidebar-nav">
        <NavLink 
          to="/dashboard" 
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >
          <span className="nav-icon">📊</span>
          Dashboard
        </NavLink>
        <NavLink 
          to="/users" 
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >
          <span className="nav-icon">👥</span>
          Users
        </NavLink>
        <NavLink
          to="/products"
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >
          <span className="nav-icon">📦</span>
          Products
        </NavLink>
        <NavLink
          to="/stores"
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >
          <span className="nav-icon">🏪</span>
          Stores
        </NavLink>
        <NavLink
          to="/visits"
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >
          <span className="nav-icon">📋</span>
          Visits
        </NavLink>
        <NavLink
          to="/inventory"
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >
          <span className="nav-icon">🗃️</span>
          Inventory
        </NavLink>
        <NavLink
          to="/notifications"
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >
          <span className="nav-icon">🔔</span>
          Notifications
        </NavLink>
      </nav>
    </aside>
  );
};

export default Sidebar;
