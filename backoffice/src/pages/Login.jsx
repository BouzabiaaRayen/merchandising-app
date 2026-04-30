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
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
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

      // Only allow admin users to access the backoffice
      if (profile.role !== 'admin' && profile.role !== 'ADMIN') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setError('Accès refusé. Seuls les administrateurs peuvent accéder au backoffice.');
        return;
      }

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
            <label htmlFor="username">Email Address</label>
            <div className="input-with-icon">
              <input
                type="text"
                id="username"
                name="username"
                value={credentials.username}
                onChange={handleChange}
                required
                autoFocus
                aria-label="Email address"
              />
            </div>
          </div>

          <div className="form-group">
            <div className="label-row">
              <label htmlFor="password">Password</label>
              <a className="forgot-link" href="#" onClick={(e)=>{e.preventDefault(); /* TODO: forgot */}}>Forgot password?</a>
            </div>
            <div className="input-with-icon">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={credentials.password}
                onChange={handleChange}
                required
                placeholder="********"
                aria-label="Password"
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(s => !s)} aria-pressed={showPassword} aria-label="Show or hide password">
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="form-row small-row">
            <label className="checkbox-label">
              <input type="checkbox" checked={remember} onChange={(e)=>setRemember(e.target.checked)} />
              <span>Remember me for 30 days</span>
            </label>
          </div>

          <button type="submit" disabled={loading} className="login-btn">
            {loading ? 'Signing in...' : 'Sign In →'}
          </button>

          

          <div className="register-link">Don't have an account? <a href="#">Request Access</a></div>
        </form>
      </div>
    </div>
  );
};

export default Login;
