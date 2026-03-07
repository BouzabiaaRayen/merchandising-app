import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { leaveRequestService } from '../services/apiService';
import '../App.css';

const LeaveRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await leaveRequestService.getLeaveRequests({ page_size: 200 });
      setRequests(data?.results || data || []);
    } catch (err) {
      console.error('Failed to fetch leave requests:', err);
      setError('Impossible de charger les demandes de congé.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  const counts = useMemo(() => {
    const pending = requests.filter(r => r.status === 'pending').length;
    const approved = requests.filter(r => r.status === 'approved').length;
    const rejected = requests.filter(r => r.status === 'rejected').length;
    return { pending, approved, rejected };
  }, [requests]);

  const updateStatus = async (id, action) => {
    try {
      setActionLoadingId(id);
      if (action === 'approve') {
        await leaveRequestService.approveLeaveRequest(id);
      } else {
        await leaveRequestService.rejectLeaveRequest(id);
      }
      await fetchLeaveRequests();
    } catch (err) {
      console.error(`Failed to ${action} leave request:`, err);
      alert(`Erreur lors de l'action: ${action}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const statusMeta = (status) => {
    if (status === 'approved') return { label: 'APPROUVÉ', bg: '#E6F7EE', color: '#1F9D57' };
    if (status === 'rejected') return { label: 'REFUSÉ', bg: '#FDEBEC', color: '#E02424' };
    return { label: 'EN ATTENTE', bg: '#FFF4DB', color: '#D08700' };
  };

  const resolveDocumentUrl = (req) => {
    const raw = req.supporting_document_url || req.supporting_document;
    if (!raw) return null;

    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw;
    }

    if (raw.startsWith('/')) {
      return `http://localhost:8000${raw}`;
    }

    return `http://localhost:8000/${raw}`;
  };

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="page-container">
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1>Leave Requests</h1>
              <p>Gérer les demandes de congé des merchandisers</p>
            </div>
            <button
              onClick={fetchLeaveRequests}
              style={{
                padding: '10px 20px',
                background: '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              🔄 Actualiser
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: 'white', borderRadius: '12px', padding: '14px' }}>
              <div style={{ color: '#D08700', fontWeight: 700 }}>En attente</div>
              <div style={{ fontSize: '24px', fontWeight: 700 }}>{counts.pending}</div>
            </div>
            <div style={{ background: 'white', borderRadius: '12px', padding: '14px' }}>
              <div style={{ color: '#1F9D57', fontWeight: 700 }}>Approuvées</div>
              <div style={{ fontSize: '24px', fontWeight: 700 }}>{counts.approved}</div>
            </div>
            <div style={{ background: 'white', borderRadius: '12px', padding: '14px' }}>
              <div style={{ color: '#E02424', fontWeight: 700 }}>Refusées</div>
              <div style={{ fontSize: '24px', fontWeight: 700 }}>{counts.rejected}</div>
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Chargement...</div>
            ) : error ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#E02424' }}>{error}</div>
            ) : requests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Aucune demande de congé</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Merchandiser</th>
                    <th>Type</th>
                    <th>Période</th>
                    <th>Document</th>
                    <th>Statut</th>
                    <th>Créée le</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => {
                    const st = statusMeta(req.status);
                    const isPending = req.status === 'pending';
                    const isActionLoading = actionLoadingId === req.id;
                    return (
                      <tr key={req.id}>
                        <td>{req.id}</td>
                        <td>{req.user_details?.username || req.user || 'N/A'}</td>
                        <td>{req.leave_type || 'Congé'}</td>
                        <td>
                          {new Date(req.start_date).toLocaleDateString('fr-FR')} - {new Date(req.end_date).toLocaleDateString('fr-FR')}
                        </td>
                        <td>
                          {resolveDocumentUrl(req) ? (
                            <a
                              href={resolveDocumentUrl(req)}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}
                            >
                              Voir document
                            </a>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>Aucun</span>
                          )}
                        </td>
                        <td>
                          <span style={{ background: st.bg, color: st.color, padding: '6px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700 }}>
                            {st.label}
                          </span>
                        </td>
                        <td>{new Date(req.created_at).toLocaleDateString('fr-FR')}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              disabled={!isPending || isActionLoading}
                              onClick={() => updateStatus(req.id, 'approve')}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: 'none',
                                background: isPending ? '#16a34a' : '#cbd5e1',
                                color: '#fff',
                                cursor: isPending ? 'pointer' : 'not-allowed',
                                fontSize: '12px',
                                fontWeight: 600,
                              }}
                            >
                              {isActionLoading ? '...' : 'Accepter'}
                            </button>
                            <button
                              disabled={!isPending || isActionLoading}
                              onClick={() => updateStatus(req.id, 'reject')}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: 'none',
                                background: isPending ? '#dc2626' : '#cbd5e1',
                                color: '#fff',
                                cursor: isPending ? 'pointer' : 'not-allowed',
                                fontSize: '12px',
                                fontWeight: 600,
                              }}
                            >
                              {isActionLoading ? '...' : 'Refuser'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveRequests;
