import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { brandService, categoryService, productService } from '../services/apiService';
import './Users.css';
import './Products.css';
import './CatalogManagement.css';

const createDefaultForm = () => ({
  name: '',
  sku: '',
  barcode: '',
  brand: '',
  category: '',
  price: '',
  recommended_facing: '1',
  description: '',
  is_active: true,
  image: null,
  imagePreview: '',
});

const DEMO_PRODUCTS = [
  {
    id: 'demo-cannelloni-bechamel',
    name: 'Cannelloni Bechamel',
    barcode: '220000010001',
    sku: 'CAN-BECH-001',
    brand_name: 'Demo Pasta',
    category_name: 'Cannelloni',
    price: 8.9,
    recommended_facing: 3,
    is_active: true,
    stock_status: 'IN STOCK',
    stock_quantity: 18,
    is_demo: true,
  },
  {
    id: 'demo-cannelloni-spinach',
    name: 'Cannelloni Spinach',
    barcode: '220000010002',
    sku: 'CAN-SPIN-002',
    brand_name: 'Demo Pasta',
    category_name: 'Cannelloni',
    price: 9.4,
    recommended_facing: 2,
    is_active: true,
    stock_status: 'IN STOCK',
    stock_quantity: 9,
    is_demo: true,
  },
  {
    id: 'demo-cannelloni-ricotta',
    name: 'Cannelloni Ricotta',
    barcode: '220000010003',
    sku: 'CAN-RICO-003',
    brand_name: 'Demo Pasta',
    category_name: 'Cannelloni',
    price: 9.9,
    recommended_facing: 2,
    is_active: true,
    stock_status: 'OUT OF STOCK',
    stock_quantity: 0,
    is_demo: true,
  },
  {
    id: 'demo-cannelloni-bolognese',
    name: 'Cannelloni Bolognese',
    barcode: '220000010004',
    sku: 'CAN-BOLO-004',
    brand_name: 'Demo Pasta',
    category_name: 'Cannelloni',
    price: 10.2,
    recommended_facing: 1,
    is_active: true,
    stock_status: 'OUT OF STOCK',
    stock_quantity: 0,
    is_demo: true,
  },
  {
    id: 'demo-lasagne-classic',
    name: 'Lasagne Classic',
    barcode: '220000010005',
    sku: 'LAS-CLAS-005',
    brand_name: 'Demo Pasta',
    category_name: 'Lasagne',
    price: 7.8,
    recommended_facing: 3,
    is_active: true,
    stock_status: 'IN STOCK',
    stock_quantity: 14,
    is_demo: true,
  },
  {
    id: 'demo-ravioli-cheese',
    name: 'Ravioli Cheese',
    barcode: '220000010006',
    sku: 'RAV-CHEE-006',
    brand_name: 'Demo Pasta',
    category_name: 'Ravioli',
    price: 6.7,
    recommended_facing: 2,
    is_active: true,
    stock_status: 'OUT OF STOCK',
    stock_quantity: 0,
    is_demo: true,
  },
];

const mergeDemoProducts = (products) => {
  const liveProducts = Array.isArray(products) ? products : [];
  const existingNames = new Set(liveProducts.map((product) => String(product?.name || '').trim().toLowerCase()).filter(Boolean));
  const missingDemoProducts = DEMO_PRODUCTS.filter(
    (product) => !existingNames.has(String(product.name).trim().toLowerCase())
  );

  return [...missingDemoProducts, ...liveProducts];
};

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

