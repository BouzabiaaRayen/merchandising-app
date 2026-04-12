import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { visitService, userService, storeService, scheduleService } from '../services/apiService';
import { getAvatarUrl } from '../services/supabaseClient';
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
    stores: [], // array of selected store IDs
    merchandiser: '',
    scheduled_date: '',
    notes: '',
  });
  // Visit durations per store (default 30 min)
  const [visitDurations, setVisitDurations] = useState({});
  // Haversine formula for travel time estimation (in minutes, assuming 40km/h avg speed)
  function haversine(lat1, lon1, lat2, lon2) {
    const toRad = (x) => (x * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d;
  }

  function estimateTravelTime(from, to) {
    if (!from || !to || !from.latitude || !from.longitude || !to.latitude || !to.longitude) return 0;
    const dist = haversine(from.latitude, from.longitude, to.latitude, to.longitude);
    // Assume 40km/h average speed
    return Math.round((dist / 40) * 60);
  }

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
    const { name, value, type, checked } = e.target;
    if (name === 'stores') {
      const storeId = parseInt(value, 10);
      setFormData((prev) => {
        const newStores = checked
          ? [...prev.stores, storeId]
          : prev.stores.filter((id) => id !== storeId);
        return { ...prev, stores: newStores };
      });
      // Set default duration if adding
      if (checked) {
        setVisitDurations((durs) =>
          !durs[storeId] ? { ...durs, [storeId]: 30 } : durs
        );
      }
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleDurationChange = (storeId, value) => {
    setVisitDurations((prev) => ({ ...prev, [storeId]: Number(value) }));
  };

  const handleScheduleVisit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    if (!formData.stores.length || !formData.merchandiser || !formData.scheduled_date) {
      setFormError('At least one store, merchandiser, and scheduled date are required');
      setSubmitting(false);
      return;
    }

    try {
      // Schedule a visit for each selected store
      await Promise.all(
        formData.stores.map((storeId) =>
          visitService.createVisit({
            store: storeId,
            merchandiser: parseInt(formData.merchandiser, 10),
            scheduled_date: formData.scheduled_date,
            notes: formData.notes,
            status: 'SCHEDULED',
          })
        )
      );
      setSuccessMessage('Visits scheduled successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      setShowScheduleModal(false);
      setFormData({
        stores: [],
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
            <div>
              <button className="add-btn" onClick={() => setShowScheduleModal(true)}>
                + Schedule Visit
              </button>
            </div>
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
                                  {merchandiser?.avatar_url || merchandiser?.avatar ? (
                                    (() => {
                                      const url = getAvatarUrl(merchandiser.avatar_url || merchandiser.avatar);
                                      return url ? (
                                        <img
                                          src={url}
                                          alt="avatar"
                                          style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                                        />
                                      ) : (
                                        <>
                                          {merchandiser?.first_name?.charAt(0) || 'M'}
                                          {merchandiser?.last_name?.charAt(0) || ''}
                                        </>
                                      );
                                    })()
                                  ) : (
                                    <>
                                      {merchandiser?.first_name?.charAt(0) || 'M'}
                                      {merchandiser?.last_name?.charAt(0) || ''}
                                    </>
                                  )}
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
                  <label>Stores *</label>
                  <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '6px', padding: '4px 0 4px 0' }}>
                    {stores.map((store) => (
                      <div key={store.id} style={{ display: 'flex', alignItems: 'flex-start', padding: '6px 0', marginBottom: 2 }}>
                        <div style={{ width: 22, display: 'flex', justifyContent: 'center' }}>
                          <input
                            type="checkbox"
                            id={`store_${store.id}`}
                            name="stores"
                            value={store.id}
                            checked={formData.stores.includes(store.id)}
                            onChange={handleInputChange}
                            style={{ marginTop: 2, marginLeft: 0 }}
                          />
                        </div>
                        <label htmlFor={`store_${store.id}`} style={{ marginLeft: 8, width: '100%', cursor: 'pointer', textAlign: 'left' }}>
                          <div style={{ fontWeight: 500, color: '#222', textAlign: 'left' }}>{store.name}</div>
                          <div style={{ fontSize: '12px', color: '#888', marginTop: 1, textAlign: 'left' }}>{store.address}</div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Route Feasibility Summary - Redesigned to match screenshot */}
                {formData.stores.length > 0 && (() => {
                  // Calculations
                  const visitTime = formData.stores.reduce((sum, id) => sum + (visitDurations[id] || 30), 0);
                  const travelSegments = formData.stores.length > 1
                    ? formData.stores.slice(0, -1).map((id, idx, arr) => {
                        const from = stores.find(s => s.id === arr[idx]);
                        const to = stores.find(s => s.id === formData.stores[idx + 1]);
                        return { from, to, mins: estimateTravelTime(from, to) };
                      })
                    : [];
                  const travelTime = travelSegments.reduce((sum, seg) => sum + seg.mins, 0);
                  const breakTime = 60;
                  const total = visitTime + travelTime + breakTime;
                  const start = 8 * 60; // 8:00 AM in minutes
                  const end = start + total;
                  const endHour = Math.floor(end / 60);
                  const endMin = end % 60;
                  const endTimeStr = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
                  const feasible = end <= (17 * 60 + 30);

                  // Colors (must be defined before use)
                  // Minimal, modern, light UI
                  const accent = feasible ? '#4fbb6f' : '#f97373';
                  return (
                    <div style={{
                      border: `1.5px solid #ececec`,
                      borderRadius: 16,
                      margin: '24px 0',
                      background: '#fff',
                      boxShadow: '0 2px 12px 0 rgba(60,60,60,0.04)',
                      padding: 0,
                      overflow: 'hidden',
                      fontFamily: 'Inter, Arial, sans-serif',
                      color: '#23272f',
                      transition: 'box-shadow 0.2s',
                    }}>
                      {/* Header */}
                      <div style={{ background: '#f8fafc', color: accent, padding: '14px 24px', fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', borderBottom: '1px solid #ececec', letterSpacing: 0.1 }}>
                        <span role="img" aria-label="calendar" style={{ marginRight: 10, fontSize: 18 }}>🗓️</span>
                        Route Feasibility <span style={{ color: '#b0b4ba', marginLeft: 8, fontWeight: 400 }}>(8 AM - 5:30 PM)</span>
                      </div>
                      <div style={{ padding: '22px 24px 12px 24px' }}>
                        {/* Store Visits */}
                        <div style={{ fontWeight: 500, marginBottom: 10, color: '#7b7f87', fontSize: 13 }}>Store Visits</div>
                        <div style={{ marginBottom: 18 }}>
                          {formData.stores.map((id, idx) => {
                            const store = stores.find(s => s.id === id);
                            return store ? (
                              <div key={id} style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                                <span style={{ fontWeight: 500, minWidth: 18, fontSize: 13, color: '#b0b4ba' }}>{idx + 1}.</span>
                                <span style={{ marginLeft: 10, flex: 1, fontSize: 14, color: '#23272f' }}>{store.name}</span>
                                <input
                                  type="number"
                                  min={10}
                                  max={180}
                                  value={visitDurations[id] || 30}
                                  onChange={e => handleDurationChange(id, e.target.value)}
                                  style={{ width: 38, marginLeft: 10, height: 22, borderRadius: 8, border: '1px solid #ececec', paddingLeft: 4, fontSize: 13, background: '#f8fafc', color: '#23272f' }}
                                  title="Visit duration (minutes)"
                                />
                                <span style={{ marginLeft: 5, fontSize: 12, color: '#b0b4ba' }}>min</span>
                              </div>
                            ) : null;
                          })}
                        </div>
                        {/* Travel Times */}
                        <div style={{ fontWeight: 500, marginBottom: 10, color: '#7b7f87', fontSize: 13 }}>Travel Times (GPS-based)</div>
                        <div style={{ marginBottom: 18 }}>
                          {travelSegments.length === 0 && <div style={{ color: '#b0b4ba', fontSize: 12 }}>N/A</div>}
                          {travelSegments.map((seg, idx) => (
                            <div key={idx} style={{ color: accent, fontSize: 12.5, display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                              <span style={{ minWidth: 70, color: '#b0b4ba' }}>{seg.from?.name} <span style={{ color: '#d1d5db' }}>→</span> {seg.to?.name}:</span>
                              <span style={{ color: accent, fontWeight: 500, marginLeft: 8 }}>{seg.mins} min</span>
                            </div>
                          ))}
                        </div>
                        {/* Totals */}
                        <div style={{ marginBottom: 2, fontSize: 13.5, color: '#23272f', display: 'block' }}>
                          <div><b>Total Visits:</b> {formData.stores.length}</div>
                          <div><b>Total Travel:</b> {travelTime} min</div>
                          <div><b>Total Visit Time:</b> {visitTime} min</div>
                          <div><b>Break (fixed):</b> 60 min (12:00 - 13:00)</div>
                        </div>
                        <div style={{ margin: '18px 0 0 0', fontWeight: 600, fontSize: 14, color: accent, display: 'flex', alignItems: 'center', gap: 18 }}>
                          <span role="img" aria-label="clock" style={{ fontSize: 15 }}>⏰</span>
                          <span>Total Duration: {Math.floor(total / 60)}h {total % 60}m</span>
                          <span>|</span>
                          <span>Estimated End: {endTimeStr}</span>
                        </div>
                        {/* Feasibility Message */}
                        <div style={{
                          marginTop: 16,
                          padding: '12px 16px',
                          borderRadius: 10,
                          background: feasible ? '#f6fef9' : '#fff6f6',
                          color: accent,
                          fontWeight: 500,
                          fontSize: 13.5,
                          border: `1px solid ${accent}`,
                          display: 'flex',
                          alignItems: 'center',
                          boxShadow: '0 1px 4px 0 rgba(60,60,60,0.03)',
                        }}>
                          {feasible ? (
                            <>
                              <span role="img" aria-label="check" style={{ marginRight: 10, fontSize: 15 }}>✅</span>
                              Route feasible - Should finish by {endTimeStr}
                            </>
                          ) : (
                            <>
                              <span role="img" aria-label="warning" style={{ marginRight: 10, fontSize: 15 }}>⚠️</span>
                              This route may exceed 5:30 PM - Estimated end: {endTimeStr}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

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
                  <label htmlFor="scheduled_date">Scheduled Date *</label>
                  <input
                    type="date"
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
