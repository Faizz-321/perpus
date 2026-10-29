import { useState, useEffect, useRef } from 'react';
import { Package, Search, Plus, CheckCircle2, Clock, MapPin, AlertCircle, ShieldCheck, Phone, HelpCircle, Database, Check } from 'lucide-react';
import { useModal } from '../context/ModalContext';

function LostFound() {
  const { showAlert } = useModal();
  // 'found' (Ditemukan staf), 'lost_reports' (Laporan pengunjung), 'claimed' (Sudah diambil), 'report' (Form)
  const [activeTab, setActiveTab] = useState('found');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDbConnected, setIsDbConnected] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Refs untuk navigasi otomatis tombol Enter ke bawah
  const itemNameRef = useRef(null);
  const locationRef = useRef(null);
  const descriptionRef = useRef(null);
  const contactRef = useRef(null);

  // Form lapor kehilangan dari pengunjung
  const [formData, setFormData] = useState({
    item_name: '',
    location: '',
    description: '',
    contact: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/lost-found');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setItems(data);
          setIsDbConnected(true);
          setLoading(false);
          return;
        }
      }
      throw new Error('Format respon tidak valid');
    } catch (e) {
      console.warn('Backend offline / menggunakan data contoh:', e.message);
      setIsDbConnected(false);
      // Hanya gunakan fallback jika items masih kosong
      setItems(prev => {
        if (prev.length > 0) return prev;
        return [
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
        ];
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    const interval = setInterval(fetchItems, 4000); // Polling otomatis tiap 4 detik
    return () => clearInterval(interval);
  }, []);

  // Navigasi otomatis tombol Enter ke kolom bawahnya
  const handleEnterKeyDown = (e, nextRef) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextRef && nextRef.current) {
        nextRef.current.focus();
      }
    }
  };

  const handleTextareaEnter = (e, nextRef) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (nextRef && nextRef.current) {
        nextRef.current.focus();
      }
    }
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!formData.item_name.trim()) {
      showAlert('Nama atau jenis barang wajib diisi!', { type: 'warning', title: 'Data Belum Lengkap' });
      itemNameRef.current?.focus();
      return;
    }
    if (!formData.location.trim()) {
      showAlert('Lokasi terakhir Anda berada wajib diisi!', { type: 'warning', title: 'Data Belum Lengkap' });
      locationRef.current?.focus();
      return;
    }
    const cleanPhone = formData.contact.replace(/[^0-9]/g, '');
    if (!cleanPhone) {
      showAlert('Nomor telepon / WhatsApp wajib diisi (hanya angka) agar staf perpustakaan dapat menghubungi Anda!', {
        type: 'warning',
        title: 'Nomor Telepon Wajib Diisi'
      });
      contactRef.current?.focus();
      return;
    }
    if (cleanPhone.length < 9) {
      showAlert('Nomor telepon harus berupa angka yang valid (minimal 9 digit angka, contoh: 081234567890)!', {
        type: 'warning',
        title: 'Nomor Telepon Kurang Lengkap'
      });
      contactRef.current?.focus();
      return;
    }

    try {
      const res = await fetch('/api/lost-found', {
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

      if (res.ok) {
        showAlert('Laporan kehilangan Anda berhasil disimpan ke database perpustakaan! Staf akan segera memantau area tersebut.', {
          type: 'success',
          title: 'Laporan Berhasil Disimpan'
        });
        setIsSubmitted(true);
        setFormData({ item_name: '', location: '', description: '', contact: '' });
        fetchItems();
      } else {
        const errData = await res.json().catch(() => ({}));
        showAlert(errData.error || 'Gagal mengirim laporan. Silakan coba lagi.', {
          type: 'danger',
          title: 'Gagal Mengirim'
        });
      }
    } catch (e) {
      console.warn('Gagal simpan laporan ke server:', e.message);
      // Simpan lokal sementara jika backend offline
      const tempItem = {
        id: Date.now(),
        item_name: formData.item_name,
        type: 'lost',
        location: formData.location,
        description: formData.description,
        contact: formData.contact,
        report_date: new Date().toISOString(),
        status: 'unclaimed'
      };
      setItems(prev => [tempItem, ...prev]);
      setIsSubmitted(true);
      setFormData({ item_name: '', location: '', description: '', contact: '' });
      showAlert('Laporan dicatat secara lokal (server sedang offline).', {
        type: 'info',
        title: 'Tersimpan Lokal'
      });
    }
  };

  // Filter kategori
  // 1. Barang temuan staf (belum diambil)
  const staffFoundItems = items.filter(i => (i.type === 'found' || !i.type) && i.status !== 'claimed');
  // 2. Laporan kehilangan dari pengunjung (belum ditemukan/diambil)
  const userReportItems = items.filter(i => i.type === 'lost' && i.status !== 'claimed');
  // 3. Barang yang sudah diserahkan / diklaim
  const claimedItems = items.filter(i => i.status === 'claimed');

  // Filter berdasarkan pencarian teks
  const getActiveList = () => {
    if (activeTab === 'found') return staffFoundItems;
    if (activeTab === 'lost_reports') return userReportItems;
    if (activeTab === 'claimed') return claimedItems;
    return [];
  };

  const displayedItems = getActiveList().filter(item => {
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

  // Masking nomor telepon untuk privasi pengunjung di tampilan publik
  const maskPhone = (phone) => {
    if (!phone) return '-';
    const clean = phone.replace(/[^0-9]/g, '');
    if (clean.length <= 6) return phone;
    return clean.slice(0, 4) + '****' + clean.slice(-4);
  };

  return (
    <div className="glass-panel lf-panel" style={{ maxWidth: '950px', margin: '0 auto' }}>
      {/* Header Halaman */}
      <div className="page-header" style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(99, 102, 241, 0.15)', padding: '4px 14px', borderRadius: '20px', color: 'var(--primary-color)', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.8rem' }}>
          <ShieldCheck size={16} /> Layanan Amanah Perpustakaan
        </div>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
          Pemberitahuan Barang Tertinggal & Kehilangan
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '680px', margin: '0 auto' }}>
          Sistem informasi terpadu barang tertinggal dan pelaporan kehilangan di <strong>Perpustakaan Umum Kota Parepare</strong>. Data tersambung langsung ke database staf.
        </p>

        {/* Database Status Tag */}
        <div style={{ marginTop: '0.8rem', display: 'flex', justifyContent: 'center' }}>
          <span style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '6px', 
            fontSize: '0.75rem', 
            fontWeight: '600',
            padding: '3px 10px', 
            borderRadius: '12px',
            background: isDbConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            color: isDbConnected ? 'var(--success)' : 'var(--warning)',
            border: `1px solid ${isDbConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
          }}>
            <Database size={12} />
            {isDbConnected ? 'Database MySQL XAMPP Terhubung' : 'Mode Offline / Memuat...'}
          </span>
        </div>
      </div>

      {/* Banner Informasi & Tata Cara */}
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
          <strong>Barang Anda tertinggal?</strong> Periksa tab <strong>Barang Ditemukan Staf</strong> atau laporkan di tab <strong>Lapor Kehilangan</strong>. Untuk serah terima barang, silakan datangi <strong>Meja Pelayanan Staf</strong> dengan menyebutkan ciri barang.
        </div>
      </div>

      {/* Tab Navigasi 4 Opsi Lengkap */}
      <div className="lf-tab-container" style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.8rem', flexWrap: 'wrap' }}>
        <button 
          className={`btn lf-tab-btn ${activeTab === 'found' ? '' : 'btn-secondary'}`}
          style={{ 
            flex: '1 1 180px', 
            background: activeTab === 'found' ? 'var(--primary-color)' : '',
            justifyContent: 'center',
            padding: '0.65rem 0.9rem',
            fontSize: '0.88rem'
          }}
          onClick={() => { setActiveTab('found'); setIsSubmitted(false); }}
        >
          <Package size={17} /> 
          <span>Ditemukan Staf ({staffFoundItems.length})</span>
        </button>

        <button 
          className={`btn lf-tab-btn ${activeTab === 'lost_reports' ? '' : 'btn-secondary'}`}
          style={{ 
            flex: '1 1 180px', 
            background: activeTab === 'lost_reports' ? '#3b82f6' : '',
            borderColor: activeTab === 'lost_reports' ? '#3b82f6' : '',
            justifyContent: 'center',
            padding: '0.65rem 0.9rem',
            fontSize: '0.88rem'
          }}
          onClick={() => { setActiveTab('lost_reports'); setIsSubmitted(false); }}
        >
          <HelpCircle size={17} /> 
          <span>Laporan Pengunjung ({userReportItems.length})</span>
        </button>

        <button 
          className={`btn lf-tab-btn ${activeTab === 'claimed' ? '' : 'btn-secondary'}`}
          style={{ 
            flex: '1 1 180px', 
            background: activeTab === 'claimed' ? '#10b981' : '',
            borderColor: activeTab === 'claimed' ? '#10b981' : '',
            justifyContent: 'center',
            padding: '0.65rem 0.9rem',
            fontSize: '0.88rem'
          }}
          onClick={() => { setActiveTab('claimed'); setIsSubmitted(false); }}
        >
          <CheckCircle2 size={17} /> 
          <span>Sudah Diambil ({claimedItems.length})</span>
        </button>

        <button 
          className={`btn lf-tab-btn ${activeTab === 'report' ? '' : 'btn-secondary'}`}
          style={{ 
            flex: '0 0 auto',
            background: activeTab === 'report' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '',
            borderColor: activeTab === 'report' ? '#f59e0b' : '',
            justifyContent: 'center',
            padding: '0.65rem 1.2rem',
            fontWeight: '700',
            fontSize: '0.88rem'
          }}
          onClick={() => setActiveTab('report')}
        >
          <Plus size={17} /> 
          <span>Lapor Kehilangan</span>
        </button>
      </div>

      {/* Konten Tab 1, 2, 3: Daftar Barang */}
      {activeTab !== 'report' && (
        <div>
          {/* Bar Pencarian */}
          <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="form-control" 
              placeholder={
                activeTab === 'found'
                  ? 'Cari barang temuan staf (misal: cas hp, tumbler, dompet, kunci)...'
                  : activeTab === 'lost_reports'
                  ? 'Cari laporan barang hilang pengunjung...'
                  : 'Cari riwayat barang yang sudah diambil...'
              }
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

          {/* List Barang */}
          {displayedItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '14px', border: '1px solid var(--surface-border)' }}>
              <Package size={44} style={{ color: 'var(--text-muted)', margin: '0 auto 0.8rem auto' }} />
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.4rem' }}>
                {activeTab === 'found' && 'Tidak Ada Barang Tertinggal di Meja Staf'}
                {activeTab === 'lost_reports' && 'Belum Ada Laporan Barang Hilang dari Pengunjung'}
                {activeTab === 'claimed' && 'Belum Ada Riwayat Barang yang Diserahkan'}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                {searchQuery
                  ? `Tidak ada hasil pencarian untuk "${searchQuery}".`
                  : activeTab === 'found'
                  ? 'Semua barang pengunjung terpantau aman dan rapi.'
                  : activeTab === 'lost_reports'
                  ? 'Gunakan tombol "Lapor Kehilangan" di atas jika ada barang Anda yang tercecer.'
                  : 'Barang yang telah berhasil diambil pemilik sah akan tercatat di sini.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {displayedItems.map((item) => (
                <div 
                  key={item.id}
                  style={{
                    background: 'linear-gradient(135deg, rgba(25, 30, 46, 0.9), rgba(18, 22, 36, 0.95))',
                    border: item.status === 'claimed' 
                      ? '1px solid rgba(16, 185, 129, 0.3)' 
                      : item.type === 'lost'
                      ? '1.5px solid rgba(59, 130, 246, 0.35)'
                      : '1.5px solid rgba(99, 102, 241, 0.3)',
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
                        background: item.type === 'lost' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(99, 102, 241, 0.2)', 
                        color: item.type === 'lost' ? '#93c5fd' : '#c7d2fe', 
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
                          <CheckCircle2 size={14} /> Sudah Diserahkan
                        </span>
                      ) : item.type === 'lost' ? (
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '5px', 
                          background: 'rgba(59, 130, 246, 0.2)', 
                          color: '#60a5fa', 
                          fontSize: '0.8rem', 
                          fontWeight: '700', 
                          padding: '4px 12px', 
                          borderRadius: '20px', 
                          border: '1px solid rgba(59, 130, 246, 0.4)'
                        }}>
                          <Clock size={14} /> Sedang Dicari Staf
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

                  {/* Keterangan Tulisan Teks */}
                  <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.9rem 1.1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '0.8rem' }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      {item.type === 'lost' ? 'Ciri-ciri Khusus / Keterangan Pelapor:' : 'Keterangan Staf:'}
                    </div>
                    <p style={{ fontSize: '0.92rem', color: '#f1f5f9', margin: 0, lineHeight: '1.5' }}>
                      {item.description || (item.type === 'lost' ? 'Tidak ada ciri tambahan.' : 'Barang tertinggal di area perpustakaan dan disimpan aman di meja staf pelayanan.')}
                    </p>
                  </div>

                  {/* Footer Informasi & Waktu */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={13} /> {item.type === 'lost' ? 'Dilaporkan pada:' : 'Ditemukan pada:'} <strong>{formatDate(item.report_date)}</strong>
                    </div>

                    {item.status === 'claimed' ? (
                      <div style={{ color: 'var(--success)', fontWeight: '600' }}>
                        Diambil oleh: <strong>{item.claimed_by || 'Pemilik Sah'}</strong> ({formatDateTime(item.claimed_at)})
                      </div>
                    ) : item.type === 'lost' ? (
                      <div style={{ color: '#93c5fd', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Phone size={13} /> Kontak: {maskPhone(item.contact)} (Staf akan mengabari)
                      </div>
                    ) : (
                      <div style={{ color: '#a5b4fc', fontWeight: '600' }}>
                        Silakan datangi Meja Staf untuk serah terima
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Konten Tab 4: Form Lapor Barang Hilang dari Pengunjung */}
      {activeTab === 'report' && (
        <div style={{ maxWidth: '600px', margin: '0 auto', background: 'rgba(0,0,0,0.25)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--surface-border)' }}>
          {isSubmitted ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div style={{ width: '64px', height: '64px', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.2rem auto' }}>
                <CheckCircle2 size={36} />
              </div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '0.4rem' }}>Laporan Berhasil Dicatat di Database!</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                Informasi kehilangan Anda telah tersimpan di sistem perpustakaan. Staf akan memeriksa lokasi yang Anda sebutkan dan langsung menghubungi nomor kontak Anda jika barang ditemukan.
              </p>
              
              <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', marginTop: '1.8rem', flexWrap: 'wrap' }}>
                <button 
                  className="btn" 
                  style={{ background: '#3b82f6', fontSize: '0.88rem', padding: '0.65rem 1.2rem' }} 
                  onClick={() => { setIsSubmitted(false); setActiveTab('lost_reports'); }}
                >
                  Lihat Daftar Laporan Kehilangan
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ fontSize: '0.88rem', padding: '0.65rem 1.2rem' }} 
                  onClick={() => setIsSubmitted(false)}
                >
                  Buat Laporan Lain
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitReport}>
              <div style={{ marginBottom: '1.2rem' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '0.3rem' }}>Lapor Barang Hilang / Ketinggalan</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Jika barang Anda tertinggal di area perpustakaan, isi formulir ini agar langsung masuk ke dashboard staf:
                </p>
              </div>

              <div className="form-group" style={{ marginBottom: '1.1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                  Nama / Jenis Barang <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input 
                  ref={itemNameRef}
                  type="text" 
                  className="form-control" 
                  placeholder="Contoh: Cas HP Samsung Type-C Hitam, Flashdisk Kingston, Tumbler..." 
                  required
                  value={formData.item_name}
                  onChange={e => setFormData({ ...formData, item_name: e.target.value })}
                  onKeyDown={e => handleEnterKeyDown(e, locationRef)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                  Lokasi Terakhir Anda Berada <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input 
                  ref={locationRef}
                  type="text" 
                  className="form-control" 
                  placeholder="Contoh: Meja 4 (Lantai 1) atau Ruang Baca Sastra" 
                  required
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  onKeyDown={e => handleEnterKeyDown(e, descriptionRef)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                  Ciri-ciri Khusus (Keterangan Tambahan)
                </label>
                <textarea 
                  ref={descriptionRef}
                  className="form-control" 
                  rows={3}
                  placeholder="Contoh: Kabelnya ada isolasi putih sedikit, di cas ada stiker kecil..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  onKeyDown={e => handleTextareaEnter(e, contactRef)}
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Tekan <strong>Enter</strong> untuk pindah ke kolom nomor kontak, atau <strong>Shift + Enter</strong> untuk baris baru.
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                  <span>
                    Nomor WhatsApp / Kontak Anda <span style={{ color: '#ef4444' }}>* (Wajib Diisi)</span>
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: '700' }}>
                    ● Staf akan langsung mengabari
                  </span>
                </label>
                <input 
                  ref={contactRef}
                  type="text" 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={15}
                  className="form-control" 
                  placeholder="Contoh: 081234567890 (Hanya angka)" 
                  required
                  value={formData.contact}
                  onKeyDown={e => {
                    if (
                      ['Backspace', 'Tab', 'Enter', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) ||
                      (e.ctrlKey || e.metaKey)
                    ) {
                      return;
                    }
                    if (!/^[0-9]$/.test(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  onChange={e => {
                    const onlyDigits = e.target.value.replace(/[^0-9]/g, '');
                    setFormData({ ...formData, contact: onlyDigits });
                  }}
                />
              </div>

              <button type="submit" className="btn" style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontSize: '0.95rem', background: 'var(--primary-color)' }}>
                <Plus size={18} /> Kirimkan Laporan ke Database Staf
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default LostFound;
