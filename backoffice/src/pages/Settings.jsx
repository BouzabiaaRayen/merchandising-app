import React from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import '../App.css';

const Settings = () => {
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
            <p>Settings page content coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
