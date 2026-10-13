import { useNavigate } from 'react-router-dom';
import { BookOpen, Package } from 'lucide-react';

function Home() {
  const navigate = useNavigate();

  return (
    <div className="glass-panel home-hero-panel">
      <div className="page-header">
        <h1>Selamat Datang di Perpustakaan Umum Kota Parepare</h1>
        <p>Sistem layanan perpustakaan pintar & pemesanan buku digital</p>
      </div>
      
      <div className="features-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', maxWidth: '900px', margin: '2rem auto 0' }}>
        <div className="feature-card glass-panel" onClick={() => navigate('/qr-system')} style={{ cursor: 'pointer', transition: 'all 0.25s ease' }}>
          <div className="feature-icon-wrapper" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(139, 92, 246, 0.25))', color: '#818cf8', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.2)' }}>
            <BookOpen size={32} />
          </div>
          <h3 style={{ fontWeight: '800', fontSize: '1.3rem', color: '#ffffff', marginBottom: '0.3rem' }}>Pesan Pinjam Buku</h3>
          <p style={{ color: '#cbd5e1', fontWeight: '500', lineHeight: 1.6 }}>Scan QR di meja Anda, pilih buku dari katalog digital, staf kami akan menyiapkannya untuk Anda.</p>
        </div>

        <div className="feature-card glass-panel" onClick={() => navigate('/lost-found')} style={{ cursor: 'pointer', transition: 'all 0.25s ease' }}>
          <div className="feature-icon-wrapper" style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.25))', color: '#fbbf24', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.2)' }}>
            <Package size={32} />
          </div>
          <h3 style={{ fontWeight: '800', fontSize: '1.3rem', color: '#ffffff', marginBottom: '0.3rem' }}>Barang Tertinggal</h3>
          <p style={{ color: '#cbd5e1', fontWeight: '500', lineHeight: 1.6 }}>Pemberitahuan barang tertinggal di perpustakaan dalam bentuk tulisan teks. Cek dan ambil di meja staf.</p>
        </div>
      </div>
    </div>
  );
}

export default Home;

