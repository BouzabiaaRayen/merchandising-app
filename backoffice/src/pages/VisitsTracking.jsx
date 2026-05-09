import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { visitService, userService, storeService } from '../services/apiService';
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

const WEEK_DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

const DEFAULT_VISIT_BREAK_SETTINGS = {
  break_duration: 30,
  break_window_start: '12:00',
  break_window_end: '14:00',
};

const TERRITORY_STORAGE_KEY = 'mds_territories_v1';
const WORKING_DAYS_STORAGE_KEY = 'mds_working_days_v1';

const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInput = (value) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const getStartOfWeek = (date) => {
  const baseDate = new Date(date);
  const day = baseDate.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  baseDate.setDate(baseDate.getDate() + diff);
  baseDate.setHours(0, 0, 0, 0);
  return baseDate;
};

const addDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const toApiDateTime = (date) => `${toDateInputValue(date)}T09:00:00`;

// ─── Auto-planning algorithms ─────────────────────────────────────────────────

const autoDistributeStores = (allStores, allMerchandisers) => {
  if (!allMerchandisers.length) return {};
  const sorted = [...allStores].sort((a, b) => a.id - b.id);
  const result = {};
  allMerchandisers.forEach((m) => { result[m.id] = []; });
  sorted.forEach((store, index) => {
    const merch = allMerchandisers[index % allMerchandisers.length];
    result[merch.id].push(store.id);
  });
  return result;
};

// Round-robin within one merchandiser's territory across working days
const buildMerchandiserWeek = (storeIds, workingDayValues) => {
  const schedule = {};
  workingDayValues.forEach((d) => { schedule[d] = []; });
  storeIds.forEach((storeId, index) => {
    const dayValue = workingDayValues[index % workingDayValues.length];
    schedule[dayValue].push(storeId);
  });
  return schedule;
};

const countWeeksInRange = (startDateStr, endDateStr) => {
  const start = parseDateInput(startDateStr);
  const end = parseDateInput(endDateStr);
  if (!start || !end) return 0;
  const mondayStart = getStartOfWeek(start);
  const mondayEnd = getStartOfWeek(end);
  return Math.floor((mondayEnd - mondayStart) / (7 * 24 * 60 * 60 * 1000)) + 1;
};

const buildFullVisitPlan = (territories, allStores, allMerchandisers, workingDayValues, startDateStr, endDateStr) => {
  const visits = [];
  const startDate = parseDateInput(startDateStr);
  const endDate = parseDateInput(endDateStr);
  if (!startDate || !endDate || !workingDayValues.length) return visits;
  const mondayStart = getStartOfWeek(startDate);
  const endTime = endDate.getTime();
  allMerchandisers.forEach((merch) => {
    const storeIds = territories[merch.id] || [];
    if (!storeIds.length) return;
    const weekSchedule = buildMerchandiserWeek(storeIds, workingDayValues);
    let currentMonday = new Date(mondayStart);
    while (currentMonday.getTime() <= endTime) {
      workingDayValues.forEach((dayValue) => {
        const dayStores = weekSchedule[dayValue] || [];
        const offset = dayValue === 0 ? 6 : dayValue - 1;
        const visitDate = addDays(currentMonday, offset);
        if (visitDate.getTime() < startDate.getTime()) return;
        if (visitDate.getTime() > endTime) return;
        dayStores.forEach((storeId) => {
          const store = allStores.find((s) => s.id === storeId);
          visits.push({
            store: storeId,
            storeName: store?.name || `Store #${storeId}`,
            merchandiser: merch.id,
            scheduled_date: toApiDateTime(visitDate),
            status: 'SCHEDULED',
            break_duration: DEFAULT_VISIT_BREAK_SETTINGS.break_duration,
            break_window_start: DEFAULT_VISIT_BREAK_SETTINGS.break_window_start,
            break_window_end: DEFAULT_VISIT_BREAK_SETTINGS.break_window_end,
          });
        });
      });
      currentMonday = addDays(currentMonday, 7);
    }
  });
  return visits;
};

