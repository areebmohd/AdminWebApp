import React, { useEffect, useState, useCallback, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, 
  ArrowLeft, 
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
import { PRODUCT_CATEGORIES } from '../constants/productCategories';
import type { Product, SpecItem } from '../types';
import './ProductDetails.css';

const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [globalStoreCount, setGlobalStoreCount] = useState(1);
  
  // Form States
  const [name, setName] = useState('');
  const [price, setPrice] = useState('0');
  const [weight, setWeight] = useState('0');
  const [category, setCategory] = useState('');
  const [deliveryVehicle, setDeliveryVehicle] = useState<'bike' | 'truck'>('bike');
  const [descriptionPairs, setDescriptionPairs] = useState<SpecItem[]>([]);
  const [productOptions, setProductOptions] = useState<{ title: string; values: string[] }[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [uploading, setUploading] = useState(false);

  const fetchProduct = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*, stores(id, name)')
        .eq('id', id!)
        .single();

      if (error) throw error;
      const productData = data as Product;
      setProduct(productData);
      
      // Fetch global store count
      const { count: gCount, error: gError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq(productData.barcode ? 'barcode' : 'name', productData.barcode || productData.name)
        .neq('is_deleted', true);
      
      if (!gError) setGlobalStoreCount(gCount || 1);
      
      // Initialize form
      setName(productData.name || '');
      setPrice(productData.price?.toString() || '0');
      setWeight(productData.weight_kg?.toString() || '0');
      setCategory(productData.category || '');
      setDeliveryVehicle(productData.delivery_vehicle || 'bike');
      
      try {
        if (!productData.description) {
          setDescriptionPairs([{ title: '', text: '' }]);
        } else {
          const parsed = JSON.parse(productData.description);
          if (Array.isArray(parsed)) {
            setDescriptionPairs(parsed.length > 0 ? parsed : [{ title: '', text: '' }]);
          } else {
            setDescriptionPairs([{ title: 'Description', text: productData.description }]);
          }
        }
      } catch {
        setDescriptionPairs([{ title: 'Description', text: productData.description || '' }]);
      }
      
      setProductOptions(productData.options || []);
      setTags(productData.tags || []);
    } catch (error: unknown) {
      console.error('Error fetching product:', (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchProduct();
  }, [id, fetchProduct]);

  const handlePickImage = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    } catch (error: unknown) {
      alert(`Upload Error: ${(error as Error).message}`);
    } finally {
      setUploading(false);
    }
  }, [product]);

  const handleSave = useCallback(async () => {
    if (!product) return;
    if (!name || isNaN(parseFloat(price))) {
      alert('Name and valid Price are required.');
      return;
    }

    try {
      setSaving(true);
      const validPairs = descriptionPairs.filter(p => p.title.trim() || p.text.trim());
      const isComplete = !!name && !!product.image_url && !!price && !!category;

      const updateData = {
        name,
        price: parseFloat(price),
        weight_kg: parseFloat(weight) || 0,
        category,
        description: JSON.stringify(validPairs),
        options: productOptions,
        tags: tags,
        image_url: product.image_url, // Ensure image is synced across all stores
        is_info_complete: isComplete,
        delivery_vehicle: deliveryVehicle,
        needs_changes: false,
        is_wrong_barcode: false,
        raw_image_url: null, // Clear raw image for all stores once info is official
        updated_at: new Date().toISOString(),
      };

      let query = supabase.from('products').update(updateData);

      if (product.product_type === 'barcode' && product.barcode) {
        query = query.eq('barcode', product.barcode);
      } else {
        query = query.eq('id', id!);
      }

      const { error } = await query;

      if (error) throw error;

      // Cleanup raw image from storage if it exists
      if (product.raw_image_url) {
        try {
          const path = product.raw_image_url.split('products/')[1];
          if (path) {
            await supabase.storage.from('products').remove([path]);
          }
        } catch (cleanupError) {
          console.error('Failed to cleanup raw image:', cleanupError);
        }
      }
      alert('Product updated successfully!');
      setIsEditing(false);
      fetchProduct();
    } catch (error: unknown) {
      alert(`Save failed: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  }, [product, name, price, weight, category, descriptionPairs, productOptions, tags, deliveryVehicle, id, fetchProduct]);

  const handleWrongBarcode = useCallback(async () => {
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
        .update({ is_deleted: true, raw_image_url: null })
        .eq('id', product.id);

      if (error) throw error;

      // Cleanup raw image from storage if it exists
      if (product.raw_image_url) {
        try {
          const path = product.raw_image_url.split('products/')[1];
          if (path) {
            await supabase.storage.from('products').remove([path]);
          }
        } catch (cleanupError) {
          console.error('Failed to cleanup raw image:', cleanupError);
        }
      }
      alert('Product removed and store notified.');
      navigate('/products');
    } catch (error: unknown) {
      alert(`Action failed: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  }, [product, navigate]);

  const updateSpecPair = useCallback((idx: number, field: keyof SpecItem, val: string) => {
    setDescriptionPairs(prev => {
      const newPairs = [...prev];
      newPairs[idx] = { ...newPairs[idx], [field]: val };
      return newPairs;
    });
  }, []);

  const addSpecPair = useCallback(() => setDescriptionPairs(prev => [...prev, { title: '', text: '' }]), []);
  const removeSpecPair = useCallback((idx: number) => setDescriptionPairs(prev => prev.filter((_, i) => i !== idx)), []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'white' }}>
        <Loader2 className="animate-spin" size={48} color="var(--primary)" />
      </div>
    );
  }

  if (!product) return <div style={{ padding: '2rem', textAlign: 'center' }}>Product not found</div>;

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

          {product.raw_image_url && (
            <div className="raw-image-badge" onClick={() => window.open(product.raw_image_url!, '_blank')}>
              <Camera size={14} />
              <span>Raw Image Available</span>
            </div>
          )}
        </div>

        {/* Content Section */}
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
                <h3 className="product-details-section-title">Description & Specs</h3>
                <div className="product-details-spec-list">
                  {descriptionPairs.filter(p => p.title || p.text).map((pair, idx) => (
                    <div key={idx} className="product-details-spec-item">
                      <span className="product-details-spec-title">
                        {pair.title || 'Info'}
                      </span>
                      <p className="product-details-spec-value">{pair.text}</p>
                    </div>
                  ))}
                  {descriptionPairs.filter(p => p.title || p.text).length === 0 && (
                    <div className="product-details-spec-item">
                      <div className="product-details-spec-value" style={{ color: '#8E8E93' }}>No specifications provided</div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <h3 className="product-details-section-title">Search Tags</h3>
                <div className="product-details-spec-list">
                  <div className="product-details-spec-item">
                    <span className="product-details-spec-title">Synonyms</span>
                    <div className="product-details-spec-value">
                      <div className="product-details-option-values">
                        {tags && tags.length > 0 ? tags.map((tag, idx) => (
                          <span key={idx} className="option-value-chip">{tag}</span>
                        )) : <span style={{ color: '#8E8E93' }}>No tags defined</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <h3 className="product-details-section-title">Product Options (Variants)</h3>
                <div className="product-details-spec-list">
                  {productOptions && productOptions.length > 0 ? productOptions.map((opt, idx) => (
                    <div key={idx} className="product-details-spec-item">
                      <span className="product-details-spec-title">{opt.title}</span>
                      <div className="product-details-spec-value">
                        <div className="product-details-option-values">
                          {opt.values.map((v, vIdx) => (
                            <span key={vIdx} className="option-value-chip">{v}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )) : <div className="product-details-spec-item"><div className="product-details-spec-value" style={{ color: '#8E8E93' }}>No variants defined</div></div>}
                </div>
              </div>

              <div className="product-details-divider" />

              <div style={{ marginBottom: '2rem' }}>
                <h3 className="product-details-section-title">Store</h3>
                {globalStoreCount > 1 ? (
                  <p className="product-details-spec-value" style={{ paddingLeft: 0, marginTop: '0.5rem' }}>
                    Available in {globalStoreCount} Stores
                  </p>
                ) : (
                  product.stores && (
                    <button 
                      onClick={() => navigate(`/stores/${product.stores!.id}`)}
                      className="product-details-store-link-inline"
                    >
                      {product.stores!.name}
                      <ChevronRight size={16} />
                    </button>
                  )
                )}
              </div>

              {product.raw_image_url && (
                <div className="raw-image-section">
                  <h3 className="product-details-section-title">Raw Image (Submitted by Store)</h3>
                  <div className="raw-image-preview-container">
                    <img src={product.raw_image_url} alt="Raw product" className="raw-image-preview" />
                    <button 
                      className="raw-image-full-btn"
                      onClick={() => window.open(product.raw_image_url!, '_blank')}
                    >
                      View Full Size
                    </button>
                  </div>
                </div>
              )}
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
                        type="text"
                        inputMode="decimal"
                        value={price} 
                        onChange={e => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          if (val.split('.').length <= 2) setPrice(val);
                        }} 
                        className="product-edit-input" 
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="product-edit-label">Weight (kg)</label>
                      <input 
                        type="text"
                        inputMode="decimal"
                        value={weight} 
                        onChange={e => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          if (val.split('.').length <= 2) setWeight(val);
                        }} 
                        className="product-edit-input" 
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {product.product_type === 'barcode' && (
                    <div className="product-edit-group">
                      <label className="product-edit-label">Delivery Vehicle</label>
                      <div className="vehicle-selector">
                        <button 
                          className={`vehicle-btn ${deliveryVehicle === 'bike' ? 'active' : ''}`}
                          onClick={() => setDeliveryVehicle('bike')}
                        >
                          Bike
                        </button>
                        <button 
                          className={`vehicle-btn ${deliveryVehicle === 'truck' ? 'active' : ''}`}
                          onClick={() => setDeliveryVehicle('truck')}
                        >
                          Truck
                        </button>
                      </div>
                    </div>
                  )}

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
                          <input 
                            placeholder="e.g. Material" value={pair.title} 
                            onChange={e => updateSpecPair(idx, 'title', e.target.value)} 
                            className="product-edit-spec-title-input" 
                          />
                          <button onClick={() => removeSpecPair(idx)} className="product-edit-spec-delete-btn">
                            <Trash2 size={18} />
                          </button>
                        </div>
                        <div>
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

                <div className="product-edit-specs-section">
                  <div className="product-edit-specs-header">
                    <h3 className="product-details-section-title" style={{ marginBottom: 0 }}>Tags (Synonyms)</h3>
                  </div>
                  <div className="product-edit-group" style={{ marginTop: '1rem' }}>
                    <div className="tag-input-wrapper" style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        placeholder="Add a tag..." 
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (tagInput.trim()) {
                              setTags(prev => [...new Set([...(prev || []), tagInput.trim().toLowerCase()])]);
                              setTagInput('');
                            }
                          }
                        }}
                        className="product-edit-input" 
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          if (tagInput.trim()) {
                            setTags(prev => [...new Set([...(prev || []), tagInput.trim().toLowerCase()])]);
                            setTagInput('');
                          }
                        }}
                        className="detail-action-btn primary"
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        Add Tag
                      </button>
                    </div>
                    <div className="product-details-option-values" style={{ marginTop: '1rem' }}>
                      {tags && tags.map((tag, idx) => (
                        <span key={idx} className="option-value-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {tag}
                          <X 
                            size={14} 
                            style={{ cursor: 'pointer' }} 
                            onClick={() => setTags(prev => (prev || []).filter((_, i) => i !== idx))} 
                          />
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="product-edit-specs-section">
                  <div className="product-edit-specs-header">
                    <h3 className="product-details-section-title" style={{ marginBottom: 0 }}>Options & Variants</h3>
                    <button 
                      onClick={() => setProductOptions([...(productOptions || []), { title: '', values: [] }])} 
                      className="product-edit-add-spec-btn"
                    >
                      <Plus size={24} />
                    </button>
                  </div>
                  <div className="product-details-spec-list">
                    {productOptions && productOptions.map((opt, idx) => (
                      <div key={idx} className="product-edit-spec-item">
                        <div className="product-edit-spec-title-row">
                          <input 
                            placeholder="e.g. Size" 
                            value={opt.title} 
                            onChange={e => {
                               const newOptions = [...productOptions];
                               newOptions[idx].title = e.target.value;
                               setProductOptions(newOptions);
                            }} 
                            className="product-edit-spec-title-input" 
                          />
                          <button 
                            onClick={() => setProductOptions(productOptions.filter((_, i) => i !== idx))} 
                            className="product-edit-spec-delete-btn"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                        <div style={{ flex: 1, padding: '12px' }}>
                          <input 
                            placeholder="S, M, L, XL (Comma separated)" 
                            value={(opt.values || []).join(', ')} 
                            onChange={e => {
                               const newOptions = [...productOptions];
                               newOptions[idx].values = e.target.value.split(',').map(v => v.trim()).filter(v => v !== '');
                               setProductOptions(newOptions);
                            }} 
                            className="product-edit-input" 
                            style={{ background: 'white' }}
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

export default memo(ProductDetails);
