import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/apiService';
import { getAvatarUrl } from '../services/supabaseClient';
import './Login.css';

const Login = () => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { access, refresh } = await authService.login(
        credentials.username,
        credentials.password
      );

      localStorage.setItem('accessToken', access);
      localStorage.setItem('refreshToken', refresh);

      const profile = await authService.getProfile();
      console.log('=== LOGIN PROFILE DEBUG ===');
      console.log('Profile after login:', JSON.stringify(profile, null, 2));
      const avatarUrl = getAvatarUrl(profile.avatar_url || profile.avatar);
      console.log('Avatar URL (avatars bucket):', avatarUrl);
      console.log('=========================');
      localStorage.setItem('user', JSON.stringify({ ...profile, avatar_url: avatarUrl }));

      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      
      if (err.response?.status === 401) {
        setError('Invalid username or password. Please check your credentials.');
      } else if (err.message === 'Network Error' || !err.response) {
        setError('Cannot connect to the backend server. Please ensure the server is running.');
      } else {
        setError(
          err.response?.data?.detail ||
          err.response?.data?.message ||
          'Failed to login. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>Merchandising</h1>
          <p>Backoffice Login</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={credentials.username}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={credentials.password}
              onChange={handleChange}
              required
            />
          </div>

          <button type="submit" disabled={loading} className="login-btn">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
