import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService, userService } from '../services/apiService';
import { getAvatarUrl } from '../services/supabaseClient';

// Utility to clear AsyncStorage for debugging or resetting auth state
export const clearAuthStorage = async () => {
  try {
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
    console.log('Auth storage cleared.');
  } catch (error) {
    console.error('Error clearing auth storage:', error);
  }
};

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      const token = await AsyncStorage.getItem('accessToken');
      if (userStr && token) {
        setUser(JSON.parse(userStr));
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      console.log('Attempting login for:', username);
      const data = await authService.login(username, password);
      console.log('Login API response received');
      await AsyncStorage.setItem('accessToken', data.access);
      await AsyncStorage.setItem('refreshToken', data.refresh);

      console.log('Fetching user profile...');
      const profile = await authService.getProfile();
      console.log('User profile received:', profile);
      // Resolve avatar URL from the 'avatars' bucket
      const avatarUrl = getAvatarUrl(profile.avatar_url || profile.avatar);
      const profileWithAvatar = { ...profile, avatar_url: avatarUrl };
      await AsyncStorage.setItem('user', JSON.stringify(profileWithAvatar));
      setUser(profileWithAvatar);
      console.log('User state updated, should redirect now');

      return { success: true };
    } catch (error) {
      console.error('Login error:', error.response?.status, error.response?.data, error.message);
      if (!error.response) {
        return {
          success: false,
          error: 'Cannot reach server. Make sure the backend is running and reachable.',
        };
      }
      const status = error.response.status;
      if (status === 401) {
        return { success: false, error: 'Invalid username or password.' };
      }
      const detail = error.response?.data?.detail || error.response?.data?.non_field_errors?.[0];
      return { success: false, error: detail || `Server error (${status})` };
    }
  };

  const register = async (userData) => {
    try {
      await userService.createUser(userData);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || 'Registration failed',
      };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
      setUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const refreshUser = async () => {
    try {
      const profile = await authService.getProfile();
      const avatarUrl = getAvatarUrl(profile.avatar_url || profile.avatar);
      const profileWithAvatar = { ...profile, avatar_url: avatarUrl };
      await AsyncStorage.setItem('user', JSON.stringify(profileWithAvatar));
      setUser(profileWithAvatar);
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
