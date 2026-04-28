import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  RotateCcw, 
  User, 
  Package, 
  Clock, 
  CheckCircle,
  Loader2,
  Phone,
  ClipboardList,
  XCircle,
  QrCode,
  Banknote
} from 'lucide-react';
import type { ReturnRequest } from '../types';
import './Returns.css';

interface ReturnSection {
  title: string;
  data: ReturnRequest[];
}

const Returns: React.FC = () => {
  const [sections, setSections] = useState<ReturnSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedReturnForQR, setSelectedReturnForQR] = useState<ReturnRequest | null>(null);

  const groupReturnsByDate = useCallback((returns: ReturnRequest[]) => {
    if (!returns || returns.length === 0) return [];

    const groups: { [key: string]: ReturnRequest[] } = {};

    returns.forEach((item) => {
      if (!item.created_at) return;
      
      const date = new Date(item.created_at);
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
      groups[dateString].push(item);
    });

    return Object.keys(groups).map((date) => ({
      title: date,
      data: groups[date],
    }));
  }, []);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      console.log('Fetching returns...');
      // Using table names for joins is more reliable in Supabase/PostgREST
      const { data, error } = await supabase
        .from('returns')
        .select(`
          *,
          profiles!returns_user_id_fkey (full_name, phone, upi_id),
          products (name, image_url),
          orders (order_number)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error fetching returns:', error);
        throw error;
      }
      
      console.log('Raw returns data:', data);
      setSections(groupReturnsByDate(data || []));
    } catch (err) {
      console.error('Error fetching returns:', err);
    } finally {
      setLoading(false);
    }
  }, [groupReturnsByDate]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const handleApprove = async (id: string) => {
    if (!window.confirm('Are you sure you want to approve this return request?')) return;
    
    setProcessingId(id);
    try {
      const { error } = await supabase
        .from('returns')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      // Refresh data
      await fetchReturns();
    } catch (err) {
      console.error('Error approving return:', err);
      alert('Failed to approve return request. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (request: any) => {
    const reason = window.prompt('Please enter the reason for cancelling this return request:');
    if (reason === null) return; // User cancelled prompt
    
    setProcessingId(request.id);
    try {
      const { error } = await supabase
        .from('returns')
        .update({ status: 'rejected', admin_comment: reason, updated_at: new Date().toISOString() })
        .eq('id', request.id);

      if (error) throw error;
      
      // Delete image from storage
      if (request.image_url) {
        try {
          const pathParts = request.image_url.split('/products/');
          if (pathParts.length > 1) {
            const filePath = pathParts[1];
            await supabase.storage.from('products').remove([filePath]);
          }
        } catch (storageErr) {
          console.error('Failed to delete image', storageErr);
        }
      }
      
      // Refresh data
      await fetchReturns();
    } catch (err) {
      console.error('Error rejecting return:', err);
      alert('Failed to cancel return request. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handlePaid = async () => {
    if (!selectedReturnForQR) return;
    const id = selectedReturnForQR.id;
    setProcessingId(id);
    setSelectedReturnForQR(null);
    try {
      const { error } = await supabase
        .from('returns')
        .update({ status: 'refund_paid', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      // Refresh data
      await fetchReturns();
    } catch (err) {
      console.error('Error updating to paid:', err);
      alert('Failed to update status to paid. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusLower = (status || 'pending').toLowerCase();
    switch (statusLower) {
      case 'pending':
        return <span className="status-badge status-pending">Pending</span>;
      case 'approved':
        return <span className="status-badge status-approved">Approved</span>;
      case 'refund_paid':
        return <span className="status-badge status-refund_paid">Refund Paid</span>;
      case 'rejected':
        return <span className="status-badge status-rejected">Rejected</span>;
      case 'returned':
        return <span className="status-badge status-returned">Returned</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="returns-loader">
        <Loader2 className="animate-spin" size={48} color="#007bff" />
      </div>
    );
  }

  return (
    <div className="returns-container">
      <header className="returns-header">
        <h1 className="page-title">Return Requests</h1>
        <p className="page-subtitle">Manage and process customer return requests</p>
      </header>

      {sections.length === 0 ? (
        <div className="empty-state">
          <RotateCcw size={64} className="empty-icon" />
          <h3>No return requests found</h3>
          <p>When customers request returns, they will appear here.</p>
        </div>
      ) : (
        sections.map((section) => (
          <section key={section.title} className="section-group">
            <h2 className="section-title">{section.title}</h2>
            <div className="returns-list">
              {section.data.map((request) => {
                // Defensive check for joins that might be arrays or objects
                const profile = Array.isArray(request.profiles) ? request.profiles[0] : request.profiles;
                const product = Array.isArray(request.products) ? request.products[0] : request.products;
                const order = Array.isArray(request.orders) ? request.orders[0] : request.orders;

                return (
                  <div key={request.id} className="return-card">
                    <div className="return-card-header">
                      <div className="order-info">
                        <div className="order-number">
                          <ClipboardList size={16} />
                          Order #{order?.order_number || 'N/A'}
                        </div>
                        <div className="return-meta">
                          <Clock size={14} />
                          {request.created_at ? new Date(request.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                          <span className="return-type-tag">
                            {request.return_type?.toLowerCase().includes('exchange') ? 'Exchange' : 'Refund'}
                          </span>
                        </div>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>

                    <div className="return-details-grid">
                      <div className="detail-section product-detail">
                        <div className="section-label">Product</div>
                        <div className="product-item">
                          {product?.image_url ? (
                            <img src={product.image_url} alt={product.name} className="product-img" />
                          ) : (
                            <div className="product-img-placeholder"><Package size={20} /></div>
                          )}
                          <div className="product-info">
                            <div className="product-name">{product?.name || 'Unknown Product'}</div>
                            <div className="product-id-text">ID: {request.product_id?.slice(0, 8) || 'N/A'}...</div>
                          </div>
                        </div>
                      </div>

                      <div className="detail-section user-detail">
                        <div className="section-label">Customer</div>
                        <div className="user-item">
                          <div className="user-icon"><User size={18} /></div>
                          <div className="user-info">
                            <div className="user-name">{profile?.full_name || 'Customer'}</div>
                            {profile?.phone && (
                              <a href={`tel:${profile.phone}`} className="user-phone">
                                <Phone size={12} /> {profile.phone}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="return-reason-box">
                      <div className="section-label">Reason for Return</div>
                      <p className="reason-text">{request.reason || 'No reason provided'}</p>
                      {!['completed', 'returned', 'rejected'].includes(request.status) && request.image_url && (
                        <div className="reason-image-container">
                          <img 
                            src={request.image_url} 
                            alt="Return Evidence" 
                            className="reason-image" 
                            onClick={() => window.open(request.image_url!, '_blank')} 
                          />
                          <span className="image-hint">Click to enlarge</span>
                        </div>
                      )}
                    </div>

                    {request.status === 'pending' && (
                      <div className="return-actions">
                        <button 
                          className="approve-btn"
                          onClick={() => handleApprove(request.id)}
                          disabled={processingId === request.id}
                        >
                          {processingId === request.id ? (
                            <Loader2 className="animate-spin" size={18} />
                          ) : (
                            <CheckCircle size={18} />
                          )}
                          Approve
                        </button>
                        <button 
                          className="reject-btn"
                          onClick={() => handleReject(request)}
                          disabled={processingId === request.id}
                        >
                          {processingId === request.id ? (
                            <Loader2 className="animate-spin" size={18} />
                          ) : (
                            <XCircle size={18} />
                          )}
                          Cancel Request
                        </button>
                      </div>
                    )}
                    
                    {request.status === 'approved' && !request.return_type?.toLowerCase().includes('exchange') && (
                      <div className="return-actions">
                        <button 
                          className="approve-btn"
                          style={{ backgroundColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onClick={() => setSelectedReturnForQR(request)}
                          disabled={processingId === request.id}
                        >
                          {processingId === request.id ? (
                            <Loader2 className="animate-spin" size={18} />
                          ) : (
                            <QrCode size={18} />
                          )}
                          Pay Refund
                        </button>
                      </div>
                    )}
                    
                    {request.status === 'approved' && request.return_type?.toLowerCase().includes('exchange') && (
                      <div className="return-status-message success">
                        <CheckCircle size={16} />
                        Request approved {request.updated_at ? `on ${new Date(request.updated_at).toLocaleDateString()}` : ''}
                      </div>
                    )}

                    {request.status === 'refund_paid' && (
                      <div className="return-status-message success" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
                        <Banknote size={16} />
                        Refund Paid {request.updated_at ? `on ${new Date(request.updated_at).toLocaleDateString()}` : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      {/* QR Code Modal */}
      {selectedReturnForQR && (() => {
        const product = Array.isArray(selectedReturnForQR.products) ? selectedReturnForQR.products[0] : selectedReturnForQR.products;
        const order = Array.isArray(selectedReturnForQR.orders) ? selectedReturnForQR.orders[0] : selectedReturnForQR.orders;
        const profile = Array.isArray(selectedReturnForQR.profiles) ? selectedReturnForQR.profiles[0] : selectedReturnForQR.profiles;
        const amount = selectedReturnForQR.refund_amount || 0;
        
        const productName = product?.name || 'Product';
        const orderId = order?.order_number || 'N/A';
        const userUpiId = profile?.upi_id || 'zorodeliveryapp@upi';
        const note = encodeURIComponent(`Refund for ${productName} Order ${orderId}`);
        
        // Construct standard UPI String using user's UPI ID
        const upiString = `upi://pay?pa=${encodeURIComponent(userUpiId)}&pn=Zoro+Delivery&am=${amount}&cu=INR&tn=${note}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiString)}`;

        return (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2 className="modal-title">Pay Refund</h2>
              <p className="modal-subtitle">Scan to refund the amount to the customer.</p>
              
              <img 
                src={qrUrl} 
                alt="QR Code" 
                className="qr-code-placeholder"
              />
              
              <div className="modal-amount">
                ₹{amount}
              </div>

              <div className="modal-actions">
                <button 
                  className="modal-cancel-btn"
                  onClick={() => setSelectedReturnForQR(null)}
                >
                  Cancel
                </button>
                <button 
                  className="modal-paid-btn"
                  onClick={handlePaid}
                >
                  Paid
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Returns;
