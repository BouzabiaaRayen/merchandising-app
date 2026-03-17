import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { authService } from '../services/apiService';
import { getAvatarUrl } from '../services/supabaseClient';
import { Lock, Calendar } from 'lucide-react';
import './Profile.css';

const Profile = () => {
  const [activeTab, setActiveTab] = useState('personal');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    bio: '',
    jobTitle: '',
    department: '',
    employeeId: '',
    dateJoined: '',
    regionalAdmin: '',
    language: 'English (United States)',
    timezone: '(GMT-08:00) Pacific Time',
    emailNotifications: true,
    weeklyReport: false,
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Fetch user profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  // Debug avatar preview changes
  useEffect(() => {
    console.log('👁️ Avatar preview state changed:', avatarPreview);
    
    // Test if the URL is accessible
    if (avatarPreview) {
      console.log('🧪 Testing if avatar URL is accessible...');
      console.log('   Full URL:', avatarPreview);
      console.log('   URL breakdown:');
      try {
        const url = new URL(avatarPreview);
        console.log('   - Protocol:', url.protocol);
        console.log('   - Host:', url.hostname);
        console.log('   - Path:', url.pathname);
        console.log('   - Search:', url.search);
      } catch (e) {
        console.error('   Invalid URL format:', e);
      }
      
      fetch(avatarPreview, { method: 'HEAD', mode: 'cors' })
        .then(response => {
          console.log('📡 Avatar URL response:');
          console.log('   Status:', response.status);
          console.log('   Status Text:', response.statusText);
          console.log('   OK:', response.ok);
          console.log('   Content-Type:', response.headers.get('content-type'));
          console.log('   Access-Control-Allow-Origin:', response.headers.get('access-control-allow-origin'));
          if (response.status === 400) {
            console.error('❌ 400 Bad Request - The URL format or bucket configuration is incorrect');
            console.error('   Common causes:');
            console.error('   1. Wrong bucket name (check case sensitivity)');
            console.error('   2. File does not exist at this path');
            console.error('   3. Incorrect Supabase Storage URL structure');
          } else if (!response.ok) {
            console.error('❌ Avatar URL returned error status:', response.status);
          }
        })
        .catch(error => {
          console.error('❌ Failed to fetch avatar URL:', error);
          console.error('   This might be a CORS issue or the URL is not accessible');
        });
    }
  }, [avatarPreview]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const profile = await authService.getProfile();
      
      console.log('=== PROFILE DEBUG ===');
      console.log('Full profile object:', JSON.stringify(profile, null, 2));
      console.log('profile.avatar:', profile.avatar);
      console.log('profile.avatar_url:', profile.avatar_url);
      console.log('All profile keys:', Object.keys(profile));
      console.log('===================');
      
      setFormData({
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        bio: profile.bio || '',
        jobTitle: profile.job_title || '',
        department: profile.department || '',
        employeeId: profile.employee_id || profile.username || '',
        dateJoined: profile.date_joined ? new Date(profile.date_joined).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '',
        regionalAdmin: profile.supervisor_name || 'N/A',
        language: profile.language || 'English (United States)',
        timezone: profile.timezone || '(GMT-08:00) Pacific Time',
        emailNotifications: profile.email_notifications ?? true,
        weeklyReport: profile.weekly_report ?? false,
      });

      // Set avatar preview from the 'avatars' storage bucket
      const rawAvatar = profile.avatar_url || profile.avatar;
      const avatarUrl = getAvatarUrl(rawAvatar);
      if (avatarUrl) {
        console.log('✅ Setting avatar from avatars bucket:', avatarUrl);
        setAvatarPreview(avatarUrl);
      } else {
        console.log('❌ No avatar found in profile data');
        setAvatarPreview(null);
      }

      // Update localStorage with profile data including resolved avatar URL
      localStorage.setItem('user', JSON.stringify({ ...profile, avatar_url: avatarUrl }));
      
      // Notify other components (like Navbar) that profile was updated
      window.dispatchEvent(new Event('profileUpdated'));
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to load profile:', error);
      setErrorMessage('Failed to load profile data');
      setLoading(false);
      
      // Try to load basic info from localStorage as fallback (but not avatar)
      const cachedUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (cachedUser.username) {
        setFormData(prev => ({
          ...prev,
          firstName: cachedUser.first_name || '',
          lastName: cachedUser.last_name || '',
          email: cachedUser.email || '',
        }));
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData({
      ...passwordData,
      [name]: value,
    });
  };

  const handleAvatarSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Please select an image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage('Image size must be less than 5MB');
        return;
      }

      setAvatarFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;

    let progressInterval = null; // Declare outside try block

    try {
      setUploading(true);
      setUploadProgress(0);
      setErrorMessage('');

      console.log('=== STARTING AVATAR UPLOAD ===');
      console.log('File name:', avatarFile.name);
      console.log('File type:', avatarFile.type);
      console.log('File size:', avatarFile.size, 'bytes');
      console.log('=============================');

      // Simulate progress (in real scenario, use axios progress event)
      progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      const updatedProfile = await authService.uploadAvatar(avatarFile);
      
      console.log('=== UPLOAD RESPONSE DEBUG ===');
      console.log('Full upload response:', JSON.stringify(updatedProfile, null, 2));
      console.log('updatedProfile.avatar:', updatedProfile.avatar);
      console.log('updatedProfile.avatar_url:', updatedProfile.avatar_url);
      console.log('All response keys:', Object.keys(updatedProfile));
      console.log('============================');
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      // Update avatar preview from the 'avatars' storage bucket
      const rawAvatar = updatedProfile.avatar_url || updatedProfile.avatar;
      const avatarUrl = getAvatarUrl(rawAvatar);
      if (avatarUrl) {
        console.log('✅ Setting uploaded avatar from avatars bucket:', avatarUrl);
        setAvatarPreview(avatarUrl);
        
        // Update localStorage and notify other components
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const cleanedProfile = {
          ...currentUser,
          avatar_url: avatarUrl,
          avatar: updatedProfile.avatar || null
        };
        localStorage.setItem('user', JSON.stringify(cleanedProfile));
        window.dispatchEvent(new Event('profileUpdated'));
      } else {
        console.log('❌ No avatar URL in upload response');
      }

      setSuccessMessage('Avatar uploaded to Supabase Storage successfully!');
      setTimeout(() => {
        setSuccessMessage('');
        setUploadProgress(0);
        setAvatarFile(null);
      }, 3000);

      setUploading(false);
    } catch (error) {
      clearInterval(progressInterval);
      console.error('=== UPLOAD ERROR ===');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response);
      console.error('Response status:', error.response?.status);
      console.error('Response data:', error.response?.data);
      console.error('Response headers:', error.response?.headers);
      console.error('==================');
      
      // Better error messages
      let errorMsg = 'Failed to upload avatar';
      if (error.response?.status === 413) {
        errorMsg = 'File is too large. Please use a smaller image.';
      } else if (error.response?.status === 400) {
        errorMsg = error.response?.data?.avatar?.[0] || error.response?.data?.detail || 'Invalid file format or size';
      } else if (error.response?.status === 500) {
        errorMsg = 'Server error. Check backend configuration.';
      } else if (error.response?.data) {
        errorMsg = error.response.data.avatar?.[0] || error.response.data.detail || error.response.data.message || errorMsg;
      }
      
      setErrorMessage(errorMsg);
      setUploadProgress(0);
      setUploading(false);
    }
  };

  const handleSaveChanges = async () => {
    try {
      setSaving(true);
      setErrorMessage('');
      setSuccessMessage('');

      // Upload avatar first if there's a new one
      if (avatarFile) {
        await handleAvatarUpload();
      }

      // Prepare data for API
      const updateData = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        bio: formData.bio,
        job_title: formData.jobTitle,
        department: formData.department,
        language: formData.language,
        timezone: formData.timezone,
        email_notifications: formData.emailNotifications,
        weekly_report: formData.weeklyReport,
      };

      await authService.updateProfile(updateData);
      
      // Reload the complete profile to ensure we have the latest data including avatar
      await loadProfile();

      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      setSaving(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to update profile');
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setErrorMessage('New passwords do not match');
        return;
      }

      if (passwordData.newPassword.length < 8) {
        setErrorMessage('Password must be at least 8 characters');
        return;
      }

      setErrorMessage('');
      setSaving(true);

      await authService.changePassword(passwordData.currentPassword, passwordData.newPassword);

      setSuccessMessage('Password changed successfully!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      
      setTimeout(() => setSuccessMessage(''), 3000);
      setSaving(false);
    } catch (error) {
      console.error('Failed to change password:', error);
      setErrorMessage(error.response?.data?.old_password?.[0] || error.response?.data?.new_password?.[0] || 'Failed to change password');
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    loadProfile();
    setAvatarFile(null);
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setSuccessMessage('Changes discarded');
    setTimeout(() => setSuccessMessage(''), 2000);
  };

  const handleCancel = () => {
    window.history.back();
  };

  const getUserInitials = () => {
    const firstName = formData.firstName || '';
    const lastName = formData.lastName || '';
    if (firstName || lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    return formData.email?.substring(0, 2).toUpperCase() || 'U';
  };

  const getUserFullName = () => {
    const firstName = formData.firstName || '';
    const lastName = formData.lastName || '';
    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim();
    }
    return formData.email || 'User';
  };

  if (loading) {
    return (
      <div className="app">
        <Sidebar />
        <div className="main-content">
          <Navbar />
          <div className="page-container">
            <div className="loading">Loading profile...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="page-container">
          <div className="profile-header">
            <div>
              <h1>{getUserFullName()} Profile Settings</h1>
              <p>Manage your professional identity, security protocols and personal preferences</p>
            </div>
            <div className="header-actions">
              <button className="btn-cancel-header" onClick={handleCancel}>Cancel</button>
              <button 
                className="btn-save-header" 
                onClick={handleSaveChanges}
                disabled={saving}
              >
                <span>💾</span> {saving ? 'Saving...' : 'Save All Changes'}
              </button>
            </div>
          </div>

          {successMessage && (
            <div className="success-message-profile">
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="error-message-profile">
              {errorMessage}
            </div>
          )}

          <div className="profile-tabs">
            <button
              className={`tab-btn ${activeTab === 'personal' ? 'active' : ''}`}
              onClick={() => setActiveTab('personal')}
            >
              <span>👤</span> Personal Profile
            </button>
            <button
              className={`tab-btn ${activeTab === 'work' ? 'active' : ''}`}
              onClick={() => setActiveTab('work')}
            >
              <span>💼</span> Work Details
            </button>
            <button
              className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <span>🔒</span> Security
            </button>
            <button
              className={`tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
              onClick={() => setActiveTab('preferences')}
            >
              <span>⚙️</span> Preferences
            </button>
          </div>

          <div className="profile-content">
            {/* Personal Profile Tab */}
            {activeTab === 'personal' && (
              <div className="profile-section">
                <div className="profile-layout">
                  <div className="profile-avatar-section">
                    <div className="avatar-container">
                      <div className="avatar-large">
                        {avatarPreview ? (
                          <img 
                            src={avatarPreview} 
                            alt="Avatar" 
                            className="avatar-image"
                            onLoad={() => {
                              console.log('✅ Avatar image loaded successfully');
                              console.log('   URL:', avatarPreview);
                            }}
                            onError={(e) => {
                              console.error('❌ Failed to load avatar image');
                              console.error('   URL:', avatarPreview);
                              console.error('   Error type:', e.type);
                              console.error('   Target:', e.target);
                              console.log('🔍 Debugging info:');
                              console.log('   - Check if URL is accessible in new tab');
                              console.log('   - Check browser Network tab for CORS errors');
                              console.log('   - Check if Supabase bucket is public');
                              console.log('   - Try accessing:', avatarPreview);
                            }}
                            crossOrigin="anonymous"
                          />
                        ) : (
                          <span>{getUserInitials()}</span>
                        )}
                      </div>
                      <input
                        type="file"
                        id="avatar-upload"
                        accept="image/*"
                        onChange={handleAvatarSelect}
                        style={{ display: 'none' }}
                      />
                      <button 
                        className="edit-avatar-btn"
                        onClick={() => document.getElementById('avatar-upload').click()}
                        disabled={uploading}
                      >
                        ✏️
                      </button>
                    </div>
                    
                    {avatarFile && (
                      <button 
                        className="upload-avatar-btn"
                        onClick={handleAvatarUpload}
                        disabled={uploading}
                      >
                        {uploading ? 'Uploading...' : 'Upload Avatar'}
                      </button>
                    )}

                    {(uploadProgress > 0 || uploading) && (
                      <div className="upload-progress">
                        <label>Avatar Upload Progress</label>
                        <div className="progress-bar-container">
                          <div className="progress-bar" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                        <span className="progress-text">{uploadProgress}%</span>
                      </div>
                    )}
                  </div>

                  <div className="profile-fields">
                    <div className="form-row-profile">
                      <div className="form-group-profile">
                        <label>First Name</label>
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="form-group-profile">
                        <label>Last Name</label>
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>

                    <div className="form-row-profile">
                      <div className="form-group-profile">
                        <label>Email Address</label>
                        <div className="input-with-icon">
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                          />
                          <span className="input-icon"><Lock size={15} /></span>
                        </div>
                      </div>
                      <div className="form-group-profile">
                        <label>Phone Number</label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>

                    <div className="form-group-profile full-width">
                      <label>Bio / About Yourself</label>
                      <textarea
                        name="bio"
                        value={formData.bio}
                        onChange={handleInputChange}
                        rows="4"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Work Details Tab */}
            {activeTab === 'work' && (
              <div className="profile-section">
                <div className="section-header-inline">
                  <h3>💼 Work Details</h3>
                  <button className="action-employee-btn">ACTIVE EMPLOYEE</button>
                </div>

                <div className="work-details-grid">
                  <div className="form-group-profile">
                    <label>JOB TITLE</label>
                    <input
                      type="text"
                      name="jobTitle"
                      value={formData.jobTitle}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group-profile">
                    <label>DEPARTMENT</label>
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                    >
                      <option>Operations</option>
                      <option>Sales</option>
                      <option>Marketing</option>
                      <option>Finance</option>
                    </select>
                  </div>
                  <div className="form-group-profile">
                    <label>EMPLOYEE ID</label>
                    <input
                      type="text"
                      name="employeeId"
                      value={formData.employeeId}
                      onChange={handleInputChange}
                      disabled
                    />
                  </div>
                  <div className="form-group-profile">
                    <label>DATE JOINED</label>
                    <div className="input-with-icon">
                      <input
                        type="text"
                        name="dateJoined"
                        value={formData.dateJoined}
                        onChange={handleInputChange}
                        disabled
                      />
                      <span className="input-icon"><Calendar size={15} /></span>
                    </div>
                  </div>
                </div>

                <div className="reporting-structure">
                  <div className="form-group-profile">
                    <label>Regional Admin</label>
                    <input
                      type="text"
                      name="regionalAdmin"
                      value={formData.regionalAdmin}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="profile-section">
                <div className="section-header-inline">
                  <h3>🔒 Security</h3>
                </div>
                <div className="security-section">
                  <div className="form-group-profile">
                    <label>Current Password</label>
                    <input 
                      type="password" 
                      name="currentPassword"
                      placeholder="Enter current password"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                    />
                  </div>
                  <div className="form-group-profile">
                    <label>New Password</label>
                    <input 
                      type="password" 
                      name="newPassword"
                      placeholder="Enter new password"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                    />
                  </div>
                  <div className="form-group-profile">
                    <label>Confirm New Password</label>
                    <input 
                      type="password" 
                      name="confirmPassword"
                      placeholder="Confirm new password"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                    />
                  </div>
                  <button 
                    className="btn-change-password"
                    onClick={handleChangePassword}
                    disabled={saving || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                  >
                    {saving ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </div>
            )}

            {/* Preferences Tab */}
            {activeTab === 'preferences' && (
              <div className="profile-section">
                <div className="section-header-inline">
                  <h3>⚙️ Preferences</h3>
                </div>

                <div className="preferences-layout">
                  <div className="preferences-column">
                    <div className="form-group-profile">
                      <label>Language Preference</label>
                      <p className="field-description">Select your language for the admin interface</p>
                      <select
                        name="language"
                        value={formData.language}
                        onChange={handleInputChange}
                      >
                        <option>English (United States)</option>
                        <option>Spanish</option>
                        <option>French</option>
                        <option>German</option>
                      </select>
                    </div>

                    <div className="form-group-profile">
                      <label>Timezone</label>
                      <select
                        name="timezone"
                        value={formData.timezone}
                        onChange={handleInputChange}
                      >
                        <option>(GMT-08:00) Pacific Time</option>
                        <option>(GMT-05:00) Eastern Time</option>
                        <option>(GMT-06:00) Central Time</option>
                        <option>(GMT-07:00) Mountain Time</option>
                      </select>
                    </div>
                  </div>

                  <div className="preferences-column">
                    <div className="form-group-profile">
                      <label>Communication Settings</label>
                      <div className="checkbox-group">
                        <label className="checkbox-label-custom">
                          <input
                            type="checkbox"
                            name="emailNotifications"
                            checked={formData.emailNotifications}
                            onChange={handleInputChange}
                          />
                          <span className="checkbox-custom"></span>
                          <div>
                            <strong>Email Notifications</strong>
                            <p>Receive urgent news via email</p>
                          </div>
                        </label>
                        <label className="checkbox-label-custom">
                          <input
                            type="checkbox"
                            name="weeklyReport"
                            checked={formData.weeklyReport}
                            onChange={handleInputChange}
                          />
                          <span className="checkbox-custom"></span>
                          <div>
                            <strong>Weekly Report</strong>
                            <p>Receive digest news Monday</p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="profile-footer">
            <button className="btn-discard" onClick={handleDiscard} disabled={saving}>
              Discard Changes
            </button>
            <button className="btn-save-footer" onClick={handleSaveChanges} disabled={saving}>
              <span>💾</span> {saving ? 'Saving...' : 'Save All Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