const persistTerritories = (t) => {
  try { localStorage.setItem(TERRITORY_STORAGE_KEY, JSON.stringify(t)); } catch (_) {}
};
const loadPersistedTerritories = () => {
  try { const raw = localStorage.getItem(TERRITORY_STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
};
const persistWorkingDays = (d) => {
  try { localStorage.setItem(WORKING_DAYS_STORAGE_KEY, JSON.stringify(d)); } catch (_) {}
};
const loadPersistedWorkingDays = () => {
  try { const raw = localStorage.getItem(WORKING_DAYS_STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
};

// ─── Component ────────────────────────────────────────────────────────────────

const VisitsTracking = () => {
  // ── Visit list ─────────────────────────────────────────────────────────────
  const [visits, setVisits] = useState([]);
  const [merchandisers, setMerchandisers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 10;
  const [successMessage, setSuccessMessage] = useState('');

  // ── Auto-planning modal ────────────────────────────────────────────────────
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [autoStep, setAutoStep] = useState(1);
  const [territories, setTerritories] = useState({});
  const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5]);
  const [planStartDate, setPlanStartDate] = useState('');
  const [planEndDate, setPlanEndDate] = useState('');
  const [territorySearch, setTerritorySearch] = useState('');
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [autoError, setAutoError] = useState('');

  // ── Override modal (emergency single-visit) ────────────────────────────────
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideForm, setOverrideForm] = useState({ store: '', merchandiser: '', scheduled_date: '' });
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [overrideError, setOverrideError] = useState('');

  useEffect(() => { fetchData(); }, [currentPage]);

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

  const getMerchandiserInfo = (id) => id ? merchandisers.find((m) => m.id === id) : null;
  const getStoreInfo = (id) => id ? stores.find((s) => s.id === id) : null;

  const calculateDuration = (checkIn, checkOut) => {
    if (!checkIn) return '0m';
    const diffMins = Math.floor((new Date(checkOut || Date.now()) - new Date(checkIn)) / 60000);
    return diffMins < 60 ? `${diffMins}m` : `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
  };

  const formatTime = (ds) => {
    if (!ds) return 'Not Recorded';
    return new Date(ds).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDate = (ds) => {
    if (!ds) return 'N/A';
    return new Date(ds).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const startEntry = (currentPage - 1) * itemsPerPage + 1;
  const endEntry = Math.min(currentPage * itemsPerPage, totalCount);

  // ── Auto-planning handlers ─────────────────────────────────────────────────

  const openAutoModal = () => {
    const saved = loadPersistedTerritories();
    const savedDays = loadPersistedWorkingDays();
    const valid = saved && merchandisers.length > 0
      && merchandisers.every((m) => Object.prototype.hasOwnProperty.call(saved, String(m.id)));
    setTerritories(valid ? saved : autoDistributeStores(stores, merchandisers));
    setWorkingDays(savedDays || [1, 2, 3, 4, 5]);
    setPlanStartDate('');
    setPlanEndDate('');
    setTerritorySearch('');
    setAutoError('');
    setAutoStep(1);
    setShowAutoModal(true);
  };

  const closeAutoModal = () => { setShowAutoModal(false); setAutoGenerating(false); setAutoError(''); };

  const handleAutoDistribute = () => setTerritories(autoDistributeStores(stores, merchandisers));

  const handleStoreTerritoryChange = (storeId, newMerchId) => {
    setTerritories((prev) => {
      const next = {};
      Object.keys(prev).forEach((k) => { next[k] = prev[k].filter((id) => id !== storeId); });
      if (newMerchId !== '') next[String(newMerchId)] = [...(next[String(newMerchId)] || []), storeId];
      return next;
    });
  };

  const handleWorkingDayToggle = (dayValue) => {
    setWorkingDays((prev) =>
      prev.includes(dayValue) ? prev.filter((d) => d !== dayValue) : [...prev, dayValue].sort()
    );
  };

  const getCurrentTerritoryForStore = (storeId) => {
    const entry = Object.entries(territories).find(([, ids]) => ids.includes(storeId));
    return entry ? entry[0] : '';
  };

  const handleAutoGenerate = async () => {
    if (!planStartDate || !planEndDate) { setAutoError('Select a start and end date.'); return; }
    if (planEndDate < planStartDate) { setAutoError('End date must be after start date.'); return; }
    if (!workingDays.length) { setAutoError('Select at least one working day.'); return; }
    const allVisits = buildFullVisitPlan(territories, stores, merchandisers, workingDays, planStartDate, planEndDate);
    if (!allVisits.length) { setAutoError('Nothing to generate. Check territories, working days and dates.'); return; }
    setAutoGenerating(true);
    setAutoError('');
    try {
      const BATCH = 20;
      for (let i = 0; i < allVisits.length; i += BATCH) {
        await Promise.all(
          allVisits.slice(i, i + BATCH).map((v) =>
            visitService.createVisit({
              store: v.store,
              merchandiser: v.merchandiser,
              scheduled_date: v.scheduled_date,
              status: v.status,
              break_duration: v.break_duration,
              break_window_start: v.break_window_start,
              break_window_end: v.break_window_end,
            })
          )
        );
      }
      persistTerritories(territories);
      persistWorkingDays(workingDays);
      setSuccessMessage(`${allVisits.length} visits generated for all merchandisers.`);
      setTimeout(() => setSuccessMessage(''), 5000);
      closeAutoModal();
      fetchData();
    } catch (err) {
      console.error('Error generating visits:', err);
      setAutoError(err.response?.data?.detail || 'Generation failed. Please try again.');
    } finally {
      setAutoGenerating(false);
    }
  };

  // ── Override handlers ──────────────────────────────────────────────────────

  const openOverrideModal = () => {
    setOverrideForm({ store: '', merchandiser: '', scheduled_date: '' });
    setOverrideError('');
    setShowOverrideModal(true);
  };
  const closeOverrideModal = () => { setShowOverrideModal(false); setOverrideError(''); };

  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!overrideForm.store || !overrideForm.merchandiser || !overrideForm.scheduled_date) {
      setOverrideError('All fields are required.');
      return;
    }
    setOverrideSubmitting(true);
    setOverrideError('');
    try {
      await visitService.createVisit({
        store: parseInt(overrideForm.store, 10),
        merchandiser: parseInt(overrideForm.merchandiser, 10),
        scheduled_date: `${overrideForm.scheduled_date}T09:00:00`,
        status: 'SCHEDULED',
        ...DEFAULT_VISIT_BREAK_SETTINGS,
      });
      setSuccessMessage('Override visit added.');
      setTimeout(() => setSuccessMessage(''), 3000);
      closeOverrideModal();
      fetchData();
    } catch (err) {
      setOverrideError(err.response?.data?.detail || 'Failed to add override visit.');
    } finally {
      setOverrideSubmitting(false);
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────────

  const filteredStoresForTerritory = stores.filter((s) => {
    const text = `${s.name || ''} ${s.address || s.location || ''}`.toLowerCase();
    return text.includes(territorySearch.trim().toLowerCase());
  });

  const unassignedStores = stores.filter((s) => getCurrentTerritoryForStore(s.id) === '');

  const previewPlan = autoStep === 3
    ? buildFullVisitPlan(territories, stores, merchandisers, workingDays, planStartDate, planEndDate)
    : [];

  const weeklyPreviewByMerchandiser = merchandisers.map((merch) => {
    const storeIds = territories[merch.id] || [];
    const weekSchedule = buildMerchandiserWeek(storeIds, workingDays);
    return {
      merch,
      storeCount: storeIds.length,
      schedule: WEEK_DAYS
        .filter((d) => workingDays.includes(d.value))
        .map((d) => ({
          day: d,
          stores: (weekSchedule[d.value] || []).map((id) => stores.find((s) => s.id === id)).filter(Boolean),
        })),
    };
  });

  const weekCount = countWeeksInRange(planStartDate, planEndDate);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="page-container">
          <div className="tracking-header">
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button className="add-btn" onClick={openAutoModal}>⚡ Auto Planning</button>
              <button className="btn-override" onClick={openOverrideModal}>+ Override</button>
            </div>
            <button className="clear-filters-btn" onClick={() => { setCurrentPage(1); fetchData(); }}>
              Refresh
            </button>
          </div>

          {successMessage && <div className="success-message">{successMessage}</div>}

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
                      <tr><td colSpan="6" className="no-data">No visits found</td></tr>
                    ) : (
                      visits.map((visit) => {
                        const merch = getMerchandiserInfo(visit.merchandiser);
                        const store = getStoreInfo(visit.store);
                        const sc = STATUS_CONFIG[visit.status] || { label: visit.status, class: 'default' };
                        return (
                          <tr key={visit.id}>
                            <td>
                              <div className="merchandiser-cell">
                                <div className="merchandiser-avatar">
                                  {(() => {
                                    const url = (merch?.avatar_url || merch?.avatar)
                                      ? getAvatarUrl(merch.avatar_url || merch.avatar) : null;
                                    return url
                                      ? <img src={url} alt="av" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                                      : <>{merch?.first_name?.charAt(0) || 'M'}{merch?.last_name?.charAt(0) || ''}</>;
                                  })()}
                                </div>
                                <div className="merchandiser-info">
                                  <div className="merchandiser-name">
                                    {merch ? `${merch.first_name} ${merch.last_name}` : 'Unknown'}
                                  </div>
                                  <div className="merchandiser-id">ID #{visit.merchandiser || 'N/A'}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="store-cell">
                                <div className="store-name">{store?.name || visit.store_name || 'Unknown Store'}</div>
                                <div className="store-address">{store?.address || store?.location || 'No address'}</div>
                              </div>
                            </td>
                            <td><div className="date-cell">{formatDate(visit.scheduled_date)}</div></td>
                            <td>
                              <div className="checkin-cell">
                                <div className="time-row">
                                  <span className="time-value">{formatTime(visit.check_in_time || visit.checked_in_at)}</span>
                                </div>
                                <div className="time-row">
                                  <span className="time-value secondary">{formatTime(visit.check_out_time || visit.checked_out_at)}</span>
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
                              <span className={`tracking-status-badge ${sc.class}`}>● {sc.label}</span>
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
                    let p;
                    if (totalPages <= 5) p = i + 1;
                    else if (currentPage <= 3) p = i + 1;
                    else if (currentPage >= totalPages - 2) p = totalPages - 4 + i;
                    else p = currentPage - 2 + i;
                    return (
                      <button key={p} className={`page-btn ${currentPage === p ? 'active' : ''}`}
                        onClick={() => setCurrentPage(p)}>{p}</button>
                    );
                  })}
                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <>
                      <span className="page-ellipsis">...</span>
                      <button className="page-btn" onClick={() => setCurrentPage(totalPages)}>{totalPages}</button>
                    </>
                  )}
                  {currentPage < totalPages && (
                    <button className="page-btn nav-btn" onClick={() => setCurrentPage(currentPage + 1)}>›</button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Auto Planning Modal ─────────────────────────────────────────────── */}
      {showAutoModal && (
        <div className="modal-overlay" onClick={closeAutoModal}>
          <div className="modal-content auto-plan-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header auto-plan-header">
              <div>
                <span className="auto-plan-eyebrow">Automated Planning</span>
                <h2>Generate Visit Schedule</h2>
                <p className="auto-plan-subtitle">
                  {stores.length} stores · {merchandisers.length} merchandisers · the same weekly pattern repeats indefinitely.
                </p>
              </div>
              <button className="close-btn" onClick={closeAutoModal}>×</button>
            </div>

            <div className="auto-plan-steps">
              {[
                { n: 1, label: 'Territories' },
                { n: 2, label: 'Schedule' },
                { n: 3, label: 'Preview & Generate' },
              ].map(({ n, label }) => (
                <div key={n} className={`auto-step ${autoStep === n ? 'active' : ''} ${autoStep > n ? 'done' : ''}`}>
                  <span className="auto-step-num">{autoStep > n ? '✓' : n}</span>
                  <span className="auto-step-label">{label}</span>
                </div>
              ))}
            </div>

            <div className="auto-plan-body">
              {autoError && <div className="form-error">{autoError}</div>}

              {/* Step 1 – Territory assignment */}
              {autoStep === 1 && (
                <div>
                  <div className="territory-toolbar">
                    <div className="territory-merch-pills">
                      {merchandisers.map((m) => (
                        <div key={m.id} className="territory-merch-pill">
                          <span className="territory-merch-initial">
                            {m.first_name?.charAt(0)}{m.last_name?.charAt(0)}
                          </span>
                          <div>
                            <div className="territory-merch-name">{m.first_name} {m.last_name}</div>
                            <div className="territory-merch-count">{(territories[m.id] || []).length} stores</div>
                          </div>
                        </div>
                      ))}
                      {unassignedStores.length > 0 && (
                        <div className="territory-merch-pill unassigned-pill">
                          <span className="territory-merch-initial warn">!</span>
                          <div>
                            <div className="territory-merch-name">Unassigned</div>
                            <div className="territory-merch-count">{unassignedStores.length} stores</div>
                          </div>
                        </div>
                      )}
                    </div>
                    <button type="button" className="btn-auto-dist" onClick={handleAutoDistribute}>
                      ⚡ Auto-distribute equally
                    </button>
                  </div>

                  <input
                    type="search"
                    className="store-search-input"
                    placeholder="Search stores…"
                    value={territorySearch}
                    onChange={(e) => setTerritorySearch(e.target.value)}
                    style={{ marginBottom: '0.75rem', width: '100%', boxSizing: 'border-box' }}
                  />

                  <div className="territory-store-list">
                    {filteredStoresForTerritory.map((store) => {
                      const currentId = getCurrentTerritoryForStore(store.id);
                      return (
                        <div key={store.id} className={`territory-store-row ${currentId ? 'assigned' : 'unassigned'}`}>
                          <div className="territory-store-info">
                            <span className="territory-store-name">{store.name}</span>
                            <span className="territory-store-addr">{store.address || store.location || ''}</span>
                          </div>
                          <select
                            className="territory-merch-select"
                            value={currentId}
                            onChange={(e) => handleStoreTerritoryChange(store.id, e.target.value)}
                          >
                            <option value="">— Unassigned —</option>
                            {merchandisers.map((m) => (
                              <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 2 – Working days + date range */}
              {autoStep === 2 && (
                <div className="auto-schedule-body">
                  <div className="auto-plan-section">
                    <h3 className="auto-section-title">Working Days</h3>
                    <p className="auto-section-desc">Merchandisers visit stores on these days every week.</p>
                    <div className="working-days-grid">
                      {WEEK_DAYS.map((day) => (
                        <label key={day.value} className={`working-day-pill ${workingDays.includes(day.value) ? 'active' : ''}`}>
                          <input
                            type="checkbox"
                            checked={workingDays.includes(day.value)}
                            onChange={() => handleWorkingDayToggle(day.value)}
                          />
                          {day.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="auto-plan-section">
                    <h3 className="auto-section-title">Planning Period</h3>
                    <p className="auto-section-desc">Visits will be generated for every week between these two dates.</p>
                    <div className="auto-date-row">
                      <div className="form-group">
                        <label>Start date *</label>
                        <input type="date" value={planStartDate} onChange={(e) => setPlanStartDate(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label>End date *</label>
                        <input type="date" value={planEndDate} min={planStartDate || undefined}
                          onChange={(e) => setPlanEndDate(e.target.value)} />
                      </div>
                    </div>
                    {weekCount > 0 && (
                      <div className="auto-plan-stats">
                        <div className="auto-stat"><span>{stores.length}</span><label>Total stores</label></div>
                        <div className="auto-stat"><span>{merchandisers.length}</span><label>Merchandisers</label></div>
                        <div className="auto-stat"><span>{workingDays.length}</span><label>Days / week</label></div>
                        <div className="auto-stat"><span>{weekCount}</span><label>Weeks</label></div>
                        <div className="auto-stat accent">
                          <span>{buildFullVisitPlan(territories, stores, merchandisers, workingDays, planStartDate, planEndDate).length}</span>
                          <label>Total visits</label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3 – Preview */}
              {autoStep === 3 && (
                <div className="auto-preview-body">
                  <div className="preview-summary-bar">
                    <span className="preview-total-badge">{previewPlan.length} visits to generate</span>
                    <span className="preview-period">{planStartDate} → {planEndDate} · {weekCount} week(s)</span>
                  </div>

                  <div className="preview-merch-grid">
                    {weeklyPreviewByMerchandiser.map(({ merch, storeCount, schedule }) => (
                      <div key={merch.id} className="preview-merch-card">
                        <div className="preview-merch-header">
                          <div className="preview-merch-avatar">
                            {merch.first_name?.charAt(0)}{merch.last_name?.charAt(0)}
                          </div>
                          <div>
                            <div className="preview-merch-name">{merch.first_name} {merch.last_name}</div>
                            <div className="preview-merch-meta">{storeCount} stores · {storeCount} visits/week</div>
                          </div>
                        </div>
                        <div className="preview-week-schedule">
                          {schedule.map(({ day, stores: dayStores }) => (
                            <div key={day.value} className="preview-day-row">
                              <span className="preview-day-label">{day.label.slice(0, 3)}</span>
                              <div className="preview-day-stores">
                                {dayStores.length
                                  ? dayStores.map((s) => <span key={s.id} className="preview-store-chip">{s.name}</span>)
                                  : <span className="preview-no-stores">—</span>
                                }
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer auto-plan-footer">
              <button type="button" className="btn-cancel" onClick={closeAutoModal}>Cancel</button>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {autoStep > 1 && (
                  <button type="button" className="btn-back"
                    onClick={() => { setAutoStep((s) => s - 1); setAutoError(''); }}>
                    ← Back
                  </button>
                )}
                {autoStep < 3 && (
                  <button type="button" className="btn-submit"
                    onClick={() => {
                      setAutoError('');
                      if (autoStep === 1 && unassignedStores.length > 0) {
                        setAutoError(`${unassignedStores.length} store(s) are unassigned. Use auto-distribute or assign them manually.`);
                        return;
                      }
                      if (autoStep === 2) {
                        if (!workingDays.length) { setAutoError('Select at least one working day.'); return; }
                        if (!planStartDate || !planEndDate) { setAutoError('Set a start and end date.'); return; }
                        if (planEndDate < planStartDate) { setAutoError('End date must be after start date.'); return; }
                      }
                      setAutoStep((s) => s + 1);
                    }}
                  >
                    Next →
                  </button>
                )}
                {autoStep === 3 && (
                  <button type="button" className="btn-submit btn-generate"
                    onClick={handleAutoGenerate} disabled={autoGenerating}>
                    {autoGenerating ? 'Generating…' : `Generate ${previewPlan.length} Visits`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Override Modal ──────────────────────────────────────────────────── */}
      {showOverrideModal && (
        <div className="modal-overlay" onClick={closeOverrideModal}>
          <div className="modal-content override-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Override Visit</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
                  Emergency use only — absence, unavailable store, or urgent change.
                </p>
              </div>
              <button className="close-btn" onClick={closeOverrideModal}>×</button>
            </div>
            <form onSubmit={handleOverrideSubmit}>
              <div className="form-body">
                {overrideError && <div className="form-error">{overrideError}</div>}
                <div className="form-group">
                  <label>Merchandiser *</label>
                  <select value={overrideForm.merchandiser}
                    onChange={(e) => setOverrideForm((p) => ({ ...p, merchandiser: e.target.value }))} required>
                    <option value="">— Select —</option>
                    {merchandisers.map((m) => (
                      <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Store *</label>
                  <select value={overrideForm.store}
                    onChange={(e) => setOverrideForm((p) => ({ ...p, store: e.target.value }))} required>
                    <option value="">— Select —</option>
                    {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Date *</label>
                  <input type="date" value={overrideForm.scheduled_date}
                    onChange={(e) => setOverrideForm((p) => ({ ...p, scheduled_date: e.target.value }))} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={closeOverrideModal}>Cancel</button>
                <button type="submit" className="btn-submit" disabled={overrideSubmitting}>
                  {overrideSubmitting ? 'Adding…' : 'Add Override'}
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
