import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { brandService } from '../services/apiService';
import './Users.css';
import './Products.css';
import './CatalogManagement.css';

const createDefaultForm = () => ({
  name: '',
  type: 'OWN',
  description: '',
  is_active: true,
  logo: null,
  logoPreview: '',
});

const getErrorMessage = (error, fallback) => {
  const detail = error?.response?.data;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (detail.error) return detail.error;
  if (detail.detail) return detail.detail;
  return Object.entries(detail)
    .map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(', ') : value}`)
    .join('; ') || fallback;
};

const Brands = () => {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [formData, setFormData] = useState(createDefaultForm());
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchBrands();
  }, [searchTerm, typeFilter]);

  const fetchBrands = async () => {
    try {
      setLoading(true);
      const data = await brandService.getBrands({
        page_size: 1000,
        search: searchTerm || undefined,
        type: typeFilter || undefined,
      });
      setBrands(data.results ?? data);
      setError('');
    } catch (err) {
      setError('Failed to fetch brands.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(createDefaultForm());
    setFormError('');
    setEditingBrand(null);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEditModal = (brand) => {
    setEditingBrand(brand);
    setFormData({
      name: brand.name || '',
      type: brand.type || 'OWN',
      description: brand.description || '',
      is_active: brand.is_active ?? true,
      logo: null,
      logoPreview: brand.logo_url || '',
    });
    setFormError('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleLogoChange = (event) => {
    const file = event.target.files?.[0];
    setFormData((current) => ({
      ...current,
      logo: file || null,
      logoPreview: file ? URL.createObjectURL(file) : current.logoPreview,
    }));
  };

  const buildPayload = () => {
    const payload = new FormData();
    payload.append('name', formData.name.trim());
    payload.append('type', formData.type);
    payload.append('description', formData.description.trim());
    payload.append('is_active', formData.is_active ? 'true' : 'false');
    if (formData.logo) {
      payload.append('logo', formData.logo);
    }
    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Brand name is required.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');
      const payload = buildPayload();
      if (editingBrand) {
        await brandService.updateBrand(editingBrand.id, payload);
        setSuccessMessage('Brand updated successfully.');
      } else {
        await brandService.createBrand(payload);
        setSuccessMessage('Brand created successfully.');
      }
      setShowModal(false);
      resetForm();
      fetchBrands();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to save brand.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (brand) => {
    if (!window.confirm(`Delete brand "${brand.name}"?`)) {
      return;
    }

    try {
      await brandService.deleteBrand(brand.id);
      setSuccessMessage('Brand deleted successfully.');
      fetchBrands();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete brand.'));
      setTimeout(() => setError(''), 3000);
    }
  };

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="page-container">
          <div className="page-header">
            <div>
              <h1>Brand Management</h1>
              <p>Manage owner and competitor brands from one central catalog.</p>
            </div>
            <button className="add-btn" onClick={handleOpenAddModal}>+ Add Brand</button>
          </div>

          {successMessage && <div className="success-message">{successMessage}</div>}
          {error && <div className="error-message">{error}</div>}

          <div className="catalog-toolbar">
            <input
              className="catalog-search"
              type="search"
              placeholder="Search brands..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <div className="catalog-filters">
              <select className="catalog-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="">All brand types</option>
                <option value="OWN">Own brands</option>
                <option value="COMPETITOR">Competitor brands</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading">Loading brands...</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Brand</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {brands.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="no-data">No brands found.</td>
                    </tr>
                  ) : (
                    brands.map((brand) => (
                      <tr key={brand.id}>
                        <td>
                          <div className="catalog-name-cell">
                            {brand.logo_url ? (
                              <img src={brand.logo_url} alt={brand.name} className="catalog-thumb" />
                            ) : (
                              <div className="catalog-thumb-placeholder">LOGO</div>
                            )}
                            <div className="catalog-meta">
                              <strong>{brand.name}</strong>
                              <span>ID #{brand.id}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`catalog-type-badge ${brand.type === 'COMPETITOR' ? 'competitor' : 'own'}`}>
                            {brand.type === 'COMPETITOR' ? 'Competitor' : 'Own'}
                          </span>
                        </td>
                        <td>
                          <span className={`catalog-status-badge ${brand.is_active ? 'active' : 'inactive'}`}>
                            {brand.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="catalog-description">{brand.description || 'No description provided.'}</td>
                        <td>
                          <button className="action-btn edit" onClick={() => handleOpenEditModal(brand)}>Edit</button>
                          <button className="action-btn delete" onClick={() => handleDelete(brand)}>Delete</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingBrand ? 'Edit Brand' : 'Add Brand'}</h2>
              <button className="close-btn" onClick={handleCloseModal}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-body">
                {formError && <div className="form-error">{formError}</div>}
                <div className="catalog-form-grid">
                  <div className="form-group">
                    <label htmlFor="name">Name *</label>
                    <input id="name" name="name" value={formData.name} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="type">Type *</label>
                    <select id="type" name="type" value={formData.type} onChange={handleInputChange}>
                      <option value="OWN">Own</option>
                      <option value="COMPETITOR">Competitor</option>
                    </select>
                  </div>
                  <div className="form-group full-width">
                    <label htmlFor="description">Description</label>
                    <textarea id="description" name="description" value={formData.description} onChange={handleInputChange} rows="4" />
                  </div>
                  <div className="form-group full-width">
                    <label htmlFor="logo">Logo</label>
                    <input id="logo" name="logo" className="catalog-file-input" type="file" accept="image/*" onChange={handleLogoChange} />
                    {formData.logoPreview ? (
                      <div className="catalog-preview">
                        <img src={formData.logoPreview} alt="Brand preview" />
                        <span>Current preview</span>
                      </div>
                    ) : (
                      <p className="catalog-empty-note">No logo selected.</p>
                    )}
                  </div>
                  <div className="form-group full-width">
                    <label>
                      <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleInputChange} /> Active brand
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={handleCloseModal}>Cancel</button>
                <button type="submit" className="btn-submit" disabled={submitting}>
                  {submitting ? 'Saving...' : editingBrand ? 'Update Brand' : 'Create Brand'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Brands;
