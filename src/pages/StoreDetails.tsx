import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Store as StoreIcon, 
  ArrowLeft, 
  MapPin, 
  Phone, 
  ShieldCheck, 
  Loader2, 
  Package,
  Image as ImageIcon,
  XCircle,
  ClipboardCheck,
  ArrowRight,
  Clock,
  Compass,
  Globe,
  ExternalLink,
  MessageCircle,
  Map
} from 'lucide-react';
import { parseHexEWKB } from '../utils/formatters';
import type { Store, Product } from '../types';
import './StoreDetails.css';

const StoreDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'info'>('products');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [changedFields, setChangedFields] = useState<{ label: string; old: string; new: string }[]>([]);

  const fetchStoreDetails = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('id', id!)
        .single();

      if (error) throw error;
      
      const storeData = data as Store;
      // Handle geographic location if it's in hex format
      if (storeData.location && !storeData.location_wkt) {
        storeData.location_wkt = parseHexEWKB(storeData.location as unknown as string);
      }

      setStore(storeData);

      const { data: prodData } = await supabase
        .from('products')
        .select('id, name, price, image_url')
        .eq('store_id', id!)
        .eq('in_stock', true)
        .eq('is_deleted', false);
      
      setProducts((prodData as Product[]) || []);
    } catch (err: unknown) {
      alert('Error updating status: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchStoreDetails();
  }, [id, fetchStoreDetails]);

  const renderFormattedValue = useCallback((key: string, value: string | null | undefined | unknown) => {
    if (!value || value === 'Not set' || value === 'Not provided') return 'Not set';
    if (key === 'opening_hours') {
      try {
        const hours = typeof value === 'string' ? JSON.parse(value) : value;
        if (Array.isArray(hours) && hours.length > 0) {
          return hours.map((h: { start: string; end: string }) => `${h.start} - ${h.end}`).join(', ');
        }
      } catch { return String(value); }
    }
    if (key === 'location_wkt' || key === 'location') {
      if (typeof value === 'string') {
        const cleanedValue = value.replace('POINT(', '').replace(')', '');
        const parts = cleanedValue.split(' ');
        if (parts.length === 2) {
          return parts.reverse().join(', ');
        }
        return cleanedValue;
      }
    }
    return String(value);
  }, []);

  const getChanges = useCallback(() => {
    if (!store) return [];
    const fields = [
      { key: 'name', label: 'Store Name' },
      { key: 'description', label: 'Description' },
      { key: 'category', label: 'Category' },
      { key: 'upi_id', label: 'UPI ID' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'whatsapp_number', label: 'WhatsApp' },
      { key: 'address_line_1', label: 'Address' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'pincode', label: 'Pincode' },
      { key: 'owner_name', label: 'Owner Name' },
      { key: 'owner_number', label: 'Owner Number' },
      { key: 'location_wkt', label: 'Location' },
      { key: 'opening_hours', label: 'Opening Hours' },
      { key: 'banner_url', label: 'Store Banner' },
    ];

    const approved = store.approved_details || {};
    const diffs: { label: string; old: string; new: string }[] = [];

    fields.forEach(f => {
      const oldV = renderFormattedValue(f.key, (approved as Record<string, any>)[f.key]);
      const newV = renderFormattedValue(f.key, (store as unknown as Record<string, any>)[f.key]);
      if (oldV !== newV) diffs.push({ label: f.label, old: oldV, new: newV });
    });

    return diffs;
  }, [store, renderFormattedValue]);

  const confirmVerification = useCallback(async () => {
    if (!store) return;
    try {
      setActionLoading(true);
      const snapshot = {
        name: store.name,
        description: store.description,
        category: store.category,
        upi_id: store.upi_id,
        phone: store.phone,
        email: store.email,
        whatsapp_number: store.whatsapp_number,
        address_line_1: store.address_line_1,
        city: store.city,
        state: store.state,
        pincode: store.pincode,
        owner_name: store.owner_name,
        owner_number: store.owner_number,
        location_wkt: store.location_wkt,
        opening_hours: store.opening_hours,
        banner_url: store.banner_url,
      };

      const { error } = await supabase
        .from('stores')
        .update({ 
          has_pending_changes: false, 
          approved_details: snapshot 
        })
        .eq('id', store.id);

      if (error) throw error;
      alert('Changes verified successfully!');
      setIsModalOpen(false);
      fetchStoreDetails();
    } catch (error: unknown) {
      alert(`Action failed: ${(error as Error).message}`);
    } finally {
      setActionLoading(false);
    }
  }, [store, fetchStoreDetails]);

  const handleVerifyChanges = useCallback(() => {
    const diffs = getChanges();
    if (diffs.length === 0) {
      confirmVerification();
    } else {
      setChangedFields(diffs);
      setIsModalOpen(true);
    }
  }, [getChanges, confirmVerification]);

  const handleStatusUpdate = useCallback(async (type: 'activate' | 'deactivate') => {
    if (!store) return;
    try {
      setActionLoading(true);
      const snapshot = {
        name: store.name,
        description: store.description,
        category: store.category,
        upi_id: store.upi_id,
        phone: store.phone,
        email: store.email,
        whatsapp_number: store.whatsapp_number,
        address_line_1: store.address_line_1,
        city: store.city,
        state: store.state,
        pincode: store.pincode,
        owner_name: store.owner_name,
        owner_number: store.owner_number,
        location_wkt: store.location_wkt,
        opening_hours: store.opening_hours,
        banner_url: store.banner_url,
      };

      const updates = type === 'activate' 
        ? { is_active: true, is_approved: true, approved_details: snapshot, verification_images: [] }
        : { is_active: false, is_approved: false };

      const { error } = await supabase
        .from('stores')
        .update(updates)
        .eq('id', store.id);

      if (error) throw error;
      alert(`Store ${type}d successfully!`);
      fetchStoreDetails();
    } catch (error: unknown) {
      alert(`Action failed: ${(error as Error).message}`);
    } finally {
      setActionLoading(false);
    }
  }, [store, fetchStoreDetails]);

  const handleContact = useCallback((type: 'tel' | 'whatsapp' | 'url', value: string) => {
    if (!value) return;
    let url = '';
    if (type === 'tel') url = `tel:${value}`;
    else if (type === 'whatsapp') url = `https://wa.me/${value.replace(/\D/g, '')}`;
    else url = value.startsWith('http') ? value : `https://${value}`;
    window.open(url, '_blank');
  }, []);

  const openInMap = useCallback(() => {
    if (!store?.location_wkt) return;
    const match = store.location_wkt.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
    if (match) {
      const [lng, lat] = [match[1], match[2]];
      window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
    }
  }, [store]);

  const openingHoursFormatted = useMemo(() => renderFormattedValue('opening_hours', store?.opening_hours), [store?.opening_hours, renderFormattedValue]);
  const locationWktFormatted = useMemo(() => renderFormattedValue('location_wkt', store?.location_wkt), [store?.location_wkt, renderFormattedValue]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'white' }}>
        <Loader2 className="animate-spin" size={48} color="var(--primary)" />
      </div>
    );
  }

  if (!store) return <div style={{ padding: '2rem', textAlign: 'center' }}>Store not found</div>;

  return (
    <div className="detail-page-container">
      <header className="detail-header">
        <div className="store-details-back-container">
          <button onClick={() => navigate(-1)} className="detail-back-btn">
            <ArrowLeft size={24} /> 
            <h1 className="store-details-page-title">Store Details</h1>
          </button>
        </div>

        <div className="detail-actions">
          {store.has_pending_changes && (
            <button 
              onClick={handleVerifyChanges}
              className="detail-action-btn success"
            >
              <ClipboardCheck size={16} /> Verify Changes
            </button>
          )}

          {store.is_active ? (
            <button 
              onClick={() => handleStatusUpdate('deactivate')}
              disabled={actionLoading}
              className="detail-action-btn danger"
            >
              <XCircle size={16} /> Deactivate
            </button>
          ) : (
            <button 
              onClick={() => handleStatusUpdate('activate')}
              disabled={actionLoading}
              className="detail-action-btn primary"
            >
              {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />} 
              Activate
            </button>
          )}
        </div>
      </header>

      <main className="store-details-main">
        <div className="store-details-banner-container">
          {store.banner_url ? (
            <img src={store.banner_url} alt="Banner" loading="lazy" decoding="async" className="store-details-banner-img" />
          ) : (
            <div className="store-details-banner-placeholder">
               <StoreIcon size={60} />
               <p style={{ marginTop: '8px', fontWeight: 600 }}>Welcome to our store</p>
            </div>
          )}
        </div>

        <div className="store-details-branding-container">
           <div className="store-details-branding-top">
              <h2 className="store-details-name">{store.name}</h2>
              <div className="store-details-badges-container">
                 {store.is_active ? (
                   <span className="store-details-status-badge active">ACTIVE</span>
                 ) : (
                   <span className="store-details-status-badge inactive">INACTIVE</span>
                 )}
                 {store.has_pending_changes && (
                   <span className="store-details-status-badge unverified">UNVERIFIED</span>
                 )}
              </div>
           </div>
           <div className="store-details-tags-container">
              <span className="store-details-tag">
                {store.category}
              </span>
              {store.city && (
                <span className="store-details-tag">
                  {store.city}
                </span>
              )}
           </div>
        </div>

        <div className="store-details-tabs-wrapper">
          <div className="store-details-tabs-inner">
            <button 
              onClick={() => setActiveTab('products')}
              className={`store-details-tab-btn ${activeTab === 'products' ? 'active' : ''}`}
            >
              <Package size={20} /> Products
            </button>
            <button 
              onClick={() => setActiveTab('info')}
              className={`store-details-tab-btn ${activeTab === 'info' ? 'active' : ''}`}
            >
              <ImageIcon size={20} /> Store Info
            </button>
          </div>
        </div>

        <div className="store-details-content-wrapper">
          {activeTab === 'products' ? (
            <div className="store-details-products-grid">
               {products.map(p => (
                 <ProductCard key={p.id} product={p} />
               ))}
               {products.length === 0 && (
                 <div className="store-details-products-empty">
                   <Package size={64} style={{ marginBottom: '1rem' }} />
                   <p>No products available right now.</p>
                 </div>
               )}
            </div>
          ) : (
            <div className="store-details-info-layout">
              <div className="card store-info-section-card">
                <h3 className="store-info-section-title">Owner Information</h3>
                <div className="store-info-row">
                   <p className="store-info-label">Owner Name</p>
                   <p className="store-info-value">{store.owner_name || 'Not provided'}</p>
                </div>
                <div className="store-info-row">
                   <p className="store-info-label">Owner Number</p>
                   <button 
                     onClick={() => handleContact('tel', store.owner_number || '')}
                     className="store-info-value-link"
                   >
                     {store.owner_number || 'Not provided'}
                   </button>
                </div>

                {store.verification_images && store.verification_images.length > 0 && (
                  <div style={{ borderTop: '1px solid #F2F2F7', paddingTop: '1rem' }}>
                    <p className="store-info-label" style={{ marginBottom: '10px' }}>Verification Documents</p>
                    <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
                      {store.verification_images.map((img, i) => (
                        <div key={i} style={{ flexShrink: 0, width: '120px', height: '120px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #E5E5EA' }}>
                          <img src={img} alt="Doc" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} onClick={() => window.open(img, '_blank')} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="card store-info-section-card">
                <h3 className="store-info-section-title">Contact Information</h3>
                <div className="store-info-row">
                   <p className="store-info-label">Store Phone</p>
                   <button 
                     onClick={() => handleContact('tel', store.phone || '')}
                     className="store-info-value-link"
                   >
                     {store.phone || 'Not provided'}
                   </button>
                </div>
                <div className="store-info-row" style={{ marginBottom: 0 }}>
                   <p className="store-info-label">WhatsApp Number</p>
                   <button 
                     onClick={() => handleContact('whatsapp', store.whatsapp_number || '')}
                     className="store-info-value-link"
                   >
                     {store.whatsapp_number || 'Not provided'}
                   </button>
                </div>
              </div>

              <div className="card store-info-section-card">
                <h3 className="store-info-section-title">Business Information</h3>
                <div className="store-info-row">
                   <p className="store-info-label">UPI ID</p>
                   <p className="store-info-value">{store.upi_id || 'Not provided'}</p>
                </div>
                <div className="store-info-row" style={{ marginBottom: 0 }}>
                   <p className="store-info-label">Email</p>
                   <p className="store-info-value">{store.email || 'Not provided'}</p>
                </div>
              </div>

              <div className="card store-info-section-card">
                 <h3 className="store-info-section-title">About the Store</h3>
                 <p style={{ fontSize: '15px', color: '#1C1C1E', lineHeight: 1.5, fontWeight: 500 }}>
                   {store.description || 'Quality products from your neighborhood store.'}
                 </p>
              </div>

              <div className="card" style={{ padding: '0', borderRadius: '20px', overflow: 'hidden' }}>
                 <div style={{ padding: '1rem', borderBottom: '1px solid #F2F2F7' }}>
                    <h3 className="store-info-section-title">Operating Hours</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={18} color="#007bff" />
                      <p style={{ fontSize: '15px', fontWeight: 600 }}>
                        {openingHoursFormatted}
                      </p>
                    </div>
                 </div>
                 <div style={{ padding: '1rem' }}>
                    <h3 className="store-info-section-title">Live Location</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <Compass size={18} color="#007bff" />
                      <p style={{ fontSize: '15px', fontWeight: 600 }}>
                        {locationWktFormatted}
                      </p>
                    </div>
                    <button 
                      onClick={openInMap}
                      className="store-info-value-link"
                      style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Map size={16} /> View on Map
                    </button>
                 </div>
              </div>

              <div className="card store-info-section-card">
                 <h3 className="store-info-section-title">Address</h3>
                 <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <MapPin size={20} color="#FF3B30" />
                    <p style={{ fontSize: '15px', fontWeight: 600, color: '#1C1C1E', lineHeight: 1.4 }}>
                      {store.address_line_1 || store.address}
                      {store.pincode && ` - ${store.pincode}`}
                      {store.city && <><br />{store.city}</>}
                      {store.state && `, ${store.state}`}
                    </p>
                 </div>
              </div>

              {(store.phone || store.whatsapp_number) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                   <div style={{ display: 'flex', gap: '1rem' }}>
                     {store.phone && (
                       <button 
                         onClick={() => handleContact('tel', store.phone || '')}
                         style={{ 
                           flex: 1, background: '#007bff', color: 'white', border: 'none', 
                           padding: '12px', borderRadius: '25px', fontWeight: 800, fontSize: '14px',
                           display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                         }}
                       >
                         <Phone size={18} /> Call
                       </button>
                     )}
                     {store.whatsapp_number && (
                       <button 
                         onClick={() => handleContact('whatsapp', store.whatsapp_number || '')}
                         style={{ 
                           flex: 1, background: '#34C759', color: 'white', border: 'none', 
                           padding: '12px', borderRadius: '25px', fontWeight: 800, fontSize: '14px',
                           display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                         }}
                       >
                         <MessageCircle size={18} /> WhatsApp
                       </button>
                     )}
                   </div>
                </div>
              )}

              {(store.instagram_url || store.facebook_url) && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1.5rem', padding: '1rem 0' }}>
                   {store.instagram_url && (
                     <button onClick={() => handleContact('url', store.instagram_url || '')} style={{ background: 'white', border: '1px solid #E5E5EA', width: '48px', height: '48px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E4405F' }}>
                        <Globe size={24} />
                     </button>
                   )}
                   {store.facebook_url && (
                     <button onClick={() => handleContact('url', store.facebook_url || '')} style={{ background: 'white', border: '1px solid #E5E5EA', width: '48px', height: '48px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1877F2' }}>
                        <ExternalLink size={24} />
                     </button>
                   )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {isModalOpen && (
          <div className="modal-overlay">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} 
              className="modal-content"
            >
               <div className="modal-header">
                  <h2 className="modal-title">
                    <ClipboardCheck size={24} color="#007bff" />
                    Review Changes
                  </h2>
                  <button onClick={() => setIsModalOpen(false)} className="modal-close-btn"><XCircle size={24} color="#8E8E93" /></button>
               </div>
               
               <div className="modal-body">
                  <p className="store-details-modal-subtitle">
                    The following details have been updated by the owner. Please review before accepting.
                  </p>
                  
                  <div className="store-details-diff-list">
                    {changedFields.map((f, i) => (
                      <div key={i} className="store-details-diff-item">
                        <span className="store-details-diff-label">{f.label}</span>
                        <div className="store-details-diff-row">
                          <div className="store-details-diff-old">{f.old}</div>
                          <ArrowRight size={16} color="#8E8E93" />
                          <div className="store-details-diff-new">{f.new}</div>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>

               <div className="modal-footer">
                  <button className="btn" style={{ flex: 1, background: '#E5E5EA', color: '#8E8E93' }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirmVerification} disabled={actionLoading}>
                    {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <span>Accept Changes</span>}
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProductCard: React.FC<{ product: Product }> = memo(({ product }) => (
  <motion.div 
    layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
    className="store-details-product-card"
  >
    <div className="store-details-product-img-wrapper">
       {product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" decoding="async" /> : <Package size={32} color="#ccc" style={{ margin: 'auto' }} />}
    </div>
    <h4 className="store-details-product-name">{product.name}</h4>
    <p className="store-details-product-price">₹{product.price}</p>
  </motion.div>
));

export default memo(StoreDetails);

