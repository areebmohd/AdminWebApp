import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  ClipboardList, 
  Store, 
  Tag, 
  Truck, 
  X, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  XCircle,
  HelpCircle,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { 
  getItemTotals, 
  getRiderDeliveryFee, 
  getSponsoredDeliveryFee, 
  getDisplayPlatformFee 
} from '../utils/orderUtils';
import './Orders.css';

interface OrderItem {
  id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  selected_options?: { [key: string]: string };
  products?: {
    store_id: string;
    stores?: {
      name: string;
      id: string;
    };
  };
}

interface Order {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  total_amount: number;
  payment_method: string;
  store_id: string;
  stores: {
    id: string;
    name: string;
  };
  order_items: OrderItem[];
  applied_offers?: any;
  delivery_fee?: number;
  rider_delivery_fee?: number;
  platform_fee?: number;
  helper_fee?: number;
  store_delivery_fees?: Record<string, number>;
  transport_type?: string;
}

interface OrderSection {
  title: string;
  data: Order[];
}

const getStatusLabel = (status: string) => {
  switch (status.toLowerCase()) {
    case 'waiting_for_pickup': return 'Waiting for Pickup';
    case 'picked_up': return 'Picked Up';
    case 'delivered': return 'Delivered';
    case 'cancelled': return 'Cancelled';
    default: return status.replace(/_/g, ' ');
  }
};

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'waiting_for_pickup': return '#f39c12';
    case 'picked_up': return '#3498db';
    case 'delivered': return '#27ae60';
    case 'cancelled': return '#e74c3c';
    default: return '#7f8c8d';
  }
};

const Orders: React.FC = () => {
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

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, stores(id, name), order_items(*, selected_options, products(id, store_id, stores(id, name))), applied_offers')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSections(groupOrdersByDate(data || []));
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  }, [groupOrdersByDate]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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
            <h3 className="modal-title"><ClipboardList size={20} /> Order Breakdown</h3>
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
            <button className="btn btn-primary" onClick={() => setSelectedOrder(null)}>Close</button>
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
    <div className="orders-container">
      <header className="orders-header">
        <h1 className="page-title">Orders</h1>
        <p className="page-subtitle">Manage and track all customer orders</p>
      </header>

      {sections.map((section) => (
        <section key={section.title} className="section-group">
          <h2 className="section-title">{section.title}</h2>
          <div className="orders-grid">
            {section.data.map((order) => (
              <div key={order.id} className="order-card">
                <div className="order-card-header">
                  <div className="order-info">
                    <h3>#{order.order_number}</h3>
                    <div className="order-meta">
                      <Clock size={14} />
                      {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {order.transport_type && ` • ${order.transport_type === 'heavy' ? 'Truck' : 'Bike'}`}
                    </div>
                  </div>
                  <div 
                    className="order-status-badge" 
                    style={{ backgroundColor: getStatusColor(order.status) }}
                  >
                    {getStatusLabel(order.status)}
                  </div>
                </div>

                <div className="order-card-divider" />

                <div className="order-stores-list">
                  {Object.entries(
                    order.order_items.reduce((acc: any, oi) => {
                      const storeId = oi.products?.store_id || order.stores?.id || order.store_id || 'unknown';
                      const storeName = oi.products?.stores?.name || order.stores?.name || 'Unknown Store';
                      if (!acc[storeId]) acc[storeId] = { name: storeName, items: [] };
                      acc[storeId].items.push(oi);
                      return acc;
                    }, {})
                  ).map(([storeId, storeData]: [string, any], sIdx) => {
                    const storeOffer = order.applied_offers?.[storeId];
                    const deliveryOffer = order.applied_offers?.[`${storeId}_delivery`];

                    return (
                      <div key={storeId} className="order-store-item">
                        <div className="order-store-header">
                          <Store size={14} />
                          {storeData.name}
                        </div>
                        <div className="order-products-list">
                          {storeData.items.map((product: any) => {
                            const { original, discounted } = getItemTotals(product, storeData.items, storeOffer);
                            return (
                              <div key={product.id} className="order-product-row">
                                <div className="product-name-qty">
                                  {product.product_name} x{product.quantity}
                                  {product.selected_options && Object.keys(product.selected_options).length > 0 && (
                                    <span className="product-options">
                                      {Object.entries(product.selected_options)
                                        .map(([k, v]) => k === 'gift' ? 'Gift' : v)
                                        .join(', ')}
                                    </span>
                                  )}
                                </div>
                                <div className="product-price-box">
                                  {discounted < original ? (
                                    <>
                                      <span className="price-discounted">₹{discounted.toFixed(2)}</span>
                                      <span className="price-original">₹{original.toFixed(2)}</span>
                                    </>
                                  ) : (
                                    <span className="price-discounted">₹{original.toFixed(2)}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {storeOffer && (
                            <div className="order-offer-badge">
                              <Tag size={16} className="offer-icon" />
                              <div className="offer-details">
                                <h4>{storeOffer.name || (storeOffer.type === 'free_delivery' ? 'Free Delivery' : 'Special Offer')}</h4>
                                <p>
                                  {storeOffer.type === 'discount' && `${storeOffer.amount}% Instant Discount on Total Items Price`}
                                  {storeOffer.type === 'free_delivery' && '₹0 Delivery fee'}
                                  {storeOffer.type === 'free_product' && `Get Free ${storeOffer.name || 'Gift Item'}`}
                                  {storeOffer.type === 'cheap_product' && `${storeOffer.amount}% Instant Discount on ${storeOffer.name || 'Some Items'}`}
                                  {storeOffer.type === 'combo' && `${storeOffer.name || 'Items'} at Only ₹${storeOffer.amount}`}
                                  {storeOffer.type === 'free_cash' && `₹${storeOffer.amount} Free Cash amount`}
                                </p>
                              </div>
                            </div>
                          )}
                          {deliveryOffer && (
                            <div className="order-offer-badge" style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a' }}>
                              <Truck size={16} className="offer-icon" style={{ color: '#d97706' }} />
                              <div className="offer-details">
                                <h4 style={{ color: '#d97706' }}>{deliveryOffer.name || 'Free Delivery'}</h4>
                                <p style={{ color: '#b45309' }}>₹0 Delivery fee</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="order-card-divider" />

                <div className="order-card-footer">
                  <button 
                    className="view-shares-btn"
                    onClick={() => setSelectedOrder(order)}
                  >
                    View Shares
                  </button>
                  <div className="order-total">
                    ₹{Number(order.total_amount).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {renderBreakdownModal()}
    </div>
  );
};

export default Orders;
