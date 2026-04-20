import React, { useEffect, useState, useCallback, memo } from 'react';
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
import { PRODUCT_CATEGORIES } from '../constants/productCategories';
import './Images.css';

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

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      if (activeTab === 'banners') {
        const { data, error } = await supabase
          .from('home_banners')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setBanners((data as Banner[]) || []);
      } else {
        const { data, error } = await supabase.from('category_images').select('*');
        if (error) throw error;
        const mapping: Record<string, string> = {};
        (data as { category_name: string; image_url: string }[])?.forEach((item) => {
          mapping[item.category_name] = item.image_url;
        });
        setCategoryImages(mapping);
      }
    } catch (error: unknown) {
      console.error('Fetch error:', (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePickImage = useCallback(async (id: string, type: 'banner' | 'category', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(id);
      
      let oldUrl = '';
      if (type === 'banner') {
        if (id !== 'new') {
          setBanners(prev => {
            const banner = prev.find(b => b.id === id);
            if (banner) oldUrl = banner.image_url;
            return prev;
          });
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
    } catch (error: unknown) {
      alert(`Upload Error: ${(error as Error).message}`);
    } finally {
      setUploading(null);
    }
  }, [categoryImages, fetchData]);

  const handleDeleteBanner = useCallback(async (id: string, imageUrl: string) => {
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
    } catch (error: unknown) {
      alert(`Error: ${(error as Error).message}`);
    }
  }, []);

  return (
    <div className="page-container">
      <header className="page-header">
        <div className="page-header-top">
          <div>
            <h1 className="page-title">Images</h1>
            <p className="page-subtitle">Manage promotional banners and category icons</p>
          </div>
        </div>

        <div className="tab-bar">
          <button 
            onClick={() => setActiveTab('banners')}
            className={`tab-btn ${activeTab === 'banners' ? 'active' : ''}`}
          >
            Banners
          </button>
          <button 
            onClick={() => setActiveTab('categories')}
            className={`tab-btn ${activeTab === 'categories' ? 'active' : ''}`}
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
             <label className="images-banner-add-btn">
                <input type="file" accept="image/*" onChange={(e) => handlePickImage('new', 'banner', e)} style={{ display: 'none' }} />
                <PlusCircle size={24} /> Add New Banner
             </label>
             
             <div className="images-banner-list-inner">
                {banners.map(banner => (
                  <BannerCard 
                    key={banner.id} 
                    banner={banner} 
                    onUpload={handlePickImage} 
                    onDelete={handleDeleteBanner}
                    isUploading={uploading === banner.id}
                  />
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
              <CategoryCard 
                key={cat} 
                category={cat} 
                imageUrl={categoryImages[cat]} 
                onUpload={handlePickImage}
                isUploading={uploading === cat}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

interface BannerCardProps {
  banner: Banner;
  onUpload: (id: string, type: 'banner' | 'category', e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: (id: string, imageUrl: string) => void;
  isUploading: boolean;
}

const BannerCard: React.FC<BannerCardProps> = memo(({ banner, onUpload, onDelete, isUploading }) => (
  <motion.div layout className="images-banner-card">
     <div className="images-banner-img-container">
        <img src={banner.image_url} alt="Banner" loading="lazy" decoding="async" className="images-banner-img" />
     </div>
     <div className="images-banner-actions">
        <label className="images-banner-action-btn">
          <input type="file" accept="image/*" onChange={(e) => onUpload(banner.id, 'banner', e)} style={{ display: 'none' }} />
          {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Pencil size={20} />}
        </label>
        <button 
          onClick={() => onDelete(banner.id, banner.image_url)}
          className="images-banner-delete-btn"
        >
          <Trash2 size={20} />
        </button>
     </div>
  </motion.div>
));

interface CategoryCardProps {
  category: string;
  imageUrl?: string;
  onUpload: (id: string, type: 'banner' | 'category', e: React.ChangeEvent<HTMLInputElement>) => void;
  isUploading: boolean;
}

const CategoryCard: React.FC<CategoryCardProps> = memo(({ category, imageUrl, onUpload, isUploading }) => (
  <div className="card images-category-card">
     <div className="images-category-img-container">
        {imageUrl ? (
          <img src={imageUrl} alt={category} loading="lazy" decoding="async" className="images-category-img" />
        ) : (
          <div className="images-category-placeholder">
            <ImageIcon size={32} color="#ccc" />
          </div>
        )}
        <label className="images-category-upload-btn">
          <input type="file" accept="image/*" onChange={(e) => onUpload(category, 'category', e)} style={{ display: 'none' }} />
          {isUploading ? <Loader2 className="animate-spin" size={16} /> : <Camera size={16} />}
        </label>
     </div>
     <div className="images-category-title-container">
        <h4 className="images-category-title">{category}</h4>
     </div>
  </div>
));

export default memo(Images);
