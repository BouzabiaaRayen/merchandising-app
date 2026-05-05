import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { storeService, productService, visitService } from '../services/apiService';
import '../pages/Dashboard.css';

const kpiLabels = {
  availability: 'Product Availability',
  shelf: 'Shelf Visibility',
  stock: 'Stock Levels',
  execution: 'Execution Quality',
};

function analyzeKPIs({ stores, products, visits }) {
  // Example logic, should be expanded with real business rules
  const issues = [];
  let totalStockouts = 0;
  let totalOverstock = 0;
  let poorVisibility = 0;
  let delayedExec = 0;

  stores.forEach(store => {
    // Stockouts & overstock
    (store.inventory || []).forEach(item => {
      if (item.quantity === 0) {
        totalStockouts++;
        issues.push({
          type: 'Stockout',
          store: store.name,
          product: item.product_name,
          impact: 'Lost sales',
          recommendation: 'Restock immediately',
        });
      } else if (item.quantity > 100) {
        totalOverstock++;
        issues.push({
          type: 'Overstock',
          store: store.name,
          product: item.product_name,
          impact: 'Tied-up capital',
          recommendation: 'Reduce order quantity',
        });
      }
    });
    // Shelf visibility (placeholder)
    if (store.shelf_visibility && store.shelf_visibility < 0.7) {
      poorVisibility++;
      issues.push({
        type: 'Poor Shelf Visibility',
        store: store.name,
        impact: 'Reduced impulse sales',
        recommendation: 'Improve product placement',
      });
    }
  });

  // Execution delays (placeholder)
  visits.forEach(visit => {
    if (visit.status !== 'completed' && new Date(visit.scheduled_date) < new Date()) {
      delayedExec++;
      issues.push({
        type: 'Delayed Execution',
        store: stores.find(s => s.id === visit.store)?.name,
        impact: 'Missed sales opportunity',
        recommendation: 'Follow up with field team',
      });
    }
  });

  return {
    summary: {
      totalStockouts,
      totalOverstock,
      poorVisibility,
      delayedExec,
    },
    issues,
  };
}

const Recommendations = ({ issues }) => (
  <div style={{ marginTop: 24 }}>
    <h3>Detected Issues & Recommendations</h3>
    {issues.length === 0 ? (
      <div style={{ color: '#4fbb6f' }}>No major issues detected.</div>
    ) : (
      <ul style={{ color: '#b91c1c' }}>
        {issues.map((issue, idx) => (
          <li key={idx} style={{ marginBottom: 10 }}>
            <b>{issue.type}</b> in <b>{issue.store}</b>
            {issue.product && <> for <b>{issue.product}</b></>}:<br />
            <span style={{ color: '#23272f' }}>Impact:</span> {issue.impact}.<br />
            <span style={{ color: '#23272f' }}>Recommendation:</span> {issue.recommendation}
          </li>
        ))}
      </ul>
    )}
  </div>
);

const MerchandisingPerformanceScreen = () => {
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [visits, setVisits] = useState([]);
  const [report, setReport] = useState(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [storesData, productsData, visitsData] = await Promise.all([
          storeService.getStores({ page_size: 1000 }),
          productService.getProducts({ page_size: 1000 }),
          visitService.getVisits({ page_size: 1000 }),
        ]);
        // Simulate inventory and shelf data for demo
        const storesWithInventory = (storesData.results || storesData).map(store => ({
          ...store,
          inventory: [
            { product_name: 'Product A', quantity: Math.floor(Math.random() * 120) },
            { product_name: 'Product B', quantity: Math.floor(Math.random() * 120) },
          ],
          shelf_visibility: Math.random(),
        }));
        setStores(storesWithInventory);
        setProducts(productsData.results || productsData);
        setVisits(visitsData.results || visitsData);
        setReport(analyzeKPIs({ stores: storesWithInventory, products: productsData.results || productsData, visits: visitsData.results || visitsData }));
      } catch (e) {
        setReport(null);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="page-container">
          <h2>Merchandising Performance & Supply Chain Report</h2>
          {loading ? (
            <div className="loading">Analyzing data...</div>
          ) : report ? (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Stockouts</div>
                  <div className="stat-value" style={{ color: report.summary.totalStockouts > 0 ? '#b91c1c' : '#4fbb6f' }}>{report.summary.totalStockouts}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Overstocked Items</div>
                  <div className="stat-value" style={{ color: report.summary.totalOverstock > 0 ? '#f59e0b' : '#4fbb6f' }}>{report.summary.totalOverstock}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Poor Shelf Visibility</div>
                  <div className="stat-value" style={{ color: report.summary.poorVisibility > 0 ? '#b91c1c' : '#4fbb6f' }}>{report.summary.poorVisibility}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Delayed Executions</div>
                  <div className="stat-value" style={{ color: report.summary.delayedExec > 0 ? '#b91c1c' : '#4fbb6f' }}>{report.summary.delayedExec}</div>
                </div>
              </div>
              <Recommendations issues={report.issues} />
            </>
          ) : (
            <div style={{ color: '#b91c1c' }}>Failed to generate report. Please try again later.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MerchandisingPerformanceScreen;
