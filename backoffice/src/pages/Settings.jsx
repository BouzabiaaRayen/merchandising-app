import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { notificationService } from '../services/apiService';
import '../App.css';

const Settings = () => {
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const savedAlerts = localStorage.getItem('backofficeAlertsEnabled');
    if (savedAlerts !== null) {
      setAlertsEnabled(savedAlerts === 'true');
    }
  }, []);

  const handleAlertsToggle = async () => {
    const nextValue = !alertsEnabled;
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    setSaving(true);
    setStatusMessage('');

    try {
      localStorage.setItem('backofficeAlertsEnabled', String(nextValue));
      setAlertsEnabled(nextValue);

      if (currentUser?.id) {
        await notificationService.createNotification({
          user: currentUser.id,
          title: nextValue ? 'Alerts Enabled' : 'Alerts Disabled',
          message: nextValue
            ? 'Backoffice alerts have been turned on.'
            : 'Backoffice alerts have been turned off.',
          notification_type: 'system',
          priority: nextValue ? 'low' : 'high',
          data: {
            event: 'alerts_toggle',
            enabled: nextValue,
          },
        });
      }

      setStatusMessage(nextValue ? 'Alerts enabled.' : 'Alerts disabled.');
      window.dispatchEvent(new Event('profileUpdated'));
    } catch (error) {
      console.error('Failed to update alerts setting:', error);
      setStatusMessage('Saved locally, but failed to notify bell feed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="page-container">
          <div className="page-header">
            <h1>Settings</h1>
            <p>Configure your system preferences</p>
          </div>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#1e293b' }}>Backoffice Alerts</h3>
                <p style={{ margin: '0.5rem 0 0', color: '#64748b' }}>
                  Turn bell notifications on or off for this backoffice session.
                </p>
              </div>
              <button
                onClick={handleAlertsToggle}
                disabled={saving}
                style={{
                  padding: '10px 16px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  background: alertsEnabled ? '#10b981' : '#ef4444',
                  color: 'white',
                  fontWeight: 600,
                  minWidth: '130px',
                }}
              >
                {saving ? 'Saving...' : alertsEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            {statusMessage && (
              <p style={{ marginTop: '1rem', color: '#475569' }}>{statusMessage}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
