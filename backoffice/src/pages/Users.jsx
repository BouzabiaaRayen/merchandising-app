import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { userService } from '../services/apiService';
import { getAvatarUrl } from '../services/supabaseClient';
import { Search, SlidersHorizontal, Pencil, Eye, UserPlus, Trash2, CheckCircle2, User } from 'lucide-react';
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
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedMerchandiser, setSelectedMerchandiser] = useState(null);
  const [supervisors, setSupervisors] = useState([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [assignError, setAssignError] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [supervisorAssignments, setSupervisorAssignments] = useState({});

  useEffect(() => {
    fetchUsers();
    fetchSupervisors();
    // Load supervisor assignments from localStorage
    const saved = localStorage.getItem('supervisorAssignments');
    if (saved) {
      try {
        setSupervisorAssignments(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading supervisor assignments:', e);
      }
    }
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, activeTab, searchQuery]);

  const fetchSupervisors = async () => {
    try {
      const data = await userService.getUsers({ role: 'supervisor' });
      const supervisorList = data.results ?? [];
      console.log('=== FETCHED SUPERVISORS ===');
      console.log('Total supervisors:', supervisorList.length);
      console.log('Supervisors:', supervisorList.map(s => ({
        id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        email: s.email
      })));
      setSupervisors(supervisorList);
    } catch (err) {
      console.error('Error fetching supervisors:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      // Request expanded user data that includes supervisor info
      const data = await userService.getUsers({ expand: 'supervisor' });
      const userList = data.results ?? [];
      console.log('=== FETCHED USERS ===');
      console.log('Total users:', userList.length);
      if (userList.length > 0) {
        console.log('Sample user object structure:', userList[0]);
        console.log('All user fields:', Object.keys(userList[0]));
        const merchandisers = userList.filter(u => 
          u.role === 'merchandiser' || u.role === 'MERCHANDISER'
        );
        if (merchandisers.length > 0) {
          console.log('Sample merchandiser:', merchandisers[0]);
        }
      }
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

  const handleOpenAssignModal = (merchandiser) => {
    setSelectedMerchandiser(merchandiser);
    setSelectedSupervisor(merchandiser.supervisor || '');
    setShowAssignModal(true);
    setAssignError('');
  };

  const handleCloseAssignModal = () => {
    setShowAssignModal(false);
    setSelectedMerchandiser(null);
    setSelectedSupervisor('');
    setAssignError('');
  };

  const handleAssignSupervisor = async (e) => {
    e.preventDefault();
    setAssignError('');
    setAssigning(true);

    if (!selectedSupervisor) {
      setAssignError('Please select a supervisor');
      setAssigning(false);
      return;
    }

    try {
      console.log('=== ASSIGNING SUPERVISOR ===');
      console.log('Merchandiser ID:', selectedMerchandiser.id);
      console.log('Merchandiser object:', selectedMerchandiser);
      console.log('Selected Supervisor ID:', selectedSupervisor);
      console.log('Selected Supervisor type:', typeof selectedSupervisor);
      
      const result = await userService.assignSupervisor(selectedMerchandiser.id, selectedSupervisor);
      console.log('=== ASSIGNMENT SUCCESS ===');
      console.log('Result:', result);
      console.log('Result fields:', Object.keys(result));
      console.log('Result supervisor field:', result.supervisor);
      console.log('Result supervisor_name field:', result.supervisor_name);
      console.log('All result data:', JSON.stringify(result, null, 2));
      
      // Find the supervisor from the supervisors list
      const supervisorId = parseInt(selectedSupervisor, 10);
      const assignedSupervisor = supervisors.find(s => s.id === supervisorId);
      const supervisorName = assignedSupervisor 
        ? `${assignedSupervisor.first_name} ${assignedSupervisor.last_name}` 
        : null;
      
      console.log('Assigned supervisor:', { id: supervisorId, name: supervisorName });
      
      // Store supervisor assignment locally
      const newAssignments = {
        ...supervisorAssignments,
        [selectedMerchandiser.id]: {
          supervisorId: supervisorId,
          supervisorName: supervisorName
        }
      };
      setSupervisorAssignments(newAssignments);
      localStorage.setItem('supervisorAssignments', JSON.stringify(newAssignments));
      
      setSuccessMessage('Supervisor assigned successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      setShowAssignModal(false);
      
      // Refresh users list
      await fetchUsers();
    } catch (err) {
      console.error('=== ASSIGNMENT ERROR ===');
      console.error('Full error:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      console.error('Error headers:', err.response?.headers);
      
      let errorMessage = 'Failed to assign supervisor';
      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        } else if (err.response.data.detail) {
          errorMessage = err.response.data.detail;
        } else if (err.response.data.supervisor) {
          errorMessage = `Supervisor: ${Array.isArray(err.response.data.supervisor) ? err.response.data.supervisor.join(', ') : err.response.data.supervisor}`;
        } else {
          errorMessage = JSON.stringify(err.response.data);
        }
      }
      setAssignError(errorMessage);
    } finally {
      setAssigning(false);
    }
  };

  const handleOpenViewModal = (user) => {
    setSelectedUser(user);
    setShowViewModal(true);
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setSelectedUser(null);
  };

  const handleDeleteUser = async (user) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete user "${user.username}"?\n\n` +
      `Name: ${user.first_name} ${user.last_name}\n` +
      `Email: ${user.email}\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await userService.deleteUser(user.id);
      setSuccessMessage(`User "${user.username}" deleted successfully!`);
      setTimeout(() => setSuccessMessage(''), 3000);
      await fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      const errorMessage = err.response?.data?.detail || err.response?.data?.error || 'Failed to delete user';
      alert(`Error: ${errorMessage}`);
    }
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
                    <span className="search-icon"><Search size={15} /></span>
                    <input
                      type="text"
                      placeholder="Search by name, email or ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="search-input"
                    />
                  </div>
                  <button className="filter-btn" title="More Filters">
                    <SlidersHorizontal size={15} /> More Filters
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
                                {user.avatar_url || user.avatar ? (
                                  (() => {
                                    const url = getAvatarUrl(user.avatar_url || user.avatar);
                                    return url ? (
                                      <img
                                        src={url}
                                        alt="avatar"
                                        style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                                      />
                                    ) : (
                                      <span>{user.username?.substring(0, 2).toUpperCase() || 'U'}</span>
                                    );
                                  })()
                                ) : (
                                  <span>{user.username?.substring(0, 2).toUpperCase() || 'U'}</span>
                                )}
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
                            <span className="supervisor-name">
                              {(() => {
                                // First check locally stored assignments
                                const localAssignment = supervisorAssignments[user.id];
                                if (localAssignment && localAssignment.supervisorName) {
                                  return localAssignment.supervisorName;
                                }
                                
                                // Then check if supervisor_name exists from backend
                                if (user.supervisor_name) return user.supervisor_name;
                                
                                // Try all possible supervisor field names from backend
                                const supervisorId = user.supervisor || user.supervisor_id || user.assignedSupervisor;
                                
                                if (supervisorId) {
                                  const supervisor = supervisors.find(s => s.id === supervisorId);
                                  if (supervisor) {
                                    return `${supervisor.first_name} ${supervisor.last_name}`;
                                  }
                                }
                                
                                // Only show "-" for non-merchandisers
                                if (user.role !== 'merchandiser' && user.role !== 'MERCHANDISER') {
                                  return 'N/A';
                                }
                                
                                return '-';
                              })()}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button 
                                className="action-btn-icon delete" 
                                title="Edit User"
                                onClick={() => handleDeleteUser(user)}
                              >
                                <Pencil size={14} />
                              </button>
                              <button 
                                className="action-btn-icon view" 
                                title="View"
                                onClick={() => handleOpenViewModal(user)}
                              >
                                <Eye size={14} />
                              </button>
                              {(user.role === 'merchandiser' || user.role === 'MERCHANDISER') && (
                                <button
                                  className="action-btn-icon assign"
                                  onClick={() => handleOpenAssignModal(user)}
                                  title="Assign Supervisor"
                                >
                                  <UserPlus size={14} />
                                </button>
                              )}
                              <button
                                className={`action-btn-icon ${user.is_active ? 'delete' : 'activate'}`}
                                onClick={() => handleToggleActive(user)}
                                title={user.is_active ? 'Deactivate' : 'Activate'}
                              >
                                {user.is_active ? <Trash2 size={14} /> : <CheckCircle2 size={14} />}
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

      {/* Assign Supervisor Modal */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={handleCloseAssignModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Assign Supervisor</h2>
              <button className="close-btn" onClick={handleCloseAssignModal}>×</button>
            </div>
            <form onSubmit={handleAssignSupervisor}>
              <div className="form-body">
                {assignError && (
                  <div className="form-error">{assignError}</div>
                )}
                
                <div className="assign-info">
                  <p>
                    <strong>Merchandiser:</strong> {selectedMerchandiser?.first_name} {selectedMerchandiser?.last_name}
                  </p>
                  <p>
                    <strong>Email:</strong> {selectedMerchandiser?.email}
                  </p>
                </div>

                <div className="form-group">
                  <label htmlFor="supervisor">Select Supervisor *</label>
                  <select
                    id="supervisor"
                    value={selectedSupervisor}
                    onChange={(e) => setSelectedSupervisor(e.target.value)}
                    required
                  >
                    <option value="">-- Choose a supervisor --</option>
                    {supervisors.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.first_name} {sup.last_name} ({sup.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={handleCloseAssignModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={assigning}>
                  {assigning ? 'Assigning...' : 'Assign Supervisor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View User Modal */}
      {showViewModal && selectedUser && (
        <div className="modal-overlay" onClick={handleCloseViewModal}>
          <div className="modal-content view-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>User Details</h2>
              <button className="close-btn" onClick={handleCloseViewModal}>×</button>
            </div>
            <div className="form-body">
              <div className="user-detail-card">
                <div className="user-avatar-large">
                  {selectedUser.avatar_url || selectedUser.avatar ? (
                    (() => {
                      const url = getAvatarUrl(selectedUser.avatar_url || selectedUser.avatar);
                      return url ? (
                        <img
                          src={url}
                          alt="avatar"
                          style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span>{selectedUser.username?.substring(0, 2).toUpperCase() || 'U'}</span>
                      );
                    })()
                  ) : (
                    <span>{selectedUser.username?.substring(0, 2).toUpperCase() || 'U'}</span>
                  )}
                </div>
                
                <div className="user-detail-section">
                  <h3>Personal Information</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Username</span>
                      <span className="detail-value">{selectedUser.username || '-'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">First Name</span>
                      <span className="detail-value">{selectedUser.first_name || '-'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Last Name</span>
                      <span className="detail-value">{selectedUser.last_name || '-'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Email</span>
                      <span className="detail-value">{selectedUser.email || '-'}</span>
                    </div>
                  </div>
                </div>

                <div className="user-detail-section">
                  <h3>Role & Status</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Role</span>
                      <span className="detail-value">
                        <span className={`role-badge ${(selectedUser.role || '').toLowerCase()}`}>
                          {ROLE_LABELS[selectedUser.role] ?? selectedUser.role ?? 'N/A'}
                        </span>
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Status</span>
                      <span className="detail-value">
                        <span className={`status-badge ${selectedUser.is_active ? 'active' : 'inactive'}`}>
                          ● {selectedUser.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">User ID</span>
                      <span className="detail-value">{selectedUser.id || '-'}</span>
                    </div>
                  </div>
                </div>

                {(selectedUser.role === 'merchandiser' || selectedUser.role === 'MERCHANDISER') && (
                  <div className="user-detail-section">
                    <h3>Assigned Supervisor</h3>
                    <div className="detail-grid">
                      <div className="detail-item full-width">
                        <span className="detail-label">Supervisor</span>
                        <span className="detail-value supervisor-info">
                          {(() => {
                            // First check locally stored assignments
                            const localAssignment = supervisorAssignments[selectedUser.id];
                            if (localAssignment && localAssignment.supervisorName) {
                              return (
                                <>
                                  <span className="supervisor-icon"><User size={14} /></span>
                                  {localAssignment.supervisorName}
                                </>
                              );
                            }
                            
                            // Check if supervisor_name exists from backend
                            if (selectedUser.supervisor_name) {
                              return (
                                <>
                                  <span className="supervisor-icon"><User size={14} /></span>
                                  {selectedUser.supervisor_name}
                                </>
                              );
                            }
                            
                            // Try to find supervisor by ID
                            if (selectedUser.supervisor) {
                              const supervisor = supervisors.find(s => s.id === selectedUser.supervisor);
                              if (supervisor) {
                                return (
                                  <>
                                    <span className="supervisor-icon"><User size={14} /></span>
                                    {supervisor.first_name} {supervisor.last_name}
                                  </>
                                );
                              }
                            }
                            
                            // No supervisor assigned
                            return <span className="no-supervisor">No supervisor assigned</span>;
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-cancel" onClick={handleCloseViewModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
