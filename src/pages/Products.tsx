import React, { useEffect, useState, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Loader2, 
  Package, 
  Camera,
  Store as StoreIcon,
  Barcode as BarcodeIcon
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import type { Product } from '../types';
import './Products.css';

const Products: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'barcode' | 'common' | 'personal'>('barcode');
  const [barcodeFilter, setBarcodeFilter] = useState<'all' | 'uncomplete' | 'needs_changes'>('all');
  const [commonFilter, setCommonFilter] = useState<'all' | 'no_image'>('all');
  const [uploading, setUploading] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('products')
        .select('*, stores(name)')
        .eq('product_type', activeTab)
        .eq('is_deleted', false);

      if (activeTab === 'barcode') {
        if (barcodeFilter === 'uncomplete') {
          query = query.eq('is_info_complete', false);
        } else if (barcodeFilter === 'needs_changes') {
          query = query.eq('needs_changes', true);
        }
      } else if (activeTab === 'common') {
        if (commonFilter === 'no_image') {
          query = query.or('image_url.is.null,image_url.eq.""');
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      let finalData = (data as (Product & { stores: { name: string } | null })[]) || [];

      // Deduplicate by barcode for uncomplete barcode products (User Request)
      if (activeTab === 'barcode' && barcodeFilter === 'uncomplete') {
        const seenBarcodes = new Set();
        finalData = finalData.filter(p => {
          if (!p.barcode) return true;
          if (seenBarcodes.has(p.barcode)) return false;
          seenBarcodes.add(p.barcode);
          return true;
        });
      }

      setProducts(finalData);
    } catch (error: unknown) {
      console.error('Error fetching products:', (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, barcodeFilter, commonFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handlePickImage = useCallback(async (productId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(productId);
      const fileName = `${productId}_${Date.now()}.jpg`;
      const filePath = `product_images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('products')
        .update({ image_url: publicUrl })
        .eq('id', productId);

      if (updateError) throw updateError;

      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, image_url: publicUrl } : p))
      );
      alert('Product image updated');
    } catch (error: unknown) {
      alert(`Upload Error: ${(error as Error).message}`);
    } finally {
      setUploading(null);
    }
  }, []);

  const handleProductClick = useCallback((id: string) => {
    navigate(`/products/${id}`);
  }, [navigate]);

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="page-header-top">
          <div>
            <h1 className="page-title">Products</h1>
            <p className="page-subtitle">Manage catalog across all store types</p>
          </div>
        </div>

        <div className="tab-bar">
          {(['barcode', 'common', 'personal'] as const).map((tab) => (
            <button 
              key={tab}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`} 
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === 'barcode' && (
          <div className="pill-tab-group">
            {(['all', 'uncomplete', 'needs_changes'] as const).map((filter) => (
              <button 
                key={filter}
                className={`pill-tab ${barcodeFilter === filter ? 'active' : ''}`}
                onClick={() => setBarcodeFilter(filter)}
              >
                {filter === 'uncomplete' ? 'Uncomplete Info' : 
                 filter === 'needs_changes' ? 'Need Changes' : 'All'}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'common' && (
          <div className="pill-tab-group">
            {(['all', 'no_image'] as const).map((filter) => (
              <button 
                key={filter}
                className={`pill-tab ${commonFilter === filter ? 'active' : ''}`}
                onClick={() => setCommonFilter(filter)}
              >
                {filter === 'no_image' ? 'Require Image' : 'All'}
              </button>
            ))}
          </div>
        )}
      </header>

      {loading ? (
        <div className="products-loader">
          <Loader2 className="animate-spin" size={48} color="var(--primary)" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <div key={activeTab + barcodeFilter + commonFilter} className="grid">
            {products.map((product) => (
              <ProductItem 
                key={product.id} 
                product={product} 
                activeTab={activeTab}
                uploading={uploading}
                onImagePick={handlePickImage}
                onClick={handleProductClick}
              />
            ))}
            {products.length === 0 && (
              <div className="products-empty" style={{ gridColumn: '1 / -1' }}>
                <Package size={64} className="products-empty-icon" />
                <p className="products-empty-text">No products found</p>
              </div>
            )}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
};

interface ProductItemProps {
  product: Product;
  activeTab: string;
  uploading: string | null;
  onImagePick: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  onClick: (id: string) => void;
}

const ProductItem: React.FC<ProductItemProps> = memo(({ product, activeTab, uploading, onImagePick, onClick }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="card product-card"
      onClick={() => onClick(product.id)}
    >
      <div className="product-image-container">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} loading="lazy" decoding="async" className="product-image" />
        ) : (
          <div className="product-image-placeholder">
            <Package size={40} />
          </div>
        )}

        {activeTab !== 'personal' && (
          <label 
            className="product-upload-label"
            onClick={(e) => e.stopPropagation()}
          >
            <input 
              type="file" 
              accept="image/*" 
              onChange={(e) => onImagePick(product.id, e)} 
              style={{ display: 'none' }} 
              disabled={uploading === product.id}
            />
            {uploading === product.id ? (
              <Loader2 className="animate-spin" size={16} color="white" />
            ) : (
              <Camera size={16} color="white" />
            )}
          </label>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <div style={{ flex: 1, marginRight: '8px' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1c1c1e', lineHeight: 1.2, marginBottom: '4px' }}>
              {product.name}
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
               {product.category || 'No Category'}
               {product.weight_kg && ` • ${product.weight_kg}kg`}
            </p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(product.price)}</p>
          </div>
        </div>

        {product.product_type === 'barcode' && product.barcode && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)', background: '#f1f5f9', padding: '3px 7px', borderRadius: '4px', marginBottom: '6px', alignSelf: 'flex-start' }}>
            <BarcodeIcon size={12} />
            <span style={{ fontWeight: 600 }}>{product.barcode}</span>
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: '6px', borderTop: '1px solid #f2f2f7', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <StoreIcon size={13} color="var(--primary)" />
          <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600 }}>{product.stores?.name || 'Unknown'}</span>
        </div>
      </div>
    </motion.div>
  );
});

export default memo(Products);
