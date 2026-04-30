import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { complaintService } from '../services/apiService';
import '../App.css';

const CATEGORY_LABELS = {
  technical: 'Technical',
  logistics: 'Logistics',
  hr: 'HR',
  store: 'Store',
  product: 'Product',
  other: 'Other',
};

const STATUS_META = {
  pending: { label: 'PENDING', bg: 'var(--bg-surface-soft)', color: 'var(--warning)' },
  in_progress: { label: 'IN PROGRESS', bg: 'var(--bg-surface-soft)', color: 'var(--info)' },
  resolved: { label: 'RESOLVED', bg: 'var(--bg-surface-soft)', color: 'var(--success)' },
  rejected: { label: 'REJECTED', bg: 'var(--bg-surface-soft)', color: 'var(--danger)' },
};

const Complaints = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [responseText, setResponseText] = useState('');
  const [responseStatus, setResponseStatus] = useState('in_progress');
  const [actionLoading, setActionLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await complaintService.getComplaints({ page_size: 200 });
      setComplaints(data?.results || data || []);
    } catch (err) {
      console.error('Failed to fetch complaints:', err);
      setError('Failed to load complaints.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const counts = useMemo(() => ({
    pending: complaints.filter(c => c.status === 'pending').length,
    in_progress: complaints.filter(c => c.status === 'in_progress').length,
    resolved: complaints.filter(c => c.status === 'resolved').length,
    rejected: complaints.filter(c => c.status === 'rejected').length,
  }), [complaints]);

  const filtered = useMemo(() => {
    if (filterStatus === 'all') return complaints;
    return complaints.filter(c => c.status === filterStatus);
  }, [complaints, filterStatus]);

  const handleRespond = async () => {
    if (!selectedComplaint) return;
    try {
      setActionLoading(true);
      await complaintService.respondToComplaint(selectedComplaint.id, {
        status: responseStatus,
        admin_response: responseText,
      });
      setSelectedComplaint(null);
      setResponseText('');
      setResponseStatus('in_progress');
      await fetchComplaints();
    } catch (err) {
      console.error('Failed to respond:', err);
      alert('Error responding to complaint.');
    } finally {
      setActionLoading(false);
    }
  };

  const openDetail = (complaint) => {
    setSelectedComplaint(complaint);
    setResponseText(complaint.admin_response || '');
    setResponseStatus(
      complaint.status === 'pending' ? 'in_progress' : complaint.status
    );
  };

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="page-container">
          {/* Header */}
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1>Complaints</h1>
              <p>Manage complaints from merchandisers</p>
            </div>
            <button
              onClick={fetchComplaints}
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
              🔄 Refresh
            </button>
          </div>

          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '12px', marginBottom: '20px' }}>
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <div
                key={key}
                onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
                style={{
                  background: filterStatus === key ? meta.bg : 'white',
                  borderRadius: '12px',
                  padding: '14px',
                  cursor: 'pointer',
                  border: filterStatus === key ? `2px solid ${meta.color}` : '2px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ color: meta.color, fontWeight: 700, fontSize: '13px' }}>{meta.label}</div>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>{counts[key]}</div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading...</div>
            ) : error ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--danger)' }}>{error}</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No complaints found</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Photo</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const st = STATUS_META[c.status] || STATUS_META.pending;
                    return (
                      <tr key={c.id}>
                        <td>{c.id}</td>
                        <td>{c.user_details?.username || c.user || 'N/A'}</td>
                        <td>{CATEGORY_LABELS[c.category] || c.category}</td>
                        <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.description}
                        </td>
                        <td>
                          {c.photo ? (
                            <a href={c.photo} target="_blank" rel="noreferrer" style={{ color: 'var(--info)', fontWeight: 600, textDecoration: 'none' }}>
                              View
                            </a>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>None</span>
                          )}
                        </td>
                        <td>
                          <span style={{ background: st.bg, color: st.color, padding: '6px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700 }}>
                            {st.label}
                          </span>
                        </td>
                        <td>{new Date(c.created_at).toLocaleDateString('fr-FR')}</td>
                        <td>
                          <button
                            onClick={() => openDetail(c)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '6px',
                              border: 'none',
                              background: '#6366f1',
                              color: '#fff',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 600,
                            }}
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Detail / Respond Modal */}
          {selectedComplaint && (
            <div
              style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.4)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', zIndex: 1000,
              }}
              onClick={() => setSelectedComplaint(null)}
            >
              <div
                style={{
                  background: 'white', borderRadius: '16px', padding: '2rem',
                  width: '560px', maxHeight: '90vh', overflowY: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ margin: 0 }}>Complaint #{selectedComplaint.id}</h2>
                  <button
                    onClick={() => setSelectedComplaint(null)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-secondary)' }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ display: 'grid', gap: '12px', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ fontWeight: 600, color: '#475569', fontSize: '13px' }}>User</label>
                    <p style={{ margin: '4px 0 0' }}>{selectedComplaint.user_details?.username || 'N/A'}</p>
                  </div>
                  <div>
                    <label style={{ fontWeight: 600, color: '#475569', fontSize: '13px' }}>Category</label>
                    <p style={{ margin: '4px 0 0' }}>{CATEGORY_LABELS[selectedComplaint.category] || selectedComplaint.category}</p>
                  </div>
                  <div>
                    <label style={{ fontWeight: 600, color: '#475569', fontSize: '13px' }}>Description</label>
                    <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{selectedComplaint.description}</p>
                  </div>
                  {selectedComplaint.photo && (
                    <div>
                      <label style={{ fontWeight: 600, color: '#475569', fontSize: '13px' }}>Photo</label>
                      <div style={{ marginTop: '8px' }}>
                        <img
                          src={selectedComplaint.photo}
                          alt="Complaint"
                          style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '8px', objectFit: 'cover' }}
                        />
                      </div>
                    </div>
                  )}
                  <div>
                    <label style={{ fontWeight: 600, color: '#475569', fontSize: '13px' }}>Current Status</label>
                    <p style={{ margin: '4px 0 0' }}>
                      <span style={{
                        background: (STATUS_META[selectedComplaint.status] || STATUS_META.pending).bg,
                        color: (STATUS_META[selectedComplaint.status] || STATUS_META.pending).color,
                        padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700,
                      }}>
                        {(STATUS_META[selectedComplaint.status] || STATUS_META.pending).label}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label style={{ fontWeight: 600, color: '#475569', fontSize: '13px' }}>Date</label>
                    <p style={{ margin: '4px 0 0' }}>{new Date(selectedComplaint.created_at).toLocaleString('fr-FR')}</p>
                  </div>
                </div>

                {/* Response Form */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>Respond</h3>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontWeight: 600, color: '#475569', fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                      Set Status
                    </label>
                    <select
                      value={responseStatus}
                      onChange={(e) => setResponseStatus(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: '8px',
                        border: '1px solid #d1d5db', fontSize: '14px',
                      }}
                    >
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontWeight: 600, color: '#475569', fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                      Admin Response
                    </label>
                    <textarea
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder="Write your response..."
                      rows={4}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: '8px',
                        border: '1px solid #d1d5db', fontSize: '14px', resize: 'vertical',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setSelectedComplaint(null)}
                      style={{
                        padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db',
                        background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRespond}
                      disabled={actionLoading}
                      style={{
                        padding: '10px 20px', borderRadius: '8px', border: 'none',
                        background: '#6366f1', color: 'white', cursor: actionLoading ? 'not-allowed' : 'pointer',
                        fontSize: '14px', fontWeight: 600, opacity: actionLoading ? 0.7 : 1,
                      }}
                    >
                      {actionLoading ? 'Sending...' : 'Send Response'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Complaints;
