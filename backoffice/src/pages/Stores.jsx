import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import GPSMap from '../components/GPSMap';
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
      const payload = {
        name: formData.name,
        address: formData.address,
        city: formData.city || null,
        phone: formData.phone || null,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      };

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
      setFormError(err.response?.data?.detail || 'Failed to save store');
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

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Navbar />
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
                  📋 List
                </button>
                <button
                  className={`toggle-btn ${viewMode === 'map' ? 'active' : ''}`}
                  onClick={() => setViewMode('map')}
                >
                  🗺️ Map
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
                      <th>Coordinates</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stores.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="no-data">
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
                          <td>{store.phone || 'N/A'}</td>
                          <td>
                            {store.latitude && store.longitude
                              ? `${store.latitude}, ${store.longitude}`
                              : 'Not set'}
                          </td>
                          <td>
                            <button
                              className="action-btn view"
                              onClick={() => handleOpenViewModal(store)}
                              title="View Details"
                            >
                              👁️
                            </button>
                            <button
                              className="action-btn edit"
                              onClick={() => handleOpenEditModal(store)}
                              title="Edit Store"
                            >
                              ✏️
                            </button>
                            <button
                              className="action-btn delete"
                              onClick={() => handleDelete(store.id, store.name)}
                              title="Delete Store"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    className="page-btn"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  <span className="page-info">
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
              <h2>{editingStore ? 'Edit Store' : 'Add New Store'}</h2>
              <button className="close-btn" onClick={handleCloseModal}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-body">
                {formError && (
                  <div className="form-error">{formError}</div>
                )}
                
                <div className="form-group">
                  <label htmlFor="name">Store Name *</label>
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
                  <label htmlFor="address">Address *</label>
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

                <p className="form-hint">
                  💡 Tip: Coordinates are optional but recommended for map features
                </p>
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Store Details</h2>
              <button className="close-btn" onClick={handleCloseModal}>×</button>
            </div>
            <div className="view-details">
              <div className="detail-row">
                <span className="detail-label">ID:</span>
                <span className="detail-value">{viewingStore.id}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Name:</span>
                <span className="detail-value">{viewingStore.name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Address:</span>
                <span className="detail-value">{viewingStore.address || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">City:</span>
                <span className="detail-value">{viewingStore.city || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Phone:</span>
                <span className="detail-value">{viewingStore.phone || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Latitude:</span>
                <span className="detail-value">{viewingStore.latitude || 'Not set'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Longitude:</span>
                <span className="detail-value">{viewingStore.longitude || 'Not set'}</span>
              </div>
              {viewingStore.latitude && viewingStore.longitude && (
                <div className="detail-row">
                  <span className="detail-label">Map Link:</span>
                  <span className="detail-value">
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${viewingStore.latitude}&mlon=${viewingStore.longitude}&zoom=15`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="map-link"
                    >
                      View on OpenStreetMap 🗺️
                    </a>
                  </span>
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
