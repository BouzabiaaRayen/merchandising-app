import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { documentService } from '../services/apiService';
import '../App.css';

const Reports = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, today, week, month

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await documentService.getDocuments({ page_size: 1000 });
      const docs = response?.results || response || [];
      
      // Sort by created date (newest first)
      const sortedDocs = docs.sort((a, b) => 
        new Date(b.created_at || b.uploaded_at) - new Date(a.created_at || a.uploaded_at)
      );
      
      setDocuments(sortedDocs);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError('Impossible de charger les documents. Vérifiez que le backend est actif.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const fileUrl = doc.file_url;
      if (fileUrl) {
        window.open(fileUrl, '_blank');
      } else {
        alert('Fichier non disponible');
      }
    } catch (err) {
      console.error('Error downloading document:', err);
      alert('Erreur lors du téléchargement');
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
      return;
    }

    try {
      await documentService.deleteDocument(doc.id);
      setDocuments(documents.filter(d => d.id !== doc.id));
    } catch (err) {
      console.error('Error deleting document:', err);
      alert('Erreur lors de la suppression');
    }
  };

  const getFilteredDocuments = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    return documents.filter(doc => {
      const docDate = new Date(doc.created_at || doc.uploaded_at);
      
      switch (filter) {
        case 'today':
          return docDate >= today;
        case 'week':
          return docDate >= weekAgo;
        case 'month':
          return docDate >= monthAgo;
        default:
          return true;
      }
    });
  };

  const filteredDocuments = getFilteredDocuments();

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="page-container">
          <div className="page-header">
            <div>
              <h1>Documents & Rapports</h1>
              <p>Rapports journaliers des merchandisers</p>
            </div>
            <button 
              onClick={fetchDocuments}
              style={{
                padding: '10px 20px',
                background: '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              🔄 Actualiser
            </button>
          </div>

          {/* Filter Tabs */}
          <div style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '20px',
            background: 'white',
            padding: '15px',
            borderRadius: '12px'
          }}>
            {['all', 'today', 'week', 'month'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '8px 16px',
                  background: filter === f ? '#6366f1' : '#f1f5f9',
                  color: filter === f ? 'white' : '#64748b',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  textTransform: 'capitalize'
                }}
              >
                {f === 'all' ? 'Tous' : f === 'today' ? "Aujourd'hui" : f === 'week' ? 'Cette semaine' : 'Ce mois'}
              </button>
            ))}
            <div style={{ marginLeft: 'auto', color: '#64748b', fontSize: '14px', alignSelf: 'center' }}>
              {filteredDocuments.length} document(s)
            </div>
          </div>

          {/* Documents List */}
          <div style={{ background: 'white', padding: '2rem', borderRadius: '12px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '14px', color: '#64748b' }}>Chargement...</div>
              </div>
            ) : error ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '48px', marginBottom: '1rem' }}>⚠️</div>
                <div style={{ fontSize: '16px', color: '#ef4444', marginBottom: '1rem' }}>{error}</div>
                <div style={{ 
                  fontSize: '13px', 
                  color: '#64748b',
                  maxWidth: '500px',
                  margin: '0 auto',
                  lineHeight: '1.6'
                }}>
                  Vérifiez que le backend Django est démarré et accessible.
                </div>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '48px', marginBottom: '1rem' }}>📄</div>
                <div style={{ fontSize: '16px', color: '#64748b', marginBottom: '0.5rem' }}>
                  Aucun document disponible
                </div>
                <div style={{ fontSize: '14px', color: '#94a3b8' }}>
                  Les rapports générés par les merchandisers apparaîtront ici
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      transition: 'all 0.2s',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f8fafc';
                      e.currentTarget.style.borderColor = '#6366f1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        background: '#fee2e2',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px'
                      }}>
                        📑
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontSize: '15px', 
                          fontWeight: '600', 
                          color: '#1e293b',
                          marginBottom: '4px'
                        }}>
                          {doc.title || 'Rapport Journalier'}
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>
                          {doc.description || 'Aucune description'}
                        </div>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#94a3b8',
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'center'
                        }}>
                          <span>
                            📅 {new Date(doc.created_at || doc.uploaded_at).toLocaleDateString('fr-FR', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {(doc.merchandiser_details?.username || doc.merchandiser_name) && (
                            <span>👤 {doc.merchandiser_details?.username || doc.merchandiser_name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleDownload(doc)}
                        style={{
                          padding: '8px 16px',
                          background: '#6366f1',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        📥 Télécharger
                      </button>
                      <button
                        onClick={() => handleDelete(doc)}
                        style={{
                          padding: '8px 12px',
                          background: '#fee2e2',
                          color: '#dc2626',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '600'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
