import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Bell, Settings, User, LogOut, ChevronDown, Moon, Sun } from 'lucide-react';
import { notificationService, authService } from '../services/apiService';
import { getAvatarUrl } from '../services/supabaseClient';
import './Navbar.css';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [theme, setTheme] = useState(localStorage.getItem('backoffice-theme') || 'light');
  const menuRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('backoffice-theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    // Refresh count every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Listen for profile updates (avatar changes from Supabase)
  useEffect(() => {
    const handleStorageChange = () => {
      const updatedUser = JSON.parse(localStorage.getItem('user') || '{}');
      console.log('Navbar: User data updated', updatedUser);
      console.log('Navbar: Avatar URL:', updatedUser.avatar_url || updatedUser.avatar);
      setUser(updatedUser);
    };

    // Listen for storage events from other tabs/windows
    window.addEventListener('storage', handleStorageChange);

    // Custom event for same-window updates
    window.addEventListener('profileUpdated', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('profileUpdated', handleStorageChange);
    };
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const data = await notificationService.getUnreadCount();
      setUnreadCount(data.count ?? data.unread_count ?? 0);
    } catch (error) {
      console.error('Failed to fetch unread notifications:', error);
      // Don't show error to user, just keep previous count
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleNotificationClick = () => {
    navigate('/notifications');
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path.includes('dashboard')) return 'Dashboard Overview';
    if (path.includes('users')) return 'Team Management';
    if (path.includes('stores')) return 'Stores Management';
    if (path.includes('visits')) return 'Visits Tracking';
    if (path.includes('reports')) return 'Reporting';
    if (path.includes('leave-requests')) return 'Leave Requests';
    if (path.includes('settings')) return 'Settings';
    return 'Dashboard';
  };

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <div className="navbar-left">
          <div className="navbar-title">
            <h2>{getBreadcrumb()}</h2>
          </div>
          <div className="breadcrumb">
            <span className="breadcrumb-item">Main Console</span>
            <span className="breadcrumb-separator">›</span>
            <span className="breadcrumb-item active">Overview</span>
          </div>
        </div>
        
        <div className="navbar-right">
          <div className="search-container">
            <input 
              type="text" 
              placeholder="Search for merchandisers, stores or reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <span className="search-icon"><Search size={16} /></span>
          </div>
          
          <div className="navbar-actions">
            <button
              className="icon-btn theme-toggle-btn"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className="icon">
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </span>
            </button>

            <button 
              className="icon-btn notification-btn" 
              title="Notifications"
              onClick={handleNotificationClick}
            >
              <span className="icon"><Bell size={18} /></span>
              {unreadCount > 0 && (
                <span className="notification-badge">{unreadCount}</span>
              )}
            </button>
            
            <div className="user-profile-container" ref={menuRef}>
              <div 
                className="user-profile"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <div className="user-avatar">
                  {getAvatarUrl(user.avatar_url || user.avatar) ? (
                    <img 
                      src={getAvatarUrl(user.avatar_url || user.avatar)} 
                      alt="Avatar" 
                      className="user-avatar-image" 
                    />
                  ) : (
                    <span>{user.username ? user.username.substring(0, 2).toUpperCase() : 'AU'}</span>
                  )}
                </div>
                <div className="user-details">
                  <span className="user-name">
                    {user.first_name && user.last_name 
                      ? `${user.first_name} ${user.last_name}` 
                      : user.username || 'Admin User'}
                  </span>
                  <span className="user-role">{user.role || 'Global Supervisor'}</span>
                </div>
                <span className="dropdown-arrow"><ChevronDown size={14} /></span>
              </div>
              
              {showUserMenu && (
                <div className="user-dropdown-menu">
                  <div className="dropdown-item" onClick={() => navigate('/settings')}>
                    <span className="dropdown-icon"><Settings size={15} /></span>
                    <span>Settings</span>
                  </div>
                  <div className="dropdown-item" onClick={() => navigate('/profile')}>
                    <span className="dropdown-icon"><User size={15} /></span>
                    <span>Profile</span>
                  </div>
                  <div className="dropdown-divider"></div>
                  <div className="dropdown-item logout-item" onClick={handleLogout}>
                    <span className="dropdown-icon"><LogOut size={15} /></span>
                    <span>Logout</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
