import { useNavigate } from 'react-router-dom';
import { BookOpen, Users, Package, LayoutGrid, Monitor } from 'lucide-react';

function Home() {
  const navigate = useNavigate();

  return (
    <div className="glass-panel home-hero-panel">
      <div className="page-header">
        <h1>Selamat Datang di Perpustakaan Umum Kota Parepare</h1>
        <p>Sistem layanan perpustakaan pintar, pemantauan meja real-time & pemesanan buku</p>
      </div>
      
      <div className="features-grid">
        <div className="feature-card glass-panel" onClick={() => navigate('/tables')}>
          <div className="feature-icon-wrapper" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.2))', color: '#10b981' }}>
            <LayoutGrid size={32} />
          </div>
          <h3>Status Meja Real-Time</h3>
          <p>Pantau denah denah visual interaktif, jumlah kursi kosong/terisi, dan mode TV display untuk lobby pintu masuk.</p>
        </div>

        <div className="feature-card glass-panel" onClick={() => navigate('/qr-system')}>
          <div className="feature-icon-wrapper">
            <BookOpen size={32} />
          </div>
          <h3>Pesan Pinjam Buku</h3>
          <p>Scan QR di meja Anda, pilih buku dari katalog digital, staf kami akan menyiapkannya untuk Anda.</p>
        </div>

        <div className="feature-card glass-panel" onClick={() => navigate('/lost-found')}>
          <div className="feature-icon-wrapper" style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.2))', color: '#f59e0b' }}>
            <Package size={32} />
          </div>
          <h3>Barang Tertinggal</h3>
          <p>Pemberitahuan barang tertinggal di perpustakaan dalam bentuk tulisan teks. Cek dan ambil di meja staf.</p>
        </div>

        <div className="feature-card glass-panel" onClick={() => navigate('/staff')}>
          <div className="feature-icon-wrapper" style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(245, 158, 11, 0.2))', color: '#f87171' }}>
            <Users size={32} />
          </div>
          <h3>Dashboard Staf</h3>
          <p>Halaman staf untuk mengupdate status buku, kontrol meja manual, dan foto bukti serah terima.</p>
        </div>
      </div>
    </div>
  );
}

export default Home;
