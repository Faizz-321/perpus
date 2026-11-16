import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Package, MessageCircle } from 'lucide-react';

function Home() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Jika pengunjung membuka link meja (misal dari QR Code di meja), langsung arahkan ke form pemesanan buku
  useEffect(() => {
    const tableParam = searchParams.get('meja') || searchParams.get('table') || searchParams.get('m') || searchParams.get('t');
    if (tableParam) {
      navigate(`/qr-system?${searchParams.toString()}`, { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <div className="glass-panel home-hero-panel">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
          <img src="/Lambang.png" alt="Lambang Kota Parepare" style={{ height: '62px', width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }} />
          <div style={{ width: '1.5px', height: '44px', background: 'rgba(255,255,255,0.2)' }} />
          <img src="/baruu.png" alt="Logo Dinas Perpustakaan Parepare" style={{ height: '62px', width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }} onError={(e) => { e.currentTarget.src = '/baruu.png'; }} />
          <div style={{ width: '1.5px', height: '44px', background: 'rgba(255,255,255,0.2)' }} />
          <img src="/logo-ilkom.png" alt="Logo Ilmu Komputer ITH" style={{ height: '62px', width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }} onError={(e) => { e.currentTarget.src = '/logo ilkom.jpg'; }} />
        </div>
        <h1>Selamat Datang di Perpustakaan Umum Kota Parepare</h1>
        <p>Sistem layanan perpustakaan pintar & pemesanan buku digital</p>
      </div>
      
      <div className="features-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', maxWidth: '900px', width: '100%', margin: '2rem auto 0' }}>
        <div className="feature-card glass-panel" onClick={() => navigate('/qr-system')} style={{ cursor: 'pointer', transition: 'all 0.25s ease' }}>
          <div className="feature-icon-wrapper" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(139, 92, 246, 0.25))', color: '#818cf8', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.2)' }}>
            <BookOpen size={32} />
          </div>
          <h3 style={{ fontWeight: '800', fontSize: '1.3rem', color: '#ffffff', marginBottom: '0.3rem' }}>Pesan Pinjam Buku</h3>
          <p style={{ color: '#cbd5e1', fontWeight: '500', lineHeight: 1.6 }}>Scan QR di meja Anda, pilih buku dari katalog digital, staf kami akan menyiapkannya untuk Anda.</p>
        </div>

        <div className="feature-card glass-panel" onClick={() => navigate('/ebooks')} style={{ cursor: 'pointer', transition: 'all 0.25s ease' }}>
          <div className="feature-icon-wrapper" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(6, 182, 212, 0.25))', color: '#34d399', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.2)' }}>
            <BookOpen size={32} />
          </div>
          <h3 style={{ fontWeight: '800', fontSize: '1.3rem', color: '#ffffff', marginBottom: '0.3rem' }}>Baca E-Book Online</h3>
          <p style={{ color: '#cbd5e1', fontWeight: '500', lineHeight: 1.6 }}>900+ koleksi buku digital resmi (Novel, Biografi, Inspirasi, Tips & Trik, Bacaan Anak). Baca langsung gratis di HP.</p>
        </div>

        <div className="feature-card glass-panel" onClick={() => navigate('/lost-found')} style={{ cursor: 'pointer', transition: 'all 0.25s ease' }}>
          <div className="feature-icon-wrapper" style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.25))', color: '#fbbf24', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.2)' }}>
            <Package size={32} />
          </div>
          <h3 style={{ fontWeight: '800', fontSize: '1.3rem', color: '#ffffff', marginBottom: '0.3rem' }}>Barang Tertinggal</h3>
          <p style={{ color: '#cbd5e1', fontWeight: '500', lineHeight: 1.6 }}>Pemberitahuan barang tertinggal di perpustakaan dalam bentuk tulisan teks. Cek dan ambil di meja staf.</p>
        </div>

        <div 
          className="feature-card glass-panel" 
          onClick={() => window.open('https://wa.me/6285111357372?text=Halo%20Admin%20Perpustakaan%20Umum%20Kota%20Parepare,%20saya%20ingin%20menyampaikan%20pengaduan%20/%20pertanyaan.', '_blank')} 
          style={{ cursor: 'pointer', transition: 'all 0.25s ease' }}
          title="Klik untuk membuka WhatsApp Layanan Pengaduan"
        >
          <div className="feature-icon-wrapper" style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(244, 63, 94, 0.25))', color: '#f87171', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.2)' }}>
            <MessageCircle size={32} />
          </div>
          <h3 style={{ fontWeight: '800', fontSize: '1.3rem', color: '#ffffff', marginBottom: '0.3rem' }}>Layanan Pengaduan</h3>
          <p style={{ color: '#cbd5e1', fontWeight: '500', lineHeight: 1.6 }}>Hubungi staf / admin perpustakaan via WhatsApp: <strong style={{ color: '#fca5a5' }}>085 111 357 372</strong> untuk bantuan & kritik saran.</p>
        </div>
      </div>
    </div>
  );
}

export default Home;

