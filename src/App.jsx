import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { BookOpen, Library, Search, CalendarClock, Users, Package } from 'lucide-react';
import Home from './components/Home';
import QRSystem from './components/QRSystem';
import StaffDashboard from './components/StaffDashboard';
import LostFound from './components/LostFound';
import TableBooking from './components/TableBooking';
import { ModalProvider } from './context/ModalContext';

function Nav() {
  const location = useLocation();
  
  return (
    <header className="app-header">
      <Link to="/" className="logo-area" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', textDecoration: 'none' }}>
        <img 
          src="/Lambang.png" 
          alt="Lambang Kota Parepare" 
          style={{ width: '46px', height: '46px', objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }} 
        />
        <span style={{ fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.3px', color: 'var(--text-main)' }}>
          Perpustakaan Umum Kota Parepare
        </span>
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
        <Link to="/staff" className={`nav-link ${location.pathname === '/staff' ? 'active' : ''}`}>
          <Users size={20} />
          Dashboard Staf
        </Link>
      </nav>
    </header>
  );
}

function App() {
  return (
    <ModalProvider>
      <Router>
        <div className="app-container">
          <Nav />
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/qr-system" element={<QRSystem />} />
              <Route path="/staff" element={<StaffDashboard />} />
              <Route path="/lost-found" element={<LostFound />} />
              <Route path="/booking" element={<TableBooking />} />
            </Routes>
          </main>
        </div>
      </Router>
    </ModalProvider>
  );
}

export default App;
