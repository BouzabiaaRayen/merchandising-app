import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { visitService } from '../services/apiService';
import './Users.css';
import './Products.css';
import './Visits.css';

const STATUS_LABELS = {
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const Visits = () => {
  const [visits, setVisits] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchVisits();
  }, []);

  const fetchVisits = async () => {
    try {
      const data = await visitService.getVisits();
      setVisits(data.results ?? []);
      setCount(data.count ?? 0);
    } catch (err) {
      setError('Failed to fetch visits');
      console.error('Error fetching visits:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (id) => {
    try {
      await visitService.checkIn(id);
      fetchVisits();
    } catch (err) {
      console.error('Check-in failed:', err);
    }
  };

  const handleCheckOut = async (id) => {
    const notes = window.prompt('Check-out notes (optional):') ?? '';
    try {
      await visitService.checkOut(id, notes);
      fetchVisits();
    } catch (err) {
      console.error('Check-out failed:', err);
    }
  };

  const handleCancel = async (id) => {
    const reason = window.prompt('Cancellation reason:') ?? '';
    try {
      await visitService.cancel(id, reason);
      fetchVisits();
    } catch (err) {
      console.error('Cancel failed:', err);
    }
  };

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="page-container">
          <div className="page-header">
            <h1>Visits</h1>
            <p>Manage merchandiser visits ({count} total)</p>
          </div>

          {loading ? (
            <div className="loading">Loading visits...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : (
            <div className="table-container">
              <div className="table-actions">
                <button className="btn-primary">Schedule Visit</button>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Store</th>
                    <th>Merchandiser</th>
                    <th>Status</th>
                    <th>Scheduled Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="no-data">
                        No visits found
                      </td>
                    </tr>
                  ) : (
                    visits.map((visit) => (
                      <tr key={visit.id}>
                        <td>{visit.id}</td>
                        <td>{visit.store_name ?? visit.store ?? 'N/A'}</td>
                        <td>{visit.merchandiser_name ?? visit.merchandiser ?? 'N/A'}</td>
                        <td>
                          <span className={`visit-status-badge ${(visit.status || '').toLowerCase().replace('_', '-')}`}>
                            {STATUS_LABELS[visit.status] ?? visit.status ?? 'N/A'}
                          </span>
                        </td>
                        <td>
                          {visit.scheduled_date
                            ? new Date(visit.scheduled_date).toLocaleDateString()
                            : 'N/A'}
                        </td>
                        <td>
                          {visit.status === 'SCHEDULED' && (
                            <button className="action-btn view" onClick={() => handleCheckIn(visit.id)}>
                              Check In
                            </button>
                          )}
                          {visit.status === 'IN_PROGRESS' && (
                            <button className="action-btn edit" onClick={() => handleCheckOut(visit.id)}>
                              Check Out
                            </button>
                          )}
                          {(visit.status === 'SCHEDULED' || visit.status === 'IN_PROGRESS') && (
                            <button className="action-btn delete" onClick={() => handleCancel(visit.id)}>
                              Cancel
                            </button>
                          )}
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

export default Visits;
