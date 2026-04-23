import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Truck, 
  Store, 
  MapPin, 
  Phone, 
  Clock, 
  AlertCircle,
  X,
  Bike,
  Loader2
} from 'lucide-react';
import { 
  getItemTotals, 
  getRiderDeliveryFee, 
  getSponsoredDeliveryFee, 
  getDisplayPlatformFee 
} from '../utils/orderUtils';
import './Deliveries.css';
import './Orders.css'; // Reuse breakdown modal styles

interface Order {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  total_amount: number;
  delivery_fee: number;
  rider_delivery_fee?: number;
  platform_fee: number;
  helper_fee: number;
  transport_type?: string;
  applied_offers: any;
  store_delivery_fees?: Record<string, number>;
  payment_method: string;
  store_id: string;
  rider_id: string | null;
  delivery_address_id: string;
  stores: {
    id: string;
    name: string;
    address: string;
    phone?: string;
  };
  addresses: {
    receiver_name: string;
    address_line: string;
    city: string;
    receiver_phone: string;
  };
  rider?: {
    full_name: string;
    phone: string;
  };
  customer?: {
    full_name: string;
    phone: string;
  };
  order_items: any[];
}

interface OrderSection {
  title: string;
  data: Order[];
}

const getStatusLabel = (status: string) => {
  if (!status) return 'Unknown';
  switch (status.toLowerCase()) {
    case 'waiting_for_pickup': return 'Waiting for Pickup';
    case 'picked_up': return 'Picked Up';
    case 'delivered': return 'Delivered';
    case 'cancelled': return 'Cancelled';
    default: return status.replace(/_/g, ' ');
  }
};

const getStatusColor = (status: string) => {
  if (!status) return '#7f8c8d';
  switch (status.toLowerCase()) {
    case 'waiting_for_pickup': return '#f39c12';
    case 'picked_up': return '#3498db';
    case 'delivered': return '#27ae60';
    case 'cancelled': return '#e74c3c';
    default: return '#7f8c8d';
  }
};