const Products = () => {
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState(createDefaultForm());
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCatalogData();
  }, [searchTerm, brandFilter, categoryFilter]);

  const fetchCatalogData = async () => {
    try {
      setLoading(true);
      const [productsData, brandsData, categoriesData] = await Promise.all([
        productService.getProducts({
          page_size: 1000,
          search: searchTerm || undefined,
          brand: brandFilter || undefined,
          category: categoryFilter || undefined,
        }),
        brandService.getBrands({ page_size: 1000, is_active: true }),
        categoryService.getCategories({ page_size: 1000, is_active: true }),
      ]);

      setProducts(mergeDemoProducts(productsData.results ?? productsData));
      setBrands(brandsData.results ?? brandsData);
      setCategories(categoriesData.results ?? categoriesData);
      setError('');
    } catch (err) {
      setError('Failed to load products catalog.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
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

  const handleOpenEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      brand: product.brand ? String(product.brand) : '',
      category: product.category ? String(product.category) : '',
      price: product.price ? String(product.price) : '',
      recommended_facing: product.recommended_facing ? String(product.recommended_facing) : '1',
      description: product.description || '',
      is_active: product.is_active ?? true,
      image: null,
      imagePreview: product.image_url || '',
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

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    setFormData((current) => ({
      ...current,
      image: file || null,
      imagePreview: file ? URL.createObjectURL(file) : current.imagePreview,
    }));
  };

  const buildPayload = () => {
    const payload = new FormData();
    payload.append('name', formData.name.trim());
    payload.append('sku', formData.sku.trim());
    payload.append('barcode', formData.barcode.trim());
    payload.append('brand', formData.brand);
    payload.append('category', formData.category);
    payload.append('price', formData.price);
    payload.append('recommended_facing', formData.recommended_facing);
    payload.append('description', formData.description.trim());
    payload.append('is_active', formData.is_active ? 'true' : 'false');
    if (formData.image) {
      payload.append('image', formData.image);
    }
    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.name.trim() || !formData.brand || !formData.category || !formData.price) {
      setFormError('Name, brand, category and price are required.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');
      const payload = buildPayload();
      if (editingProduct) {
        await productService.updateProduct(editingProduct.id, payload);
        setSuccessMessage('Product updated successfully.');
      } else {
        await productService.createProduct(payload);
        setSuccessMessage('Product created successfully.');
      }
      handleCloseModal();
      fetchCatalogData();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to save product.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete product "${product.name}"?`)) {
      return;
    }

    try {
      await productService.deleteProduct(product.id);
      setSuccessMessage('Product deleted successfully.');
      fetchCatalogData();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete product.'));
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
              <h1>Product Management</h1>
              <p>Manage centralized products, pricing, facing targets and media.</p>
            </div>
            <button className="add-btn" onClick={handleOpenAddModal}>+ Add Product</button>
          </div>

          {successMessage && <div className="success-message">{successMessage}</div>}
          {error && <div className="error-message">{error}</div>}

          <div className="catalog-toolbar">
            <input
              className="catalog-search"
              type="search"
              placeholder="Search by product, barcode or SKU..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <div className="catalog-filters">
              <select className="catalog-select" value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)}>
                <option value="">All brands</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>{brand.name}</option>
                ))}
              </select>
              <select className="catalog-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading">Loading products...</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Brand</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Facing</th>
                    <th>Status</th>
                    <th>Stock</th>
                    <th>Qty</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="no-data">No products found.</td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <div className="catalog-name-cell">
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} className="catalog-thumb" />
                            ) : (
                              <div className="catalog-thumb-placeholder">IMG</div>
                            )}
                            <div className="catalog-meta">
                              <strong>{product.name}</strong>
                              <span>{product.barcode || product.sku || 'No code'}</span>
                              {product.is_demo && <span className="catalog-demo-tag">Demo catalog</span>}
                            </div>
                          </div>
                        </td>
                        <td>{product.brand_name || 'No brand'}</td>
                        <td>{product.category_name || 'No category'}</td>
                        <td className="catalog-price">{Number(product.price || 0).toFixed(3)} TND</td>
                        <td>{product.recommended_facing || 1}</td>
                        <td>
                          <span className={`catalog-status-badge ${product.is_active ? 'active' : 'inactive'}`}>
                            {product.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <span className={`stock-badge ${String(product.stock_status || '').toUpperCase() === 'IN STOCK' ? 'in-stock' : 'out-of-stock'}`}>
                            {String(product.stock_status || '').toUpperCase() === 'IN STOCK' ? 'In Stock' : 'Out of Stock'}
                          </span>
                        </td>
                        <td>{Number(product.stock_quantity || 0)}</td>
                        <td>
                          {!product.is_demo && <button className="action-btn edit" onClick={() => handleOpenEditModal(product)}>Edit</button>}
                          {!product.is_demo && <button className="action-btn delete" onClick={() => handleDelete(product)}>Delete</button>}
                          {product.is_demo && <span className="catalog-demo-note">Seeded demo</span>}
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
              <h2>{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
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
                    <label htmlFor="brand">Brand *</label>
                    <select id="brand" name="brand" value={formData.brand} onChange={handleInputChange} required>
                      <option value="">Select brand</option>
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>{brand.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="category">Category *</label>
                    <select id="category" name="category" value={formData.category} onChange={handleInputChange} required>
                      <option value="">Select category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="price">Price (TND) *</label>
                    <input id="price" name="price" type="number" min="0" step="0.001" value={formData.price} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="recommended_facing">Recommended Facing *</label>
                    <input id="recommended_facing" name="recommended_facing" type="number" min="1" step="1" value={formData.recommended_facing} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="barcode">Barcode</label>
                    <input id="barcode" name="barcode" value={formData.barcode} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="sku">Internal SKU</label>
                    <input id="sku" name="sku" value={formData.sku} onChange={handleInputChange} />
                  </div>
                  <div className="form-group full-width">
                    <label htmlFor="description">Description</label>
                    <textarea id="description" name="description" rows="4" value={formData.description} onChange={handleInputChange} />
                  </div>
                  <div className="form-group full-width">
                    <label htmlFor="image">Product Image</label>
                    <input id="image" name="image" className="catalog-file-input" type="file" accept="image/*" onChange={handleImageChange} />
                    {formData.imagePreview ? (
                      <div className="catalog-preview">
                        <img src={formData.imagePreview} alt="Product preview" />
                        <span>Current preview</span>
                      </div>
                    ) : (
                      <p className="catalog-empty-note">No image selected.</p>
                    )}
                  </div>
                  <div className="form-group full-width">
                    <label>
                      <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleInputChange} /> Active product
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={handleCloseModal}>Cancel</button>
                <button type="submit" className="btn-submit" disabled={submitting}>
                  {submitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
