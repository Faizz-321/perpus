import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { BookOpen, Users, Package, Home as HomeIcon } from 'lucide-react';
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
      <Link to="/" className="logo-area">
        <img 
          src="/Lambang.png" 
          alt="Lambang Kota Parepare" 
          className="logo-img"
        />
        <span className="logo-title">
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

function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav className="mobile-bottom-nav">
      <Link to="/" className={`mobile-nav-item ${location.pathname === '/' ? 'active' : ''}`}>
        <HomeIcon size={20} />
        <span>Beranda</span>
      </Link>
      <Link to="/qr-system" className={`mobile-nav-item ${location.pathname === '/qr-system' ? 'active' : ''}`}>
        <BookOpen size={20} />
        <span>Pinjam Buku</span>
      </Link>
      <Link to="/lost-found" className={`mobile-nav-item ${location.pathname === '/lost-found' ? 'active' : ''}`}>
        <Package size={20} />
        <span>Barang Hilang</span>
      </Link>
      <Link to="/staff" className={`mobile-nav-item ${location.pathname === '/staff' ? 'active' : ''}`}>
        <Users size={20} />
        <span>Staf</span>
      </Link>
    </nav>
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
          <MobileBottomNav />
        </div>
      </Router>
    </ModalProvider>
  );
}

export default App;
