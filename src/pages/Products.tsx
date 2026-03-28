import React, { useEffect, useState } from 'react';
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

import './Products.css';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  image_url: string | null;
  product_type: string;
  barcode: string | null;
  weight_kg: number | null;
  is_info_complete: boolean;
  needs_changes: boolean;
  stores: {
    name: string;
  };
}

const Products: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'barcode' | 'common' | 'personal'>('barcode');
  const [barcodeFilter, setBarcodeFilter] = useState<'all' | 'uncomplete' | 'needs_changes'>('all');
  const [commonFilter, setCommonFilter] = useState<'all' | 'no_image'>('all');
  const [uploading, setUploading] = useState<string | null>(null);

  const fetchProducts = async () => {
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
      setProducts(data || []);
    } catch (error: any) {
      console.error('Error fetching products:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [activeTab, barcodeFilter, commonFilter]);

  const handlePickImage = async (productId: string, e: React.ChangeEvent<HTMLInputElement>) => {
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
    } catch (error: any) {
      alert(`Upload Error: ${error.message}`);
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="products-page-container">
      <header className="products-header">
        <div className="products-header-top">
          <div>
            <h1 className="products-title">Products</h1>
            <p className="products-subtitle">Manage catalog across all store types</p>
          </div>
        </div>

        {/* Parity Tab Bar */}
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

        {/* Conditional Sub-Tabs */}
        {activeTab === 'barcode' && (
          <div className="sub-tab-bar">
            {(['all', 'uncomplete', 'needs_changes'] as const).map((filter) => (
              <button 
                key={filter}
                className={`sub-tab-btn ${barcodeFilter === filter ? 'active' : ''}`}
                onClick={() => setBarcodeFilter(filter)}
              >
                {filter === 'uncomplete' ? 'Uncomplete Info' : 
                 filter === 'needs_changes' ? 'Need Changes' : 'All'}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'common' && (
          <div className="sub-tab-bar">
            {(['all', 'no_image'] as const).map((filter) => (
              <button 
                key={filter}
                className={`sub-tab-btn ${commonFilter === filter ? 'active' : ''}`}
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
        <div className="grid">
          <AnimatePresence>
            {products.map((product) => (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={product.id} 
                className="card product-card product-card-wrapper"
                onClick={() => navigate(`/products/${product.id}`)}
              >
                <div className="product-image-container">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="product-image" />
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
                        onChange={(e) => handlePickImage(product.id, e)} 
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

                <div className="product-info-container">
                  <div className="product-info-header">
                    <div className="product-title-section">
                      <h3 className="product-title">
                        {product.name}
                      </h3>
                      <p className="product-category">{product.category || 'No Category'}</p>
                    </div>
                    <div className="product-price-section">
                      <p className="product-price">₹{product.price}</p>
                      {product.weight_kg !== null && (
                        <p className="product-weight">{product.weight_kg}kg</p>
                      )}
                    </div>
                  </div>

                  {product.barcode && (
                    <div className="product-barcode-badge">
                      <BarcodeIcon size={12} color="#666" />
                      <span className="product-barcode-text">{product.barcode}</span>
                    </div>
                  )}

                  <div className="product-store-row">
                    <StoreIcon size={14} color="var(--primary)" />
                    <span className="product-store-text">{product.stores?.name || 'Unknown'}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {products.length === 0 && (
            <div className="products-empty">
              <Package size={64} className="products-empty-icon" />
              <p className="products-empty-text">No products found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Products;
