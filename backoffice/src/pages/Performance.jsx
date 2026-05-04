import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import {
  TrendingUp, CheckCircle2, Users,
  Package, Zap,
} from 'lucide-react';
import {
  storeService, visitService, inventoryService, productService,
  userService,
} from '../services/apiService';
import { getAvatarUrl } from '../services/supabaseClient';
import './Performance.css';

const COMPETITOR_TRACKERS_KEY = 'competitorTrackers';
const ACTIVE_COMPETITOR_KEY = 'activeCompetitorTracker';
const DEFAULT_OWNER_OPTIONS = ['Warda', 'Lepidor', 'Spiga', 'Moulin d\'Or', 'Saida'];

const Performance = () => {
  const [performanceData, setPerformanceData] = useState({
    overallPerformance: 0,
    completionRate: 0,
    totalVisits: 0,
    completedVisits: 0,
    activeVisits: 0,
    totalStores: 0,
    totalSupervisors: 0,
  });

  const [stockRuptureData, setStockRuptureData] = useState([]);
  const [visitStatusData, setVisitStatusData] = useState([]);
  const [supervisorObjectives, setSupervisorObjectives] = useState([]);
  const [performanceTrend, setPerformanceTrend] = useState([]);
  const [competitorAnalysis, setCompetitorAnalysis] = useState({
    promosDetected: 0,
    criticalGaps: 0,
    newProductsSpotted: 0,
    activities: [],
    priceRows: [],
    categoryGaps: [],
  });
  const [productsData, setProductsData] = useState([]);
  const [visitsData, setVisitsData] = useState([]);
  const [trackedCompetitors, setTrackedCompetitors] = useState(() => {
    try {
      const raw = localStorage.getItem(COMPETITOR_TRACKERS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignore parse issues and use defaults
    }
    return ['Warda'];
  });
  const [activeCompetitor, setActiveCompetitor] = useState(() => {
    return localStorage.getItem(ACTIVE_COMPETITOR_KEY) || 'Warda';
  });
  const [showTrackerModal, setShowTrackerModal] = useState(false);
  const [ownerOptions, setOwnerOptions] = useState(DEFAULT_OWNER_OPTIONS);
  const [selectedCompetitorOption, setSelectedCompetitorOption] = useState(DEFAULT_OWNER_OPTIONS[0]);
  const [customCompetitorName, setCustomCompetitorName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const normalizeCompetitorKey = (name = '') =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  const buildCompetitorAnalysis = (products, visits, competitorName) => {
    const nowMs = Date.now();
    const monthMs = 30 * 24 * 60 * 60 * 1000;
    const toNumber = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const resolveCompetitorPrice = (product, selectedName) => {
      const genericPrice =
        toNumber(product.competitor_price) ??
        toNumber(product.competitorPrice) ??
        toNumber(product.market_price) ??
        toNumber(product.reference_price) ??
        toNumber(product.benchmark_price);

      if (!selectedName) {
        return genericPrice;
      }

      const key = normalizeCompetitorKey(selectedName);
      const specificPrice =
        toNumber(product[`${key}_price`]) ??
        toNumber(product[`${key}Price`]) ??
        toNumber(product[`price_${key}`]) ??
        toNumber(product[`competitor_${key}_price`]) ??
        toNumber(product[`competitor_${key}`]) ??
        toNumber(product.competitor_prices?.[key]);

      return specificPrice ?? genericPrice;
    };

    const normalizedActive = normalizeCompetitorKey(competitorName || '');

    const visitRows = (visits || [])
      .flatMap((visit) => {
        const comparisons = Array.isArray(visit.price_comparisons)
          ? visit.price_comparisons
          : Array.isArray(visit.priceComparisons)
            ? visit.priceComparisons
            : [];

        return comparisons.map((pc) => {
          const ourPrice = toNumber(pc.ourPrice ?? pc.our_price);
          const competitorPrice = toNumber(pc.competitorPrice ?? pc.competitor_price);
          const competitor = pc.competitor || pc.competitor_name || pc.owner || '';
          const normalizedCompetitor = normalizeCompetitorKey(String(competitor));

          if (!ourPrice || !competitorPrice || competitorPrice <= 0) {
            return null;
          }

          if (normalizedActive && normalizedCompetitor && normalizedCompetitor !== normalizedActive) {
            return null;
          }

          const gapPercent = ((ourPrice - competitorPrice) / competitorPrice) * 100;
          return {
            name: pc.productName || pc.product_name || `Visit product ${visit.id || ''}`,
            category: pc.category || 'Field Audit',
            ourPrice,
            competitorPrice,
            gapPercent,
            gapState: gapPercent > 0 ? 'up' : gapPercent < 0 ? 'down' : 'neutral',
            updatedAt: visit.updated_at || visit.date || visit.created_at || null,
            source: 'visit',
          };
        });
      })
      .filter(Boolean);

    const productRows = products
      .map((p) => {
        const ourPrice = toNumber(p.price);
        const competitorPrice = resolveCompetitorPrice(p, competitorName);

        if (!ourPrice || !competitorPrice || competitorPrice <= 0) {
          return null;
        }

        const gapPercent = ((ourPrice - competitorPrice) / competitorPrice) * 100;
        return {
          name: p.name || p.product_name || `Product ${p.id}`,
          category: p.category || 'Uncategorized',
          ourPrice,
          competitorPrice,
          gapPercent,
          gapState: gapPercent > 0 ? 'up' : gapPercent < 0 ? 'down' : 'neutral',
          updatedAt: p.updated_at || p.created_at || null,
          source: 'product',
        };
      })
      .filter(Boolean)
      .sort((a, b) => Math.abs(b.gapPercent) - Math.abs(a.gapPercent));

    const mergedRows = [...visitRows, ...productRows]
      .sort((a, b) => Math.abs(b.gapPercent) - Math.abs(a.gapPercent));

    const criticalGaps = mergedRows.filter((r) => r.gapPercent > 8).length;
    const promosDetected = mergedRows.filter((r) => Math.abs(r.gapPercent) >= 10).length;
    const newProductsSpotted = products.filter((p) => {
      const created = p.created_at ? new Date(p.created_at).getTime() : null;
      return created && nowMs - created <= monthMs;
    }).length;

    const categoryMap = new Map();
    mergedRows.forEach((row) => {
      const key = row.category || 'Uncategorized';
      if (!categoryMap.has(key)) {
        categoryMap.set(key, { category: key, competitive: [], critical: [] });
      }
      const bucket = categoryMap.get(key);
      if (row.gapPercent <= 0) {
        bucket.competitive.push(Math.abs(row.gapPercent));
      } else {
        bucket.critical.push(row.gapPercent);
      }
    });

    const categoryGaps = Array.from(categoryMap.values())
      .map((entry) => {
        const avg = (arr) => (arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0);
        return {
          category: entry.category,
          competitive: Number(avg(entry.competitive).toFixed(1)),
          critical: Number(avg(entry.critical).toFixed(1)),
        };
      })
      .sort((a, b) => (b.critical + b.competitive) - (a.critical + a.competitive))
      .slice(0, 6);

    const activities = mergedRows.slice(0, 5).map((row, idx) => ({
      id: idx + 1,
      title: `${row.name} gap vs ${competitorName || 'market'} detected (${row.source === 'visit' ? 'field' : 'catalog'})`,
      subtitle: row.category,
      time: row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : 'Recent',
      gapPercent: row.gapPercent,
    }));

    return {
      promosDetected,
      criticalGaps,
      newProductsSpotted,
      activities,
      priceRows: mergedRows.slice(0, 8),
      categoryGaps,
    };
  };

  useEffect(() => {
    localStorage.setItem(COMPETITOR_TRACKERS_KEY, JSON.stringify(trackedCompetitors));
  }, [trackedCompetitors]);

  useEffect(() => {
    if (activeCompetitor && !trackedCompetitors.includes(activeCompetitor)) {
      setTrackedCompetitors((prev) => [...prev, activeCompetitor]);
    }
  }, [activeCompetitor, trackedCompetitors]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_COMPETITOR_KEY, activeCompetitor);
    setCompetitorAnalysis(buildCompetitorAnalysis(productsData, visitsData, activeCompetitor));
  }, [activeCompetitor, productsData, visitsData]);

  useEffect(() => {
    if (selectedCompetitorOption === '__custom__') {
      return;
    }
    if (ownerOptions.length > 0 && !ownerOptions.includes(selectedCompetitorOption)) {
      setSelectedCompetitorOption(ownerOptions[0]);
    }
  }, [ownerOptions, selectedCompetitorOption]);

  useEffect(() => {
    fetchPerformanceData();
  }, []);

  const fetchPerformanceData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch all necessary data in parallel
      const [
        storesRes,
        visitRes,
        supervisorsRes,
        inventoryRes,
        productsRes,
        allUsersRes,
      ] = await Promise.all([
        storeService.getStores({ page_size: 1000 }).catch(err => ({
          count: 0,
          results: [],
        })),
        visitService.getVisits({ page_size: 1000 }).catch(err => ({
          count: 0,
          results: [],
        })),
        userService.getUsers({ role: 'supervisor', page_size: 1000 }).catch(err => ({
          count: 0,
          results: [],
        })),
        inventoryService.getInventory({ page_size: 1000 }).catch(err => ({
          count: 0,
          results: [],
        })),
        productService.getProducts({ page_size: 1000 }).catch(err => ({
          count: 0,
          results: [],
        })),
        userService.getUsers({ page_size: 1000, expand: 'supervisor' }).catch(err => ({
          count: 0,
          results: [],
        })),
      ]);

      const stores = storesRes.results || [];
      const visits = visitRes.results || [];
      const supervisors = supervisorsRes.results || [];
      const inventory = inventoryRes.results || [];
      const products = productsRes.results || [];
      const ownerSlugToName = (slug = '') =>
        slug
          .replace(/[_-]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .replace(/\b\w/g, (c) => c.toUpperCase());

      const genericKeys = new Set([
        'competitor',
        'market',
        'reference',
        'benchmark',
      ]);

      const discoveredOwnerNames = new Set();
      products.forEach((product) => {
        const keys = Object.keys(product || {});
        keys.forEach((key) => {
          let slug = null;
          let match = key.match(/^([a-z0-9_]+)_price$/i);
          if (match) slug = match[1];

          match = key.match(/^price_([a-z0-9_]+)$/i);
          if (match) slug = slug || match[1];

          match = key.match(/^competitor_([a-z0-9_]+)_price$/i);
          if (match) slug = slug || match[1];

          if (slug && !genericKeys.has(slug.toLowerCase())) {
            discoveredOwnerNames.add(ownerSlugToName(slug));
          }
        });

        if (product.competitor_prices && typeof product.competitor_prices === 'object') {
          Object.keys(product.competitor_prices).forEach((slug) => {
            if (!genericKeys.has(String(slug).toLowerCase())) {
              discoveredOwnerNames.add(ownerSlugToName(String(slug)));
            }
          });
        }
      });

      const mergedOwnerOptions = Array.from(
        new Set([...DEFAULT_OWNER_OPTIONS, ...Array.from(discoveredOwnerNames)])
      );
      setOwnerOptions(mergedOwnerOptions);
      const allUsers = allUsersRes.results || [];
      const merchandisers = allUsers.filter(u => u.role === 'merchandiser');
      const savedAssignmentsRaw = localStorage.getItem('supervisorAssignments');
      let savedAssignments = {};
      if (savedAssignmentsRaw) {
        try {
          savedAssignments = JSON.parse(savedAssignmentsRaw);
        } catch {
          savedAssignments = {};
        }
      }

      // Calculate overall performance metrics
      const completedVisits = visits.filter(v => v.status === 'completed').length;
      const activeVisits = visits.filter(v => v.status === 'in_progress').length;
      const totalVisits = visits.length;
      const completionRate = totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 100) : 0;

      // Calculate average performance based on visit completion and on-time rate
      const onTimeVisits = visits.filter(v => v.status === 'completed' && !v.is_late).length;
      const onTimeRate = completedVisits > 0 ? Math.round((onTimeVisits / completedVisits) * 100) : 0;
      const overallPerformance = Math.round((completionRate + onTimeRate) / 2);

      setPerformanceData({
        overallPerformance,
        completionRate,
        totalVisits,
        completedVisits,
        activeVisits,
        totalStores: stores.length,
        totalSupervisors: supervisors.length,
      });

      // Process stock rupture data by store
      const storeStockMap = new Map();
      stores.forEach(store => {
        storeStockMap.set(store.id, {
          name: store.name || `Store ${store.id}`,
          ruptures: 0,
          lowStock: 0,
          totalItems: 0,
        });
      });

      inventory.forEach(item => {
        if (item.store && storeStockMap.has(item.store)) {
          const storeData = storeStockMap.get(item.store);
          storeData.totalItems++;
          if (item.quantity === 0) {
            storeData.ruptures++;
          } else if (item.quantity < (item.min_quantity || 5)) {
            storeData.lowStock++;
          }
        }
      });

      const stockData = Array.from(storeStockMap.values())
        .sort((a, b) => b.ruptures - a.ruptures)
        .slice(0, 10);
      setStockRuptureData(stockData);

      // Process visit status data
      const visitStatuses = {
        completed: visits.filter(v => v.status === 'completed').length,
        in_progress: visits.filter(v => v.status === 'in_progress').length,
        cancelled: visits.filter(v => v.status === 'cancelled').length,
        pending: visits.filter(v => v.status === 'pending').length,
      };
      
      const visitStatusArray = [
        { status: 'Completed', count: visitStatuses.completed, color: '#10b981' },
        { status: 'In Progress', count: visitStatuses.in_progress, color: '#3b82f6' },
        { status: 'Pending', count: visitStatuses.pending, color: '#f59e0b' },
        { status: 'Cancelled', count: visitStatuses.cancelled, color: '#ef4444' },
      ].filter(item => item.count > 0);
      
      setVisitStatusData(visitStatusArray);

      // Calculate supervisor objectives (based on their managed merchandiser teams and monthly targets)
      const supervisorMap = new Map();
      supervisors.forEach(sup => {
        supervisorMap.set(sup.id, {
          id: sup.id,
          name: sup.first_name + ' ' + sup.last_name,
          avatar: getAvatarUrl(sup.avatar_url || sup.avatar) || `https://ui-avatars.com/api/?name=${sup.first_name}+${sup.last_name}&background=667eea&color=fff`,
          teamSize: 0, // Number of merchandisers they manage
          teamVisits: 0, // Total visits from their team
          completedVisits: 0, // Completed visits from their team
          teamCompletionRate: 0,
          monthlyObjective: 95, // Monthly target (%)
          monthlyAchievement: 0, // Monthly achievement (%)
        });
      });

      // Match merchandisers to supervisors and aggregate their team's performance
      merchandisers.forEach(merch => {
        // Accept multiple backend shapes: numeric FK, expanded object, or local assignment fallback
        const expandedSupervisorId =
          typeof merch.supervisor === 'object' && merch.supervisor !== null
            ? merch.supervisor.id
            : null;
        const localAssignmentId = savedAssignments?.[merch.id]?.supervisorId;
        const supervisorIdRaw =
          merch.supervisor ||
          merch.supervisor_id ||
          merch.supervisorId ||
          expandedSupervisorId ||
          localAssignmentId;
        const supervisorId = Number(supervisorIdRaw);
        
        if (Number.isFinite(supervisorId) && supervisorMap.has(supervisorId)) {
          const supData = supervisorMap.get(supervisorId);
          supData.teamSize++; // Count this merchandiser in the team
          
          // Find all visits for this merchandiser
          const merchVisits = visits.filter(v => 
            Number(v.merchandiser) === Number(merch.id) || 
            Number(v.merchandiser_id) === Number(merch.id) ||
            Number(v.merchandiserId) === Number(merch.id) ||
            Number(v.assigned_to) === Number(merch.id)
          );
          
          supData.teamVisits += merchVisits.length;
          supData.completedVisits += merchVisits.filter(v => v.status === 'completed').length;
        }
      });

      // Calculate team completion rate and monthly achievement
      supervisorMap.forEach(supData => {
        if (supData.teamVisits > 0) {
          supData.teamCompletionRate = Math.round((supData.completedVisits / supData.teamVisits) * 100);
          supData.monthlyAchievement = supData.teamCompletionRate; // Achievement based on team's completion rate
        } else {
          // If team has no visits yet, show as 0
          supData.monthlyAchievement = 0;
        }
      });

      // Sort supervisors - those with teams first, then by achievement
      const supervisorObj = Array.from(supervisorMap.values())
        .sort((a, b) => {
          if (a.teamSize === 0 && b.teamSize === 0) return 0;
          if (a.teamSize === 0) return 1;
          if (b.teamSize === 0) return -1;
          return b.monthlyAchievement - a.monthlyAchievement;
        });
      setSupervisorObjectives(supervisorObj);

      // Build real trend from the last 4 weeks of visit completion rate
      const now = new Date();
      const trendData = [];
      for (let i = 3; i >= 0; i -= 1) {
        const start = new Date(now);
        start.setDate(now.getDate() - (i + 1) * 7);
        const end = new Date(now);
        end.setDate(now.getDate() - i * 7);

        const weeklyVisits = visits.filter(v => {
          const rawDate = v.updated_at || v.date || v.created_at || v.started_at;
          if (!rawDate) return false;
          const visitDate = new Date(rawDate);
          return visitDate >= start && visitDate < end;
        });

        const weeklyCompleted = weeklyVisits.filter(v => v.status === 'completed').length;
        const weeklyRate = weeklyVisits.length > 0
          ? Math.round((weeklyCompleted / weeklyVisits.length) * 100)
          : 0;

        trendData.push({
          week: `Week ${4 - i}`,
          performance: weeklyRate,
          target: 95,
        });
      }
      setPerformanceTrend(trendData);

      setProductsData(products);
      setVisitsData(visits);
      setCompetitorAnalysis(buildCompetitorAnalysis(products, visits, activeCompetitor));
    } catch (err) {
      console.error('Error fetching performance data:', err);
      setError('Failed to load performance data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = () => {
    if (!competitorAnalysis.priceRows.length) {
      return;
    }

    const headers = ['Product', 'Category', 'Our Price', 'Competitor Price', 'Gap %', 'Tracker'];
    const rows = competitorAnalysis.priceRows.map((row) => [
      row.name,
      row.category,
      row.ourPrice.toFixed(2),
      row.competitorPrice.toFixed(2),
      row.gapPercent.toFixed(2),
      activeCompetitor,
    ]);

    const csv = [headers, ...rows]
      .map((cols) => cols.map((col) => `"${String(col).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = normalizeCompetitorKey(activeCompetitor || 'tracker');
    link.href = url;
    link.setAttribute('download', `competitor-analysis-${safeName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveTracker = () => {
    const candidate = selectedCompetitorOption === '__custom__'
      ? customCompetitorName.trim()
      : selectedCompetitorOption;

    if (!candidate) {
      return;
    }

    setTrackedCompetitors((prev) => {
      if (prev.includes(candidate)) {
        return prev;
      }
      return [...prev, candidate];
    });

    setActiveCompetitor(candidate);
    setShowTrackerModal(false);
    setCustomCompetitorName('');
  };

  if (loading) {
    return (
      <div className="app">
        <Sidebar />
        <div className="main-content">
          <Navbar />
          <div className="page-container performance-page">
            <div className="loading-state">
              <Zap className="loading-icon" size={48} />
              <p>Loading performance data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <div className="page-container performance-page">
          <div className="page-header">
            <h1>Performance Analytics</h1>
            <p>Overall system performance, stock management, and supervisor objectives</p>
          </div>

          {error && <div className="error-banner">{error}</div>}

          {/* Key Metrics Section */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon overall">
                <TrendingUp size={24} />
              </div>
              <div className="metric-content">
                <p className="metric-label">Overall Performance</p>
                <h3 className="metric-value">{performanceData.overallPerformance}%</h3>
                <p className="metric-subtitle">System efficiency</p>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon completion">
                <CheckCircle2 size={24} />
              </div>
              <div className="metric-content">
                <p className="metric-label">Completion Rate</p>
                <h3 className="metric-value">{performanceData.completionRate}%</h3>
                <p className="metric-subtitle">
                  {performanceData.completedVisits}/{performanceData.totalVisits} visits
                </p>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon active">
                <Zap size={24} />
              </div>
              <div className="metric-content">
                <p className="metric-label">Active Visits</p>
                <h3 className="metric-value">{performanceData.activeVisits}</h3>
                <p className="metric-subtitle">In progress</p>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon users">
                <Users size={24} />
              </div>
              <div className="metric-content">
                <p className="metric-label">Team Overview</p>
                <h3 className="metric-value">{performanceData.totalSupervisors}</h3>
                <p className="metric-subtitle">
                  Supervisors managing {performanceData.totalStores} stores
                </p>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="charts-container">
            {/* Performance Trend */}
            <div className="chart-card">
              <div className="chart-header">
                <h2>Performance Trend</h2>
                <p>Weekly performance vs target</p>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={performanceTrend} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="week" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="performance"
                    stroke="#3b82f6"
                    name="Actual Performance"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="target"
                    stroke="#10b981"
                    name="Target"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Stock Rupture by Store */}
            <div className="chart-card">
              <div className="chart-header">
                <h2>Stock Ruptures by Location</h2>
                <p>Top stores with critical stock issues</p>
              </div>
              {stockRuptureData.length > 0 ? (
                <div className="data-values-container">
                  {stockRuptureData.map((store, index) => (
                    <div key={index} className="data-value-item">
                      <div className="value-header">
                        <h4>{store.name}</h4>
                        <div className="value-badges">
                          <span className="badge rupture">{store.ruptures} Ruptures</span>
                          <span className="badge low-stock">{store.lowStock} Low Stock</span>
                        </div>
                      </div>
                      <div className="value-bars">
                        <div className="bar-item">
                          <label>Stock Ruptures</label>
                          <div className="bar-container">
                            <div className="bar-fill rupture" style={{ width: `${Math.min((store.ruptures / Math.max(...stockRuptureData.map(s => s.ruptures), 1)) * 100, 100)}%` }} />
                          </div>
                          <span className="bar-value">{store.ruptures}</span>
                        </div>
                        <div className="bar-item">
                          <label>Low Stock Items</label>
                          <div className="bar-container">
                            <div className="bar-fill low-stock" style={{ width: `${Math.min((store.lowStock / Math.max(...stockRuptureData.map(s => s.lowStock), 1)) * 100, 100)}%` }} />
                          </div>
                          <span className="bar-value">{store.lowStock}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <Package size={48} />
                  <p>No stock data available</p>
                </div>
              )}
            </div>

            {/* Visit Status Summary */}
            <div className="chart-card">
              <div className="chart-header">
                <h2>Visit Execution Summary</h2>
                <p>Distribution of visit statuses</p>
              </div>
              {visitStatusData.length > 0 ? (
                <div className="visit-status-container">
                  <div className="status-items">
                    {visitStatusData.map((item, index) => (
                      <div key={index} className="status-item">
                        <div className="status-color" style={{ backgroundColor: item.color }} />
                        <div className="status-info">
                          <span className="status-name">{item.status}</span>
                          <span className="status-count">{item.count}</span>
                        </div>
                        <div className="status-percentage">
                          {Math.round((item.count / performanceData.totalVisits) * 100)}%
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="status-bars">
                    {visitStatusData.map((item, index) => (
                      <div key={index} className="status-bar-item">
                        <div className="status-bar-wrapper">
                          <div 
                            className="status-bar" 
                            style={{ 
                              width: `${(item.count / performanceData.totalVisits) * 100}%`,
                              backgroundColor: item.color
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <Zap size={48} />
                  <p>No visit data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Competitor Analysis */}
          <div className="competitor-section">
            <div className="competitor-header">
              <div>
                <h2>Competitor Analysis</h2>
                <p>Real-time owner brand movement and tactical pricing intelligence.</p>
              </div>
              <div className="competitor-actions">
                <button type="button" className="competitor-btn secondary" onClick={handleExportReport}>Export Report</button>
                <button type="button" className="competitor-btn primary" onClick={() => setShowTrackerModal(true)}>New Tracker</button>
              </div>
            </div>

            <div className="tracker-row">
              <span className="tracker-label">Tracking Owner:</span>
              <div className="tracker-chips">
                {trackedCompetitors.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={`tracker-chip ${activeCompetitor === name ? 'active' : ''}`}
                    onClick={() => setActiveCompetitor(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div className="competitor-kpis">
              <div className="competitor-kpi-card">
                <p className="kpi-title">Competitor Promos Detected</p>
                <div className="kpi-value-row">
                  <h3>{competitorAnalysis.promosDetected}</h3>
                </div>
              </div>
              <div className="competitor-kpi-card">
                <p className="kpi-title">Price Gaps Found</p>
                <div className="kpi-value-row">
                  <h3>{competitorAnalysis.priceRows.length}</h3>
                  <span className="kpi-alert">{competitorAnalysis.criticalGaps} critical</span>
                </div>
              </div>
              <div className="competitor-kpi-card">
                <p className="kpi-title">New Products Spotted</p>
                <div className="kpi-value-row">
                  <h3>{competitorAnalysis.newProductsSpotted}</h3>
                  <span className="kpi-sub">Last 30 days</span>
                </div>
              </div>
            </div>

            <div className="competitor-layout">
              <div className="competitor-activities">
                <h3>Detected Competitor Activities</h3>
                {competitorAnalysis.activities.length > 0 ? (
                  <ul className="activity-list">
                    {competitorAnalysis.activities.map((activity) => (
                      <li key={activity.id} className="activity-item">
                        <div className="activity-dot" />
                        <div className="activity-content">
                          <p className="activity-title">{activity.title}</p>
                          <p className="activity-meta">{activity.time} · {activity.subtitle}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="competitor-empty">No competitor signals yet.</p>
                )}
              </div>

              <div className="competitor-main">
                <div className="competitor-table-wrap">
                  <h3>Our Price vs. {activeCompetitor} (Owner)</h3>
                  {competitorAnalysis.priceRows.length > 0 ? (
                    <div className="competitor-table-scroll">
                      <table className="competitor-table">
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Category</th>
                            <th>Our Price</th>
                            <th>Comp. Price</th>
                            <th>Gap %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {competitorAnalysis.priceRows.map((row, idx) => (
                            <tr key={`${row.name}-${idx}`}>
                              <td>
                                <div className="row-product-cell">
                                  <span>{row.name}</span>
                                  <span className={`source-badge ${row.source === 'visit' ? 'field' : 'catalog'}`}>
                                    {row.source === 'visit' ? 'Field' : 'Catalog'}
                                  </span>
                                </div>
                              </td>
                              <td>{row.category}</td>
                              <td>${row.ourPrice.toFixed(2)}</td>
                              <td>${row.competitorPrice.toFixed(2)}</td>
                              <td className={`gap-${row.gapState}`}>
                                {row.gapPercent > 0 ? '+' : ''}{row.gapPercent.toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="competitor-empty">
                      No owner price fields found yet. Add owner-specific prices to products to activate gap analytics.
                    </p>
                  )}
                </div>

                <div className="competitor-categories">
                  <h3>Price Gaps Across Categories</h3>
                  <p>% difference relative to nearest competitor</p>
                  <div className="category-bars">
                    {competitorAnalysis.categoryGaps.map((cat) => (
                      <div key={cat.category} className="category-bar-item">
                        <div className="bar-pair">
                          <div
                            className="bar-competitive"
                            style={{ height: `${Math.min(cat.competitive * 10, 120)}px` }}
                            title={`Competitive: ${cat.competitive}%`}
                          />
                          <div
                            className="bar-critical"
                            style={{ height: `${Math.min(cat.critical * 10, 120)}px` }}
                            title={`Critical: ${cat.critical}%`}
                          />
                        </div>
                        <span>{cat.category}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {showTrackerModal && (
            <div className="tracker-modal-overlay" role="dialog" aria-modal="true">
              <div className="tracker-modal">
                <h3>Choose Owner To Track</h3>
                <p>Select an existing owner brand or add a custom one.</p>

                <label htmlFor="competitorOption">Owner</label>
                <select
                  id="competitorOption"
                  value={selectedCompetitorOption}
                  onChange={(e) => setSelectedCompetitorOption(e.target.value)}
                >
                  {ownerOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                  <option value="__custom__">Other owner (custom)</option>
                </select>

                {selectedCompetitorOption === '__custom__' && (
                  <>
                    <label htmlFor="customCompetitor">Custom Owner Name</label>
                    <input
                      id="customCompetitor"
                      type="text"
                      value={customCompetitorName}
                      onChange={(e) => setCustomCompetitorName(e.target.value)}
                      placeholder="e.g. Warda Premium"
                    />
                  </>
                )}

                <div className="tracker-modal-actions">
                  <button type="button" className="competitor-btn secondary" onClick={() => setShowTrackerModal(false)}>
                    Cancel
                  </button>
                  <button type="button" className="competitor-btn primary" onClick={handleSaveTracker}>
                    Track Owner
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Supervisor Objectives */}
          <div className="supervisor-section">
            <div className="section-header">
              <h2>Supervisor Performance & Objectives</h2>
              <p>Team management and monthly objective achievement</p>
            </div>

            {supervisorObjectives.length > 0 ? (
              <div className="supervisor-grid">
                {supervisorObjectives.map((supervisor, index) => (
                  <div key={index} className="supervisor-card">
                    <div className="supervisor-header">
                      <div className="supervisor-name">
                          <img 
                            src={supervisor.avatar} 
                            alt={supervisor.name} 
                            className="supervisor-avatar"
                            onError={(e) => {e.target.src = `https://ui-avatars.com/api/?name=${supervisor.name}&background=667eea&color=fff`}}
                          />
                        <h3>{supervisor.name}</h3>
                      </div>
                      <div
                        className={`completion-badge ${
                          supervisor.teamSize === 0
                            ? 'pending'
                            : supervisor.monthlyAchievement >= supervisor.monthlyObjective ? 'success' : 'warning'
                        }`}
                      >
                        {supervisor.monthlyAchievement}%
                      </div>
                    </div>

                    <div className="supervisor-stats">
                      <div className="stat-row">
                        <span className="stat-label">Team Size:</span>
                        <span className="stat-value">{supervisor.teamSize} merchandisers</span>
                      </div>
                      <div className="stat-row">
                        <span className="stat-label">Team Visits:</span>
                        <span className="stat-value">{supervisor.teamVisits}</span>
                      </div>
                      <div className="stat-row">
                        <span className="stat-label">Completed:</span>
                        <span className="stat-value">{supervisor.completedVisits}</span>
                      </div>
                    </div>

                    <div className="objective-info">
                      <div className="objective-row">
                        <span className="objective-label">Monthly Objective:</span>
                        <span className="objective-target">{supervisor.monthlyObjective}%</span>
                      </div>
                      <div className="objective-row">
                        <span className="objective-label">Achievement:</span>
                        <span className="objective-value">{supervisor.monthlyAchievement}%</span>
                      </div>
                    </div>

                    {supervisor.teamSize > 0 ? (
                      <>
                        <div className="supervisor-progress-bar">
                          <div
                            className={`supervisor-progress-fill ${
                              supervisor.monthlyAchievement >= supervisor.monthlyObjective ? 'success' : 'warning'
                            }`}
                            style={{ width: `${Math.min(supervisor.monthlyAchievement, 100)}%` }}
                          />
                        </div>

                        <div className="supervisor-status-text">
                          {supervisor.monthlyAchievement >= supervisor.monthlyObjective ? (
                            <span className="success">✓ Objective achieved</span>
                          ) : (
                            <span className="warning">
                              {supervisor.monthlyObjective - supervisor.monthlyAchievement}% to target
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="no-data-message">
                        <p>No team members assigned</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Users size={48} />
                <p>No supervisors available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Performance;