const Deliveries: React.FC = () => {
  const [sections, setSections] = useState<OrderSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const groupOrdersByDate = useCallback((orders: Order[]) => {
    if (!orders || orders.length === 0) return [];

    const groups: { [key: string]: Order[] } = {};

    orders.forEach((order) => {
      const date = new Date(order.created_at);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      let dateString = '';
      if (date.toDateString() === today.toDateString()) {
        dateString = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateString = 'Yesterday';
      } else {
        dateString = date.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      }

      if (!groups[dateString]) groups[dateString] = [];
      groups[dateString].push(order);
    });

    return Object.keys(groups).map((date) => ({
      title: date,
      data: groups[date],
    }));
  }, []);

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          stores:store_id (*),
          addresses:delivery_address_id (*),
          rider:rider_id (full_name, phone),
          customer:customer_id (full_name, phone),
          order_items (*, products(id, store_id, stores(*)))
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSections(groupOrdersByDate(data || []));
    } catch (err) {
      console.error('Error fetching deliveries:', err);
    } finally {
      setLoading(false);
    }
  }, [groupOrdersByDate]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  const renderBreakdownModal = () => {
    if (!selectedOrder) return null;

    const storeShares: { [key: string]: number } = {};
    const deliverySponsored: { [key: string]: number } = {};

    selectedOrder.order_items.forEach((oi: any) => {
      const sId = oi.products?.store_id || selectedOrder.store_id || 'unknown';
      const sName = oi.products?.stores?.name || selectedOrder.stores?.name || 'Store';
      
      const storeOffer = selectedOrder.applied_offers?.[sId];
      const allStoreItems = selectedOrder.order_items.filter((i: any) => (i.products?.store_id || selectedOrder.store_id) === sId);
      
      const { discounted } = getItemTotals(oi, allStoreItems, storeOffer);

      if (!storeShares[sName]) storeShares[sName] = 0;
      storeShares[sName] += discounted;

      if (deliverySponsored[sName] === undefined) {
        const deliveryFeePaidByStore = Number(selectedOrder.store_delivery_fees?.[sId] || 0);
        deliverySponsored[sName] = deliveryFeePaidByStore;
        storeShares[sName] -= deliveryFeePaidByStore;
      }
    });

    const riderFee = getRiderDeliveryFee(selectedOrder);
    const platformFee = getDisplayPlatformFee(selectedOrder);
    const helperFee = Number(selectedOrder.helper_fee || 0);

    return (
      <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
        <div className="modal-content breakdown-modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="modal-title"><Truck size={20} /> Delivery Breakdown</h3>
            <button className="modal-close-btn" onClick={() => setSelectedOrder(null)}>
              <X size={24} />
            </button>
          </div>
          <div className="modal-body">
            <div className="breakdown-section">
              <h4 className="breakdown-section-title">Store Shares</h4>
              {Object.entries(storeShares).map(([name, amount], idx) => (
                <div key={idx} className="breakdown-row">
                  <span className="breakdown-label">{name}</span>
                  <span className="breakdown-value">₹{amount.toFixed(2)}</span>
                </div>
              ))}
              {Object.entries(deliverySponsored).filter(([_, amt]) => amt > 0).map(([name, amount], idx) => (
                <div key={`del-${idx}`} className="breakdown-row">
                  <span className="breakdown-label">{name} Sponsored Delivery</span>
                  <span className="breakdown-value negative">-₹{amount.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="breakdown-section">
              <h4 className="breakdown-section-title">Fees & Services</h4>
              <div className="breakdown-row">
                <span className="breakdown-label">Delivery Fee</span>
                <span className="breakdown-value">₹{riderFee.toFixed(2)}</span>
              </div>
              {platformFee > 0 && (
                <div className="breakdown-row">
                  <span className="breakdown-label">Platform Fee</span>
                  <span className="breakdown-value">₹{platformFee.toFixed(2)}</span>
                </div>
              )}
              {helperFee > 0 && (
                <div className="breakdown-row">
                  <span className="breakdown-label">Helper Fee</span>
                  <span className="breakdown-value">₹{helperFee.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="grand-total-row">
              <span className="grand-total-label">Grand Total</span>
              <span className="grand-total-value">₹{Number(selectedOrder.total_amount).toFixed(2)}</span>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={() => setSelectedOrder(null)}>Done</button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Loader2 className="animate-spin" size={48} color="#007bff" />
      </div>
    );
  }

  return (
    <div className="deliveries-container">
      <header className="deliveries-header">
        <h1 className="page-title">Deliveries</h1>
        <p className="page-subtitle">Monitor and track live delivery statuses</p>
      </header>

      {sections.map((section) => (
        <section key={section.title} className="section-group">
          <h2 className="section-title">{section.title}</h2>
          <div className="deliveries-list">
            {section.data.map((order) => {
              const rider = order.rider;
              const address = Array.isArray(order.addresses) ? order.addresses[0] : order.addresses;
              const customerName = order.customer?.full_name || address?.receiver_name || 'Customer';
              const stores = order.order_items.reduce((acc: any, oi) => {
                const s = oi.products?.stores || order.stores;
                const sId = s?.id || order.store_id || 'unknown';
                if (!acc[sId]) {
                  acc[sId] = {
                    name: s?.name || 'Unknown Store',
                    address: s?.address || 'Address not available',
                    phone: s?.phone,
                    items: []
                  };
                }
                acc[sId].items.push(oi);
                return acc;
              }, {});

              return (
                <div key={order.id} className="delivery-card">
                  <div className="delivery-card-header">
                    <div className="delivery-info">
                      <h3>#{order.order_number}</h3>
                      <div className="delivery-meta">
                        <Clock size={14} />
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {order.transport_type && ` • ${order.transport_type === 'heavy' ? 'Truck' : 'Bike'}`}
                      </div>
                    </div>
                    <div 
                      className="status-badge" 
                      style={{ backgroundColor: getStatusColor(order.status) }}
                    >
                      {getStatusLabel(order.status)}
                    </div>
                  </div>

                    {Object.entries(stores).map(([sId, sData]: [string, any], sIdx) => (
                      <div key={sId} className="journey-step">
                        <div className="step-icon pickup"><Store size={18} /></div>
                        <div className="step-content">
                          <div className="step-label">Pickup From {sData.name}</div>
                          <div className="step-address">{sData.address}</div>
                          {sData.phone && (
                            <a href={`tel:${sData.phone}`} className="step-phone">
                              <Phone size={14} /> {sData.phone}
                            </a>
                          )}
                          
                          <div className="mini-product-list">
                            {sData.items.map((product: any) => {
                              const storeOffer = order.applied_offers?.[sId];
                              const { original, discounted } = getItemTotals(product, sData.items, storeOffer);
                              return (
                                <div key={product.id} className="mini-product-row">
                                  <span className="mini-product-name">{product.product_name} x{product.quantity}</span>
                                  <div className="mini-product-price">
                                    {discounted < original ? (
                                      <>
                                        <span className="price-discounted">₹{discounted.toFixed(2)}</span>
                                        <span className="price-original" style={{ textDecoration: 'line-through', color: '#999', fontSize: '0.75rem', marginLeft: '0.5rem' }}>₹{original.toFixed(2)}</span>
                                      </>
                                    ) : (
                                      <span className="price-discounted">₹{original.toFixed(2)}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="journey-step deliver-to">
                      <div className="step-icon delivery"><MapPin size={18} /></div>
                      <div className="step-content">
                        <div className="step-label">Deliver To</div>
                        <div className="step-title">{customerName}</div>
                        <div className="step-address">
                          {address?.address_line || 'No address'}, {address?.city || ''}
                        </div>
                        {(address?.receiver_phone || order.customer?.phone) && (
                          <a href={`tel:${address?.receiver_phone || order.customer?.phone}`} className="step-phone">
                            <Phone size={14} /> {address?.receiver_phone || order.customer?.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  <div className="rider-box">
                    {rider ? (
                      <>
                        <div className="rider-avatar"><Bike size={20} /></div>
                        <div className="rider-info">
                          <div className="rider-status">Assigned Rider</div>
                          <div className="rider-name">{rider.full_name}</div>
                        </div>
                        <a href={`tel:${rider.phone}`} className="rider-phone">
                          <Phone size={16} /> {rider.phone}
                        </a>
                      </>
                    ) : (
                      <div className="unassigned-rider">
                        <AlertCircle size={20} />
                        Waiting for rider assignment
                      </div>
                    )}
                  </div>

                  <div className="delivery-footer">
                    <button 
                      className="view-shares-btn"
                      onClick={() => setSelectedOrder(order)}
                    >
                      View Breakdown
                    </button>
                    <div className="delivery-total">
                      ₹{Number(order.total_amount).toFixed(2)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {renderBreakdownModal()}
    </div>
  );
};

export default Deliveries;
