import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { userService } from '../services/apiService';
import './Users.css';

const ROLE_LABELS = {
  admin: 'Admin',
  supervisor: 'Supervisor',
  merchandiser: 'Merchandiser',
  ADMIN: 'Admin',
  SUPERVISOR: 'Supervisor',
  MERCHANDISER: 'Merchandiser',
};

const Users = () => {
  const [users, setUsers] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: '',
    role: 'merchandiser',
    is_active: true,
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'active', 'inactive'
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [activeCount, setActiveCount] = useState(0);
  const [inactiveCount, setInactiveCount] = useState(0);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, activeTab, searchQuery]);

  const fetchUsers = async () => {
    try {
      const data = await userService.getUsers();
      const userList = data.results ?? [];
      setUsers(userList);
      setCount(data.count ?? 0);
      
      // Calculate counts
      const active = userList.filter(u => u.is_active).length;
      const inactive = userList.filter(u => !u.is_active).length;
      setActiveCount(active);
      setInactiveCount(inactive);
      setError('');
    } catch (err) {
      console.error('Error fetching users:', err);
      console.error('Error details:', err.response?.data);
      console.error('Error status:', err.response?.status);
      
      if (err.response?.status === 401) {
        setError('Authentication required. Please log in again.');
      } else if (err.response?.status === 403) {
        setError('You do not have permission to view users.');
      } else if (err.response?.status === 404) {
        setError('Users endpoint not found. Please check API configuration.');
      } else if (err.message === 'Network Error') {
        setError('Cannot connect to the server. Please ensure the backend is running on port 8000.');
      } else {
        setError(`Failed to fetch users: ${err.response?.data?.detail || err.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    // Filter by tab
    if (activeTab === 'active') {
      filtered = filtered.filter(u => u.is_active);
    } else if (activeTab === 'inactive') {
      filtered = filtered.filter(u => !u.is_active);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(u => 
        u.username?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query) ||
        u.first_name?.toLowerCase().includes(query) ||
        u.last_name?.toLowerCase().includes(query) ||
        u.id?.toString().includes(query)
      );
    }

    setFilteredUsers(filtered);
  };

  const handleToggleActive = async (user) => {
    try {
      if (user.is_active) {
        await userService.deactivateUser(user.id);
      } else {
        await userService.activateUser(user.id);
      }
      await fetchUsers();
    } catch (err) {
      console.error('Error toggling user status:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    // Validation
    if (!formData.username || !formData.email || !formData.password) {
      setFormError('Username, email, and password are required');
      setSubmitting(false);
      return;
    }

    if (formData.password !== formData.password_confirm) {
      setFormError('Passwords do not match');
      setSubmitting(false);
      return;
    }

    try {
      console.log('Submitting user data:', formData);
      
      // Backend requires password_confirm for validation
      const result = await userService.createUser(formData);
      console.log('User created successfully:', result);
      
      setShowModal(false);
      setFormData({
        username: '',
        email: '',
        password: '',
        password_confirm: '',
        first_name: '',
        last_name: '',
        role: 'merchandiser',
        is_active: true,
      });
      
      setSuccessMessage('User created successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      await fetchUsers();
    } catch (err) {
      console.error('Error creating user:', err);
      console.error('Error response:', err.response);
      console.error('Error data:', JSON.stringify(err.response?.data, null, 2));
      console.error('Error status:', err.response?.status);
      
      // Better error handling
      let errorMessage = 'Failed to create user';
      if (err.response?.data) {
        // Handle different error response formats
        if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        } else if (err.response.data.detail) {
          errorMessage = err.response.data.detail;
        } else if (err.response.data.message) {
          errorMessage = err.response.data.message;
        } else if (err.response.data.error) {
          errorMessage = err.response.data.error;
        } else {
          // Handle field-specific errors
          const errors = Object.entries(err.response.data)
            .map(([field, messages]) => {
              const msg = Array.isArray(messages) ? messages.join(', ') : messages;
              return `${field}: ${msg}`;
            })
            .join('; ');
          if (errors) errorMessage = errors;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setFormError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setFormData({
      username: '',
      email: '',
      password: '',
      password_confirm: '',
      first_name: '',
      last_name: '',
      role: 'merchandiser',
      is_active: true,
    });
    setFormError('');
  };

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="page-container">
          <div className="page-header">
            <div>
              <h1>Users Directory</h1>
              <p>Manage team roles, system access levels, and supervisor hierarchies.</p>
            </div>
            <button className="add-btn" onClick={() => setShowModal(true)}>
              + Add User
            </button>
          </div>

          {successMessage && (
            <div className="success-message">
              {successMessage}
            </div>
          )}

          {loading ? (
            <div className="loading">Loading users...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : (
            <>
              <div className="users-filters">
                <div className="filter-tabs">
                  <button 
                    className={`filter-tab ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveTab('all')}
                  >
                    All Users ({count})
                  </button>
                  <button 
                    className={`filter-tab ${activeTab === 'active' ? 'active' : ''}`}
                    onClick={() => setActiveTab('active')}
                  >
                    Active ({activeCount})
                  </button>
                  <button 
                    className={`filter-tab ${activeTab === 'inactive' ? 'active' : ''}`}
                    onClick={() => setActiveTab('inactive')}
                  >
                    Inactive ({inactiveCount})
                  </button>
                </div>

                <div className="filter-actions">
                  <div className="search-box">
                    <span className="search-icon">🔍</span>
                    <input
                      type="text"
                      placeholder="Search by name, email or ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="search-input"
                    />
                  </div>
                  <button className="filter-btn" title="More Filters">
                    <span>⚙️</span> More Filters
                  </button>
                </div>
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>NAME & ID</th>
                      <th>ROLE</th>
                      <th>STATUS</th>
                      <th>SUPERVISOR</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="no-data">
                          No users found
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user.id}>
                          <td>
                            <div className="user-info">
                              <div className="user-avatar-cell">
                                <span>{user.username?.substring(0, 2).toUpperCase() || 'U'}</span>
                              </div>
                              <div className="user-details-cell">
                                <div className="user-name-cell">{user.first_name} {user.last_name}</div>
                                <div className="user-email-cell">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`role-badge ${(user.role || '').toLowerCase()}`}>
                              {ROLE_LABELS[user.role] ?? user.role ?? 'N/A'}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                              ● {user.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <span className="supervisor-name">{user.supervisor_name || '-'}</span>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button className="action-btn-icon edit" title="Edit">✏️</button>
                              <button className="action-btn-icon view" title="View">👁️</button>
                              <button
                                className={`action-btn-icon ${user.is_active ? 'delete' : 'activate'}`}
                                onClick={() => handleToggleActive(user)}
                                title={user.is_active ? 'Deactivate' : 'Activate'}
                              >
                                {user.is_active ? '🗑️' : '✅'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {filteredUsers.length > 0 && (
                <div className="pagination">
                  <span className="pagination-info">
                    Showing 1 to {filteredUsers.length} of {activeTab === 'all' ? count : activeTab === 'active' ? activeCount : inactiveCount} users
                  </span>
                  <div className="pagination-buttons">
                    <button className="page-btn">‹</button>
                    <button className="page-btn active">1</button>
                    <button className="page-btn">2</button>
                    <button className="page-btn">3</button>
                    <button className="page-btn">...</button>
                    <button className="page-btn">31</button>
                    <button className="page-btn">›</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New User</h2>
              <button className="close-btn" onClick={handleCancel}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-body">
                {formError && (
                  <div className="form-error">{formError}</div>
                )}
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="username">Username *</label>
                    <input
                      type="text"
                      id="username"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter username"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="email">Email *</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter email"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="first_name">First Name</label>
                    <input
                      type="text"
                      id="first_name"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleInputChange}
                      placeholder="Enter first name"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="last_name">Last Name</label>
                    <input
                      type="text"
                      id="last_name"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleInputChange}
                      placeholder="Enter last name"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="password">Password *</label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter password"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="password_confirm">Confirm Password *</label>
                    <input
                      type="password"
                      id="password_confirm"
                      name="password_confirm"
                      value={formData.password_confirm}
                      onChange={handleInputChange}
                      required
                      placeholder="Re-enter password"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="role">Role *</label>
                    <select
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="merchandiser">Merchandiser</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="is_active"
                        checked={formData.is_active}
                        onChange={handleInputChange}
                      />
                      <span>Active User</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={handleCancel}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
