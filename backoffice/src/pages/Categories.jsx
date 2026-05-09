import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { categoryService } from '../services/apiService';
import './Users.css';
import './Products.css';
import './CatalogManagement.css';

const createDefaultForm = () => ({
  name: '',
  description: '',
  is_active: true,
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

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState(createDefaultForm());
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, [searchTerm]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const data = await categoryService.getCategories({ page_size: 1000, search: searchTerm || undefined });
      setCategories(data.results ?? data);
      setError('');
    } catch (err) {
      setError('Failed to fetch categories.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingCategory(null);
    setFormData(createDefaultForm());
    setFormError('');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleOpenAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEditModal = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name || '',
      description: category.description || '',
      is_active: category.is_active ?? true,
    });
    setFormError('');
    setShowModal(true);
  };

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Category name is required.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        is_active: formData.is_active,
      };
      if (editingCategory) {
        await categoryService.updateCategory(editingCategory.id, payload);
        setSuccessMessage('Category updated successfully.');
      } else {
        await categoryService.createCategory(payload);
        setSuccessMessage('Category created successfully.');
      }
      handleCloseModal();
      fetchCategories();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to save category.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (category) => {
    if (!window.confirm(`Delete category "${category.name}"?`)) {
      return;
    }

    try {
      await categoryService.deleteCategory(category.id);
      setSuccessMessage('Category deleted successfully.');
      fetchCategories();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete category.'));
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
              <h1>Category Management</h1>
              <p>Manage the centralized product category tree used by web and mobile.</p>
            </div>
            <button className="add-btn" onClick={handleOpenAddModal}>+ Add Category</button>
          </div>

          {successMessage && <div className="success-message">{successMessage}</div>}
          {error && <div className="error-message">{error}</div>}

          <div className="catalog-toolbar">
            <input
              className="catalog-search"
              type="search"
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          {loading ? (
            <div className="loading">Loading categories...</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="no-data">No categories found.</td>
                    </tr>
                  ) : (
                    categories.map((category) => (
                      <tr key={category.id}>
                        <td>
                          <div className="catalog-meta">
                            <strong>{category.name}</strong>
                            <span>ID #{category.id}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`catalog-status-badge ${category.is_active ? 'active' : 'inactive'}`}>
                            {category.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="catalog-description">{category.description || 'No description provided.'}</td>
                        <td>
                          <button className="action-btn edit" onClick={() => handleOpenEditModal(category)}>Edit</button>
                          <button className="action-btn delete" onClick={() => handleDelete(category)}>Delete</button>
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
              <h2>{editingCategory ? 'Edit Category' : 'Add Category'}</h2>
              <button className="close-btn" onClick={handleCloseModal}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-body">
                {formError && <div className="form-error">{formError}</div>}
                <div className="catalog-form-grid">
                  <div className="form-group full-width">
                    <label htmlFor="name">Name *</label>
                    <input id="name" name="name" value={formData.name} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group full-width">
                    <label htmlFor="description">Description</label>
                    <textarea id="description" name="description" value={formData.description} onChange={handleInputChange} rows="4" />
                  </div>
                  <div className="form-group full-width">
                    <label>
                      <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleInputChange} /> Active category
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={handleCloseModal}>Cancel</button>
                <button type="submit" className="btn-submit" disabled={submitting}>
                  {submitting ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
