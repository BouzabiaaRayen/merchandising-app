import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { visitService, storeService, userService } from '../services/apiService';
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
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [stores, setStores] = useState([]);
  const [merchandisers, setMerchandisers] = useState([]);
  const [formData, setFormData] = useState({
    store: '',
    merchandiser: '',
    scheduled_date: '',
    notes: '',
    break_duration: '30',
    break_window_start: '12:00',
    break_window_end: '14:00',
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchVisits();
    fetchStores();
    fetchMerchandisers();
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

  const fetchStores = async () => {
    try {
      const data = await storeService.getStores({ page_size: 1000 });
      setStores(data.results ?? []);
    } catch (err) {
      console.error('Error fetching stores:', err);
    }
  };

  const fetchMerchandisers = async () => {
    try {
      const data = await userService.getUsers({ role: 'merchandiser', page_size: 1000 });
      setMerchandisers(data.results ?? []);
    } catch (err) {
      console.error('Error fetching merchandisers:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleScheduleVisit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    if (!formData.store || !formData.merchandiser || !formData.scheduled_date) {
      setFormError('Store, Merchandiser, and Scheduled Date are required');
      setSubmitting(false);
      return;
    }

    try {
      await visitService.createVisit({
        store: parseInt(formData.store, 10),
        merchandiser: parseInt(formData.merchandiser, 10),
        scheduled_date: formData.scheduled_date,
        notes: formData.notes,
        break_duration: parseInt(formData.break_duration, 10),
        break_window_start: formData.break_window_start,
        break_window_end: formData.break_window_end,
        status: 'SCHEDULED',
      });

      setSuccessMessage('Visit scheduled successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      setShowScheduleModal(false);
      setFormData({
        store: '',
        merchandiser: '',
        scheduled_date: '',
        notes: '',
        break_duration: '30',
        break_window_start: '12:00',
        break_window_end: '14:00',
      });
      await fetchVisits();
    } catch (err) {
      console.error('Error scheduling visit:', err);
      setFormError(err.response?.data?.detail || 'Failed to schedule visit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSchedule = () => {
    setShowScheduleModal(false);
    setFormData({
      store: '',
      merchandiser: '',
      scheduled_date: '',
      notes: '',
      break_duration: '30',
      break_window_start: '12:00',
      break_window_end: '14:00',
    });
    setFormError('');
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
            <div>
              <h1>Visits</h1>
              <p>Manage merchandiser visits ({count} total)</p>
            </div>
            <button className="add-btn" onClick={() => setShowScheduleModal(true)}>
              + Schedule Visit
            </button>
          </div>

          {successMessage && (
            <div className="success-message">
              {successMessage}
            </div>
          )}

          {loading ? (
            <div className="loading">Loading visits...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Store</th>
                    <th>Merchandiser</th>
                    <th>Status</th>
                    <th>Scheduled Date</th>
                    <th>Check-In Time</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="no-data">
                        No visits found
                      </td>
                    </tr>
                  ) : (
                    visits.map((visit) => (
                      <tr key={visit.id}>
                        <td>{visit.id}</td>
                        <td>
                          {(() => {
                            // Check if store_name exists from backend
                            if (visit.store_name) return visit.store_name;
                            
                            // Try to find store by ID
                            if (visit.store) {
                              const store = stores.find(s => s.id === visit.store);
                              if (store) {
                                return store.name;
                              }
                              // If store not found in list, show the ID
                              return `ID: ${visit.store}`;
                            }
                            
                            return 'N/A';
                          })()}
                        </td>
                        <td>
                          {(() => {
                            // Check if merchandiser_name exists from backend
                            if (visit.merchandiser_name) return visit.merchandiser_name;
                            
                            // Try to find merchandiser by ID
                            if (visit.merchandiser) {
                              const merchandiser = merchandisers.find(m => m.id === visit.merchandiser);
                              if (merchandiser) {
                                return `${merchandiser.first_name} ${merchandiser.last_name}`;
                              }
                              // If merchandiser not found in list, show the ID
                              return `ID: ${visit.merchandiser}`;
                            }
                            
                            return 'N/A';
                          })()}
                        </td>
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
                          {(() => {
                            // Check for various possible field names for check-in time
                            const checkInTime = visit.check_in_time || visit.checked_in_at || visit.checkin_time;
                            
                            if (checkInTime) {
                              const date = new Date(checkInTime);
                              return date.toLocaleString();
                            }
                            
                            // Show dash if not checked in yet
                            if (visit.status === 'SCHEDULED') {
                              return '-';
                            }
                            
                            return 'N/A';
                          })()}
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

      {/* Schedule Visit Modal */}
      {showScheduleModal && (
        <div className="modal-overlay" onClick={handleCancelSchedule}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Schedule New Visit</h2>
              <button className="close-btn" onClick={handleCancelSchedule}>×</button>
            </div>
            <form onSubmit={handleScheduleVisit}>
              <div className="form-body">
                {formError && (
                  <div className="form-error">{formError}</div>
                )}
                
                <div className="form-group">
                  <label htmlFor="store">Store *</label>
                  <select
                    id="store"
                    name="store"
                    value={formData.store}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">-- Select a store --</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        [{store.code || store.id}] {store.name} - {store.address}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="merchandiser">Merchandiser *</label>
                  <select
                    id="merchandiser"
                    name="merchandiser"
                    value={formData.merchandiser}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">-- Select a merchandiser --</option>
                    {merchandisers.map((merch) => (
                      <option key={merch.id} value={merch.id}>
                        {merch.first_name} {merch.last_name} ({merch.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="scheduled_date">Scheduled Date & Time *</label>
                  <input
                    type="datetime-local"
                    id="scheduled_date"
                    name="scheduled_date"
                    value={formData.scheduled_date}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <h3 style={{marginBottom: '15px', marginTop: '20px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)'}}>Break Management</h3>

                <div className="form-group">
                  <label htmlFor="break_duration">Break Duration (minutes)</label>
                  <input
                    type="number"
                    id="break_duration"
                    name="break_duration"
                    min="15"
                    max="120"
                    value={formData.break_duration}
                    onChange={handleInputChange}
                    placeholder="30"
                  />
                </div>

                <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
                  <div className="form-group">
                    <label htmlFor="break_window_start">Break Window Start Time</label>
                    <input
                      type="time"
                      id="break_window_start"
                      name="break_window_start"
                      value={formData.break_window_start}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="break_window_end">Break Window End Time</label>
                    <input
                      type="time"
                      id="break_window_end"
                      name="break_window_end"
                      value={formData.break_window_end}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="notes">Notes (Optional)</label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Add any additional notes or instructions..."
                    rows="4"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={handleCancelSchedule}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={submitting}>
                  {submitting ? 'Scheduling...' : 'Schedule Visit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Visits;
