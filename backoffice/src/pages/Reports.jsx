import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { documentService, userService } from '../services/apiService';
import {
  FileSpreadsheet, Calendar, User, Download, Trash2,
  FileX, RefreshCw, ChevronDown, CheckSquare, Square,
} from 'lucide-react';
import '../App.css';
import './Reports.css';

const toISODate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const isToday = (dateStr) => {
  if (!dateStr) return false;
  return new Date(dateStr).toDateString() === new Date().toDateString();
};

const Reports = () => {
  const [mode, setMode] = useState('today'); // 'today' | 'user'
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [merchandisers, setMerchandisers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUserName, setSelectedUserName] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  /* ── fetch merchandisers for dropdown ── */
  useEffect(() => {
    userService.getUsers({ page_size: 500 })
      .then(res => {
        const all = res?.results ?? res ?? [];
        const merch = all.filter(u =>
          (u.role || u.user_type || '').toLowerCase().includes('merch') ||
          u.is_merchandiser === true
        );
        setMerchandisers(merch.length > 0 ? merch : all);
      })
      .catch(() => setMerchandisers([]));
  }, []);

  /* ── fetch today on mount ── */
  useEffect(() => { fetchToday(); }, []);

  const normalizeDocs = (raw) => {
    const arr = raw?.results ?? raw ?? [];
    return arr
      .filter(d => (d.document_type || d.type || '').toLowerCase() === 'daily_report')
      .sort((a, b) => new Date(b.created_at || b.uploaded_at) - new Date(a.created_at || a.uploaded_at));
  };

  const fetchToday = useCallback(async () => {
    setLoading(true);
    setError('');
    setMode('today');
    setSelectedUserId('');
    setSelectedUserName('');
    setSelectedIds(new Set());
    try {
      const todayStr = toISODate(new Date());
      const res = await documentService.getDocuments({
        page_size: 500,
        document_type: 'daily_report',
        date: todayStr,
      });
      const all = normalizeDocs(res);
      // Client-side fallback: keep only today in case backend ignores the date param
      const todayDocs = all.filter(d => isToday(d.created_at || d.uploaded_at));
      setDocuments(todayDocs.length > 0 ? todayDocs : all.filter(d => isToday(d.created_at || d.uploaded_at)));
      // If nothing came back with the date param, maybe the API returned more
      if (all.length > 0 && todayDocs.length === 0) {
        setDocuments([]);
      }
    } catch (err) {
      console.error('Reports fetch error:', err);
      setError('Failed to load reports. Check the backend is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUserHistory = useCallback(async (userId, userName) => {
    setLoading(true);
    setError('');
    setMode('user');
    setSelectedUserId(String(userId));
    setSelectedUserName(userName);
    setSelectedIds(new Set());
    try {
      const res = await documentService.getDocuments({
        page_size: 1000,
        document_type: 'daily_report',
        uploaded_by: userId,
        user_id: userId,
        merchandiser: userId,
      });
      const all = normalizeDocs(res);
      // Client-side fallback: filter by user id
      const userDocs = all.filter(d => {
        const uid = d.uploaded_by || d.merchandiser || d.user || d.merchandiser_details?.id;
        return String(uid) === String(userId);
      });
      setDocuments(userDocs.length > 0 ? userDocs : all);
    } catch (err) {
      console.error('Reports user history fetch error:', err);
      setError('Failed to load history for this merchandiser.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUserSelect = (e) => {
    const val = e.target.value;
    if (!val) {
      fetchToday();
    } else {
      const user = merchandisers.find(u => String(u.id) === String(val));
      const name = user?.full_name || user?.username || `User ${val}`;
      fetchUserHistory(val, name);
    }
  };

  /* ── search filter (client-side on top of mode fetch) ── */
  const filteredDocuments = documents.filter(doc => {
    if (!searchQuery.trim()) return true;
    const name = (
      doc.merchandiser_details?.username ||
      doc.merchandiser_details?.full_name ||
      doc.merchandiser_name || ''
    ).toLowerCase();
    return name.includes(searchQuery.toLowerCase().trim());
  });

  /* ── bulk selection ── */
  const allSelected = filteredDocuments.length > 0 && filteredDocuments.every(d => selectedIds.has(d.id));

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDocuments.map(d => d.id)));
    }
  };

  const downloadSelected = () => {
    filteredDocuments
      .filter(d => selectedIds.has(d.id))
      .forEach(d => { if (d.file_url) window.open(d.file_url, '_blank'); });
  };

  const deleteSelected = async () => {
    if (!window.confirm(`Supprimer ${selectedIds.size} rapport(s) sélectionné(s) ?`)) return;
    const ids = [...selectedIds];
    await Promise.allSettled(ids.map(id => documentService.deleteDocument(id)));
    setDocuments(prev => prev.filter(d => !selectedIds.has(d.id)));
    setSelectedIds(new Set());
  };

  /* ── single actions ── */
  const handleDownload = (doc) => {
    if (doc.file_url) window.open(doc.file_url, '_blank');
    else alert('File not available');
  };

  const handleDelete = async (doc) => {
    if (!window.confirm('Delete this report?')) return;
    try {
      await documentService.deleteDocument(doc.id);
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      setSelectedIds(prev => { const next = new Set(prev); next.delete(doc.id); return next; });
    } catch {
      alert('Delete failed');
    }
  };

  const fmt = (dateStr) =>
    new Date(dateStr).toLocaleDateString('fr-FR', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <div className="page-container reports-page">

          {/* ── Header ── */}
          <div className="page-header">
            <div>
              <h1>Rapports</h1>
              <p>
                {mode === 'today'
                  ? "Rapports soumis aujourd'hui"
                  : `Historique complet — ${selectedUserName}`}
              </p>
            </div>
            <div className="reports-actions">
              {selectedIds.size > 0 && (
                <>
                  <button className="bulk-download-btn" onClick={downloadSelected}>
                    <Download size={14} />
                    Télécharger ({selectedIds.size})
                  </button>
                  <button className="bulk-delete-btn" onClick={deleteSelected}>
                    <Trash2 size={14} />
                    Supprimer ({selectedIds.size})
                  </button>
                </>
              )}
              <button className="refresh-btn" onClick={fetchToday} disabled={loading}>
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
                Aujourd'hui
              </button>
            </div>
          </div>

          {/* ── Controls bar ── */}
          <div className="filters-bar">
            <div className="filters-left">
              {/* Merchandiser select */}
              <div className="merch-select-wrap">
                <User size={14} className="merch-select-icon" />
                <select
                  className="merch-select"
                  value={selectedUserId}
                  onChange={handleUserSelect}
                >
                  <option value="">Tous (Aujourd'hui)</option>
                  {merchandisers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.username || `User ${u.id}`}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="merch-select-arrow" />
              </div>

              {/* Mode badge */}
              <span className={`mode-badge ${mode}`}>
                {mode === 'today' ? "Aujourd'hui" : 'Historique'}
              </span>
            </div>

            <div className="filters-right">
              <input
                type="text"
                placeholder="Rechercher par nom..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="user-search-box"
              />
              <span className="filters-count">{filteredDocuments.length} rapport(s)</span>
            </div>
          </div>

          {/* ── List ── */}
          <div className="reports-list-card">
            {loading ? (
              <div className="reports-loading">Chargement…</div>
            ) : error ? (
              <div className="reports-error">
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
                <div className="reports-error-title">{error}</div>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="reports-empty">
                <FileX size={38} strokeWidth={1.2} />
                <p>
                  {mode === 'today'
                    ? "Aucun rapport soumis aujourd'hui"
                    : 'Aucun rapport pour ce merchandiser'}
                </p>
              </div>
            ) : (
              <>
                {/* Select-all row */}
                <div className="select-all-row">
                  <button className="select-all-btn" onClick={toggleSelectAll}>
                    {allSelected
                      ? <CheckSquare size={15} color="#4f46e5" />
                      : <Square size={15} color="#94a3b8" />}
                    <span>{allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}</span>
                  </button>
                </div>

                {filteredDocuments.map(doc => (
                  <div
                    key={doc.id}
                    className={`report-item${selectedIds.has(doc.id) ? ' selected' : ''}`}
                  >
                    {/* Checkbox */}
                    <button
                      className="report-checkbox"
                      onClick={() => toggleSelect(doc.id)}
                      aria-label="Select"
                    >
                      {selectedIds.has(doc.id)
                        ? <CheckSquare size={16} color="#4f46e5" />
                        : <Square size={16} color="#cbd5e1" />}
                    </button>

                    {/* Icon */}
                    <div className="report-icon">
                      <FileSpreadsheet size={18} strokeWidth={1.5} />
                    </div>

                    {/* Info */}
                    <div className="report-info">
                      <div className="report-title">{doc.title || 'Rapport Journalier'}</div>
                      <div className="report-meta">
                        <span><Calendar size={12} /> {fmt(doc.created_at || doc.uploaded_at)}</span>
                        {(doc.merchandiser_details?.username || doc.merchandiser_details?.full_name || doc.merchandiser_name) && (
                          <span>
                            <User size={12} />
                            {doc.merchandiser_details?.full_name || doc.merchandiser_details?.username || doc.merchandiser_name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="report-actions">
                      <button onClick={() => handleDownload(doc)} className="report-download">
                        <Download size={13} />
                      </button>
                      <button onClick={() => handleDelete(doc)} className="report-delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default Reports;
