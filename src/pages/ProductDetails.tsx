import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, 
  ArrowLeft, 
  Store as StoreIcon, 
  Loader2, 
  Barcode as BarcodeIcon, 
  Camera,
  ChevronRight,
  Plus,
  Trash2,
  X,
  XCircle,
  Edit2,
  CheckCircle2
} from 'lucide-react';

import './ProductDetails.css';

const PRODUCT_CATEGORIES = [
  'Clothing',
  'Electronics',
  'Food',
  'Health',
  'Home',
  'Kids',
  'Sports',
  'Vehicles',
  'Hardware',
  'Animals',
  'Art',
  'Stationery',
];

interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  image_url: string | null;
  product_type: string;
  barcode: string | null;
  weight_kg: number | null;
  is_info_complete: boolean;
  needs_changes: boolean;
  store_id: string;
  stores: {
    name: string;
    id: string;
  };
}

interface SpecItem {
  title: string;
  text: string;
}

const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  
  // Form States
  const [name, setName] = useState('');
  const [price, setPrice] = useState('0');
  const [weight, setWeight] = useState('0');
  const [category, setCategory] = useState('');
  const [descriptionPairs, setDescriptionPairs] = useState<SpecItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*, stores(id, name)')
        .eq('id', id)
        .single();

      if (error) throw error;
      setProduct(data);
      
      // Initialize form
      setName(data.name || '');
      setPrice(data.price?.toString() || '0');
      setWeight(data.weight_kg?.toString() || '0');
      setCategory(data.category || '');
      
      try {
        if (!data.description) {
          setDescriptionPairs([{ title: '', text: '' }]);
        } else {
          const parsed = JSON.parse(data.description);
          if (Array.isArray(parsed)) {
            setDescriptionPairs(parsed.length > 0 ? parsed : [{ title: '', text: '' }]);
          } else {
            setDescriptionPairs([{ title: 'Description', text: data.description }]);
          }
        }
      } catch (e) {
        setDescriptionPairs([{ title: 'Description', text: data.description || '' }]);
      }
    } catch (error: any) {
      console.error('Error fetching product:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const handlePickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !product) return;

    try {
      setUploading(true);
      const fileName = `${product.id}_${Date.now()}.jpg`;
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
        .eq('id', product.id);

      if (updateError) throw updateError;

      setProduct(prev => prev ? { ...prev, image_url: publicUrl } : null);
      alert('Product image updated');
    } catch (error: any) {
      alert(`Upload Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!product) return;
    if (!name || isNaN(parseFloat(price))) {
      alert('Name and valid Price are required.');
      return;
    }

    try {
      setSaving(true);
      const validPairs = descriptionPairs.filter(p => p.title.trim() || p.text.trim());
      const isComplete = !!name && !!product.image_url && !!price && !!category;

      const { error } = await supabase
        .from('products')
        .update({
          name,
          price: parseFloat(price),
          weight_kg: parseFloat(weight) || 0,
          category,
          description: JSON.stringify(validPairs),
          is_info_complete: isComplete,
          needs_changes: false,
          is_wrong_barcode: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      alert('Product updated successfully!');
      setIsEditing(false);
      fetchProduct();
    } catch (error: any) {
      alert(`Save failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleWrongBarcode = async () => {
    if (!product || !window.confirm('Delete this product and notify the store about wrong barcode?')) return;
    
    try {
      setSaving(true);
      // 1. Notify store
      await supabase.from('notifications').insert({
        title: 'Product Removed',
        description: `The product "${product.name}" (Barcode: ${product.barcode || 'N/A'}) was removed by admin due to invalid barcode.`,
        target_group: 'business',
      });

      // 2. Soft delete
      const { error } = await supabase
        .from('products')
        .update({ is_deleted: true })
        .eq('id', product.id);

      if (error) throw error;
      alert('Product removed and store notified.');
      navigate('/products');
    } catch (error: any) {
      alert(`Action failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const updateSpecPair = (idx: number, field: keyof SpecItem, val: string) => {
    const newPairs = [...descriptionPairs];
    newPairs[idx][field] = val;
    setDescriptionPairs(newPairs);
  };

  const addSpecPair = () => setDescriptionPairs([...descriptionPairs, { title: '', text: '' }]);
  const removeSpecPair = (idx: number) => setDescriptionPairs(descriptionPairs.filter((_, i) => i !== idx));

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'white' }}>
        <Loader2 className="animate-spin" size={48} color="var(--primary)" />
      </div>
    );
  }

  if (!product) return <div>Product not found</div>;

  return (
    <div className="detail-page-container">
      <header className="detail-header">
        <button onClick={() => navigate('/products')} className="detail-back-btn">
          <ArrowLeft size={20} /> Back
        </button>

        {product.product_type === 'barcode' && (
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className={`detail-action-btn ${isEditing ? 'danger' : 'primary'}`}
          >
            {isEditing ? <XCircle size={18} /> : <Edit2 size={16} />}
            {isEditing ? 'Close' : 'Edit'}
          </button>
        )}
      </header>

      <main className="product-details-main">
        {/* Large Image Section */}
        <div className="product-details-hero-image">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} loading="lazy" decoding="async" className="product-details-img" />
          ) : (
            <div className="product-details-img-placeholder">
              <Package size={80} />
              <p>No Image Available</p>
            </div>
          )}

          {product.product_type !== 'personal' && (
            <label className="product-details-upload-btn">
              <input type="file" accept="image/*" onChange={handlePickImage} style={{ display: 'none' }} disabled={uploading} />
              {uploading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
              {product.image_url ? 'Change Photo' : 'Add Photo'}
            </label>
          )}
        </div>

        {/* Content Section Overlay */}
        <div className="product-details-content-overlay">
          {!isEditing ? (
            <>
              {/* View Mode */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div className="product-details-title-row">
                  <h1 className="product-details-title">{product.name}</h1>
                  <span className="product-details-category-badge">{product.category || 'Uncategorized'}</span>
                </div>

                <div className="product-details-price-row">
                  <span className="product-details-price">₹{product.price}</span>
                  {product.weight_kg !== null && (
                    <span className="product-details-weight"> • {product.weight_kg} kg</span>
                  )}
                  <div className={`product-details-type-badge ${product.product_type}`}>
                    {product.product_type}
                  </div>
                </div>
              </div>

              <div className="product-details-divider" />

              <div style={{ marginBottom: '2rem' }}>
                <h3 className="product-details-section-title">Description</h3>
                <div className="product-details-spec-list">
                  {descriptionPairs.filter(p => p.title || p.text).map((pair, idx) => (
                    <div key={idx} className="product-details-spec-item">
                      <span className="product-details-spec-title">
                        {pair.title || 'Info'}
                      </span>
                      <p className="product-details-spec-value">{pair.text}</p>
                    </div>
                  ))}
                  {descriptionPairs.length === 0 && <p style={{ color: '#8E8E93' }}>N/A</p>}
                </div>
              </div>

              {/* Store Info Card (Parity Style) */}
              <div className="product-details-store-card">
                <div className="product-details-store-header">
                  <StoreIcon size={18} color="#8E8E93" />
                  <span className="product-details-store-label">Source Store</span>
                </div>
                <h4 className="product-details-store-name">{product.stores.name}</h4>
                <button 
                  onClick={() => navigate(`/stores/${product.stores.id}`)}
                  className="product-details-store-link"
                >
                  View Store Profile
                  <ChevronRight size={16} />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Edit Mode */}
              <div className="product-edit-form">
                <h2 className="product-edit-title">Edit Product Information</h2>
                
                <div className="product-edit-group">
                  <label className="product-edit-label">Product Name</label>
                  <input 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    className="product-edit-input" 
                  />
                </div>

                <div className="product-edit-group">
                  <label className="product-edit-label">Category</label>
                  <button 
                    onClick={() => setIsPickerVisible(true)}
                    className="product-edit-select-btn"
                  >
                    <span style={{ color: category ? '#1C1C1E' : '#999', fontWeight: 600 }}>{category || 'Select Category'}</span>
                    <ChevronRight size={18} color="#007bff" />
                  </button>
                </div>

                <div className="product-edit-grid">
                  <div>
                    <label className="product-edit-label">Price (₹)</label>
                    <input 
                      type="number" value={price} 
                      onChange={e => setPrice(e.target.value)} 
                      className="product-edit-input" 
                    />
                  </div>
                  <div>
                    <label className="product-edit-label">Weight (kg)</label>
                    <input 
                      type="number" value={weight} 
                      onChange={e => setWeight(e.target.value)} 
                      className="product-edit-input" 
                    />
                  </div>
                </div>

                <div className="product-edit-specs-section">
                  <div className="product-edit-specs-header">
                    <h3 className="product-details-section-title" style={{ marginBottom: 0 }}>Specifications</h3>
                    <button onClick={addSpecPair} className="product-edit-add-spec-btn">
                      <Plus size={24} />
                    </button>
                  </div>
                  <div className="product-details-spec-list">
                    {descriptionPairs.map((pair, idx) => (
                      <div key={idx} className="product-edit-spec-item">
                        <div className="product-edit-spec-title-row">
                          <div style={{ flex: 1 }}>
                            <label className="product-edit-label">Detail Title</label>
                            <input 
                              placeholder="e.g. Material" value={pair.title} 
                              onChange={e => updateSpecPair(idx, 'title', e.target.value)} 
                              className="product-edit-spec-title-input" 
                            />
                          </div>
                          <button onClick={() => removeSpecPair(idx)} className="product-edit-spec-delete-btn">
                            <Trash2 size={18} />
                          </button>
                        </div>
                        <div>
                          <label className="product-edit-label">Detail Value</label>
                          <textarea 
                            placeholder="Value..." value={pair.text} 
                            onChange={e => updateSpecPair(idx, 'text', e.target.value)} 
                            className="product-edit-spec-value-textarea" 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Actions Fixed for Mobile Parity */}
                <div className="product-edit-actions">
                  <button 
                    onClick={handleWrongBarcode}
                    disabled={saving}
                    className="product-edit-action-btn danger"
                  >
                    <BarcodeIcon size={20} />
                    Wrong Barcode
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="product-edit-action-btn primary"
                  >
                    {saving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                    Save Changes
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Category Picker Modal (Mobile Parity) */}
      <AnimatePresence>
        {isPickerVisible && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsPickerVisible(false)}
              className="modal-overlay"
            />
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="modal-content"
              style={{ position: 'fixed', bottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
            >
              <div className="modal-header">
                <h3 className="modal-title">Select Category</h3>
                <button onClick={() => setIsPickerVisible(false)} className="modal-close-btn"><X size={24} /></button>
              </div>
              <div className="modal-body">
                {PRODUCT_CATEGORIES.map(cat => (
                  <button 
                    key={cat}
                    onClick={() => { setCategory(cat); setIsPickerVisible(false); }}
                    className={`product-details-modal-list-item ${category === cat ? 'selected' : ''}`}
                  >
                    {cat}
                    {category === cat && <CheckCircle2 size={20} />}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductDetails;
