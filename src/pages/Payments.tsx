import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  RotateCw, 
  CheckCircle2, 
  Loader2,
  Wallet,
  Coins,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { formatDateShort, getUpiUri, formatCurrency } from '../utils/formatters';
import type { PayoutType, Payout } from '../types';
import './Payments.css';

const Payments: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<PayoutType>('store');
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // QR Modal State
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [payingGroup, setPayingGroup] = useState<PayoutGroup | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchPayouts = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data: payoutsData, error: payoutsError } = await supabase
        .from('payouts')
        .select(`
          *,
          order:order_id (order_number)
        `)
        .eq('recipient_type', activeTab)
        .order('payment_date', { ascending: false });

      if (payoutsError) throw payoutsError;

      if (!payoutsData || payoutsData.length === 0) {
        setPayouts([]);
        return;
      }

      const recipientIds = [...new Set(payoutsData.map(p => p.recipient_id))];
      let enrichedPayouts: Payout[] = [];

      if (activeTab === 'store') {
        const { data: stores } = await supabase
          .from('stores')
          .select('id, name, upi_id, phone')
          .in('id', recipientIds);
        
        enrichedPayouts = payoutsData.map(p => ({
          ...p,
          recipient: stores?.find(s => s.id === p.recipient_id) || { name: 'Unknown Store' }
        }));
      } else {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, upi_id, phone')
          .in('id', recipientIds);
        
        enrichedPayouts = payoutsData.map(p => ({
          ...p,
          recipient: profiles?.find(pr => pr.id === p.recipient_id) || { full_name: 'Unknown Rider' }
        }));
      }

      setPayouts(enrichedPayouts);
    } catch (err: unknown) {
      console.error('Error fetching payouts:', (err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  const generatePayouts = useCallback(async () => {
    try {
      setIsSyncing(true);
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id, 
          status, 
          delivery_fee, 
          rider_delivery_fee,
          rider_id,
          store_id,
          created_at,
          order_items(product_price, quantity)
        `)
        .or(`status.eq.delivered,status.eq.cancelled`);

      if (ordersError) throw ordersError;

      const newPayouts: {
        recipient_id: string;
        recipient_type: string;
        order_id: string;
        amount: number;
        payment_date: string;
        status: string;
      }[] = [];
      const getRiderFee = (order: { rider_delivery_fee?: number | string; delivery_fee: number | string }) => {
        const rFee = Number(order.rider_delivery_fee ?? 0);
        return rFee > 0 ? rFee : Number(order.delivery_fee ?? 0);
      };

      for (const order of orders) {
        const orderDate = new Date(order.created_at).toLocaleDateString('en-CA');

        if (order.status === 'delivered' && order.store_id) {
          let storeAmount = 0;
          order.order_items.forEach((item: { product_price: number; quantity: number }) => {
            storeAmount += (item.product_price * item.quantity);
          });

          newPayouts.push({
            recipient_id: order.store_id,
            recipient_type: 'store',
            order_id: order.id,
            amount: storeAmount,
            payment_date: orderDate,
            status: 'pending'
          });

          if (order.rider_id) {
            newPayouts.push({
              recipient_id: order.rider_id,
              recipient_type: 'rider',
              order_id: order.id,
              amount: getRiderFee(order),
              payment_date: orderDate,
              status: 'pending'
            });
          }
        }
      }

      const { data: existingPayouts } = await supabase.from('payouts').select('order_id, recipient_id');
      const filteredNewPayouts = newPayouts.filter(np => 
        !existingPayouts?.some(ep => ep.order_id === np.order_id && ep.recipient_id === np.recipient_id)
      );

      if (filteredNewPayouts.length > 0) {
        const { error: insertError } = await supabase.from('payouts').insert(filteredNewPayouts);
        if (insertError) throw insertError;
        alert(`Sync complete: ${filteredNewPayouts.length} entries added.`);
      } else {
        alert('System is up to date.');
      }
      
      fetchPayouts();
    } catch (e: unknown) {
        alert('Error: ' + (e as Error).message);
    } finally {
        setIsSyncing(false);
    }
  }, [fetchPayouts]);
  
  interface PayoutGroup {
    ids: string[];
    recipient: any;
    totalAmount: number;
    status: string;
    paymentDate: string;
    isToday: boolean;
    upiTransactionId?: string;
  }
  
  const handlePayOnlineClick = useCallback((group: PayoutGroup) => {
    if (!group.recipient?.upi_id) {
      alert('Recipient has not linked a UPI ID.');
      return;
    }
    setPayingGroup(group);
    setQrModalVisible(true);
  }, []);

  const confirmPayment = useCallback(async (method: 'online' | 'cash', groupIds: string[]) => {
    const utr = method === 'online' ? 'PAID_ONLINE' : 'PAID_CASH';
    
    if (method === 'cash') {
      if (!window.confirm('Confirm settlement via Cash?')) return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('payouts')
        .update({ 
          status: 'sent', 
          upi_transaction_id: utr
        })
        .in('id', groupIds);

      if (error) throw error;
      setQrModalVisible(false);
      setPayingGroup(null);
      fetchPayouts();
    } catch (e: unknown) {
      alert('Error updating payment: ' + (e as Error).message);
    } finally {
      setUpdating(false);
    }
  }, [fetchPayouts]);

  const handleCloseQrModal = useCallback(async () => {
    if (window.confirm('Was the payment successful?')) {
      if (payingGroup) {
        await confirmPayment('online', payingGroup.ids);
      }
    }
  }, [payingGroup, confirmPayment]);

  const processedData = useMemo(() => {
    const today = new Date().toLocaleDateString('en-CA');
    const groups: Record<string, PayoutGroup> = {};
 
    payouts.forEach(p => {
      const key = `${p.recipient_id}_${p.payment_date}`;
      if (!groups[key]) {
        groups[key] = {
          ids: [],
          recipient: p.recipient,
          totalAmount: 0,
          status: p.status,
          paymentDate: p.payment_date,
          isToday: p.payment_date === today,
          upiTransactionId: p.upi_transaction_id || undefined,
        };
      }
      groups[key].ids.push(p.id);
      groups[key].totalAmount += parseFloat(p.amount as string);
      if (p.upi_transaction_id) groups[key].upiTransactionId = p.upi_transaction_id;
      
      if (p.status !== groups[key].status && p.status === 'pending') {
          groups[key].status = 'pending';
      }
    });

    const result = Object.values(groups).map(g => ({
        ...g,
        canPay: !g.isToday
    }));

    const groupedByDate: Record<string, typeof result> = result.reduce((acc: Record<string, typeof result>, curr) => {
      if (!acc[curr.paymentDate]) acc[curr.paymentDate] = [];
      acc[curr.paymentDate].push(curr);
      return acc;
    }, {});

    const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));
    const dailyTotals: Record<string, number> = {};
    sortedDates.forEach(date => {
      dailyTotals[date] = groupedByDate[date].reduce((sum, item) => sum + item.totalAmount, 0);
    });

    return { groupedByDate, sortedDates, dailyTotals };
  }, [payouts]);

  const { groupedByDate, sortedDates, dailyTotals } = processedData;

  return (
    <div className="payments-container">
      <div className="payments-header">
        <h1 className="payments-title">Payouts Dashboard</h1>
        <div className="payments-controls">
          <div className="payout-tabs">
            <button 
              className={`payout-tab ${activeTab === 'store' ? 'active' : ''}`}
              onClick={() => setActiveTab('store')}
            >
              Stores
            </button>
            <button 
              className={`payout-tab ${activeTab === 'rider' ? 'active' : ''}`}
              onClick={() => setActiveTab('rider')}
            >
              Riders
            </button>
          </div>
          <button 
            className="sync-btn" 
            onClick={generatePayouts}
            disabled={isSyncing}
            title="Sync payouts from orders"
          >
            {isSyncing ? <Loader2 className="animate-spin" size={20} /> : <RotateCw size={20} />}
          </button>
        </div>
      </div>

      {loading && !refreshing ? (
        <div className="loading-state">
          <Loader2 className="animate-spin" size={48} color="#007bff" />
          <p>Analyzing payout history...</p>
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="empty-state">
          <Wallet size={64} />
          <p>No {activeTab} payouts recorded yet.</p>
        </div>
      ) : (
        <div className="payout-timeline">
          {sortedDates.map(date => (
            <div key={date} className="date-group">
              <div className="date-divider">
                <span className="date-label">{formatDateShort(date)}</span>
                <div className="date-line" />
              </div>
              
              <div className="daily-total-badge">
                <Coins size={18} />
                <span>Daily Payout: {formatCurrency(dailyTotals[date])}</span>
              </div>

              <div className="payout-grid">
                {groupedByDate[date].map((group, idx) => {
                  const isPaid = group.status === 'sent' || group.status === 'paid';
                  
                  return (
                    <motion.div 
                      key={`${date}_${idx}`} 
                      className="payout-card"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <div className="payout-card-top">
                        <div className="recipient-info">
                          <h3>{group.recipient?.name || group.recipient?.full_name || 'System'}</h3>
                          <div className="recipient-upi">{group.recipient?.upi_id || 'Upi not linked'}</div>
                        </div>
                        <div className="payout-amount">{formatCurrency(group.totalAmount)}</div>
                      </div>

                      <div className="payment-status-row">
                        <span className={`status-badge ${
                          isPaid ? 'status-paid' : (group.isToday ? 'status-accumulating' : 'status-pending')
                        }`}>
                          {isPaid ? 'SETTLED' : (group.isToday ? 'ACCUMULATING' : 'PENDING')}
                        </span>
                        {group.upiTransactionId && (
                          <div className="utr-info">
                            <CheckCircle2 size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
                            {group.upiTransactionId === 'PAID_CASH' ? 'Paid via Cash' : 'Paid Online'}
                          </div>
                        )}
                      </div>

                      <div className="payout-actions">
                        {!isPaid ? (
                          group.canPay ? (
                            <>
                              <button 
                                className="btn-pay-online"
                                onClick={() => handlePayOnlineClick(group)}
                              >
                                Pay Online
                              </button>
                              <button 
                                className="btn-pay-cash"
                                onClick={() => confirmPayment('cash', group.ids)}
                              >
                                Pay Cash
                              </button>
                            </>
                          ) : (
                            <button className="btn-paid-disabled" title="Daily payouts settle after 24h">
                              Scheduled for Tomorrow
                            </button>
                          )
                        ) : (
                          <button className="btn-paid-disabled">
                            <CheckCircle2 size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
                            Transaction Completed
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR MODAL */}
      <AnimatePresence>
        {qrModalVisible && payingGroup && (
          <div className="modal-overlay">
            <motion.div 
              className="modal-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="modal-header">
                <h2 className="modal-title">Scan to Pay</h2>
                <button className="close-btn" onClick={handleCloseQrModal}>
                  <X size={24} />
                </button>
              </div>

              <div className="qr-container">
                <div className="qr-wrapper">
                  <QRCodeSVG 
                    value={getUpiUri(payingGroup.recipient as any, payingGroup.totalAmount, payingGroup.paymentDate)} 
                    size={220}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                
                <p className="qr-instructions">
                  Open any UPI app on your phone and scan this QR code. Details will be pre-filled.
                </p>

                <div className="qr-details">
                  <div className="qr-amount-large">{formatCurrency(payingGroup.totalAmount)}</div>
                  <div className="qr-detail-row">
                    <span className="qr-detail-label">Recipient</span>
                    <span className="qr-detail-value">{payingGroup.recipient?.name || payingGroup.recipient?.full_name}</span>
                  </div>
                  <div className="qr-detail-row">
                    <span className="qr-detail-label">UPI ID</span>
                    <span className="qr-detail-value">{payingGroup.recipient?.upi_id}</span>
                  </div>
                  <div className="qr-detail-row">
                    <span className="qr-detail-label">Note</span>
                    <span className="qr-detail-value">
                      {payingGroup.recipient?.name || payingGroup.recipient?.full_name} {
                        (() => {
                          const dateParts = payingGroup.paymentDate.split('-');
                          return dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : payingGroup.paymentDate;
                        })()
                      }
                    </span>
                  </div>
                </div>

                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                  <button 
                    className="btn-qr-success" 
                    onClick={() => confirmPayment('online', payingGroup.ids)}
                    disabled={updating}
                  >
                    {updating ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                    <span>Payment Successful</span>
                  </button>
                  <button className="btn-qr-cancel" onClick={handleCloseQrModal} disabled={updating}>
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Payments;
