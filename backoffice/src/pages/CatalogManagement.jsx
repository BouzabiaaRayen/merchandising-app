import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { brandService, categoryService, productService } from '../services/apiService';
import './Users.css';
import './Products.css';
import './CatalogManagement.css';
import { Dropdown, DropdownItem } from '../components/Dropdown';

const createDefaultOwnerBrandForm = () => ({
  name: '',
  logo: null,
  logoPreview: '',
});

const createDefaultCompetitorForm = () => ({
  name: '',
});

const createDefaultCategoryForm = () => ({
  name: '',
});

const createDefaultProductForm = () => ({
  name: '',
  category: '',
  price: '0.000',
});

const normalizeList = (data) => data?.results ?? data ?? [];

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

const CatalogManagement = () => {
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState('');
  const [globalMessage, setGlobalMessage] = useState('');
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');

  const [showOwnerBrandModal, setShowOwnerBrandModal] = useState(false);
  const [ownerBrandForm, setOwnerBrandForm] = useState(createDefaultOwnerBrandForm());
  const [ownerBrandFormError, setOwnerBrandFormError] = useState('');
  const [ownerBrandSubmitting, setOwnerBrandSubmitting] = useState(false);

  const [showCompetitorModal, setShowCompetitorModal] = useState(false);
  const [editingCompetitor, setEditingCompetitor] = useState(null);
  const [competitorForm, setCompetitorForm] = useState(createDefaultCompetitorForm());
  const [competitorFormError, setCompetitorFormError] = useState('');
  const [competitorSubmitting, setCompetitorSubmitting] = useState(false);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState(createDefaultCategoryForm());
  const [categoryFormError, setCategoryFormError] = useState('');
  const [categorySubmitting, setCategorySubmitting] = useState(false);

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState(createDefaultProductForm());
  const [productFormError, setProductFormError] = useState('');
  const [productSubmitting, setProductSubmitting] = useState(false);

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    try {
      setLoading(true);
      const [brandsData, categoriesData, productsData] = await Promise.all([
        brandService.getBrands({ page_size: 1000 }),
        categoryService.getCategories({ page_size: 1000 }),
        productService.getProducts({ page_size: 1000 }),
      ]);
      setBrands(normalizeList(brandsData));
      setCategories(normalizeList(categoriesData));
      setProducts(normalizeList(productsData));
      setGlobalError('');
    } catch (error) {
      setGlobalError(getErrorMessage(error, 'Failed to load catalog data.'));
    } finally {
      setLoading(false);
    }
  };

  const ownBrands = useMemo(() => brands.filter((brand) => brand.type === 'OWN'), [brands]);
  const primaryBrand = ownBrands[0] || null;
  const competitorBrands = useMemo(() => brands.filter((brand) => brand.type === 'COMPETITOR'), [brands]);
  const isFirstSetup = useMemo(
    () => !brands.length && !categories.length && !products.length,
    [brands.length, categories.length, products.length]
  );
  const ownBrandProducts = useMemo(
    () => products.filter((product) => primaryBrand && String(product.brand) === String(primaryBrand.id)),
    [products, primaryBrand]
  );
  const displayedProducts = useMemo(
    () => selectedCategoryFilter
      ? ownBrandProducts.filter((product) => String(product.category) === selectedCategoryFilter)
      : ownBrandProducts,
    [ownBrandProducts, selectedCategoryFilter]
  );
  const categoryCounts = useMemo(() => {
    const counts = {};
    ownBrandProducts.forEach((product) => {
      const key = String(product.category || '');
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [ownBrandProducts]);

  const pushMessage = (text) => {
    setGlobalMessage(text);
    window.setTimeout(() => setGlobalMessage(''), 3000);
  };

  const openOwnerBrandModal = () => {
    setOwnerBrandForm({
      name: primaryBrand?.name || '',
      logo: null,
      logoPreview: primaryBrand?.logo_url || '',
    });
    setOwnerBrandFormError('');
    setShowOwnerBrandModal(true);
  };

  const closeOwnerBrandModal = () => {
    setShowOwnerBrandModal(false);
    setOwnerBrandForm(createDefaultOwnerBrandForm());
    setOwnerBrandFormError('');
  };

  const handleOwnerBrandChange = (event) => {
    const { name, value } = event.target;
    setOwnerBrandForm((current) => ({ ...current, [name]: value }));
  };

  const handleOwnerBrandLogoChange = (event) => {
    const file = event.target.files?.[0];
    setOwnerBrandForm((current) => ({
      ...current,
      logo: file || null,
      logoPreview: file ? URL.createObjectURL(file) : current.logoPreview,
    }));
  };

  const handleOwnerBrandSubmit = async (event) => {
    event.preventDefault();
    if (!ownerBrandForm.name.trim()) {
      setOwnerBrandFormError('Brand name is required.');
      return;
    }
    if (!primaryBrand && ownBrands.length > 0) {
      setOwnerBrandFormError('Only one owner brand is allowed on this screen.');
      return;
    }

    try {
      setOwnerBrandSubmitting(true);
      setOwnerBrandFormError('');
      const payload = new FormData();
      payload.append('name', ownerBrandForm.name.trim());
      payload.append('type', 'OWN');
      payload.append('is_active', 'true');
      if (ownerBrandForm.logo) {
        payload.append('logo', ownerBrandForm.logo);
      }

      if (primaryBrand) {
        await brandService.updateBrand(primaryBrand.id, payload);
        pushMessage('Owner brand updated successfully.');
      } else {
        await brandService.createBrand(payload);
        pushMessage('Owner brand created successfully.');
      }

      closeOwnerBrandModal();
      loadCatalog();
    } catch (error) {
      setOwnerBrandFormError(getErrorMessage(error, 'Failed to save owner brand.'));
    } finally {
      setOwnerBrandSubmitting(false);
    }
  };

  const handleDeleteOwnerBrand = async (brandId) => {
    if (!window.confirm('Delete this owner brand? Products linked to it may lose their brand association.')) {
      return;
    }

    try {
      await brandService.deleteBrand(brandId);
      pushMessage('Owner brand deleted successfully.');
      loadCatalog();
    } catch (error) {
      setGlobalError(getErrorMessage(error, 'Failed to delete owner brand.'));
    }
  };

  const openCompetitorModal = (brand = null) => {
    setEditingCompetitor(brand);
    setCompetitorForm({ name: brand?.name || '' });
    setCompetitorFormError('');
    setShowCompetitorModal(true);
  };

  const closeCompetitorModal = () => {
    setShowCompetitorModal(false);
    setEditingCompetitor(null);
    setCompetitorForm(createDefaultCompetitorForm());
    setCompetitorFormError('');
  };

  const handleCompetitorSubmit = async (event) => {
    event.preventDefault();
    if (!competitorForm.name.trim()) {
      setCompetitorFormError('Competitor name is required.');
      return;
    }

    try {
      setCompetitorSubmitting(true);
      setCompetitorFormError('');
      const payload = new FormData();
      payload.append('name', competitorForm.name.trim());
      payload.append('type', 'COMPETITOR');
      payload.append('is_active', 'true');

      if (editingCompetitor) {
        await brandService.updateBrand(editingCompetitor.id, payload);
        pushMessage('Competitor updated successfully.');
      } else {
        await brandService.createBrand(payload);
        pushMessage('Competitor added successfully.');
      }

      closeCompetitorModal();
      loadCatalog();
    } catch (error) {
      setCompetitorFormError(getErrorMessage(error, 'Failed to save competitor.'));
    } finally {
      setCompetitorSubmitting(false);
    }
  };

  const handleDeleteCompetitor = async (brandId) => {
    if (!window.confirm('Delete this competitor brand?')) {
      return;
    }

    try {
      await brandService.deleteBrand(brandId);
      pushMessage('Competitor deleted successfully.');
      loadCatalog();
    } catch (error) {
      setGlobalError(getErrorMessage(error, 'Failed to delete competitor.'));
    }
  };

  const openCategoryModal = (category = null) => {
    setEditingCategory(category);
    setCategoryForm({ name: category?.name || '' });
    setCategoryFormError('');
    setShowCategoryModal(true);
  };

  const closeCategoryModal = () => {
    setShowCategoryModal(false);
    setEditingCategory(null);
    setCategoryForm(createDefaultCategoryForm());
    setCategoryFormError('');
  };

  const handleCategorySubmit = async (event) => {
    event.preventDefault();
    if (!categoryForm.name.trim()) {
      setCategoryFormError('Category name is required.');
      return;
    }

    try {
      setCategorySubmitting(true);
      setCategoryFormError('');
      const payload = {
        name: categoryForm.name.trim(),
        is_active: true,
      };

      if (editingCategory) {
        await categoryService.updateCategory(editingCategory.id, payload);
        pushMessage('Category updated successfully.');
      } else {
        await categoryService.createCategory(payload);
        pushMessage('Category added successfully.');
      }

      closeCategoryModal();
      loadCatalog();
    } catch (error) {
      setCategoryFormError(getErrorMessage(error, 'Failed to save category.'));
    } finally {
      setCategorySubmitting(false);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm('Delete this category?')) {
      return;
    }

    try {
      await categoryService.deleteCategory(categoryId);
      pushMessage('Category deleted successfully.');
      loadCatalog();
    } catch (error) {
      setGlobalError(getErrorMessage(error, 'Failed to delete category.'));
    }
  };

  const openProductModal = (product = null) => {
    setEditingProduct(product);
    setProductForm({
      name: product?.name || '',
      category: product?.category ? String(product.category) : '',
      price: product?.price ? String(product.price) : '0.000',
    });
    setProductFormError('');
    setShowProductModal(true);
  };

  const closeProductModal = () => {
    setShowProductModal(false);
    setEditingProduct(null);
    setProductForm(createDefaultProductForm());
    setProductFormError('');
  };

  const handleProductSubmit = async (event) => {
    event.preventDefault();
    if (!primaryBrand) {
      setProductFormError('Create your owner brand first.');
      return;
    }
    if (!productForm.name.trim()) {
      setProductFormError('Product name is required.');
      return;
    }
    if (!productForm.category) {
      setProductFormError('Select a category.');
      return;
    }

    try {
      setProductSubmitting(true);
      setProductFormError('');
      const payload = new FormData();
      payload.append('name', productForm.name.trim());
      payload.append('brand', String(primaryBrand.id));
      payload.append('category', String(Number(productForm.category)));
      payload.append('price', String(Number(productForm.price || 0)));
      payload.append('recommended_facing', '1');
      payload.append('is_active', 'true');

      if (editingProduct) {
        await productService.updateProduct(editingProduct.id, payload);
        pushMessage('Product updated successfully.');
      } else {
        await productService.createProduct(payload);
        pushMessage('Product added successfully.');
      }

      closeProductModal();
      loadCatalog();
    } catch (error) {
      setProductFormError(getErrorMessage(error, 'Failed to save product.'));
    } finally {
      setProductSubmitting(false);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Delete this product?')) {
      return;
    }

    try {
      await productService.deleteProduct(productId);
      pushMessage('Product deleted successfully.');
      loadCatalog();
    } catch (error) {
      setGlobalError(getErrorMessage(error, 'Failed to delete product.'));
    }
  };

  const renderDropdownActions = (onEdit, onDelete) => (
    <Dropdown>
      <DropdownItem onClick={onEdit}>Edit</DropdownItem>
      <DropdownItem onClick={onDelete} className="danger">Delete</DropdownItem>
    </Dropdown>
  );

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <div className="page-container">
          <div className="page-header">
            <div>
              <h1>Catalog Setup</h1>
              <p>Set your main brand, its categories, its products, and the competitor names you want to track.</p>
            </div>
          </div>

          {globalMessage && <div className="success-message">{globalMessage}</div>}
          {globalError && <div className="error-message">{globalError}</div>}

          {!isFirstSetup && (
            <div className="catalog-summary-grid">
              <div className="catalog-summary-card">
                <span className="catalog-summary-label">Your Brand</span>
                <strong>{primaryBrand?.name || 'Not set'}</strong>
              </div>
              <div className="catalog-summary-card">
                <span className="catalog-summary-label">Categories</span>
                <strong>{categories.length}</strong>
              </div>
              <div className="catalog-summary-card">
                <span className="catalog-summary-label">Products</span>
                <strong>{ownBrandProducts.length}</strong>
              </div>
              <div className="catalog-summary-card">
                <span className="catalog-summary-label">Competitors</span>
                <strong>{competitorBrands.length}</strong>
              </div>
            </div>
          )}

          {ownBrands.length > 1 && (
            <div className="error-message">This simplified screen is designed for one owner brand. Please keep one brand and remove the others.</div>
          )}

          <section className="catalog-simple-section">
            <div className="catalog-simple-header">
              <div>
                <h2>Your Brand</h2>
              </div>
              <button className="add-btn" onClick={openOwnerBrandModal}>
                {primaryBrand ? 'Edit Brand' : '+ Add Brand'}
              </button>
            </div>

            {loading ? (
              <div className="loading">Loading brand...</div>
            ) : primaryBrand ? (
              <div className="catalog-brand-card">
                <div className="catalog-name-cell">
                  {primaryBrand.logo_url ? (
                    <img src={primaryBrand.logo_url} alt={primaryBrand.name} className="catalog-thumb catalog-thumb-large" />
                  ) : (
                    <div className="catalog-thumb-placeholder catalog-thumb-large">LOGO</div>
                  )}
                  <div className="catalog-meta">
                    <strong>{primaryBrand.name}</strong>
                    <span>Main owner brand</span>
                  </div>
                </div>
                <div className="catalog-inline-actions">
                  {renderDropdownActions(() => openOwnerBrandModal(), () => handleDeleteOwnerBrand(primaryBrand.id))}
                </div>
              </div>
            ) : !isFirstSetup ? (
              <div className="catalog-empty-state">
                <p>Start by creating your main brand. Categories and products will use it automatically.</p>
              </div>
            ) : null}
          </section>

          <section className="catalog-simple-section">
            <div className="catalog-simple-header">
              <div>
                <h2>Categories</h2>
              </div>
              <button className="add-btn" onClick={() => openCategoryModal()} disabled={!primaryBrand}>+ Add Category</button>
            </div>

            {!primaryBrand && !isFirstSetup ? (
              <div className="catalog-empty-state">
                <p>Create your brand first, then add the categories that belong to it.</p>
              </div>
            ) : categories.length === 0 ? (
              <div className="catalog-empty-state">
                <p>No categories yet.</p>
              </div>
            ) : (
              <div className="catalog-category-list">
                {categories.map((category) => (
                  <div key={category.id} className="catalog-category-row">
                    <span className="catalog-category-label">
                      <strong>{category.name}</strong>
                      <span className="catalog-category-count">{categoryCounts[String(category.id)] || 0} products</span>
                    </span>
                    <div className="catalog-inline-actions">
                      {renderDropdownActions(() => openCategoryModal(category), () => handleDeleteCategory(category.id))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="catalog-simple-section">
            <div className="catalog-simple-header">
              <div>
                <h2>Products</h2>
              </div>
              <button className="add-btn" onClick={() => openProductModal()} disabled={!primaryBrand || categories.length === 0}>+ Add Product</button>
            </div>

            {!primaryBrand && !isFirstSetup ? (
              <div className="catalog-empty-state">
                <p>Create your brand first, then add products.</p>
              </div>
            ) : categories.length === 0 ? (
              <div className="catalog-empty-state">
                <p>Add at least one category before creating products.</p>
              </div>
            ) : (
              <div className="catalog-category-list">
                {ownBrandProducts.map((product) => (
                  <div key={product.id} className="catalog-category-row">
                    <span className="catalog-category-label">
                      <strong>{product.name}</strong>
                    </span>
                    <div className="catalog-inline-actions">
                      {renderDropdownActions(() => openProductModal(product), () => handleDeleteProduct(product.id))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="catalog-simple-section">
            <div className="catalog-simple-header">
              <div>
                <h2>Competitors</h2>
              </div>
              <button className="add-btn" onClick={() => openCompetitorModal()}>+ Add Competitor</button>
            </div>

            {competitorBrands.length === 0 && !isFirstSetup ? (
              <div className="catalog-empty-state">
                <p>No competitors yet.</p>
              </div>
            ) : (
              <div className="catalog-category-list">
                {competitorBrands.map((brand) => (
                  <div key={brand.id} className="catalog-category-row">
                    <strong>{brand.name}</strong>
                    <div className="catalog-inline-actions">
                      {renderDropdownActions(() => openCompetitorModal(brand), () => handleDeleteCompetitor(brand.id))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {showOwnerBrandModal && (
        <div className="modal-overlay" onClick={closeOwnerBrandModal}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>{primaryBrand ? 'Edit Your Brand' : 'Add Your Brand'}</h2>
              <button className="close-btn" onClick={closeOwnerBrandModal}>×</button>
            </div>
            <form onSubmit={handleOwnerBrandSubmit}>
              <div className="form-body">
                {ownerBrandFormError && <div className="form-error">{ownerBrandFormError}</div>}
                <div className="catalog-form-grid">
                  <div className="form-group full-width">
                    <label htmlFor="owner-brand-name">Brand name</label>
                    <input id="owner-brand-name" name="name" value={ownerBrandForm.name} onChange={handleOwnerBrandChange} required />
                  </div>
                  <div className="form-group full-width">
                    <label htmlFor="owner-brand-logo">Logo</label>
                    <div className="catalog-file-picker">
                      <input
                        id="owner-brand-logo"
                        className="catalog-file-input-hidden"
                        type="file"
                        accept="image/*"
                        onChange={handleOwnerBrandLogoChange}
                      />
                      <label htmlFor="owner-brand-logo" className="catalog-file-trigger">
                        Choose image
                      </label>
                      {ownerBrandForm.logo ? <span className="catalog-file-name">{ownerBrandForm.logo.name}</span> : null}
                    </div>
                    {ownerBrandForm.logoPreview ? (
                      <div className="catalog-preview">
                        <img src={ownerBrandForm.logoPreview} alt="Brand preview" />
                        <span>Current preview</span>
                      </div>
                    ) : (
                      <p className="catalog-empty-note">No logo selected.</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={closeOwnerBrandModal}>Cancel</button>
                <button type="submit" className="btn-submit" disabled={ownerBrandSubmitting}>
                  {ownerBrandSubmitting ? 'Saving...' : primaryBrand ? 'Update Brand' : 'Create Brand'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCompetitorModal && (
        <div className="modal-overlay" onClick={closeCompetitorModal}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCompetitor ? 'Edit Competitor' : 'Add Competitor'}</h2>
              <button className="close-btn" onClick={closeCompetitorModal}>×</button>
            </div>
            <form onSubmit={handleCompetitorSubmit}>
              <div className="form-body">
                {competitorFormError && <div className="form-error">{competitorFormError}</div>}
                <div className="catalog-form-grid">
                  <div className="form-group full-width">
                    <label htmlFor="competitor-name">Competitor name</label>
                    <input id="competitor-name" value={competitorForm.name} onChange={(event) => setCompetitorForm({ name: event.target.value })} required />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={closeCompetitorModal}>Cancel</button>
                <button type="submit" className="btn-submit" disabled={competitorSubmitting}>
                  {competitorSubmitting ? 'Saving...' : editingCompetitor ? 'Update Competitor' : 'Add Competitor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCategoryModal && (
        <div className="modal-overlay" onClick={closeCategoryModal}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCategory ? 'Edit Category' : 'Add Category'}</h2>
              <button className="close-btn" onClick={closeCategoryModal}>×</button>
            </div>
            <form onSubmit={handleCategorySubmit}>
              <div className="form-body">
                {categoryFormError && <div className="form-error">{categoryFormError}</div>}
                <div className="catalog-form-grid">
                  <div className="form-group full-width">
                    <label htmlFor="category-name">Category name</label>
                    <input id="category-name" value={categoryForm.name} onChange={(event) => setCategoryForm({ name: event.target.value })} required />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={closeCategoryModal}>Cancel</button>
                <button type="submit" className="btn-submit" disabled={categorySubmitting}>
                  {categorySubmitting ? 'Saving...' : editingCategory ? 'Update Category' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showProductModal && (
        <div className="modal-overlay" onClick={closeProductModal}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
              <button className="close-btn" onClick={closeProductModal}>×</button>
            </div>
            <form onSubmit={handleProductSubmit}>
              <div className="form-body">
                {productFormError && <div className="form-error">{productFormError}</div>}
                <div className="catalog-form-grid">
                  <div className="form-group full-width">
                    <label htmlFor="product-name">Product name</label>
                    <input id="product-name" value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="product-category">Category</label>
                    <select id="product-category" value={productForm.category} onChange={(event) => setProductForm((current) => ({ ...current, category: event.target.value }))} required>
                      <option value="">Select category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="product-price">Price</label>
                    <input id="product-price" type="number" min="0" step="0.001" value={productForm.price} onChange={(event) => setProductForm((current) => ({ ...current, price: event.target.value }))} />
                    <p className="catalog-helper"></p>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={closeProductModal}>Cancel</button>
                <button type="submit" className="btn-submit" disabled={productSubmitting}>
                  {productSubmitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogManagement;