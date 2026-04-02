/**
 * Shared API client: base URL from .env (app.config.js), auth header and token refresh.
 * Use this instance or the wrappers in apiService.js for all API calls.
 */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const normalizeApiBaseUrl = (url) => {
  if (!url) return null;
  const trimmed = String(url).trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/api/v1')) return trimmed;
  if (trimmed.endsWith('/api')) return `${trimmed}/v1`;
  return `${trimmed}/api/v1`;
};

const resolveRuntimeApiUrl = () => {
  const explicitEnvUrl = process.env.EXPO_PUBLIC_API_URL || process.env.API_URL;
  const configuredUrl = Constants.expoConfig?.extra?.apiUrl;

  const normalizedExplicitEnvUrl = normalizeApiBaseUrl(explicitEnvUrl);
  if (normalizedExplicitEnvUrl) {
    return normalizedExplicitEnvUrl;
  }

  const normalizedConfiguredUrl = normalizeApiBaseUrl(configuredUrl);
  if (normalizedConfiguredUrl) {
    const isLocalhostConfigured = /:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(normalizedConfiguredUrl);
    if (!isLocalhostConfigured || Platform.OS === 'web') {
      return normalizedConfiguredUrl;
    }
  }

  if (Platform.OS === 'web') {
    return 'http://localhost:8000/api/v1';
  }

  const hostCandidate =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost;

  const hostFromExpo = hostCandidate?.split(':')?.[0];

  if (hostFromExpo && !['localhost', '127.0.0.1'].includes(hostFromExpo)) {
    return `http://${hostFromExpo}:8000/api/v1`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api/v1';
  }

  return 'http://localhost:8000/api/v1';
};

const API_BASE_URL = resolveRuntimeApiUrl();

console.log('API_BASE_URL:', API_BASE_URL);

// Export base URL (without /api/v1) for WebSocket connections
export const getWebSocketBaseUrl = () => {
  return API_BASE_URL.replace(/\/api\/v1\/?$/, '');
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const isAuthEndpointRequest = (requestUrl = '') =>
  /\/users\/auth\/(login|refresh|verify)\/?$/i.test(requestUrl);

// Request interceptor to add token & handle FormData
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Don't set Content-Type for FormData — let axios handle it
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = `${originalRequest?.baseURL || ''}${originalRequest?.url || ''}`;
    const isAuthRequest = isAuthEndpointRequest(requestUrl);

    console.log(
      'API Error:',
      error.response?.status,
      error.response?.data,
      error.message,
      'code=',
      error.code,
      'url=',
      `${error.config?.baseURL || ''}${error.config?.url || ''}`
    );

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthRequest) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        
        // Don't attempt refresh if we don't have a refresh token
        if (!refreshToken) {
          await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
          return Promise.reject(error);
        }
        
        const response = await axios.post(`${API_BASE_URL}/users/auth/refresh/`, {
          refresh: refreshToken,
        });

        const { access } = response.data;
        await AsyncStorage.setItem('accessToken', access);

        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
