/**
 * API service layer for backoffice — all domain services.
 * Uses the shared axios instance from api.js (base URL, auth header, token refresh).
 *
 * Base URL: /api/v1/
 * All list endpoints return { count, next, previous, results }
 */
import api from './api';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const authService = {
  login: (username, password) =>
    api.post('/users/auth/login/', { username, password }).then(r => r.data),

  refresh: (refresh) =>
    api.post('/users/auth/refresh/', { refresh }).then(r => r.data),

  verify: (token) =>
    api.post('/users/auth/verify/', { token }).then(r => r.data),

  getProfile: () =>
    api.get('/users/profile/').then(r => r.data),

  updateProfile: (data) =>
    api.patch('/users/profile/', data).then(r => r.data),

  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.patch('/users/profile/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }).then(r => r.data);
  },

  changePassword: (oldPassword, newPassword) =>
    api.post('/users/change_password/', {
      old_password: oldPassword,
      new_password: newPassword,
    }).then(r => r.data),
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export const userService = {
  getUsers: (params = {}) =>
    api.get('/users/', { params }).then(r => r.data),

  getUser: (id) =>
    api.get(`/users/${id}/`).then(r => r.data),

  createUser: (data) =>
    api.post('/users/', data).then(r => r.data),

  updateUser: (id, data) =>
    api.put(`/users/${id}/`, data).then(r => r.data),

  patchUser: (id, data) =>
    api.patch(`/users/${id}/`, data).then(r => r.data),

  deleteUser: (id) =>
    api.delete(`/users/${id}/`).then(r => r.data),

  activateUser: (id) =>
    api.post(`/users/${id}/activate/`).then(r => r.data),

  deactivateUser: (id) =>
    api.post(`/users/${id}/deactivate/`).then(r => r.data),
};

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------
export const storeService = {
  getStores: (params = {}) =>
    api.get('/merchandising/stores/', { params }).then(r => r.data),

  getStore: (id) =>
    api.get(`/merchandising/stores/${id}/`).then(r => r.data),

  createStore: (data) =>
    api.post('/merchandising/stores/', data).then(r => r.data),

  updateStore: (id, data) =>
    api.put(`/merchandising/stores/${id}/`, data).then(r => r.data),

  patchStore: (id, data) =>
    api.patch(`/merchandising/stores/${id}/`, data).then(r => r.data),

  deleteStore: (id) =>
    api.delete(`/merchandising/stores/${id}/`).then(r => r.data),
};

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
export const productService = {
  getProducts: (params = {}) =>
    api.get('/merchandising/products/', { params }).then(r => r.data),

  getProduct: (id) =>
    api.get(`/merchandising/products/${id}/`).then(r => r.data),

  createProduct: (data) =>
    api.post('/merchandising/products/', data).then(r => r.data),

  updateProduct: (id, data) =>
    api.put(`/merchandising/products/${id}/`, data).then(r => r.data),

  patchProduct: (id, data) =>
    api.patch(`/merchandising/products/${id}/`, data).then(r => r.data),

  deleteProduct: (id) =>
    api.delete(`/merchandising/products/${id}/`).then(r => r.data),
};

// ---------------------------------------------------------------------------
// Visits
// ---------------------------------------------------------------------------
export const visitService = {
  getVisits: (params = {}) =>
    api.get('/merchandising/visits/', { params }).then(r => r.data),

  getVisit: (id) =>
    api.get(`/merchandising/visits/${id}/`).then(r => r.data),

  createVisit: (data) =>
    api.post('/merchandising/visits/', data).then(r => r.data),

  updateVisit: (id, data) =>
    api.put(`/merchandising/visits/${id}/`, data).then(r => r.data),

  patchVisit: (id, data) =>
    api.patch(`/merchandising/visits/${id}/`, data).then(r => r.data),

  deleteVisit: (id) =>
    api.delete(`/merchandising/visits/${id}/`).then(r => r.data),

  checkIn: (id) =>
    api.post(`/merchandising/visits/${id}/check_in/`).then(r => r.data),

  checkOut: (id, notes = '') =>
    api.post(`/merchandising/visits/${id}/check_out/`, { notes }).then(r => r.data),

  cancel: (id, reason = '') =>
    api.post(`/merchandising/visits/${id}/cancel/`, { reason }).then(r => r.data),
};

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------
export const inventoryService = {
  getInventory: (params = {}) =>
    api.get('/merchandising/inventory/', { params }).then(r => r.data),

  getInventoryItem: (id) =>
    api.get(`/merchandising/inventory/${id}/`).then(r => r.data),

  createInventoryItem: (data) =>
    api.post('/merchandising/inventory/', data).then(r => r.data),

  updateInventoryItem: (id, data) =>
    api.put(`/merchandising/inventory/${id}/`, data).then(r => r.data),

  patchInventoryItem: (id, data) =>
    api.patch(`/merchandising/inventory/${id}/`, data).then(r => r.data),

  deleteInventoryItem: (id) =>
    api.delete(`/merchandising/inventory/${id}/`).then(r => r.data),

  restock: (id, quantity) =>
    api.post(`/merchandising/inventory/${id}/restock/`, { quantity }).then(r => r.data),

  reduce: (id, quantity) =>
    api.post(`/merchandising/inventory/${id}/reduce/`, { quantity }).then(r => r.data),
};

// ---------------------------------------------------------------------------
// GPS
// ---------------------------------------------------------------------------
export const gpsService = {
  getLocations: (params = {}) =>
    api.get('/merchandising/gps/', { params }).then(r => r.data),

  getLocation: (id) =>
    api.get(`/merchandising/gps/${id}/`).then(r => r.data),

  createLocation: (data) =>
    api.post('/merchandising/gps/', data).then(r => r.data),

  updateLocation: (id, data) =>
    api.put(`/merchandising/gps/${id}/`, data).then(r => r.data),

  patchLocation: (id, data) =>
    api.patch(`/merchandising/gps/${id}/`, data).then(r => r.data),

  deleteLocation: (id) =>
    api.delete(`/merchandising/gps/${id}/`).then(r => r.data),

  /** @param {{ latitude, longitude, visit, accuracy?, altitude?, speed?, heading? }} data */
  track: (data) =>
    api.post('/merchandising/gps/track/', data).then(r => r.data),
};

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export const notificationService = {
  getNotifications: (params = {}) =>
    api.get('/merchandising/notifications/', { params }).then(r => r.data),

  getNotification: (id) =>
    api.get(`/merchandising/notifications/${id}/`).then(r => r.data),

  createNotification: (data) =>
    api.post('/merchandising/notifications/', data).then(r => r.data),

  updateNotification: (id, data) =>
    api.put(`/merchandising/notifications/${id}/`, data).then(r => r.data),

  patchNotification: (id, data) =>
    api.patch(`/merchandising/notifications/${id}/`, data).then(r => r.data),

  deleteNotification: (id) =>
    api.delete(`/merchandising/notifications/${id}/`).then(r => r.data),

  markRead: (id) =>
    api.post(`/merchandising/notifications/${id}/mark_read/`).then(r => r.data),

  markAllRead: () =>
    api.post('/merchandising/notifications/mark_all_read/').then(r => r.data),

  getUnreadCount: () =>
    api.get('/merchandising/notifications/unread_count/').then(r => r.data),

  getUrgent: () =>
    api.get('/merchandising/notifications/urgent/').then(r => r.data),
};
