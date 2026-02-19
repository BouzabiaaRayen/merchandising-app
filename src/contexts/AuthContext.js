import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService, userService } from '../services/apiService';

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
      const data = await authService.login(username, password);
      await AsyncStorage.setItem('accessToken', data.access);
      await AsyncStorage.setItem('refreshToken', data.refresh);

      const profile = await authService.getProfile();
      await AsyncStorage.setItem('user', JSON.stringify(profile));
      setUser(profile);

      return { success: true };
    } catch (error) {
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

  const value = {
    user,
    loading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
