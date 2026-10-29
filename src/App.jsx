import { useState, useEffect, useCallback, useRef, Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate, useSearchParams } from 'react-router-dom';
import { 
  BookOpen, Users, Package, Home as HomeIcon, Bell, LogOut, 
  Shield, ChevronDown, Volume2, VolumeX, BookPlus, X, QrCode 
} from 'lucide-react';
import Home from './components/Home';
import QRSystem from './components/QRSystem';
import StaffDashboard from './components/StaffDashboard';
import LostFound from './components/LostFound';
import LoginPage from './components/LoginPage';
import EBookReader from './components/EBookReader';
import { ModalProvider, useModal } from './context/ModalContext';
import { playNewOrderAlarm } from './utils/soundAnnouncement';
import { formatOrderBookTitles } from './utils/orderBooks';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#fff', background: 'rgba(15,23,42,0.92)', margin: '2rem auto', maxWidth: '540px', borderRadius: '16px', border: '1.5px solid rgba(239,68,68,0.45)', backdropFilter: 'blur(16px)' }}>
          <h3 style={{ color: '#f87171', marginBottom: '0.6rem', fontSize: '1.2rem' }}>Pemberitahuan Sistem</h3>
          <p style={{ color: '#cbd5e1', fontSize: '0.88rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            {this.state.error?.message || 'Sedang memuat ulang modul...'}
          </p>
          <button 
            type="button"
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            style={{ padding: '0.6rem 1.4rem', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}
          >
            Muat Ulang Halaman
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ======================================================
// NAVIGASI CUSTOMER (Pengunjung)
// ======================================================
function CustomerNav({ onLogout }) {
  const location = useLocation();
  const { showConfirm } = useModal();

  const handleLogoutClick = async () => {
    const ok = await showConfirm('Apakah Anda yakin ingin keluar dari mode pengunjung dan kembali ke menu akses?', {
      title: 'Konfirmasi Keluar',
      confirmText: 'Ya, Keluar',
      cancelText: 'Batal',
      type: 'warning'
    });
    if (ok) onLogout();
  };

  return (
    <header className="app-header">
      <Link to="/" className="logo-area">
        <div className="logos-group">
          <img src="/Lambang.png" alt="Lambang Kota Parepare" className="logo-img" />
          <img src="/logo-perpus.png" alt="Logo Dinas Perpustakaan" className="logo-img" onError={(e) => { e.currentTarget.src = '/logo perpus.jpg'; }} />
          <img src="/logo-ilkom.png" alt="Logo Ilmu Komputer ITH" className="logo-img" onError={(e) => { e.currentTarget.src = '/logo ilkom.jpg'; }} />
        </div>
        <span className="logo-title">Perpustakaan Umum Kota Parepare</span>
      </Link>

      {/* Tombol Keluar Cepat untuk Pengunjung di Tampilan Mobile Header */}
      <button
        type="button"
        onClick={handleLogoutClick}
        className="mobile-header-logout"
        title="Keluar dari mode pengunjung"
      >
        <LogOut size={15} />
        <span>Keluar</span>
      </button>

      <nav className="nav-links">
        <Link to="/qr-system" className={`nav-link ${location.pathname === '/qr-system' ? 'active' : ''}`}>
          <BookOpen size={20} />
          Pesan Pinjam Buku
        </Link>
        <Link to="/ebooks" className={`nav-link ${location.pathname === '/ebooks' ? 'active' : ''}`}>
          <BookPlus size={20} />
          Baca E-Book Online
        </Link>
        <Link to="/lost-found" className={`nav-link ${location.pathname === '/lost-found' ? 'active' : ''}`}>
          <Package size={20} />
          Barang Tertinggal
        </Link>
        <button
          onClick={handleLogoutClick}
          className="nav-link"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}
          title="Keluar / Ganti akses"
        >
          <LogOut size={18} />
          Keluar
        </button>
      </nav>
    </header>
  );
}

// ======================================================
// NAVIGASI STAFF (Pegawai)
// ======================================================
function StaffNav({ onLogout, notifCount }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'portal';
  const { showConfirm } = useModal();
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [alarmSoundEnabled, setAlarmSoundEnabled] = useState(() => {
    return localStorage.getItem('perpus_notif_alarm_sound') !== 'false';
  });
  const [newOrderToast, setNewOrderToast] = useState(null);
  const prevNotifIdsRef = useRef(null);

  const handleStaffLogoutClick = async () => {
    const ok = await showConfirm('Apakah Anda yakin ingin keluar dari mode staf perpustakaan?', {
      title: 'Konfirmasi Keluar Staf',
      confirmText: 'Ya, Keluar',
      cancelText: 'Batal',
      type: 'warning'
    });
    if (ok) onLogout();
  };

  const toggleAlarmSound = () => {
    const nextState = !alarmSoundEnabled;
    setAlarmSoundEnabled(nextState);
    localStorage.setItem('perpus_notif_alarm_sound', String(nextState));
    window.dispatchEvent(new CustomEvent('perpus_alarm_sound_toggle', { detail: nextState }));
    if (nextState) {
      playNewOrderAlarm(true);
    }
  };

  // Sinkronisasi status alarm suara jika diubah dari tempat lain
  useEffect(() => {
    const onAlarmSync = (e) => {
      if (typeof e.detail === 'boolean') {
        setAlarmSoundEnabled(e.detail);
      }
    };
    window.addEventListener('perpus_alarm_sound_toggle', onAlarmSync);
    return () => window.removeEventListener('perpus_alarm_sound_toggle', onAlarmSync);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setNotifications(list);

        // Deteksi jika ada pesanan baru yang belum pernah muncul sebelumnya
        if (list.length > 0) {
          const currentIds = list.map(item => item.id);
          if (prevNotifIdsRef.current !== null) {
            const newlyAdded = list.filter(item => !prevNotifIdsRef.current.includes(item.id));
            if (newlyAdded.length > 0) {
              const latest = newlyAdded[0];
              setNewOrderToast({
                id: latest.id,
                ticket: latest.ticket_code,
                table: latest.table_no,
                book: latest.book_title,
                count: newlyAdded.length
              });
            }
          }
          prevNotifIdsRef.current = currentIds;
        } else {
          prevNotifIdsRef.current = [];
        }
      }
    } catch {
      // backend mungkin belum siap
    }
  }, []);

  // Otomatis sembunyikan toast banner setelah 9 detik
  useEffect(() => {
    if (!newOrderToast) return;
    const timer = setTimeout(() => {
      setNewOrderToast(null);
    }, 9000);
    return () => clearTimeout(timer);
  }, [newOrderToast]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 4000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Dengarkan event ketika staf mengubah status (misal klik '1. Mulai Mencari Buku di Rak')
  // agar notifikasi segera di-refresh dan alarm berhenti seketika tanpa menunggu jeda
  useEffect(() => {
    const onOrderStatusChanged = () => {
      fetchNotifications();
    };
    window.addEventListener('perpus_order_status_changed', onOrderStatusChanged);
    return () => window.removeEventListener('perpus_order_status_changed', onOrderStatusChanged);
  }, [fetchNotifications]);

  const pendingCount = notifications.length;
  const hasPendingOrders = pendingCount > 0;

  // ALARM BERULANG SETIAP 15 DETIK:
  // Berbunyi segera saat ada pesanan pending jika alarmSoundEnabled aktif
  useEffect(() => {
    if (!hasPendingOrders || !alarmSoundEnabled) return;

    // Bunyikan langsung saat pesanan pending terdeteksi
    playNewOrderAlarm(true);

    // Ulangi setiap 15 detik selama masih ada pesanan pending
    const alarmInterval = setInterval(() => {
      playNewOrderAlarm(true);
    }, 15000);

    return () => clearInterval(alarmInterval);
  }, [hasPendingOrders, alarmSoundEnabled]);

  return (
    <header className="app-header" style={{ borderBottom: '1px solid rgba(16,185,129,0.3)' }}>
      <Link to="/staff?tab=portal" className="logo-area" title="Ke Beranda Portal Staf">
        <div className="logos-group">
          <img src="/Lambang.png" alt="Lambang Kota Parepare" className="logo-img" />
          <img src="/logo-perpus.png" alt="Logo Dinas Perpustakaan" className="logo-img" onError={(e) => { e.currentTarget.src = '/logo perpus.jpg'; }} />
          <img src="/logo-ilkom.png" alt="Logo Ilmu Komputer ITH" className="logo-img" onError={(e) => { e.currentTarget.src = '/logo ilkom.jpg'; }} />
        </div>
        <span className="logo-title">
          Perpustakaan Umum Kota Parepare
          <span style={{ display: 'block', fontSize: '0.72rem', color: '#10b981', fontWeight: '600', letterSpacing: '0.5px' }}>
            ▲ Mode Staf Aktif
          </span>
        </span>
      </Link>

      {/* Tombol Keluar Cepat untuk Staf di Tampilan Mobile Header */}
      <button
        type="button"
        onClick={handleStaffLogoutClick}
        className="mobile-header-logout"
        title="Keluar dari mode staf"
      >
        <LogOut size={15} />
        <span>Keluar</span>
      </button>

      <nav className="nav-links" style={{ alignItems: 'center' }}>
        <Link 
          to="/staff?tab=portal" 
          className={`nav-link ${location.pathname === '/staff' && (currentTab === 'portal' || !searchParams.get('tab')) ? 'active' : ''}`}
        >
          <HomeIcon size={18} />
          Beranda Staf
        </Link>

        <Link 
          to="/staff?tab=orders" 
          className={`nav-link ${location.pathname === '/staff' && currentTab === 'orders' ? 'active' : ''}`}
        >
          <Shield size={18} />
          Antrean Pesanan
        </Link>

        <Link to="/ebooks" className={`nav-link ${location.pathname === '/ebooks' ? 'active' : ''}`}>
          <BookPlus size={18} />
          E-Book
        </Link>

        {/* Akses Cepat Barcode Meja di Navigasi Atas */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('open_table_qr_modal'))}
          className="nav-link nav-link-barcode-top"
          title="Buka & Cetak Stiker Barcode Meja (QR Code)"
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: '9px',
            padding: '0.42rem 0.85rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            fontSize: '0.86rem',
            fontWeight: '700',
            color: '#34d399',
            transition: 'all 0.2s ease'
          }}
        >
          <QrCode size={16} color="#10b981" />
          <span>Barcode Meja</span>
        </button>

        {/* Bell Notifikasi Pesanan Masuk */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setShowNotif(!showNotif); fetchNotifications(); }}
            className="nav-link"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: pendingCount > 0 ? '#fbbf24' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '0.9rem', position: 'relative',
              animation: pendingCount > 0 ? 'pulse 2s infinite' : 'none'
            }}
            title={`${pendingCount} pesanan pending belum diproses`}
          >
            <Bell size={20} />
            Notifikasi
            {pendingCount > 0 && (
              <span style={{
                position: 'absolute', top: '-4px', right: '18px',
                background: '#ef4444', color: '#fff', fontSize: '0.68rem',
                fontWeight: '800', padding: '1px 5px', borderRadius: '9px',
                minWidth: '18px', textAlign: 'center',
                animation: 'bounce 1s ease infinite'
              }}>
                {pendingCount}
              </span>
            )}
          </button>

          {/* Dropdown Panel Notifikasi */}
          {showNotif && (
            <>
              <div onClick={() => setShowNotif(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
              <div style={{
                position: 'absolute', top: 'calc(100% + 12px)', right: 0,
                width: '380px', maxHeight: '420px', overflowY: 'auto',
                background: 'var(--surface)', border: '1px solid var(--surface-border)',
                borderRadius: '14px', zIndex: 100,
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                animation: 'fadeIn 0.15s ease'
              }}>
                <div style={{ padding: '0.9rem 1.2rem', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Bell size={15} color="#fbbf24" /> Pesanan Masuk
                    {pendingCount > 0 && (
                      <span style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', fontSize: '0.75rem', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }}>
                        {pendingCount}
                      </span>
                    )}
                  </span>
                  
                  {/* Kontrol Bunyi Alarm Notifikasi - Di tempat yang berbeda (khusus notifikasi pesanan) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleAlarmSound(); }}
                      style={{
                        background: alarmSoundEnabled ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        border: '1px solid ' + (alarmSoundEnabled ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'),
                        color: alarmSoundEnabled ? '#10b981' : '#f87171',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '0.74rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Nyalakan / Matikan bunyi alarm notifikasi pesanan masuk"
                    >
                      {alarmSoundEnabled ? <Bell size={13} color="#10b981" /> : <VolumeX size={13} />}
                      {alarmSoundEnabled ? 'Alarm ON' : 'Mute Alarm'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); playNewOrderAlarm(true); }}
                      style={{
                        background: 'rgba(99,102,241,0.15)',
                        border: '1px solid rgba(99,102,241,0.35)',
                        color: '#a5b4fc',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '0.74rem',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                      title="Uji coba nada alarm notifikasi pesanan"
                    >
                      Tes Alarm
                    </button>
                  </div>
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    Tidak ada pesanan pending
                  </div>
                ) : (
                  <div>
                    {notifications.map(n => (
                      <div key={n.id} style={{
                        padding: '0.9rem 1.2rem',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        display: 'flex', alignItems: 'flex-start', gap: '0.8rem'
                      }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <BookOpen size={16} color="#fbbf24" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: '600', fontSize: '0.85rem', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {n.ticket_code} — {n.table_no}
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {formatOrderBookTitles(n.book_title)}
                          </div>
                          <div style={{ color: '#fbbf24', fontSize: '0.72rem', marginTop: '2px' }}>
                            {n.created_at ? new Date(n.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Baru'}
                          </div>
                        </div>
                        <span style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24', fontSize: '0.7rem', fontWeight: '700', padding: '2px 7px', borderRadius: '8px', flexShrink: 0 }}>
                          PENDING
                        </span>
                      </div>
                    ))}
                    <div style={{ padding: '0.8rem 1.2rem', textAlign: 'center' }}>
                      <Link to="/staff" onClick={() => setShowNotif(false)} style={{ color: 'var(--primary-color)', fontSize: '0.83rem', fontWeight: '600', textDecoration: 'none' }}>
                        Lihat semua di Dashboard →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <button
          onClick={handleStaffLogoutClick}
          className="nav-link"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}
          title="Keluar dari mode staf"
        >
          <LogOut size={18} />
          Keluar
        </button>
      </nav>

      {/* Toast Notifikasi Pesanan Baru: Tetap Muncul Meski Alarm Mute */}
      {newOrderToast && (
        <div 
          className="new-order-toast-banner" 
          onClick={() => {
            setShowNotif(true);
            setNewOrderToast(null);
          }}
          title="Klik untuk membuka rincian pesanan"
        >
          <div className="new-order-toast-icon">
            <Bell size={20} color="#fbbf24" />
          </div>
          <div className="new-order-toast-content">
            <div className="new-order-toast-title">
              Pesanan Baru Masuk! {newOrderToast.count > 1 ? `(${newOrderToast.count} Pesanan)` : ''}
              {!alarmSoundEnabled && (
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#f87171', background: 'rgba(239,68,68,0.15)', padding: '1px 5px', borderRadius: '4px', marginLeft: '6px' }}>
                  Hening
                </span>
              )}
            </div>
            <div className="new-order-toast-meta">
              <strong>{newOrderToast.ticket}</strong> • {newOrderToast.table}
            </div>
            <div className="new-order-toast-book">
              {formatOrderBookTitles(newOrderToast.book)}
            </div>
          </div>
          <button 
            type="button" 
            className="new-order-toast-close"
            onClick={(e) => { e.stopPropagation(); setNewOrderToast(null); }}
            title="Tutup pemberitahuan"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </header>
  );
}

// ======================================================
// MOBILE NAV CUSTOMER
// ======================================================
function CustomerMobileNav({ onLogout }) {
  const location = useLocation();
  const { showConfirm } = useModal();

  const handleLogoutClick = async () => {
    const ok = await showConfirm('Apakah Anda yakin ingin keluar dari mode pengunjung dan kembali ke menu akses?', {
      title: 'Konfirmasi Keluar',
      confirmText: 'Ya, Keluar',
      cancelText: 'Batal',
      type: 'warning'
    });
    if (ok) onLogout();
  };

  return (
    <nav className="mobile-bottom-nav">
      <Link to="/" className={`mobile-nav-item ${location.pathname === '/' ? 'active' : ''}`}>
        <HomeIcon size={20} /><span>Beranda</span>
      </Link>
      <Link to="/qr-system" className={`mobile-nav-item ${location.pathname === '/qr-system' ? 'active' : ''}`}>
        <BookOpen size={20} /><span>Pinjam</span>
      </Link>
      <Link to="/ebooks" className={`mobile-nav-item ${location.pathname === '/ebooks' ? 'active' : ''}`}>
        <BookPlus size={20} /><span>E-Book</span>
      </Link>
      <Link to="/lost-found" className={`mobile-nav-item ${location.pathname === '/lost-found' ? 'active' : ''}`}>
        <Package size={20} /><span>Hilang</span>
      </Link>
      <button
        type="button"
        onClick={handleLogoutClick}
        className="mobile-nav-item mobile-nav-btn-logout"
        title="Keluar dari mode pengunjung"
      >
        <LogOut size={20} /><span>Keluar</span>
      </button>
    </nav>
  );
}

// ======================================================
// MOBILE NAV STAFF
// ======================================================
function StaffMobileNav({ onLogout }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'portal';
  const { showConfirm } = useModal();

  const handleStaffLogoutClick = async () => {
    const ok = await showConfirm('Apakah Anda yakin ingin keluar dari mode staf perpustakaan?', {
      title: 'Konfirmasi Keluar Staf',
      confirmText: 'Ya, Keluar',
      cancelText: 'Batal',
      type: 'warning'
    });
    if (ok) onLogout();
  };

  return (
    <nav className="mobile-bottom-nav">
      <Link 
        to="/staff?tab=portal" 
        className={`mobile-nav-item ${location.pathname === '/staff' && (currentTab === 'portal' || !searchParams.get('tab')) ? 'active' : ''}`}
        title="Beranda Portal Staf"
      >
        <HomeIcon size={20} /><span>Beranda</span>
      </Link>
      <Link 
        to="/staff?tab=orders" 
        className={`mobile-nav-item ${location.pathname === '/staff' && currentTab === 'orders' ? 'active' : ''}`}
        title="Antrean Pesanan Tiket"
      >
        <Shield size={20} /><span>Pesanan</span>
      </Link>
      <Link 
        to="/ebooks" 
        className={`mobile-nav-item ${location.pathname === '/ebooks' ? 'active' : ''}`}
        title="Katalog E-Book"
      >
        <BookOpen size={20} /><span>E-Book</span>
      </Link>
      <Link 
        to="/staff?tab=lost_found" 
        className={`mobile-nav-item ${currentTab === 'lost_found' ? 'active' : ''}`}
        title="Barang Tertinggal (Lost & Found)"
      >
        <Package size={20} /><span>Brg Tertinggal</span>
      </Link>
      <Link 
        to="/staff?tab=import_books" 
        className={`mobile-nav-item ${currentTab === 'import_books' ? 'active' : ''}`}
        title="Tambah Buku dari PDF"
      >
        <BookPlus size={20} /><span>Tambah Buku</span>
      </Link>
      <button
        type="button"
        onClick={handleStaffLogoutClick}
        className="mobile-nav-item mobile-nav-btn-logout"
        title="Keluar dari mode staf"
      >
        <LogOut size={20} /><span>Logout</span>
      </button>
    </nav>
  );
}

// ======================================================
// APP UTAMA
// ======================================================
function App() {
  const [userRole, setUserRole] = useState(() => {
    // 1. Cek parameter URL: Jika pengunjung membuka link dari QR Code meja (?meja=1 atau ?table=1),
    // otomatis tetapkan peran sebagai 'customer' agar langsung masuk ke katalog tanpa terhalang form login
    if (typeof window !== 'undefined') {
      try {
        const search = new URLSearchParams(window.location.search);
        const hasTableParam = search.get('meja') || search.get('table') || search.get('m') || search.get('t');
        if (hasTableParam) {
          sessionStorage.setItem('perpus_role', 'customer');
          return 'customer';
        }
      } catch (e) {
        console.warn('Gagal membaca parameter meja dari URL:', e);
      }
    }

    // 2. Cek apakah sudah login di session sebelumnya (session storage)
    return sessionStorage.getItem('perpus_role') || null;
  });

  const handleLogin = (role) => {
    setUserRole(role);
    sessionStorage.setItem('perpus_role', role);
  };

  const handleLogout = () => {
    setUserRole(null);
    sessionStorage.removeItem('perpus_role');
  };

  // Belum login — tampilkan halaman pilih akses
  if (!userRole) {
    return (
      <ModalProvider>
        <LoginPage onLogin={handleLogin} />
      </ModalProvider>
    );
  }

  // Mode STAFF
  if (userRole === 'staff') {
    return (
      <ModalProvider>
        <Router>
          <div className="app-container">
            <StaffNav onLogout={handleLogout} />
            <main>
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={<StaffDashboard />} />
                  <Route path="/staff" element={<StaffDashboard />} />
                  <Route path="/ebooks" element={<EBookReader isStaff={true} />} />
                  <Route path="*" element={<Navigate to="/staff?tab=portal" replace />} />
                </Routes>
              </ErrorBoundary>
            </main>
            <StaffMobileNav onLogout={handleLogout} />
          </div>
        </Router>
      </ModalProvider>
    );
  }

  // Mode CUSTOMER (default)
  return (
    <ModalProvider>
      <Router>
        <div className="app-container">
          <CustomerNav onLogout={handleLogout} />
          <main>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/qr-system" element={<QRSystem />} />
                <Route path="/ebooks" element={<EBookReader isStaff={false} />} />
                <Route path="/lost-found" element={<LostFound />} />
                {/* Customer tidak bisa akses staff */}
                <Route path="/staff" element={<Navigate to="/" replace />} />
                <Route path="/tables" element={<Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ErrorBoundary>
          </main>
          <CustomerMobileNav onLogout={handleLogout} />
        </div>
      </Router>
    </ModalProvider>
  );
}

export default App;
