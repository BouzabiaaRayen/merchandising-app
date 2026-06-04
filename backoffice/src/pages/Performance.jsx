import React, { useEffect, useState, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  TrendingUp, CheckCircle2, Users, Package, Zap,
  MapPin, AlertTriangle, Clock, Activity, Eye,
  ChevronDown, ChevronRight, WifiOff, Star,
  MessageSquare, ShieldAlert, RefreshCw,
} from 'lucide-react';
import {
  storeService, visitService, inventoryService,
  productService, userService, complaintService, statsService,
} from '../services/apiService';
import './Performance.css';

/* ── helpers ────────────────────────────────────────────── */

const CircularGauge = ({ value = 0, max = 100, color = '#3b82f6', size = 120, label }) => {
  const pct   = Math.min(Math.max(value / max, 0), 1);
  const r     = 46;
  const circ  = 2 * Math.PI * r;
  const dash  = pct * circ;
  return (
    <div className="gauge-wrap" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="9" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={color} strokeWidth="9"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x="50" y="47" textAnchor="middle" fontSize="18" fontWeight="700" fill="#0f172a">
          {Math.round(value)}
        </text>
        <text x="50" y="60" textAnchor="middle" fontSize="9" fill="#64748b">
          {label || `/ ${max}`}
        </text>
      </svg>
    </div>
  );
};

const Module = ({ letter, title, subtitle, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="perf-module">
      <button className="perf-module-header" onClick={() => setOpen(o => !o)}>
        <div className="module-title-wrap">
          <span className="module-title">{title}</span>
          {subtitle && <span className="module-subtitle">{subtitle}</span>}
        </div>
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
      </button>
      {open && <div className="perf-module-body">{children}</div>}
    </div>
  );
};

const StatCard = ({ icon, label, value, sub, color = '#3b82f6' }) => (
  <div className="perf-stat-card">
    <div className="perf-stat-icon" style={{ background: color + '18', color }}>{icon}</div>
    <div>
      <div className="perf-stat-value">{value}</div>
      <div className="perf-stat-label">{label}</div>
      {sub && <div className="perf-stat-sub">{sub}</div>}
    </div>
  </div>
);

const CT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <p className="ct-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

const PIE_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];

/* ── main component ─────────────────────────────────────── */

