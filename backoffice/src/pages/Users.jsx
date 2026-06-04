import React, { useEffect, useRef, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { userService } from '../services/apiService';
import { getAvatarUrl } from '../services/supabaseClient';
import { Search, User } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('all');
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
  const [editFormData, setEditFormData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    role: 'merchandiser',
  });
  const [editFormError, setEditFormError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [supervisorAssignments, setSupervisorAssignments] = useState({});
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);
  const syncedAssignmentsRef = useRef(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  useEffect(() => {
    const syncAssignments = async () => {
      if (syncedAssignmentsRef.current) return;
      const assignmentEntries = Object.entries(supervisorAssignments);
      if (assignmentEntries.length === 0 || users.length === 0) return;

      const merchandiserIds = new Set(
        users
          .filter((u) => u.role === 'merchandiser' || u.role === 'MERCHANDISER')
          .map((u) => String(u.id))
      );

      const pending = assignmentEntries.filter(([merchandiserId, assignment]) => {
        return merchandiserIds.has(String(merchandiserId)) && assignment?.supervisorId;
      });

      if (pending.length === 0) {
        syncedAssignmentsRef.current = true;
        return;
      }

      try {
        await Promise.allSettled(
          pending.map(([merchandiserId, assignment]) =>
            userService.assignSupervisor(merchandiserId, assignment.supervisorId)
          )
        );
        syncedAssignmentsRef.current = true;
        await fetchUsers();
      } catch (err) {
        console.error('Error syncing supervisor assignments to backend:', err);
      }
    };

    syncAssignments();
  }, [users, supervisorAssignments]);

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
      syncedAssignmentsRef.current = false;
      
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
    setEditFormData({
      username: user.username || '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      role: (user.role || 'merchandiser').toLowerCase(),
    });
    setEditFormError('');
    setShowViewModal(true);
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setSelectedUser(null);
    setEditFormError('');
    setEditSubmitting(false);
  };

  const handleEditInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setEditFormError('');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditFormError('');
    setEditSubmitting(true);

    if (!selectedUser?.id) {
      setEditFormError('No user selected for update.');
      setEditSubmitting(false);
      return;
    }

    if (!editFormData.username || !editFormData.email) {
      setEditFormError('Username and email are required.');
      setEditSubmitting(false);
      return;
    }

    try {
      const payload = {
        username: editFormData.username.trim(),
        first_name: editFormData.first_name.trim(),
        last_name: editFormData.last_name.trim(),
        email: editFormData.email.trim(),
        role: editFormData.role,
      };

      const updatedUser = await userService.patchUser(selectedUser.id, payload);

      setUsers((prev) =>
        prev.map((u) => (u.id === updatedUser.id ? { ...u, ...updatedUser } : u))
      );
      setSelectedUser(updatedUser);
      setSuccessMessage('User info updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      setShowViewModal(false);
      await fetchUsers();
    } catch (err) {
      const apiError = err.response?.data;
      if (typeof apiError === 'string') {
        setEditFormError(apiError);
      } else if (apiError?.detail) {
        setEditFormError(apiError.detail);
      } else if (apiError && typeof apiError === 'object') {
        const message = Object.entries(apiError)
          .map(([field, messages]) => {
            const msg = Array.isArray(messages) ? messages.join(', ') : messages;
            return `${field}: ${msg}`;
          })
          .join('; ');
        setEditFormError(message || 'Failed to update user info.');
      } else {
        setEditFormError(err.message || 'Failed to update user info.');
      }
    } finally {
      setEditSubmitting(false);
    }
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
                <div className="search-box">
                  <span className="search-icon"><Search size={15} /></span>
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                  />
                </div>
              </div>

              <div className="table-scroll-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>NAME</th>
                      <th>ROLE</th>
                      <th>SUPERVISOR</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="no-data">
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
                            <span className="role-badge">
                              {ROLE_LABELS[user.role] ?? user.role ?? 'N/A'}
                            </span>
                          </td>
                          <td>
                            <span className="supervisor-name">
                              {(() => {
                                const isMerchandiser = user.role === 'merchandiser' || user.role === 'MERCHANDISER';
                                if (!isMerchandiser) return '—';

                                // Check locally stored assignments
                                const local = supervisorAssignments[user.id];
                                if (local?.supervisorName) return local.supervisorName;

                                // Backend nested object
                                if (typeof user.supervisor === 'object' && user.supervisor?.first_name)
                                  return `${user.supervisor.first_name} ${user.supervisor.last_name}`;

                                // Backend name string
                                if (user.supervisor_name) return user.supervisor_name;

                                // Backend supervisor ID → look up in supervisors list
                                const supId = typeof user.supervisor === 'number' ? user.supervisor : user.supervisor_id || null;
                                if (supId) {
                                  const sup = supervisors.find(s => s.id === supId);
                                  if (sup) return `${sup.first_name} ${sup.last_name}`;
                                }

                                return '—';
                              })()}
                            </span>
                          </td>
                          <td style={{ position: 'relative' }}>
                            <button
                              className="dots-btn"
                              onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                            >
                              <span className="dots-trigger">•••</span>
                            </button>
                            {openMenuId === user.id && (
                              <div className="dots-menu" ref={menuRef}>
                                <button className="dots-item" onClick={() => { handleOpenViewModal(user); setOpenMenuId(null); }}>Edit Info</button>
                                {(user.role === 'merchandiser' || user.role === 'MERCHANDISER') && (
                                  <button className="dots-item" onClick={() => { handleOpenAssignModal(user); setOpenMenuId(null); }}>Assign Supervisor</button>
                                )}
                                <button className="dots-item danger" onClick={() => { handleDeleteUser(user); setOpenMenuId(null); }}>Delete</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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
                    <label htmlFor="username">Username</label>
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
                    <label htmlFor="email">Email</label>
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
                    <label htmlFor="password">Password</label>
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
                    <label htmlFor="password_confirm">Confirm Password</label>
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
                    <label htmlFor="role">Role</label>
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
                  <label htmlFor="supervisor">Select Supervisor</label>
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
          <div className="modal-content view-modal edit-user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit User Info</h2>
              <button className="close-btn" onClick={handleCloseViewModal}>×</button>
            </div>
            <form onSubmit={handleEditSubmit}>
            <div className="form-body">
              {editFormError && <div className="form-error">{editFormError}</div>}
              <div className="user-detail-card">

                <div className="user-detail-section">
                  <h3>Personal Information</h3>
                  <div className="detail-grid">
                    <div className="detail-item full-width">
                      <span className="detail-label">Username</span>
                      <span className="detail-value read-only-value">{editFormData.username || '-'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">First Name</span>
                      <input
                        type="text"
                        name="first_name"
                        className="detail-value"
                        value={editFormData.first_name}
                        onChange={handleEditInputChange}
                      />
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Last Name</span>
                      <input
                        type="text"
                        name="last_name"
                        className="detail-value"
                        value={editFormData.last_name}
                        onChange={handleEditInputChange}
                      />
                    </div>
                    <div className="detail-item full-width">
                      <span className="detail-label">Email</span>
                      <input
                        type="email"
                        name="email"
                        className="detail-value"
                        value={editFormData.email}
                        onChange={handleEditInputChange}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="user-detail-section">
                  <h3>Role & Status</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Role</span>
                      <select
                        name="role"
                        className="detail-value"
                        value={editFormData.role}
                        onChange={handleEditInputChange}
                      >
                        <option value="admin">Admin</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="merchandiser">Merchandiser</option>
                      </select>
                    </div>
                    <div className="detail-item full-width">
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
                Cancel
              </button>
              <button type="submit" className="btn-submit" disabled={editSubmitting}>
                {editSubmitting ? 'Saving...' : 'Save Changes'}
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
