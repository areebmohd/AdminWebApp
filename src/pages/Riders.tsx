import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Bike, 
  Phone, 
  User, 
  MapPin, 
  CreditCard, 
  Search, 
  AlertCircle,
  Loader2,
  ExternalLink
} from 'lucide-react';
import './Riders.css';

interface Rider {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  upi_id: string | null;
  rider_profiles: {
    vehicle_type: string | null;
    vehicle_number: string | null;
  }[] | {
    vehicle_type: string | null;
    vehicle_number: string | null;
  } | null;
  addresses: {
    address_line: string;
    city: string;
    pincode: string;
    is_default: boolean;
  }[] | null;
}

const Riders: React.FC = () => {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchRiders = async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          phone,
          avatar_url,
          upi_id,
          rider_profiles (
            vehicle_type,
            vehicle_number
          ),
          addresses (
            address_line,
            city,
            pincode,
            is_default
          )
        `)
        .eq('role', 'rider')
        .order('full_name', { ascending: true });

      if (fetchError) throw fetchError;
      setRiders(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch riders');
      console.error('Error fetching riders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiders();
  }, []);

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const filteredRiders = riders.filter(rider => 
    rider.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rider.phone?.includes(searchTerm) ||
    rider.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading-state">
        <Loader2 className="animate-spin" size={48} color="#007bff" />
        <p>Loading riders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <AlertCircle size={48} color="#dc3545" />
        <p>{error}</p>
        <button onClick={fetchRiders} className="call-btn" style={{ width: 'auto', borderRadius: '8px', padding: '0 20px', marginTop: '10px' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="riders-container">
      <div className="riders-header">
        <h1 className="riders-title">Registered Riders</h1>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Search riders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '0.75rem 1rem 0.75rem 2.5rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              width: '300px',
              outline: 'none'
            }}
          />
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
        </div>
      </div>

      {filteredRiders.length === 0 ? (
        <div className="empty-state">
          <Bike size={64} />
          <p>No riders found matching your search.</p>
        </div>
      ) : (
        <div className="riders-grid">
          {filteredRiders.map((rider) => {
            const riderProfile = Array.isArray(rider.rider_profiles) 
              ? rider.rider_profiles[0] 
              : rider.rider_profiles;
            
            const defaultAddress = rider.addresses?.find(a => a.is_default) || rider.addresses?.[0];

            return (
              <div key={rider.id} className="rider-card">
                <div className="rider-header">
                  <div className="rider-avatar">
                    <User size={30} />
                  </div>
                  <div className="rider-info">
                    <h3>{rider.full_name || 'Unnamed Rider'}</h3>
                    <div className="rider-phone">{rider.phone || 'No phone'}</div>
                  </div>
                </div>

                <div className="rider-divider" />

                <div className="rider-details">
                  <div className="detail-item">
                    <Bike size={16} />
                    <span>{riderProfile?.vehicle_type || 'No vehicle info'}</span>
                  </div>
                  <div className="detail-item">
                    <CreditCard size={16} />
                    <span>{riderProfile?.vehicle_number || 'N/A'}</span>
                  </div>
                </div>

                {defaultAddress && (
                  <div className="rider-address">
                    <MapPin size={16} className="address-icon" />
                    <div className="address-text">
                      {defaultAddress.address_line}, {defaultAddress.city} - {defaultAddress.pincode}
                    </div>
                  </div>
                )}

                <div className="rider-footer">
                  <div className="upi-badge" title={rider.upi_id || 'Not provided'}>
                    <CreditCard size={14} />
                    <span>{rider.upi_id || 'No UPI ID'}</span>
                  </div>
                  <button 
                    onClick={() => rider.phone && handleCall(rider.phone)}
                    className="call-btn"
                    title="Call Rider"
                  >
                    <Phone size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Riders;
