import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import GPSMap from '../components/GPSMap';
import { Dropdown, DropdownItem } from '../components/Dropdown';
import { storeService } from '../services/apiService';
import './Users.css';
import './Products.css';
import './Visits.css';
import './Stores.css';

const Stores = () => {
  const [stores, setStores] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [viewingStore, setViewingStore] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    address: '',
    city: '',
    phone: '',
    latitude: '',
    longitude: '',
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const itemsPerPage = 10;

  useEffect(() => {
    fetchStores();
  }, [currentPage]);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const data = await storeService.getStores({ 
        page: currentPage, 
        page_size: itemsPerPage 
      });
      setStores(data.results ?? []);
      setCount(data.count ?? 0);
      setError('');
    } catch (err) {
      setError('Failed to fetch stores. Please check your connection.');
      console.error('Error fetching stores:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleOpenAddModal = () => {
    setEditingStore(null);
    setFormData({
      name: '',
      address: '',
      city: '',
      phone: '',
      latitude: '',
      longitude: '',
    });
    setFormError('');
    setShowModal(true);
  };

  const handleOpenEditModal = (store) => {
    setEditingStore(store);
    setFormData({
      code: store.code || '',
      name: store.name || '',
      address: store.address || '',
      city: store.city || '',
      phone: store.phone || '',
      latitude: store.latitude || '',
      longitude: store.longitude || '',
    });
    setFormError('');
    setShowModal(true);
  };

  const handleOpenViewModal = (store) => {
    setViewingStore(store);
    setShowViewModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setShowViewModal(false);
    setEditingStore(null);
    setViewingStore(null);
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    if (!formData.name || !formData.address) {
      setFormError('Name and Address are required');
      setSubmitting(false);
      return;
    }

    try {
      const resolvedCode = (editingStore?.code || formData.code || '').toString().trim() || `STR-${Date.now().toString().slice(-6)}`;
      const payload = {
        code: resolvedCode,
        name: formData.name.trim(),
        address: formData.address.trim(),
      };

      // Only add optional fields if they have values
      if (formData.city && formData.city.trim()) {
        payload.city = formData.city.trim();
      }
      
      if (formData.phone && formData.phone.trim()) {
        payload.phone = formData.phone.trim();
      }
      
      if (formData.latitude && formData.latitude.toString().trim()) {
        const lat = parseFloat(formData.latitude);
        if (!isNaN(lat) && lat >= -90 && lat <= 90) {
          payload.latitude = lat;
        }
      }
      
      if (formData.longitude && formData.longitude.toString().trim()) {
        const lng = parseFloat(formData.longitude);
        if (!isNaN(lng) && lng >= -180 && lng <= 180) {
          payload.longitude = lng;
        }
      }

      console.log('Sending payload:', payload);

      if (editingStore) {
        await storeService.updateStore(editingStore.id, payload);
        setSuccessMessage('Store updated successfully!');
      } else {
        await storeService.createStore(payload);
        setSuccessMessage('Store created successfully!');
      }

      setTimeout(() => setSuccessMessage(''), 3000);
      setShowModal(false);
      await fetchStores();
    } catch (err) {
      console.error('Error saving store:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      
      // Extract detailed error message
      let errorMessage = 'Failed to save store';
      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        } else if (err.response.data.detail) {
          errorMessage = err.response.data.detail;
        } else if (err.response.data.message) {
          errorMessage = err.response.data.message;
        } else {
          // Show field-specific errors
          const fieldErrors = Object.entries(err.response.data)
            .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
            .join('; ');
          if (fieldErrors) errorMessage = fieldErrors;
        }
      }
      
      setFormError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete store "${name}"?`)) {
      return;
    }

    try {
      await storeService.deleteStore(id);
      setSuccessMessage('Store deleted successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      await fetchStores();
    } catch (err) {
      console.error('Error deleting store:', err);
      setError('Failed to delete store');
      setTimeout(() => setError(''), 3000);
    }
  };

  const totalPages = Math.ceil(count / itemsPerPage);

  const renderStoreActions = (store) => (
    <Dropdown>
      <DropdownItem onClick={() => handleOpenViewModal(store)}>View Details</DropdownItem>
      <DropdownItem onClick={() => handleOpenEditModal(store)}>Edit Info</DropdownItem>
      <DropdownItem onClick={() => handleDelete(store.id, store.name)} className="danger">Delete</DropdownItem>
    </Dropdown>
  );

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <div className="page-container">
          <div className="page-header">
            <div>
              <h1>Stores Management</h1>
              <p>Manage store locations ({count} total)</p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div className="view-toggle">
                <button
                  className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  List
                </button>
                <button
                  className={`toggle-btn ${viewMode === 'map' ? 'active' : ''}`}
                  onClick={() => setViewMode('map')}
                >
                  Map
                </button>
              </div>
              <button className="add-btn" onClick={handleOpenAddModal}>
                + Add Store
              </button>
            </div>
          </div>

          {successMessage && (
            <div className="success-message">
              {successMessage}
            </div>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {loading ? (
            <div className="loading">Loading stores...</div>
          ) : viewMode === 'map' ? (
            <div className="map-view-container">
              <GPSMap externalStores={stores} />
            </div>
          ) : (
            <>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Address</th>
                      <th>City</th>
                      <th>Phone</th>
                      <th aria-label="More actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {stores.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="no-data">
                          No stores found. Click "Add Store" to create one.
                        </td>
                      </tr>
                    ) : (
                      stores.map((store) => (
                        <tr key={store.id}>
                          <td>{store.id}</td>
                          <td>{store.name}</td>
                          <td>{store.address || 'N/A'}</td>
                          <td>{store.city || 'N/A'}</td>
                          <td>{store.phone || '--'}</td>
                          <td>{renderStoreActions(store)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="pagination stores-pagination-bottom">
                  <button
                    className="page-btn"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  <span className="pagination-info">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    className="page-btn"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingStore ? 'Edit Info' : 'Add New Store'}</h2>
              <button className="close-btn" onClick={handleCloseModal}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-body">
                {formError && (
                  <div className="form-error">{formError}</div>
                )}
                
                <div className="form-group">
                  <label htmlFor="name">Store Name </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter store name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="address">Address </label>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Enter store address"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="city">City</label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="Enter city"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="phone">Phone</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="Enter phone number"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="latitude">Latitude</label>
                    <input
                      type="number"
                      id="latitude"
                      name="latitude"
                      value={formData.latitude}
                      onChange={handleInputChange}
                      placeholder="e.g., 36.8065"
                      step="any"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="longitude">Longitude</label>
                    <input
                      type="number"
                      id="longitude"
                      name="longitude"
                      value={formData.longitude}
                      onChange={handleInputChange}
                      placeholder="e.g., 10.1815"
                      step="any"
                    />
                  </div>
                </div>

                {/* Tip removed as requested */}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={submitting}>
                  {submitting ? 'Saving...' : (editingStore ? 'Update Store' : 'Create Store')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && viewingStore && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content store-view-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Store Details</h2>
              <button className="close-btn" onClick={handleCloseModal}>×</button>
            </div>
            <div className="store-view-details">
              <div className="store-detail-card compact">
                <span className="store-detail-label">Store ID</span>
                <span className="store-detail-value">#{viewingStore.id}</span>
              </div>
              <div className="store-detail-card">
                <span className="store-detail-label">Store Code</span>
                <span className="store-detail-value">{viewingStore.code || '--'}</span>
              </div>
              <div className="store-detail-card">
                <span className="store-detail-label">Name</span>
                <span className="store-detail-value">{viewingStore.name || '--'}</span>
              </div>
              <div className="store-detail-card full-width">
                <span className="store-detail-label">Address</span>
                <span className="store-detail-value">{viewingStore.address || '--'}</span>
              </div>
              <div className="store-detail-card">
                <span className="store-detail-label">City</span>
                <span className="store-detail-value">{viewingStore.city || '--'}</span>
              </div>
              <div className="store-detail-card">
                <span className="store-detail-label">Phone</span>
                <span className="store-detail-value">{viewingStore.phone || '--'}</span>
              </div>
              <div className="store-detail-card">
                <span className="store-detail-label">Latitude</span>
                <span className="store-detail-value">{viewingStore.latitude || '--'}</span>
              </div>
              <div className="store-detail-card">
                <span className="store-detail-label">Longitude</span>
                <span className="store-detail-value">{viewingStore.longitude || '--'}</span>
              </div>
              {viewingStore.latitude && viewingStore.longitude && (
                <div className="store-detail-card full-width">
                  <span className="store-detail-label">Location</span>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${viewingStore.latitude}&mlon=${viewingStore.longitude}&zoom=15`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="store-map-link"
                  >
                    Open in OpenStreetMap
                  </a>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleCloseModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stores;
