import React, { useState, useEffect, useCallback, memo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  ShoppingCart, 
  Bike, 
  Wallet, 
  Store, 
  TrendingUp, 
  Package, 
  Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCurrency } from '../utils/formatters';
import type { DashboardStats, Timeframe } from '../types';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const [timeframe, setTimeframe] = useState<Timeframe>('daily');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async (selectedTimeframe: Timeframe) => {
    try {
      setLoading(true);
      const days = selectedTimeframe === 'daily' ? 1 : selectedTimeframe === 'weekly' ? 7 : 30;
      
      const { data, error } = await supabase.rpc('get_admin_dashboard_stats', {
        days_limit: days
      });

      if (error) throw error;
      setStats(data as DashboardStats);
    } catch (err: unknown) {
      console.error('Error fetching dashboard stats:', (err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(timeframe);
  }, [timeframe, fetchStats]);

  if (loading && !refreshing) {
    return (
      <div className="loading-container">
        <Loader2 className="animate-spin" size={48} color="#007bff" />
        <p>Crunching the numbers...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1 className="dashboard-title">Overview</h1>
        <div className="timeframe-selector">
          {(['daily', 'weekly', 'monthly'] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              className={`timeframe-btn ${timeframe === tf ? 'active' : ''}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf.charAt(0).toUpperCase() + tf.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Basic Stats Row */}
        <StatCard 
          title="Total Orders" 
          value={stats?.total_orders || 0} 
          icon={<ShoppingCart size={32} />} 
          color="#007bff" 
        />
        <StatCard 
          title="Deliveries" 
          value={stats?.total_deliveries || 0} 
          icon={<Bike size={32} />} 
          color="#10b981" 
        />

        {/* Financial Hero */}
        <motion.div 
          className="financial-hero"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="finance-main-info">
            <h4>Total Revenue</h4>
            <div className="total-revenue">{formatCurrency(stats?.total_payment_received || 0)}</div>
          </div>
          <div className="finance-badge">
            <Wallet size={48} />
          </div>
        </motion.div>

        {/* Financial Breakdown Grid */}
        <div className="revenue-breakdown-grid">
          <BreakdownCard 
            label="To Stores" 
            value={formatCurrency(stats?.total_to_stores || 0)} 
            icon={<Store size={20} />} 
            color="#3b82f6" 
          />
          <BreakdownCard 
            label="To Riders" 
            value={formatCurrency(stats?.total_to_riders || 0)} 
            icon={<Bike size={20} />} 
            color="#f59e0b" 
          />
          <BreakdownCard 
            label="Admin Profit" 
            value={formatCurrency(stats?.total_to_admin || 0)} 
            icon={<TrendingUp size={20} />} 
            color="#10b981" 
          />
        </div>

        {/* Growth Stats Section */}
        <div className="section-title">Network & Growth</div>
        <StatCard 
          title="Stores Joined" 
          value={stats?.stores_joined || 0} 
          icon={<Store size={32} />} 
          color="#8b5cf6" 
        />
        <StatCard 
          title="Items Cataloged" 
          value={stats?.products_added || 0} 
          icon={<Package size={32} />} 
          color="#f97316" 
        />
      </div>
    </div>
  );
};

interface CardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<CardProps> = memo(({ title, value, icon, color }) => (
  <motion.div 
    className="stat-overview-card"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <div className="stat-icon" style={{ backgroundColor: `${color}15`, color }}>
      {icon}
    </div>
    <div className="stat-content">
      <h3>{title}</h3>
      <div className="stat-value">{value}</div>
    </div>
  </motion.div>
));

const BreakdownCard: React.FC<{ label: string; value: string; icon: React.ReactNode; color: string }> = memo(({ label, value, icon, color }) => (
  <motion.div 
    className="breakdown-card"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <div className="breakdown-header">
      <div className="breakdown-icon" style={{ backgroundColor: `${color}15`, color }}>
        {icon}
      </div>
      <span className="breakdown-label">{label}</span>
    </div>
    <div className="breakdown-value" style={{ color }}>{value}</div>
  </motion.div>
));

export default Dashboard;
