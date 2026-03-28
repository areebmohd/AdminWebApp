import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { motion } from 'framer-motion';
import { 
  Image as ImageIcon, 
  Loader2, 
  Trash2, 
  PlusCircle, 
  Camera, 
  Pencil
} from 'lucide-react';

import './Images.css';

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

interface Banner {
  id: string;
  image_url: string;
  created_at: string;
}

const Images: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'banners' | 'categories'>('banners');
  const [banners, setBanners] = useState<Banner[]>([]);
  const [categoryImages, setCategoryImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'banners') {
        const { data, error } = await supabase
          .from('home_banners')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setBanners(data || []);
      } else {
        const { data, error } = await supabase.from('category_images').select('*');
        if (error) throw error;
        const mapping: Record<string, string> = {};
        data?.forEach((item: any) => {
          mapping[item.category_name] = item.image_url;
        });
        setCategoryImages(mapping);
      }
    } catch (error: any) {
      console.error('Fetch error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handlePickImage = async (id: string, type: 'banner' | 'category', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(id);
      
      // Delete old image if it exists (Parity Logic)
      let oldUrl = '';
      if (type === 'banner') {
        if (id !== 'new') {
          const banner = banners.find(b => b.id === id);
          if (banner) oldUrl = banner.image_url;
        }
      } else {
        oldUrl = categoryImages[id] || '';
      }

      if (oldUrl) {
        try {
          const fileName = oldUrl.split('/').pop()?.split('?')[0];
          if (fileName) {
            await supabase.storage.from('banners').remove([`home/${fileName}`]);
          }
        } catch (e) {
          console.error('Error deleting old image:', e);
        }
      }

      const fileName = `${type}_${id.replace(/\s+/g, '_')}_${Date.now()}.jpg`;
      const filePath = `home/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('banners')
        .upload(filePath, file, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('banners').getPublicUrl(filePath);

      if (type === 'banner') {
        if (id === 'new') {
          await supabase.from('home_banners').insert({ image_url: publicUrl });
        } else {
          await supabase.from('home_banners').update({ image_url: publicUrl, updated_at: new Date() }).eq('id', id);
        }
      } else {
        await supabase.from('category_images').upsert({ category_name: id, image_url: publicUrl, updated_at: new Date() }, { onConflict: 'category_name' });
      }

      alert(`${type.charAt(0).toUpperCase() + type.slice(1)} image updated`);
      fetchData();
    } catch (error: any) {
      alert(`Upload Error: ${error.message}`);
    } finally {
      setUploading(null);
    }
  };

  const handleDeleteBanner = async (id: string, imageUrl: string) => {
    if (!window.confirm('Are you sure you want to delete this banner?')) return;
    try {
      const { error } = await supabase.from('home_banners').delete().eq('id', id);
      if (error) throw error;
      
      const fileName = imageUrl.split('/').pop()?.split('?')[0];
      if (fileName) {
        await supabase.storage.from('banners').remove([`home/${fileName}`]);
      }
      
      setBanners(prev => prev.filter(b => b.id !== id));
      alert('Banner deleted');
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="page-header-top">
          <div>
            <h1 className="page-title">Images</h1>
            <p className="page-subtitle">Manage promotional banners and category icons</p>
          </div>
        </div>

        <div className="pill-tab-group">
          <button 
            onClick={() => setActiveTab('banners')}
            className={`pill-tab ${activeTab === 'banners' ? 'active' : ''}`}
          >
            Banners
          </button>
          <button 
            onClick={() => setActiveTab('categories')}
            className={`pill-tab ${activeTab === 'categories' ? 'active' : ''}`}
          >
            Categories
          </button>
        </div>
      </header>

      <main className="images-main-content">
        {loading ? (
          <div className="images-loader">
            <Loader2 className="animate-spin" size={48} color="#007bff" />
          </div>
        ) : activeTab === 'banners' ? (
          <div className="images-banners-list">
             {/* Add New Banner (Dashed Placeholder) */}
             <label className="images-banner-add-btn">
                <input type="file" accept="image/*" onChange={(e) => handlePickImage('new', 'banner', e)} style={{ display: 'none' }} />
                <PlusCircle size={24} /> Add New Banner
             </label>
             
             <div className="images-banner-list-inner">
                {banners.map(banner => (
                  <motion.div 
                    layout key={banner.id} 
                    className="images-banner-card"
                  >
                     <div className="images-banner-img-container">
                        <img src={banner.image_url} alt="Banner" loading="lazy" decoding="async" className="images-banner-img" />
                     </div>
                     <div className="images-banner-actions">
                        <label className="images-banner-action-btn">
                          <input type="file" accept="image/*" onChange={(e) => handlePickImage(banner.id, 'banner', e)} style={{ display: 'none' }} />
                          {uploading === banner.id ? <Loader2 className="animate-spin" size={20} /> : <Pencil size={20} />}
                        </label>
                        <button 
                          onClick={() => handleDeleteBanner(banner.id, banner.image_url)}
                          className="images-banner-delete-btn"
                        >
                          <Trash2 size={20} />
                        </button>
                     </div>
                  </motion.div>
                ))}
                {banners.length === 0 && (
                  <div className="images-empty-state">
                    <ImageIcon size={64} className="images-empty-icon" color="#ccc" />
                    <p>No banners added yet</p>
                  </div>
                )}
             </div>
          </div>
        ) : (
          <div className="images-category-grid">
            {PRODUCT_CATEGORIES.map(cat => (
              <div 
                key={cat} 
                className="card images-category-card" 
              >
                 <div className="images-category-img-container">
                    {categoryImages[cat] ? (
                      <img src={categoryImages[cat]} alt={cat} loading="lazy" decoding="async" className="images-category-img" />
                    ) : (
                      <div className="images-category-placeholder">
                        <ImageIcon size={32} color="#ccc" />
                      </div>
                    )}
                    <label className="images-category-upload-btn">
                      <input type="file" accept="image/*" onChange={(e) => handlePickImage(cat, 'category', e)} style={{ display: 'none' }} />
                      {uploading === cat ? <Loader2 className="animate-spin" size={16} /> : <Camera size={16} />}
                    </label>
                 </div>
                 <div className="images-category-title-container">
                    <h4 className="images-category-title">{cat}</h4>
                 </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Images;
