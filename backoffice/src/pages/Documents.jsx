import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { documentService, userService } from '../services/apiService';
import { Upload, FileText, FileSpreadsheet, RefreshCw, Download, Trash2, Calendar, User, Briefcase, Loader, Search, X } from 'lucide-react';
import './Documents.css';

const Documents = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    document_type: 'guide',
    description: '',
    file: null,
    target_audience: {
      merchandisers: false,
      supervisors: false,
      selected_users: [],
    },
    send_notification: true,
  });

  useEffect(() => {
    fetchDocuments();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await userService.getUsers({ page_size: 1000 });
      const usersList = response?.results || response || [];
      setUsers(usersList);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await documentService.getDocuments({ page_size: 1000 });
      const docs = response?.results || response || [];
      
      // Filter to show only admin-shared documents (not daily reports from merchandisers)
      // Includes: guide, instructions, training
      // Excludes: daily_report and other auto-generated types
      const filteredDocs = docs.filter(doc => {
        const docType = doc.document_type?.toLowerCase() || '';
        return ['guide', 'instructions', 'training'].includes(docType);
      });
      
      // Sort by created date (newest first)
      const sortedDocs = filteredDocs.sort((a, b) => 
        new Date(b.created_at || b.uploaded_at) - new Date(a.created_at || a.uploaded_at)
      );
      
      setDocuments(sortedDocs);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError('Impossível carregar os documentos. Verifique se o backend está ativo.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!allowedTypes.includes(file.type)) {
        setError('Only PDF and Word files are allowed');
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must not exceed 10MB');
        return;
      }
      
      setFormData(prev => ({
        ...prev,
        file: file
      }));
      setError('');
    }
  };

  const handleAudienceChange = (e) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      target_audience: {
        ...prev.target_audience,
        [name]: checked
      }
    }));
  };

  const handleUserSelect = (userId) => {
    setFormData(prev => {
      const isSelected = prev.target_audience.selected_users.includes(userId);
      return {
        ...prev,
        target_audience: {
          ...prev.target_audience,
          selected_users: isSelected 
            ? prev.target_audience.selected_users.filter(id => id !== userId)
            : [...prev.target_audience.selected_users, userId]
        }
      };
    });
  };

  const handleRemoveUser = (userId) => {
    setFormData(prev => ({
      ...prev,
      target_audience: {
        ...prev.target_audience,
        selected_users: prev.target_audience.selected_users.filter(id => id !== userId)
      }
    }));
  };

  const filteredUsers = users.filter(user => {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
    const email = (user.email || '').toLowerCase();
    const query = userSearchQuery.toLowerCase();
    return fullName.includes(query) || email.includes(query);
  });

  const selectedUsersData = users.filter(user => formData.target_audience.selected_users.includes(user.id));

  const handleNotificationToggle = (e) => {
    setFormData(prev => ({
      ...prev,
      send_notification: e.target.checked
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.title.trim()) {
      setError('Please enter a document title');
      return;
    }
    
    if (!formData.file) {
      setError('Please select a file');
      return;
    }
    
    if (!formData.target_audience.merchandisers && !formData.target_audience.supervisors) {
      setError('Please select at least one target audience');
      return;
    }
    
    if (!formData.description.trim()) {
      setError('Please enter a description');
      return;
    }

    try {
      setUploading(true);
      setError('');
      
      const payload = new FormData();
      payload.append('title', formData.title);
      payload.append('document_type', formData.document_type);
      payload.append('description', formData.description);
      payload.append('file', formData.file);
      payload.append('send_to_merchandisers', formData.target_audience.merchandisers);
      payload.append('send_to_supervisors', formData.target_audience.supervisors);
      payload.append('send_notification', formData.send_notification);
      
      // Add selected users if any
      if (formData.target_audience.selected_users.length > 0) {
        formData.target_audience.selected_users.forEach((userId, index) => {
          payload.append(`selected_user_ids[${index}]`, userId);
        });
      }

      const response = await documentService.uploadDocument(payload);
      
      setSuccessMessage('Document uploaded successfully!');
      
      // Reset form
      setFormData({
        title: '',
        document_type: 'guide',
        description: '',
        file: null,
        target_audience: {
          merchandisers: false,
          supervisors: false,
          selected_users: [],
        },
        send_notification: true,
      });
      
      setUserSearchQuery('');
      setShowUserDropdown(false);
      
      // Clear file input
      const fileInput = document.getElementById('file-input');
      if (fileInput) fileInput.value = '';
      
      // Refresh documents list
      setTimeout(() => {
        fetchDocuments();
        setSuccessMessage('');
      }, 1500);

    } catch (err) {
      console.error('Error uploading document:', err);
      console.error('Full error response:', JSON.stringify(err.response?.data, null, 2));
      
      let errorMsg = 'Error uploading document.';
      
      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          errorMsg = err.response.data;
        } else if (err.response.data.detail) {
          errorMsg = err.response.data.detail;
        } else if (err.response.data.message) {
          errorMsg = err.response.data.message;
        } else {
          errorMsg = JSON.stringify(err.response.data);
        }
      }
      
      setError(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const fileUrl = doc.file_url;
      if (fileUrl) {
        window.open(fileUrl, '_blank');
      } else {
        setError('Arquivo não disponível');
      }
    } catch (err) {
      console.error('Error downloading document:', err);
      setError('Erro ao baixar documento');
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await documentService.deleteDocument(doc.id);
      setDocuments(documents.filter(d => d.id !== doc.id));
      setSuccessMessage('Document deleted successfully!');
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (err) {
      console.error('Error deleting document:', err);
      setError('Error deleting document');
    }
  };

  const documentTypeOptions = {
    guide: 'Guide',
    instructions: 'Instructions',
    training: 'Training'
  };

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="page-container">
          <div className="page-header">
            <div>
              <h1>Share Resources</h1>
              <p>Share guides, training materials or instructions with your global team.</p>
            </div>
          </div>

          {/* Upload Form */}
          <div className="document-form-container">
            <form onSubmit={handleSubmit} className="document-form">
              {/* Document Title */}
              <div className="form-group">
                <label htmlFor="title">Document Title</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  placeholder="e.g. Q4 Visual Merchandising Guide"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="form-input"
                />
              </div>

              {/* Document Type */}
              <div className="form-group">
                <label htmlFor="document_type">Document Type</label>
                <select
                  id="document_type"
                  name="document_type"
                  value={formData.document_type}
                  onChange={handleInputChange}
                  className="form-select"
                >
                  {Object.entries(documentTypeOptions).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="form-group full-width">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  placeholder="Briefly describe the purpose of this document..."
                  value={formData.description}
                  onChange={handleInputChange}
                  className="form-textarea"
                  rows="4"
                />
              </div>

              {/* File Upload */}
              <div className="form-group full-width">
                <label htmlFor="file-input">File Attachment</label>
                <div className="file-upload-area">
                  <input
                    type="file"
                    id="file-input"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx"
                    className="file-input"
                  />
                  <div className="file-upload-placeholder">
                    <div className="file-icon"><FileText size={32} strokeWidth={1.2} /></div>
                    <div className="file-text">
                      Click to upload or drag and drop
                    </div>
                    <div className="file-subtext">
                      PDF (Max. 10MB)
                    </div>
                  </div>
                  {formData.file && (
                    <div className="file-selected">
                      ✓ {formData.file.name}
                    </div>
                  )}
                </div>
              </div>

              {/* Settings Section */}
              <div className="settings-container full-width">
                <div className="settings-left">
                  <label className="settings-title">Target Audience</label>
                  <div className="audience-checkboxes">
                    <label className="simple-checkbox">
                      <input
                        type="checkbox"
                        name="merchandisers"
                        checked={formData.target_audience.merchandisers}
                        onChange={handleAudienceChange}
                      />
                      <span>Merchandisers</span>
                    </label>
                    <label className="simple-checkbox">
                      <input
                        type="checkbox"
                        name="supervisors"
                        checked={formData.target_audience.supervisors}
                        onChange={handleAudienceChange}
                      />
                      <span>Supervisors</span>
                    </label>
                  </div>

                  <div className="user-target-audience-search">
                    <label className="settings-title">Specific Users</label>
                    <div className="user-search-input-wrapper">
                      <Search size={16} className="user-search-icon" />
                      <input
                        type="text"
                        value={userSearchQuery}
                        onChange={(e) => {
                          setUserSearchQuery(e.target.value);
                          setShowUserDropdown(true);
                        }}
                        onFocus={() => setShowUserDropdown(true)}
                        placeholder="Search by name or email..."
                        className="form-input user-search-input"
                      />
                      {userSearchQuery && (
                        <button
                          type="button"
                          className="user-search-clear"
                          onClick={() => {
                            setUserSearchQuery('');
                            setShowUserDropdown(false);
                          }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {showUserDropdown && userSearchQuery.trim() && (
                      <div className="user-search-dropdown">
                        {filteredUsers.length > 0 ? (
                          filteredUsers.slice(0, 8).map((user) => {
                            const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || `User ${user.id}`;
                            const isSelected = formData.target_audience.selected_users.includes(user.id);

                            return (
                              <button
                                key={user.id}
                                type="button"
                                className={`user-search-option ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleUserSelect(user.id)}
                              >
                                <div>
                                  <div className="user-search-name">{displayName}</div>
                                  <div className="user-search-email">{user.email || 'No email'}</div>
                                </div>
                                <span className="user-search-status">
                                  {isSelected ? 'Selected' : 'Add'}
                                </span>
                              </button>
                            );
                          })
                        ) : (
                          <div className="user-search-empty">No users found</div>
                        )}
                      </div>
                    )}

                    {selectedUsersData.length > 0 && (
                      <div className="selected-users-list">
                        {selectedUsersData.map((user) => {
                          const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || `User ${user.id}`;

                          return (
                            <div key={user.id} className="selected-user-chip">
                              <span>{displayName}</span>
                              <button type="button" onClick={() => handleRemoveUser(user.id)}>
                                <X size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="settings-right">
                  <label className="settings-title">Notifications</label>
                  <div className="notification-toggle-wrapper">
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={formData.send_notification}
                        onChange={handleNotificationToggle}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <span className="toggle-label">Send mobile notification</span>
                  </div>
                </div>
              </div>

              {/* Messages */}
              {error && <div className="alert alert-error">{error}</div>}
              {successMessage && <div className="alert alert-success">{successMessage}</div>}

              {/* Buttons */}
              <div className="form-buttons">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setFormData({
                      title: '',
                      document_type: 'guide',
                      description: '',
                      file: null,
                      target_audience: {
                        merchandisers: false,
                        supervisors: false,
                      },
                      send_notification: true,
                    });
                    setUserSearchQuery('');
                    setShowUserDropdown(false);
                    const fileInput = document.getElementById('file-input');
                    if (fileInput) fileInput.value = '';
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={uploading}
                >
                  {uploading ? <><Loader size={14} className="spin" /> Uploading...</> : <><Upload size={14} /> Upload &amp; Send</>}
                </button>
              </div>
            </form>
          </div>

          {/* Documents List */}
          <div className="documents-list-container">
            <div className="list-header">
              <h2>Uploaded Documents</h2>
              <button 
                onClick={fetchDocuments}
                disabled={loading}
                className="btn-refresh"
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            {loading ? (
              <div className="empty-state">
                <div className="loading-spinner"></div>
                <div>Loading documents...</div>
              </div>
            ) : documents.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: '48px', marginBottom: '1rem' }}><FileText size={48} strokeWidth={1} /></div>
                <div className="empty-title">No documents uploaded yet</div>
                <div className="empty-description">
                  Documents you upload will appear here
                </div>
              </div>
            ) : (
              <div className="documents-grid">
                {documents.map((doc) => (
                  <div key={doc.id} className="document-card">
                    <div className="document-card-header">
                      <div className="document-icon"><FileSpreadsheet size={24} strokeWidth={1.5} /></div>
                      <div className="document-meta">
                        <div className="document-title">{doc.title || 'Sem título'}</div>
                        <div className="document-type">
                          {documentTypeOptions[doc.document_type] || doc.document_type}
                        </div>
                      </div>
                    </div>

                    <div className="document-description">
                      {doc.description || 'Sem descrição'}
                    </div>

                    <div className="document-info">
                      <div className="info-item">
                        <Calendar size={13} /> {new Date(doc.created_at || doc.uploaded_at).toLocaleDateString('pt-BR', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      {doc.sent_to_merchandisers && (
                        <div className="badge badge-blue"><User size={12} /> Merchandisers</div>
                      )}
                      {doc.sent_to_supervisors && (
                        <div className="badge badge-green"><Briefcase size={12} /> Supervisors</div>
                      )}
                    </div>

                    <div className="document-actions">
                      <button
                        onClick={() => handleDownload(doc)}
                        className="btn-action btn-download"
                      >
                        <Download size={14} /> Download
                      </button>
                      <button
                        onClick={() => handleDelete(doc)}
                        className="btn-action btn-delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Documents;
