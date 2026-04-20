import React, { useEffect, useState, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Store as StoreIcon, 
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';


import type { Store } from '../types';
import './Stores.css';

interface StoreSection {
  title: string;
  data: Store[];
}

const Stores: React.FC = () => {
  const navigate = useNavigate();
  const [storeSections, setStoreSections] = useState<StoreSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unactive' | 'unverified'>('all');

  const processStores = useCallback((stores: Store[], filter: string) => {
    const filtered = stores.filter(store => {
      if (filter === 'unactive') return !store.is_active;
      if (filter === 'unverified') return store.has_pending_changes;
      return true;
    });

    const groupedData: { [key: string]: Store[] } = {};

    filtered.forEach(store => {
      const dateString = store.created_at
        ? new Date(store.created_at).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
        : 'Unknown Date';

      if (!groupedData[dateString]) {
        groupedData[dateString] = [];
      }
      groupedData[dateString].push(store);
    });

    return Object.keys(groupedData).map(date => ({
      title: date,
      data: groupedData[date],
    }));
  }, []);

  const fetchStores = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const sections = processStores(data as Store[], activeFilter);
      setStoreSections(sections);
    } catch (error: unknown) {
      console.error('Error fetching stores:', (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, processStores]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const handleStoreClick = useCallback((id: string) => {
    navigate(`/stores/${id}`);
  }, [navigate]);

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="page-header-top">
          <div>
            <h1 className="page-title">Stores</h1>
            <p className="page-subtitle">Manage retail partners and their verification status</p>
          </div>
        </div>

        <div className="tab-bar">
          {(['all', 'unactive', 'unverified'] as const).map(filter => (
            <button 
              key={filter}
              className={`tab-btn ${activeFilter === filter ? 'active' : ''}`}
              onClick={() => setActiveFilter(filter)}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="stores-loader">
          <Loader2 className="animate-spin" size={48} color="var(--primary)" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <div key={activeFilter} className="stores-list-container">
            {storeSections.map((section) => (
              <StoreSectionComponent 
                key={section.title} 
                section={section} 
                onStoreClick={handleStoreClick} 
              />
            ))}

            {storeSections.length === 0 && (
              <div className="stores-empty">
                <StoreIcon size={64} className="stores-empty-icon" />
                <p className="stores-empty-text">No stores found</p>
              </div>
            )}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
};

const StoreSectionComponent: React.FC<{ section: StoreSection; onStoreClick: (id: string) => void }> = memo(({ section, onStoreClick }) => (
  <div key={section.title}>
    <h2 className="store-section-title">
      {section.title}
    </h2>
    
    <div className="store-grid">
      {section.data.map((store) => (
        <StoreCard key={store.id} store={store} onClick={onStoreClick} />
      ))}
    </div>
  </div>
));

const StoreCard: React.FC<{ store: Store; onClick: (id: string) => void }> = memo(({ store, onClick }) => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="card store-card"
    onClick={() => onClick(store.id)}
  >
    <div className="store-banner-container">
      {store.banner_url ? (
        <img src={store.banner_url} alt={store.name} loading="lazy" decoding="async" className="store-banner-img" />
      ) : (
        <div className="store-banner-placeholder">
          <ImageIcon size={40} />
        </div>
      )}
    </div>

    <div className="store-card-body">
      <div className="store-info-section">
        <h3 className="store-name">{store.name}</h3>
        {store.address && (
          <p className="store-address">
            {store.address}
          </p>
        )}
      </div>

      <div className="store-badges-section">
        {store.has_pending_changes && (
          <div className="store-badge unverified">
            Unverified
          </div>
        )}
        <div className={`store-badge ${store.is_active ? 'active' : 'inactive'}`}>
          {store.is_active ? 'Active' : 'Inactive'}
        </div>
      </div>
    </div>
  </motion.div>
));

export default memo(Stores);
