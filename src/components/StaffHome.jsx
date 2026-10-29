import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Ticket, 
  BookOpen, 
  Sparkles, 
  Package, 
  BarChart3, 
  BookPlus, 
  ShieldCheck,
  Clock,
  ArrowRight
} from 'lucide-react';

export default function StaffHome({ onSelectModule, ordersCount = 0, booksCount = 0, lfCount = 0 }) {
  const navigate = useNavigate();

  const handleCardClick = (moduleKey) => {
    if (typeof onSelectModule === 'function') {
      onSelectModule(moduleKey);
    } else {
      if (moduleKey === 'ebooks') {
        navigate('/ebooks');
      } else {
        navigate(`/staff?tab=${moduleKey}`);
      }
    }
  };

  const staffModules = [
    {
      id: 'orders',
      title: 'Antrean Pesanan Masuk',
      badge: 'Live Meja Pengunjung',
      badgeColor: '#818cf8',
      badgeBg: 'rgba(99, 102, 241, 0.18)',
      icon: Ticket,
      iconColor: '#818cf8',
      iconBg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(139, 92, 246, 0.25))',
      iconBorder: 'rgba(129, 140, 248, 0.4)',
      description: 'Pantau tiket pemesanan buku dari meja pengunjung secara real-time, siapkan buku fisik di rak, dan bunyikan panggilan suara otomatis ke pengunjung.'
    },
    {
      id: 'books',
      title: 'Katalog Buku Fisik',
      badge: booksCount > 0 ? `${booksCount} Judul Koleksi` : 'Koleksi Fisik',
      badgeColor: '#38bdf8',
      badgeBg: 'rgba(14, 165, 233, 0.18)',
      icon: BookOpen,
      iconColor: '#38bdf8',
      iconBg: 'linear-gradient(135deg, rgba(14, 165, 233, 0.25), rgba(56, 189, 248, 0.25))',
      iconBorder: 'rgba(56, 189, 248, 0.4)',
      description: 'Kelola data inventaris buku cetak perpustakaan, pencarian lokasi rak fisik, kontrol ketersediaan stok eksemplar, serta pembaruan foto sampul.'
    },
    {
      id: 'ebooks',
      title: 'Katalog E-Book Digital',
      badge: '900+ Koleksi E-Book',
      badgeColor: '#34d399',
      badgeBg: 'rgba(16, 185, 129, 0.18)',
      icon: Sparkles,
      iconColor: '#34d399',
      iconBg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(6, 182, 212, 0.25))',
      iconBorder: 'rgba(52, 211, 153, 0.4)',
      description: 'Akses dan kelola seluruh koleksi buku digital resmi perpustakaan, baca online langsung untuk staf, serta kelola dan hapus e-book perpustakaan.'
    },
    {
      id: 'lost_found',
      title: 'Barang Tertinggal (Lost & Found)',
      badge: lfCount > 0 ? `${lfCount} Barang Terdata` : 'Layanan Barang',
      badgeColor: '#fbbf24',
      badgeBg: 'rgba(245, 158, 11, 0.18)',
      icon: Package,
      iconColor: '#fbbf24',
      iconBg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.25))',
      iconBorder: 'rgba(251, 191, 36, 0.4)',
      description: 'Publikasikan pengumuman barang tertinggal di perpustakaan, tangani laporan kehilangan pengunjung via respon WhatsApp, dan serah terima berfoto sah.'
    },
    {
      id: 'rekap',
      title: 'Rekapitulasi Pelayanan',
      badge: 'Ekspor Excel Resmi',
      badgeColor: '#f43f5e',
      badgeBg: 'rgba(244, 63, 94, 0.18)',
      icon: BarChart3,
      iconColor: '#f43f5e',
      iconBg: 'linear-gradient(135deg, rgba(244, 63, 94, 0.25), rgba(225, 29, 72, 0.25))',
      iconBorder: 'rgba(244, 63, 94, 0.4)',
      description: 'Rekapitulasi data pelayanan peminjaman buku fisik dan pembaca e-book per hari, per bulan, dan per tahun dengan unduhan file Excel rapi terstandarisasi.'
    },
    {
      id: 'import_books',
      title: 'Import Buku Massal (AI OCR)',
      badge: 'Otomatisasi Cepat',
      badgeColor: '#a78bfa',
      badgeBg: 'rgba(167, 139, 250, 0.18)',
      icon: BookPlus,
      iconColor: '#a78bfa',
      iconBg: 'linear-gradient(135deg, rgba(167, 139, 250, 0.25), rgba(139, 92, 246, 0.25))',
      iconBorder: 'rgba(167, 139, 250, 0.4)',
      description: 'Tambah puluhan judul buku sekaligus dari file Excel/CSV atau manfaatkan fitur pemindaian OCR AI canggih untuk mencocokkan sampul buku otomatis.'
    }
  ];

  return (
    <div className="glass-panel home-hero-panel" style={{ maxWidth: '1150px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>
      {/* Header Portal Staf */}
      <div className="page-header" style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        {/* Tiga Logo Resmi */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
          <img 
            src="/Lambang.png" 
            alt="Lambang Kota Parepare" 
            style={{ height: '62px', width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }} 
          />
          <div style={{ width: '1.5px', height: '44px', background: 'rgba(255,255,255,0.2)' }} />
          <img 
            src="/logo-perpus.png" 
            alt="Logo Dinas Perpustakaan Parepare" 
            style={{ height: '62px', width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }} 
            onError={(e) => { e.currentTarget.src = '/logo perpus.jpg'; }} 
          />
          <div style={{ width: '1.5px', height: '44px', background: 'rgba(255,255,255,0.2)' }} />
          <img 
            src="/logo-ilkom.png" 
            alt="Logo Ilmu Komputer ITH" 
            style={{ height: '62px', width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }} 
            onError={(e) => { e.currentTarget.src = '/logo ilkom.jpg'; }} 
          />
        </div>

        {/* Badge Mode Staf */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 14px', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.35)', color: '#34d399', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.9rem', letterSpacing: '0.5px' }}>
          <ShieldCheck size={16} />
          <span>PORTAL OPERASIONAL STAF PERPUSTAKAAN</span>
        </div>

        <h1 style={{ fontSize: '2.1rem', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '0.5rem', lineHeight: 1.25 }}>
          Selamat Datang di Portal Staf Perpustakaan Kota Parepare
        </h1>
        <p style={{ fontSize: '0.96rem', color: '#cbd5e1', maxWidth: '680px', margin: '0 auto', lineHeight: 1.6 }}>
          Pusat kendali operasional perpustakaan, pelayanan peminjaman buku pengunjung, pengelolaan katalog buku fisik & e-book, dan rekapitulasi laporan.
        </p>
      </div>

      {/* Grid Kartu Menu Modul Staf (Gaya Desain Sama Persis dengan Halaman Pengunjung) */}
      <div 
        className="features-grid" 
        style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
          gap: '1.4rem', 
          margin: '0 auto' 
        }}
      >
        {staffModules.map((item) => {
          const IconComponent = item.icon;
          return (
            <div
              key={item.id}
              className="feature-card glass-panel"
              onClick={() => handleCardClick(item.id)}
              style={{
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                padding: '1.6rem',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(15, 23, 42, 0.65)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = item.iconColor;
                e.currentTarget.style.boxShadow = `0 12px 28px rgba(0, 0, 0, 0.4), 0 0 20px ${item.badgeBg}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div>
                {/* Baris Atas: Icon Wrapper & Badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
                  <div
                    className="feature-icon-wrapper"
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '14px',
                      background: item.iconBg,
                      border: `1px solid ${item.iconBorder}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: item.iconColor,
                      boxShadow: `0 4px 14px ${item.badgeBg}`,
                      margin: 0
                    }}
                  >
                    <IconComponent size={28} />
                  </div>

                  <span
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: '700',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: item.badgeBg,
                      color: item.badgeColor,
                      border: `1px solid ${item.iconBorder}`
                    }}
                  >
                    {item.badge}
                  </span>
                </div>

                {/* Judul Modul */}
                <h3 style={{ fontWeight: '800', fontSize: '1.25rem', color: '#ffffff', marginBottom: '0.5rem', letterSpacing: '-0.01em' }}>
                  {item.title}
                </h3>

                {/* Keterangan Tugas Staf */}
                <p style={{ color: '#cbd5e1', fontSize: '0.88rem', fontWeight: '500', lineHeight: 1.6, marginBottom: '1.2rem' }}>
                  {item.description}
                </p>
              </div>

              {/* Tombol Aksi Buka Modul */}
              <div 
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  fontSize: '0.84rem', 
                  fontWeight: '700', 
                  color: item.iconColor,
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  paddingTop: '0.9rem',
                  marginTop: 'auto'
                }}
              >
                <span>Buka Modul</span>
                <ArrowRight size={15} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
