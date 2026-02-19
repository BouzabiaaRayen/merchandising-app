import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { notificationService } from '../services/apiService';
import './Users.css';
import './Products.css';
import './Notifications.css';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [count, setCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const [data, unread] = await Promise.all([
        notificationService.getNotifications(),
        notificationService.getUnreadCount(),
      ]);
      setNotifications(data.results ?? []);
      setCount(data.count ?? 0);
      setUnreadCount(unread.count ?? unread.unread_count ?? 0);
    } catch (err) {
      setError('Failed to fetch notifications');
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await notificationService.markRead(id);
      fetchNotifications();
    } catch (err) {
      console.error('Mark read failed:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      fetchNotifications();
    } catch (err) {
      console.error('Mark all read failed:', err);
    }
  };

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="page-container">
          <div className="page-header">
            <h1>Notifications</h1>
            <p>
              {count} total &mdash;{' '}
              <span className="unread-count">{unreadCount} unread</span>
            </p>
          </div>

          {loading ? (
            <div className="loading">Loading notifications...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : (
            <div className="table-container">
              <div className="table-actions">
                <button className="btn-primary" onClick={handleMarkAllRead}>
                  Mark All Read
                </button>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Message</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="no-data">
                        No notifications found
                      </td>
                    </tr>
                  ) : (
                    notifications.map((notif) => (
                      <tr key={notif.id} className={notif.is_read ? '' : 'unread-row'}>
                        <td>{notif.id}</td>
                        <td>{notif.title ?? 'N/A'}</td>
                        <td className="notif-message">{notif.message ?? 'N/A'}</td>
                        <td>
                          <span className={`notif-type-badge ${(notif.notification_type || notif.type || '').toLowerCase()}`}>
                            {notif.notification_type ?? notif.type ?? 'N/A'}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge ${notif.is_read ? 'active' : 'inactive'}`}>
                            {notif.is_read ? 'Read' : 'Unread'}
                          </span>
                        </td>
                        <td>
                          {notif.created_at
                            ? new Date(notif.created_at).toLocaleDateString()
                            : 'N/A'}
                        </td>
                        <td>
                          {!notif.is_read && (
                            <button className="action-btn view" onClick={() => handleMarkRead(notif.id)}>
                              Mark Read
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
    </div>
  );
};

export default Notifications;
