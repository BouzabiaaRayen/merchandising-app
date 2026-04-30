import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { inventoryService } from '../services/apiService';
import './Users.css';
import './Products.css';

const Inventory = () => {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const data = await inventoryService.getInventory();
      setItems(data.results ?? []);
      setCount(data.count ?? 0);
    } catch (err) {
      setError('Failed to fetch inventory');
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestock = async (id) => {
    const qty = window.prompt('Enter restock quantity:');
    if (!qty || isNaN(Number(qty))) return;
    try {
      await inventoryService.restock(id, Number(qty));
      fetchInventory();
    } catch (err) {
      console.error('Restock failed:', err);
    }
  };

  const handleReduce = async (id) => {
    const qty = window.prompt('Enter reduce quantity:');
    if (!qty || isNaN(Number(qty))) return;
    try {
      await inventoryService.reduce(id, Number(qty));
      fetchInventory();
    } catch (err) {
      console.error('Reduce failed:', err);
    }
  };

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="page-container">
          <div className="page-header">
            <h1>Inventory</h1>
            <p>Manage product inventory ({count} total)</p>
          </div>

          {loading ? (
            <div className="loading">Loading inventory...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : (
            <div className="table-container">
              <div className="table-actions">
                <button className="btn-primary">Add Inventory Item</button>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Product</th>
                    <th>Store</th>
                    <th>Quantity</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="no-data">
                        No inventory items found
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{item.product_name ?? item.product ?? 'N/A'}</td>
                        <td>{item.store_name ?? item.store ?? 'N/A'}</td>
                        <td>
                          <span className={`stock-badge ${item.quantity > 0 ? 'in-stock' : 'out-of-stock'}`}>
                            {item.quantity ?? 0}
                          </span>
                        </td>
                        <td>
                          <button className="action-btn view" onClick={() => handleRestock(item.id)}>
                            Restock
                          </button>
                          <button className="action-btn edit" onClick={() => handleReduce(item.id)}>
                            Reduce
                          </button>
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
    </div>
  );
};

export default Inventory;
