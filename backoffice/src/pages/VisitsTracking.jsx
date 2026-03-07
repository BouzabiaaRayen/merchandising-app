import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { visitService, userService, storeService } from '../services/apiService';
import './VisitsTracking.css';
import './Users.css';
import './Visits.css';

const STATUS_CONFIG = {
  COMPLETED: { label: 'COMPLET', class: 'completed' },
  IN_PROGRESS: { label: 'IN PROGR', class: 'in-progress' },
  SCHEDULED: { label: 'PLANNED', class: 'scheduled' },
  CANCELLED: { label: 'MISSED', class: 'missed' },
  MISSED: { label: 'MISSED', class: 'missed' },
};

const VisitsTracking = () => {
  const [visits, setVisits] = useState([]);
  const [merchandisers, setMerchandisers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 10;
  
  // Schedule visit modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [formData, setFormData] = useState({
    store: '',
    merchandiser: '',
    scheduled_date: '',
    notes: '',
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchData();
  }, [currentPage]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [visitsData, merchandisersData, storesData] = await Promise.all([
        visitService.getVisits({ page: currentPage, page_size: itemsPerPage }),
        userService.getUsers({ role: 'merchandiser', page_size: 1000 }),
        storeService.getStores({ page_size: 1000 }),
      ]);

      setVisits(visitsData.results ?? []);
      setTotalCount(visitsData.count ?? 0);
      setMerchandisers(merchandisersData.results ?? []);
      setStores(storesData.results ?? []);
      setError('');
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load visits tracking data');
    } finally {
      setLoading(false);
    }
  };

  const getMerchandiserInfo = (merchandiserId) => {
    if (!merchandiserId) return null;
    return merchandisers.find(m => m.id === merchandiserId);
  };

  const getStoreInfo = (storeId) => {
    if (!storeId) return null;
    return stores.find(s => s.id === storeId);
  };

  const calculateDuration = (checkIn, checkOut) => {
    if (!checkIn) return '0m';
    
    const start = new Date(checkIn);
    const end = checkOut ? new Date(checkOut) : new Date();
    const diffMs = end - start;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins}m`;
    }
    
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'Not Recorded';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: '2-digit', 
      year: 'numeric' 
    });
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const startEntry = (currentPage - 1) * itemsPerPage + 1;
  const endEntry = Math.min(currentPage * itemsPerPage, totalCount);

  const handleClearFilters = () => {
    setCurrentPage(1);
    fetchData();
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
      });
      await fetchData();
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
    });
    setFormError('');
  };

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="page-container">
          <div className="tracking-header">
            <button className="add-btn" onClick={() => setShowScheduleModal(true)}>
              + Schedule Visit
            </button>
            <button className="clear-filters-btn" onClick={handleClearFilters}>
              Clear Filters
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
            <>
              <div className="tracking-table-container">
                <table className="tracking-table">
                  <thead>
                    <tr>
                      <th>MERCHANDISER</th>
                      <th>STORE NAME</th>
                      <th>PLANNED DATE</th>
                      <th>CHECK-IN / OUT</th>
                      <th>DURATION</th>
                      <th>STATUS</th>
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
                      visits.map((visit) => {
                        const merchandiser = getMerchandiserInfo(visit.merchandiser);
                        const store = getStoreInfo(visit.store);
                        const statusConfig = STATUS_CONFIG[visit.status] || { label: visit.status, class: 'default' };
                        
                        return (
                          <tr key={visit.id}>
                            <td>
                              <div className="merchandiser-cell">
                                <div className="merchandiser-avatar">
                                  {merchandiser?.first_name?.charAt(0) || 'M'}
                                  {merchandiser?.last_name?.charAt(0) || ''}
                                </div>
                                <div className="merchandiser-info">
                                  <div className="merchandiser-name">
                                    {merchandiser 
                                      ? `${merchandiser.first_name} ${merchandiser.last_name}`
                                      : 'Unknown'}
                                  </div>
                                  <div className="merchandiser-id">
                                    ID #{visit.merchandiser || 'N/A'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="store-cell">
                                <div className="store-name">
                                  {store?.name || visit.store_name || 'Unknown Store'}
                                </div>
                                <div className="store-address">
                                  {store?.address || store?.location || 'No address'}
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="date-cell">
                                {formatDate(visit.scheduled_date)}
                              </div>
                            </td>
                            <td>
                              <div className="checkin-cell">
                                <div className="time-row">
                                  <span className="time-value">
                                    {formatTime(visit.check_in_time || visit.checked_in_at)}
                                  </span>
                                </div>
                                <div className="time-row">
                                  <span className="time-value secondary">
                                    {formatTime(visit.check_out_time || visit.checked_out_at)}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="duration-cell">
                                {calculateDuration(
                                  visit.check_in_time || visit.checked_in_at,
                                  visit.check_out_time || visit.checked_out_at
                                )}
                              </div>
                            </td>
                            <td>
                              <span className={`tracking-status-badge ${statusConfig.class}`}>
                                ● {statusConfig.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="tracking-pagination">
                <div className="pagination-info">
                  Showing <strong>{startEntry}</strong> to <strong>{endEntry}</strong> of <strong>{totalCount}</strong> entries
                </div>
                <div className="pagination-buttons">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        className={`page-btn ${currentPage === pageNum ? 'active' : ''}`}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <>
                      <span className="page-ellipsis">...</span>
                      <button
                        className="page-btn"
                        onClick={() => setCurrentPage(totalPages)}
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                  {currentPage < totalPages && (
                    <button
                      className="page-btn nav-btn"
                      onClick={() => setCurrentPage(currentPage + 1)}
                    >
                      ›
                    </button>
                  )}
                </div>
              </div>
            </>
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

export default VisitsTracking;
