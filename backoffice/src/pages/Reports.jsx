import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { documentService } from '../services/apiService';
import { FileSpreadsheet, Calendar, User, Download, Trash2, FileX } from 'lucide-react';
import '../App.css';
import './Reports.css';

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
        <div className="page-container reports-page">
          <div className="page-header">
            <div>
              <h1>Documents & Rapports</h1>
              <p>Rapports journaliers des merchandisers</p>
            </div>
            <div className="reports-actions">
              <button onClick={fetchDocuments} className="refresh-btn">
                🔄 Actualiser
              </button>
            </div>
          </div>

          <div className="filters-bar">
            {['all', 'today', 'week', 'month'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`filter-chip ${filter === f ? 'active' : ''}`}
              >
                {f === 'all' ? 'Tous' : f === 'today' ? "Aujourd'hui" : f === 'week' ? 'Cette semaine' : 'Ce mois'}
              </button>
            ))}
            <div className="filters-count">{filteredDocuments.length} document(s)</div>
          </div>

          <div className="reports-list-card">
            {loading ? (
              <div className="reports-loading">Chargement...</div>
            ) : error ? (
              <div className="reports-error">
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
                <div className="reports-error-title">{error}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Vérifiez que le backend Django est démarré et accessible.
                </div>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="reports-empty">
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}><FileX size={40} strokeWidth={1.2} /></div>
                <div style={{ fontSize: '0.94rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Aucun document disponible
                </div>
                <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                  Les rapports générés par les merchandisers apparaîtront ici
                </div>
              </div>
            ) : (
              <div>
                {filteredDocuments.map((doc) => (
                  <div key={doc.id} className="report-item">
                    <div className="report-main">
                      <div className="report-icon"><FileSpreadsheet size={22} strokeWidth={1.5} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="report-title">{doc.title || 'Rapport Journalier'}</div>
                        <div className="report-description">{doc.description || 'Aucune description'}</div>
                        <div className="report-meta">
                          <span>
                          <Calendar size={13} /> {new Date(doc.created_at || doc.uploaded_at).toLocaleDateString('fr-FR', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {(doc.merchandiser_details?.username || doc.merchandiser_name) && (
                            <span><User size={13} /> {doc.merchandiser_details?.username || doc.merchandiser_name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="report-actions">
                      <button onClick={() => handleDownload(doc)} className="report-download">
                        <Download size={14} /> Télécharger
                      </button>
                      <button onClick={() => handleDelete(doc)} className="report-delete">
                        <Trash2 size={14} />
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
