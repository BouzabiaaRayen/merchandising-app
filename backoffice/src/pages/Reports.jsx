import React from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import '../App.css';

const Reports = () => {
  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="page-container">
          <div className="page-header">
            <h1>Reporting</h1>
            <p>View and generate reports</p>
          </div>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '12px' }}>
            <p>Reports page content coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
