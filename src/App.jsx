import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { BookOpen, Users, Package, Home as HomeIcon, Bell, LogOut, Shield, ChevronDown } from 'lucide-react';
import Home from './components/Home';
import QRSystem from './components/QRSystem';
import StaffDashboard from './components/StaffDashboard';
import LostFound from './components/LostFound';
import LoginPage from './components/LoginPage';
import { ModalProvider } from './context/ModalContext';

// ======================================================
// NAVIGASI CUSTOMER (Pengunjung)
// ======================================================
function CustomerNav({ onLogout }) {
  const location = useLocation();

  return (
    <header className="app-header">
      <Link to="/" className="logo-area">
        <img src="/Lambang.png" alt="Lambang Kota Parepare" className="logo-img" />
        <span className="logo-title">Perpustakaan Umum Kota Parepare</span>
      </Link>
      <nav className="nav-links">
        <Link to="/qr-system" className={`nav-link ${location.pathname === '/qr-system' ? 'active' : ''}`}>
          <BookOpen size={20} />
          Pesan Pinjam Buku
        </Link>
        <Link to="/lost-found" className={`nav-link ${location.pathname === '/lost-found' ? 'active' : ''}`}>
          <Package size={20} />
          Barang Tertinggal
        </Link>
        <button
          onClick={onLogout}
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
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch {
      // backend mungkin belum siap
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const pendingCount = notifications.length;

  return (
    <header className="app-header" style={{ borderBottom: '1px solid rgba(16,185,129,0.3)' }}>
      <Link to="/staff" className="logo-area">
        <img src="/Lambang.png" alt="Lambang Kota Parepare" className="logo-img" />
        <span className="logo-title">
          Perpustakaan Umum Kota Parepare
          <span style={{ display: 'block', fontSize: '0.72rem', color: '#10b981', fontWeight: '600', letterSpacing: '0.5px' }}>
            ▲ Mode Staf Aktif
          </span>
        </span>
      </Link>
      <nav className="nav-links" style={{ alignItems: 'center' }}>
        <Link to="/staff" className={`nav-link ${location.pathname === '/staff' ? 'active' : ''}`}>
          <Shield size={18} />
          Dashboard Staf
        </Link>

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
                width: '360px', maxHeight: '400px', overflowY: 'auto',
                background: 'var(--surface)', border: '1px solid var(--surface-border)',
                borderRadius: '14px', zIndex: 100,
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                animation: 'fadeIn 0.15s ease'
              }}>
                <div style={{ padding: '1rem 1.2rem 0.8rem', borderBottom: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Bell size={15} color="#fbbf24" /> Pesanan Masuk
                  </span>
                  {pendingCount > 0 && (
                    <span style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', fontSize: '0.75rem', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }}>
                      {pendingCount} pending
                    </span>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    ✅ Tidak ada pesanan pending
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
                            {n.book_title}
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
          onClick={onLogout}
          className="nav-link"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}
          title="Keluar dari mode staf"
        >
          <LogOut size={18} />
          Keluar
        </button>
      </nav>
    </header>
  );
}

// ======================================================
// MOBILE NAV CUSTOMER
// ======================================================
function CustomerMobileNav() {
  const location = useLocation();
  return (
    <nav className="mobile-bottom-nav">
      <Link to="/" className={`mobile-nav-item ${location.pathname === '/' ? 'active' : ''}`}>
        <HomeIcon size={20} /><span>Beranda</span>
      </Link>
      <Link to="/qr-system" className={`mobile-nav-item ${location.pathname === '/qr-system' ? 'active' : ''}`}>
        <BookOpen size={20} /><span>Pinjam Buku</span>
      </Link>
      <Link to="/lost-found" className={`mobile-nav-item ${location.pathname === '/lost-found' ? 'active' : ''}`}>
        <Package size={20} /><span>Barang Hilang</span>
      </Link>
    </nav>
  );
}

// ======================================================
// MOBILE NAV STAFF
// ======================================================
function StaffMobileNav() {
  const location = useLocation();
  return (
    <nav className="mobile-bottom-nav">
      <Link to="/staff" className={`mobile-nav-item ${location.pathname === '/staff' ? 'active' : ''}`}>
        <Shield size={20} /><span>Dashboard</span>
      </Link>
    </nav>
  );
}

// ======================================================
// APP UTAMA
// ======================================================
function App() {
  const [userRole, setUserRole] = useState(() => {
    // Cek apakah sudah login di session sebelumnya (session storage, bukan permanent)
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
              <Routes>
                <Route path="/staff" element={<StaffDashboard />} />
                <Route path="*" element={<Navigate to="/staff" replace />} />
              </Routes>
            </main>
            <StaffMobileNav />
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
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/qr-system" element={<QRSystem />} />
              <Route path="/lost-found" element={<LostFound />} />
              {/* Customer tidak bisa akses staff */}
              <Route path="/staff" element={<Navigate to="/" replace />} />
              <Route path="/tables" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <CustomerMobileNav />
        </div>
      </Router>
    </ModalProvider>
  );
}

export default App;
