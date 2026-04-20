import React, { useState, useEffect, useCallback, memo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Send, 
  User, 
  Store, 
  Bike, 
  Plus, 
  X, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  Inbox
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDateFull } from '../utils/formatters';
import './Notifications.css';

interface Notification {
  id: string;
  title: string;
  description: string;
  created_at: string;
  target_group: string;
}

const TARGET_GROUPS = [
  { id: 'customer', label: 'Customers', icon: User },
  { id: 'business', label: 'Businesses', icon: Store },
  { id: 'rider', label: 'Riders', icon: Bike },
];

const Notifications: React.FC = () => {
  const [selectedGroup, setSelectedGroup] = useState('customer');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('target_group', selectedGroup)
        .is('order_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications((data as Notification[]) || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedGroup]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleSendBroadcast = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setSending(true);
    setStatus(null);
    try {
      const { error } = await supabase.from('notifications').insert([
        {
          title,
          description,
          target_group: selectedGroup,
        },
      ]);

      if (error) throw error;

      setStatus({ type: 'success', message: 'Broadcast sent successfully!' });
      setTitle('');
      setDescription('');
      setTimeout(() => {
        setModalVisible(false);
        setStatus(null);
        fetchNotifications();
      }, 1500);
    } catch (error: unknown) {
      setStatus({ type: 'error', message: (error as Error).message || 'Failed to send broadcast' });
    } finally {
      setSending(false);
    }
  }, [selectedGroup, title, description, fetchNotifications]);

  const openModal = useCallback(() => setModalVisible(true), []);
  const closeModal = useCallback(() => {
    setModalVisible(false);
    setStatus(null);
  }, []);

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <h1 className="notifications-title">Broadcast Notifications</h1>
        <button className="create-btn" onClick={openModal}>
          <Plus size={20} />
          <span>New Broadcast</span>
        </button>
      </div>

      <div className="group-tabs">
        {TARGET_GROUPS.map((group) => (
          <button
            key={group.id}
            className={`group-tab ${selectedGroup === group.id ? 'active' : ''}`}
            onClick={() => setSelectedGroup(group.id)}
          >
            <group.icon size={18} />
            <span>{group.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-state">
          <Loader2 className="animate-spin" size={48} color="#007bff" />
          <p>Fetching notifications history...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="empty-state">
          <Inbox size={64} />
          <p>No broadcast history for {selectedGroup}s.</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((item) => (
            <NotificationCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Broadcast Modal */}
      <AnimatePresence>
        {modalVisible && (
          <div className="modal-overlay">
            <motion.div 
              className="modal-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="modal-header">
                <h2 className="modal-title">Push to {selectedGroup}s</h2>
                <button className="close-btn" onClick={closeModal}>
                  <X size={24} />
                </button>
              </div>

              {status ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '2rem 0',
                  color: status.type === 'success' ? '#10b981' : '#ef4444'
                }}>
                  {status.type === 'success' ? <CheckCircle2 size={64} style={{ margin: '0 auto 1rem' }} /> : <AlertCircle size={64} style={{ margin: '0 auto 1rem' }} />}
                  <h3>{status.message}</h3>
                </div>
              ) : (
                <form onSubmit={handleSendBroadcast}>
                  <div className="form-group">
                    <label className="form-label">Message Title</label>
                    <input
                      className="form-input"
                      type="text"
                      placeholder="e.g. Weekend Offer!"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Message Description</label>
                    <textarea
                      className="form-textarea"
                      placeholder="Enter the full message for push notification..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                    />
                  </div>
                  <button className="send-btn" type="submit" disabled={sending}>
                    {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                    <span>{sending ? 'Sending...' : 'Send Broadcast Now'}</span>
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const NotificationCard: React.FC<{ item: Notification }> = memo(({ item }) => (
  <div className="notification-card">
    <div className="notification-card-header">
      <h3 className="notification-card-title">{item.title}</h3>
      <span className="notification-card-time">{formatDateFull(item.created_at)}</span>
    </div>
    <div className="notification-card-body">{item.description}</div>
  </div>
));

export default memo(Notifications);
