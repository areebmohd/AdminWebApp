import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Store as StoreIcon, 
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';

import './Stores.css';

interface Store {
  id: string;
  name: string;
  address: string | null;
  banner_url: string | null;
  logo_url: string | null;
  is_active: boolean;
  is_approved: boolean;
  has_pending_changes: boolean;
  created_at: string;
}

interface StoreSection {
  title: string;
  data: Store[];
}

const Stores: React.FC = () => {
  const navigate = useNavigate();
  const [storeSections, setStoreSections] = useState<StoreSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unactive' | 'unverified'>('all');

  const processStores = (stores: Store[], filter: string) => {
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
  };

  useEffect(() => {
    const fetchStores = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('stores')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const sections = processStores(data as Store[], activeFilter);
        setStoreSections(sections);
      } catch (error: any) {
        console.error('Error fetching stores:', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStores();
  }, [activeFilter]);

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
              <div key={section.title}>
                <h2 className="store-section-title">
                  {section.title}
                </h2>
                
                <div className="store-grid">
                  {section.data.map((store) => (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={store.id} 
                      className="card store-card"
                      onClick={() => navigate(`/stores/${store.id}`)}
                    >
                      {/* Banner Image */}
                      <div className="store-banner-container">
                        {store.banner_url ? (
                          <img src={store.banner_url} alt={store.name} loading="lazy" decoding="async" className="store-banner-img" />
                        ) : (
                          <div className="store-banner-placeholder">
                            <ImageIcon size={40} />
                          </div>
                        )}
                      </div>

                      {/* Store Card Body */}
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
                  ))}
                </div>
              </div>
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

export default Stores;
