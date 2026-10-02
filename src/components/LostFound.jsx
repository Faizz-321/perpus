import { useState, useEffect } from 'react';
import { Package, Search, Plus, CheckCircle2, Clock, MapPin, AlertCircle, ArrowRight, ShieldCheck, Check, Sparkles } from 'lucide-react';

function LostFound() {
  const [activeTab, setActiveTab] = useState('found'); // 'found' (tersedia di staf), 'claimed' (sudah diambil), 'report' (lapor kehilangan)
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Form lapor kehilangan dari pengunjung
  const [formData, setFormData] = useState({
    item_name: '',
    location: '',
    description: '',
    contact: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/lost-found');
      if (res.ok) {
        const data = await res.json();
        setItems(data);
        return;
      }
    } catch (e) {
      console.warn('Backend offline, menggunakan data contoh:', e.message);
    } finally {
      setLoading(false);
    }

    // Data fallback jika offline
    setItems([
      {
        id: 1,
        item_name: 'Cas HP Samsung Type-C Hitam',
        type: 'found',
        location: 'Meja 4 (Lantai 1)',
        description: 'Tertinggal di colokan bawah meja 4 setelah jam baca siang. Tersimpan aman di meja staf perpustakaan.',
        report_date: new Date().toISOString(),
        status: 'unclaimed'
      },
      {
        id: 2,
        item_name: 'Tumbler Stainless Biru Dongker',
        type: 'found',
        location: 'Meja 12 (Zona Baca Tenang)',
        description: 'Tertinggal di sudut meja dekat rak majalah. Berisi air minum setengah.',
        report_date: new Date().toISOString(),
        status: 'unclaimed'
      },
      {
        id: 3,
        item_name: 'Kacamata Baca Frame Hitam',
        type: 'found',
        location: 'Area Lemari 3 (Sastra)',
        description: 'Ditemukan di dekat rak 2 novel fiksi.',
        report_date: new Date().toISOString(),
        status: 'unclaimed'
      }
    ]);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
    const interval = setInterval(fetchItems, 5000); // Polling otomatis tiap 5 detik
    return () => clearInterval(interval);
  }, []);

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!formData.item_name || !formData.location) return;

    try {
      await fetch('http://localhost:5000/api/lost-found', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_name: formData.item_name,
          type: 'lost',
          location: formData.location,
          description: formData.description,
          contact: formData.contact
        })
      });
      fetchItems();
    } catch (e) {
      console.warn('Gagal simpan laporan:', e.message);
    }

    setIsSubmitted(true);
    setFormData({ item_name: '', location: '', description: '', contact: '' });
  };

  // Filter barang temuan yang belum diambil
  const unclaimedItems = items.filter(i => (i.type === 'found' || !i.type) && i.status !== 'claimed');
  // Filter barang yang sudah diambil pemilik
  const claimedItems = items.filter(i => i.status === 'claimed');

  // Filter berdasarkan pencarian teks
  const displayedItems = (activeTab === 'found' ? unclaimedItems : claimedItems).filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchName = item.item_name && item.item_name.toLowerCase().includes(q);
    const matchLoc = item.location && item.location.toLowerCase().includes(q);
    const matchDesc = item.description && item.description.toLowerCase().includes(q);
    return matchName || matchLoc || matchDesc;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Hari ini';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'Baru saja';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="glass-panel" style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Header Halaman */}
      <div className="page-header" style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(99, 102, 241, 0.15)', padding: '4px 14px', borderRadius: '20px', color: 'var(--primary-color)', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.8rem' }}>
          <ShieldCheck size={16} /> Layanan Amanah Perpustakaan
        </div>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
          Pemberitahuan Barang Tertinggal
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '650px', margin: '0 auto' }}>
          Informasi barang yang ditemukan oleh staf di area <strong>Perpustakaan Umum Kota Parepare</strong>. Cukup periksa rincian tulisan di bawah ini dan ambil di Meja Pelayanan Staf.
        </p>
      </div>

      {/* Banner Informasi & Tata Cara Pengambilan */}
      <div style={{ 
        background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.85))', 
        border: '1.5px solid rgba(99, 102, 241, 0.3)', 
        borderRadius: '16px', 
        padding: '1.2rem 1.4rem', 
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        boxShadow: '0 8px 20px rgba(0,0,0,0.25)'
      }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.25)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <AlertCircle size={24} />
        </div>
        <div style={{ fontSize: '0.88rem', lineHeight: '1.5', color: '#e2e8f0' }}>
          <strong>Barang Anda tertinggal?</strong> Silakan datang langsung ke <strong>Meja Pelayanan Staf Perpustakaan</strong> dengan menyebutkan ciri barang. Demi keamanan, staf akan <strong>mengambil foto Anda saat serah terima</strong> sebagai tanda bukti sah bahwa barang sudah diserahkan.
        </div>
      </div>

      {/* Tab Navigasi */}
      <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '1.8rem', flexWrap: 'wrap' }}>
        <button 
          className={`btn ${activeTab === 'found' ? '' : 'btn-secondary'}`}
          style={{ 
            flex: 1, 
            minWidth: '200px',
            background: activeTab === 'found' ? 'var(--primary-color)' : '',
            justifyContent: 'center',
            padding: '0.65rem 1rem'
          }}
          onClick={() => { setActiveTab('found'); setIsSubmitted(false); }}
        >
          <Package size={18} /> 
          <span>Barang Tertinggal Aktif ({unclaimedItems.length})</span>
        </button>

        <button 
          className={`btn ${activeTab === 'claimed' ? '' : 'btn-secondary'}`}
          style={{ 
            flex: 1, 
            minWidth: '200px',
            background: activeTab === 'claimed' ? 'var(--primary-color)' : '',
            justifyContent: 'center',
            padding: '0.65rem 1rem'
          }}
          onClick={() => { setActiveTab('claimed'); setIsSubmitted(false); }}
        >
          <CheckCircle2 size={18} /> 
          <span>Riwayat Sudah Diambil ({claimedItems.length})</span>
        </button>

        <button 
          className={`btn ${activeTab === 'report' ? '' : 'btn-secondary'}`}
          style={{ 
            flex: '0 0 auto',
            background: activeTab === 'report' ? 'var(--primary-color)' : '',
            justifyContent: 'center',
            padding: '0.65rem 1.2rem'
          }}
          onClick={() => setActiveTab('report')}
        >
          <Plus size={18} /> 
          <span>Lapor Kehilangan</span>
        </button>
      </div>

      {/* Konten Tab 1 & 2: Daftar Barang Temuan (Hanya Bentuk Tulisan) */}
      {(activeTab === 'found' || activeTab === 'claimed') && (
        <div>
          {/* Bar Pencarian */}
          <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Cari nama barang (misal: cas hp, tumbler, kacamata, buku) atau lokasi meja..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '3rem', fontSize: '0.92rem' }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            )}
          </div>

          {/* List Barang dalam Bentuk Teks Rapi */}
          {displayedItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '14px', border: '1px solid var(--surface-border)' }}>
              <Package size={44} style={{ color: 'var(--text-muted)', margin: '0 auto 0.8rem auto' }} />
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.4rem' }}>
                {activeTab === 'found' ? 'Tidak Ada Barang Tertinggal' : 'Belum Ada Riwayat Serah Terima'}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                {searchQuery ? `Tidak ada hasil pencarian untuk "${searchQuery}".` : (activeTab === 'found' ? 'Semua barang pengunjung terpantau aman dan rapi.' : 'Barang yang telah diambil pemilik akan dicatat di sini.')}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {displayedItems.map((item) => (
                <div 
                  key={item.id}
                  style={{
                    background: 'linear-gradient(135deg, rgba(25, 30, 46, 0.9), rgba(18, 22, 36, 0.95))',
                    border: item.status === 'claimed' ? '1px solid rgba(16, 185, 129, 0.3)' : '1.5px solid rgba(99, 102, 241, 0.3)',
                    borderRadius: '14px',
                    padding: '1.3rem 1.4rem',
                    boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
                    transition: 'transform 0.2s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '0.6rem' }}>
                    <div>
                      {/* Lokasi Meja Badge */}
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '4px', 
                        background: 'rgba(99, 102, 241, 0.2)', 
                        color: '#c7d2fe', 
                        fontSize: '0.75rem', 
                        fontWeight: '700', 
                        padding: '3px 9px', 
                        borderRadius: '6px',
                        marginBottom: '6px'
                      }}>
                        <MapPin size={12} /> {item.location}
                      </span>

                      {/* Judul Nama Barang */}
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-main)', margin: '2px 0 4px 0' }}>
                        {item.item_name}
                      </h3>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {item.status === 'claimed' ? (
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '5px', 
                          background: 'rgba(16, 185, 129, 0.2)', 
                          color: 'var(--success)', 
                          fontSize: '0.8rem', 
                          fontWeight: '700', 
                          padding: '4px 12px', 
                          borderRadius: '20px',
                          border: '1px solid rgba(16, 185, 129, 0.4)'
                        }}>
                          <CheckCircle2 size={14} /> Sudah Diambil Pemilik
                        </span>
                      ) : (
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '5px', 
                          background: 'rgba(245, 158, 11, 0.18)', 
                          color: '#facc15', 
                          fontSize: '0.8rem', 
                          fontWeight: '700', 
                          padding: '4px 12px', 
                          borderRadius: '20px',
                          border: '1px solid rgba(245, 158, 11, 0.4)'
                        }}>
                          <Clock size={14} /> Tersedia di Meja Staf
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Keterangan Tulisan Teks dari Staf */}
                  <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.9rem 1.1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '0.8rem' }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Keterangan Staf:
                    </div>
                    <p style={{ fontSize: '0.92rem', color: '#f1f5f9', margin: 0, lineHeight: '1.5' }}>
                      {item.description || 'Barang tertinggal di area perpustakaan dan disimpan aman di meja staf pelayanan.'}
                    </p>
                  </div>

                  {/* Footer Informasi & Waktu */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={13} /> Ditemukan pada: <strong>{formatDate(item.report_date)}</strong>
                    </div>

                    {item.status === 'claimed' ? (
                      <div style={{ color: 'var(--success)', fontWeight: '600' }}>
                        ✓ Diambil oleh: <strong>{item.claimed_by || 'Pemilik Sah'}</strong> ({formatDateTime(item.claimed_at)})
                      </div>
                    ) : (
                      <div style={{ color: '#a5b4fc', fontWeight: '600' }}>
                        👉 Silakan datangi Meja Staf untuk serah terima
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Konten Tab 3: Form Lapor Barang Hilang dari Pengunjung */}
      {activeTab === 'report' && (
        <div style={{ maxWidth: '580px', margin: '0 auto', background: 'rgba(0,0,0,0.25)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--surface-border)' }}>
          {isSubmitted ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div style={{ width: '64px', height: '64px', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.2rem auto' }}>
                <CheckCircle2 size={36} />
              </div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '0.4rem' }}>Laporan Berhasil Dicatat!</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                Informasi kehilangan Anda telah masuk ke sistem. Staf perpustakaan akan memeriksa area yang Anda sebutkan dan menghubungi Anda jika barang ditemukan.
              </p>
              <button 
                className="btn btn-secondary" 
                style={{ marginTop: '1.5rem', fontSize: '0.88rem' }} 
                onClick={() => { setIsSubmitted(false); setActiveTab('found'); }}
              >
                Lihat Daftar Barang Temuan
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmitReport}>
              <div style={{ marginBottom: '1.2rem' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '0.3rem' }}>Lapor Barang Hilang / Ketinggalan</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Jika barang Anda tertinggal dan belum tercantum di daftar temuan, silakan isi formulir tulisan ini:
                </p>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                  Nama / Jenis Barang
                </label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Contoh: Cas HP Samsung Type-C Hitam, Flashdisk Kingston, dll." 
                  required
                  value={formData.item_name}
                  onChange={e => setFormData({ ...formData, item_name: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                  Lokasi Terakhir Anda Berada
                </label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Contoh: Meja 4 (Lantai 1) atau Ruang Baca Sastra" 
                  required
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                  Ciri-ciri Khusus (Teks Tambahan)
                </label>
                <textarea 
                  className="form-control" 
                  rows={3}
                  placeholder="Contoh: Kabelnya ada isolasi putih sedikit, di cas ada stiker kecil..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                  Nomor WhatsApp / Kontak Anda (Agar Staf Bisa Hubungi)
                </label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Contoh: 081234567890" 
                  value={formData.contact}
                  onChange={e => setFormData({ ...formData, contact: e.target.value })}
                />
              </div>

              <button type="submit" className="btn" style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontSize: '0.95rem', background: 'var(--primary-color)' }}>
                <Plus size={18} /> Kirimkan Laporan ke Staf
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default LostFound;