const Performance = () => {
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [lastFetch, setLastFetch] = useState(null);

  /* Module A — Visit Analytics */
  const [visitCounts, setVisitCounts]       = useState({ total: 0, completed: 0, active: 0, planned: 0, activeOnMap: 0 });
  const [visitStatusData, setVisitStatusData] = useState([]);
  const [avgDuration, setAvgDuration]       = useState(0);

  /* Module B — Stock & Shelf */
  const [stockoutProducts, setStockoutProducts] = useState([]);
  const [regionalCriticality, setRegionalCriticality] = useState([]);
  const [detectionRatio, setDetectionRatio]     = useState({ ai: 0, manual: 0 });

  /* Module C — Team & Attendance */
  const [attendance, setAttendance]         = useState({ present: 0, total: 0 });
  const [gpsAlerts, setGpsAlerts]           = useState({ count: 0, note: '' });
  const [leaderboard, setLeaderboard]       = useState([]);
  const [liveTrackingSessions, setLiveSessions] = useState(null);

  /* Module D — Anomalies & Complaints */
  const [anomalyData, setAnomalyData]       = useState([]);
  const [complaintsStatus, setComplaintsStatus] = useState({ open: 0, inProgress: 0, resolved: 0 });

  /* Module E — Competitor Intel */
  const [competitorShare, setCompetitorShare] = useState([]);
  const [threatData, setThreatData]           = useState([]);
  const [priceBenchmark, setPriceBenchmark]   = useState([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [visitsRes, storesRes, usersRes, invRes, productsRes, complaintsRes] = await Promise.all([
        visitService.getVisits({ page_size: 1000 }).catch(() => ({ results: [] })),
        storeService.getStores({ page_size: 1000 }).catch(() => ({ results: [] })),
        userService.getUsers({ page_size: 500 }).catch(() => ({ results: [] })),
        inventoryService.getInventory({ page_size: 1000 }).catch(() => ({ results: [] })),
        productService.getProducts({ page_size: 1000 }).catch(() => ({ results: [] })),
        complaintService.getComplaints({ page_size: 1000 }).catch(() => ({ results: [] })),
      ]);

      const visits     = visitsRes?.results   ?? visitsRes   ?? [];
      const stores     = storesRes?.results   ?? storesRes   ?? [];
      const users      = usersRes?.results    ?? usersRes    ?? [];
      const inventory  = invRes?.results      ?? invRes      ?? [];
      const products   = productsRes?.results ?? productsRes ?? [];
      const complaints = complaintsRes?.results ?? complaintsRes ?? [];

      /* ── Module A ── */
      const total     = visits.length;
      const completed = visits.filter(v => v.status === 'completed').length;
      const active    = visits.filter(v => v.status === 'in_progress' || v.status === 'active').length;
      const planned   = visits.filter(v => v.status === 'planned' || v.status === 'scheduled').length;
      const activeOnMap = new Set(
        visits
          .filter(v => { const s = (v.status||'').toLowerCase(); return s === 'in_progress' || s === 'active'; })
          .map(v => v.merchandiser || v.user || v.user_id)
          .filter(Boolean)
      ).size;
      setVisitCounts({ total, completed, active, planned, activeOnMap });

      setVisitStatusData([
        { name: 'Completed', value: completed, fill: '#059669' },
        { name: 'Active',    value: active,    fill: '#2563eb' },
        { name: 'Planned',   value: planned,   fill: '#f59e0b' },
        { name: 'Pending',   value: Math.max(0, total - completed - active - planned), fill: '#dde3ed' },
      ].filter(d => d.value > 0));

      const getIn  = v => v.check_in_time || v.check_in || v.checked_in_at  || v.checkin_time  || null;
      const getOut = v => v.check_out_time || v.check_out || v.checked_out_at || v.checkout_time || null;
      const durationsMin = visits
        .filter(v => {
          const s = (v.status || '').toLowerCase();
          return (s === 'completed' || s === 'done') && getIn(v) && getOut(v);
        })
        .map(v => (new Date(getOut(v)) - new Date(getIn(v))) / 60000)
        .filter(d => d > 0 && d < 600);
      setAvgDuration(durationsMin.length
        ? Math.round(durationsMin.reduce((s, d) => s + d, 0) / durationsMin.length)
        : 0
      );

      /* ── Module B ── */
      const ruptureMap = {};
      inventory.forEach(item => {
        const qty = Number(item.quantity ?? item.stock_quantity ?? 0);
        const min = Number(item.minimum_stock ?? item.min_stock ?? 0);
        const isOut = qty === 0;
        const isLow = qty > 0 && qty < min;
        if (isOut || isLow) {
          const prodName = item.product_name || item.name || `Item ${item.id}`;
          if (!ruptureMap[prodName]) ruptureMap[prodName] = { name: prodName, stockout: 0, low: 0 };
          if (isOut) ruptureMap[prodName].stockout++;
          else ruptureMap[prodName].low++;
        }
      });
      const allRuptures = Object.values(ruptureMap)
        .map(r => ({ ...r, total: r.stockout + r.low }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8);
      setStockoutProducts(allRuptures);

      const regionMap = {};
      stores.forEach(s => {
        const city = s.city || s.region || s.location || 'Unknown';
        if (!regionMap[city]) regionMap[city] = { city, stores: 0, issues: 0 };
        regionMap[city].stores++;
      });
      inventory.forEach(item => {
        const qty = Number(item.quantity ?? item.stock_quantity ?? 0);
        const min = Number(item.minimum_stock ?? item.min_stock ?? 0);
        if (qty < min) {
          const store = stores.find(s => s.id === (item.store || item.store_id));
          const city = store?.city || store?.region || 'Unknown';
          if (regionMap[city]) regionMap[city].issues++;
        }
      });
      setRegionalCriticality(
        Object.values(regionMap).sort((a, b) => b.issues - a.issues).slice(0, 6)
      );

      const aiDetected     = visits.filter(v => v.ai_detected || v.is_ai_analyzed).length;
      const manualDetected = Math.max(0, visits.length - aiDetected);
      setDetectionRatio({ ai: aiDetected, manual: manualDetected });

      /* ── Module C ── */
      const merchandisers = users.filter(u =>
        (u.role || '').toLowerCase().includes('merch') ||
        (u.user_type || '').toLowerCase().includes('merch')
      );
      const totalMerch  = merchandisers.length || users.length;
      const presentToday = visits.filter(v => {
        const d = new Date(v.date || v.created_at || v.check_in_time || 0);
        return d.toDateString() === new Date().toDateString();
      }).map(v => v.merchandiser || v.user || v.user_id);
      const uniquePresent = new Set(presentToday).size;
      setAttendance({ present: uniquePresent, total: totalMerch });

      const gpsIssues = visits.filter(v => v.gps_alert || v.location_mismatch || v.outside_geofence).length;
      setGpsAlerts({ count: gpsIssues, note: gpsIssues > 0 ? 'Location anomalies detected' : 'Full route compliance detected' });

      const agentMap = {};
      visits.forEach(v => {
        const uid = v.merchandiser || v.user || v.user_id;
        if (!uid) return;
        if (!agentMap[uid]) {
          const u = users.find(u => u.id === uid);
          agentMap[uid] = {
            id: uid,
            name: u?.full_name || u?.username || `Agent ${uid}`,
            visits: 0,
            completed: 0,
          };
        }
        agentMap[uid].visits++;
        if (v.status === 'completed') agentMap[uid].completed++;
      });
      const board = Object.values(agentMap)
        .map(a => ({ ...a, rate: a.visits ? Math.round((a.completed / a.visits) * 100) : 0 }))
        .sort((a, b) => b.completed - a.completed || b.rate - a.rate)
        .slice(0, 5);
      setLeaderboard(board);

      /* ── Module D ── */
      const anomTypes = {};
      visits.forEach(v => {
        const anoms = Array.isArray(v.anomalies) ? v.anomalies : [];
        anoms.forEach(a => {
          const t = a.type || a.anomaly_type || 'Other';
          anomTypes[t] = (anomTypes[t] || 0) + 1;
        });
      });
      setAnomalyData(
        Object.entries(anomTypes).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
      );

      const open       = complaints.filter(c => c.status === 'open' || c.status === 'pending').length;
      const inProgress = complaints.filter(c => c.status === 'in_progress').length;
      const resolved   = complaints.filter(c => c.status === 'resolved' || c.status === 'closed').length;
      setComplaintsStatus({ open, inProgress, resolved });

      /* ── Module E ── */
      const ownerMap = {};
      products.forEach(p => {
        const owner = p.owner || p.brand_owner || p.brand || 'Other';
        ownerMap[owner] = (ownerMap[owner] || 0) + 1;
      });
      setCompetitorShare(
        Object.entries(ownerMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6)
      );

      const threatMap = {};
      visits.forEach(v => {
        const comps = Array.isArray(v.competitor_activities) ? v.competitor_activities : [];
        comps.forEach(c => {
          const name = c.competitor || c.name || 'Unknown';
          threatMap[name] = (threatMap[name] || 0) + 1;
        });
      });
      setThreatData(
        Object.entries(threatMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5)
      );

      const benchmark = products
        .filter(p => p.price && (p.competitor_price || p.market_price))
        .map(p => {
          const ours = Number(p.price);
          const comp = Number(p.competitor_price || p.market_price);
          const gap  = comp ? Math.round(((ours - comp) / comp) * 100) : null;
          return { name: p.name || `Product ${p.id}`, ours, comp, gap };
        })
        .filter(r => r.gap !== null)
        .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
        .slice(0, 8);
      setPriceBenchmark(benchmark);

      setLastFetch(new Date());
    } catch (err) {
      console.error('Performance fetch error:', err);
      setError('Failed to load performance data. Check API connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Live tracking sessions poll (every 30 s) ── */
  useEffect(() => {
    const fetchLive = async () => {
      try {
        const data = await statsService.getLiveSessions();
        // Adjust field name to match your backend response
        const count = data?.active_connections ?? data?.active_sessions ?? data?.count ?? null;
        if (count !== null) setLiveSessions(Number(count));
      } catch {
        // silently fall back to computed activeOnMap value
      }
    };
    fetchLive();
    const intervalId = setInterval(fetchLive, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const completionRate = visitCounts.total > 0
    ? Math.round((visitCounts.completed / visitCounts.total) * 100)
    : 0;

  const totalComplaints = complaintsStatus.open + complaintsStatus.inProgress + complaintsStatus.resolved;
  const resolutionRate  = totalComplaints > 0
    ? Math.round((complaintsStatus.resolved / totalComplaints) * 100)
    : 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f5f9' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        <div className="perf-page">

          {/* Page header */}
          <div className="perf-page-header">
            <div>
              <h1>Statistics &amp; Performance Management</h1>
              <p>
                {lastFetch
                  ? `Last updated: ${lastFetch.toLocaleTimeString()}`
                  : 'Loading live data…'}
              </p>
            </div>
            <button className="perf-refresh-btn" onClick={fetchAll} disabled={loading}>
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
              Refresh
            </button>
          </div>

          {error && <div className="perf-error-banner"><AlertTriangle size={16} />{error}</div>}

          {loading ? (
            <div className="perf-loading">
              <div className="perf-spin" />
              <p>Loading performance data…</p>
            </div>
          ) : (
            <>

              {/* ── Module A: Visit Analytics ── */}
              <Module  title="Visit Analytics" subtitle="Field coverage, completion rates & visit durations">
                <div className="mod-grid-3">

                  {/* Gauge */}
                  <div className="mod-card center-col">
                    <div className="gauge-header">
                      <p className="gauge-title"> Progress</p>
                      <p className="gauge-sub">Real-time completion tracking</p>
                    </div>
                    <CircularGauge value={completionRate} max={100} color="#059669" size={130} label="%" />
                    <div className="gauge-stats">
                      <div className="dot green" /><span>{visitCounts.completed} Completed</span>
                      <div className="dot" style={{ background: '#e2e8f0' }} /><span>{visitCounts.total - visitCounts.completed} Pending</span>
                    </div>
                  </div>

                  {/* Visit status bar chart */}
                  <div className="mod-card">
                    <p className="gauge-title">Visit Status Breakdown</p>
                    <p className="gauge-sub">Distribution by current state</p>
                    <div style={{ marginTop: 20 }}>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={visitStatusData} barSize={28}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={<CT />} />
                        <Bar dataKey="value" radius={[4,4,0,0]}>
                          {visitStatusData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    </div>
                  </div>

                  {/* KPI stack */}
                  <div className="mod-card">
                    <p className="mod-card-title">Key Metrics</p>
                    <div className="kpi-stack">
                      <div className="kpi-big">
                        <span className="kpi-value" style={{ color: '#3b82f6' }}>{visitCounts.total}</span>
                        <span className="kpi-label">Total Visits</span>
                      </div>
                      <div className="kpi-divider" />
                      <div className="kpi-big">
                        <span className="kpi-value" style={{ color: '#10b981' }}>{completionRate}%</span>
                        <span className="kpi-label">Completion Rate</span>
                      </div>
                      <div className="kpi-divider" />
                      <div className="kpi-big">
                        <span className="kpi-value" style={{ color: '#f59e0b' }}>
                          {avgDuration === 0
                            ? '—'
                            : avgDuration < 60
                              ? `${avgDuration} min`
                              : `${Math.floor(avgDuration / 60)}h ${avgDuration % 60}m`}
                        </span>
                        <span className="kpi-label">Avg Visit Duration</span>
                      </div>
                      <div className="kpi-divider" />
                      <div className="kpi-big">
                        <span className="kpi-value" style={{ color: '#8b5cf6' }}>{visitCounts.active}</span>
                        <span className="kpi-label">Currently Active</span>
                      </div>
                    </div>
                  </div>

                </div>
              </Module>

              {/* ── Module B: Stock & Shelf ── */}
              <Module  title="Stock & Shelf Intelligence" subtitle="Stockouts, low-stock alerts & shelf coverage by region">
                <div className="mod-grid-3">

                  {/* Top stockout products */}
                  <div className="mod-card">
                    <p className="mod-card-title">Top Stockout Products</p>
                    {stockoutProducts.length === 0 ? (
                      <p className="empty-msg">No stockout data available</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={190}>
                        <BarChart data={stockoutProducts} layout="vertical" barSize={14}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis type="number" tick={{ fontSize: 10 }} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                          <Tooltip content={<CT />} />
                          <Bar dataKey="stockout" name="Stockout" fill="#ef4444" radius={[0,4,4,0]} stackId="a" />
                          <Bar dataKey="low"      name="Low Stock" fill="#f59e0b" radius={[0,4,4,0]} stackId="a" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Regional criticality */}
                  <div className="mod-card">
                    <p className="mod-card-title">Regional Criticality</p>
                    {regionalCriticality.length === 0 ? (
                      <p className="empty-msg">No regional data</p>
                    ) : (
                      <div className="crit-table">
                        <div className="crit-header-row">
                          <span className="crit-name">City</span>
                          <span className="crit-num">Stores</span>
                          <span className="crit-num">Issues</span>
                          <span className="crit-badge">Level</span>
                        </div>
                        {regionalCriticality.map((r, i) => {
                          const ratio = r.stores > 0 ? r.issues / r.stores : 0;
                          const badge = ratio >= 0.5 ? 'critical' : ratio >= 0.2 ? 'watch' : 'clear';
                          return (
                            <div key={i} className="crit-data-row">
                              <span className="crit-name">{r.city}</span>
                              <span className="crit-num">{r.stores}</span>
                              <span className="crit-num">{r.issues}</span>
                              <span className={`crit-badge ${badge}`}>
                                {badge.charAt(0).toUpperCase() + badge.slice(1)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Detection ratio */}
                  <div className="mod-card">
                    <p className="mod-card-title">Detection Method</p>
                    <div className="det-wrap">
                      <div className="det-item">
                        <div className="det-icon ai"><Zap size={18} /></div>
                        <div>
                          <div className="det-num">{detectionRatio.ai}</div>
                          <div className="det-lbl">AI Analyzed</div>
                        </div>
                      </div>
                      <div className="det-sep" />
                      <div className="det-item">
                        <div className="det-icon manual"><Eye size={18} /></div>
                        <div>
                          <div className="det-num">{detectionRatio.manual}</div>
                          <div className="det-lbl">Manual Review</div>
                        </div>
                      </div>
                    </div>
                    {(detectionRatio.ai + detectionRatio.manual) > 0 && (
                      <div className="det-bar-track">
                        <div
                          className="det-bar-fill"
                          style={{ width: `${Math.round(detectionRatio.ai / (detectionRatio.ai + detectionRatio.manual) * 100)}%` }}
                        />
                      </div>
                    )}
                    <p className="det-note">
                      {detectionRatio.ai + detectionRatio.manual > 0
                        ? `${Math.round(detectionRatio.ai / (detectionRatio.ai + detectionRatio.manual) * 100)}% AI coverage`
                        : 'No detection data'}
                    </p>
                  </div>

                </div>
              </Module>

              {/* ── Module C: Team & Attendance ── */}
              <Module  title="Team Performance & Attendance" subtitle="Attendance tracking, GPS compliance & agent leaderboard">
                <div className="mod-grid-3">

                  {/* Attendance gauge */}
                  <div className="mod-card center-col">
                    <p className="mod-card-title" style={{ alignSelf: 'flex-start', width: '100%' }}>Attendance</p>
                    <CircularGauge
                      value={attendance.total - attendance.present}
                      max={Math.max(attendance.total, 1)}
                      color="#64748b"
                      size={130}
                      label=" "
                    />
                    <div className="att-row">
                      <div className="att-item">
                        <strong>{attendance.present}</strong>
                        <span>Present Today</span>
                      </div>
                      <div className="att-item">
                        <strong>{attendance.total - attendance.present}</strong>
                        <span>Absent / Off</span>
                      </div>
                    </div>
                  </div>

                  {/* GPS alerts */}
                  <div className="mod-card center-col">
                    <p className="mod-card-title" style={{ alignSelf: 'flex-start', width: '100%' }}>GPS Compliance</p>
                    <div style={{ marginBottom: 4 }}>
                      <MapPin size={42} color={gpsAlerts.count > 0 ? '#ef4444' : '#10b981'} />
                    </div>
                    <div className="gps-big" style={{ color: gpsAlerts.count > 0 ? '#ef4444' : '#10b981' }}>
                      {gpsAlerts.count}
                    </div>
                    <div className="gps-alert-label">Active Alerts</div>
                    {gpsAlerts.count === 0 && <div className="gps-note">{gpsAlerts.note}</div>}
                    <StatCard
                      icon={<Activity size={16} />}
                      label="Live Tracking Sessions"
                      value={liveTrackingSessions ?? visitCounts.activeOnMap}
                      color="#3b82f6"
                    />
                  </div>

                  {/* Leaderboard */}
                  <div className="mod-card">
                    <p className="mod-card-title">Top Agents</p>
                    {leaderboard.length === 0 ? (
                      <p className="empty-msg">No agent data yet</p>
                    ) : (
                      <div className="leader-list">
                        {leaderboard.map((agent, i) => (
                          <div key={agent.id} className="leader-row">
                            <span className={`leader-rank ${i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : ''}`}>
                              {i + 1}
                            </span>
                            <div className="leader-info">
                              <span className="leader-name">
                                {agent.name.replace(/\b\w/g, c => c.toUpperCase())}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </Module>

              {/* ── Module D: Anomalies & Complaints ── */}
              <Module  title="Anomalies & Complaint Management" subtitle="Field anomaly types and complaint resolution pipeline">
                <div className="mod-grid-2">

                  {/* Anomaly pie */}
                  <div className="mod-card">
                    <p className="mod-card-title">Anomaly Types</p>
                    {anomalyData.length === 0 ? (
                      <p className="empty-msg">No anomaly data recorded</p>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                        <ResponsiveContainer width={160} height={160}>
                          <PieChart>
                            <Pie data={anomalyData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                              {anomalyData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip content={<CT />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="pie-legend">
                          {anomalyData.map((d, i) => (
                            <div key={i} className="pie-item">
                              <span className="pie-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                              {d.name} <strong>({d.value})</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </Module>

              {/* ── Module E: Competitor Intel ── */}
              <Module  title="Competitor Intelligence" subtitle="Market share, threats & price benchmarking" defaultOpen={false}>
                <div className="mod-grid-2">

                  {/* Threat bar chart */}
                  <div className="mod-card">
                    <p className="mod-card-title">Competitor Activity Threats</p>
                    {threatData.length === 0 ? (
                      <p className="empty-msg">No competitor activity logged</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={threatData} barSize={28}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip content={<CT />} />
                          <Bar dataKey="count" name="Threats" fill="#ef4444" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                </div>

                {/* Price benchmark full width */}
                <div className="bench-full">
                  <p className="mod-card-title">Price Benchmarking vs Competitors</p>
                  {priceBenchmark.length === 0 ? (
                    <p className="empty-msg">No price comparison data available in products</p>
                  ) : (
                    <table className="bench-table">
                      <thead>
                        <tr>
                          <th className="bench-head">Product</th>
                          <th className="bench-head">Our Price</th>
                          <th className="bench-head">Competitor</th>
                          <th className="bench-head">Gap</th>
                        </tr>
                      </thead>
                      <tbody>
                        {priceBenchmark.map((row, i) => (
                          <tr key={i} className="bench-row">
                            <td className="bench-prod">{row.name}</td>
                            <td>{row.ours} DA</td>
                            <td>{row.comp} DA</td>
                            <td>
                              <span className={`bench-gap ${row.gap > 0 ? 'up' : 'down'}`}>
                                {row.gap > 0 ? '+' : ''}{row.gap}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

              </Module>

            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default Performance;
