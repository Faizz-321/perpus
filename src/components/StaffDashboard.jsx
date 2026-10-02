import { useState, useEffect } from 'react';
import { Clock, Search, CheckCircle, PackageCheck, RefreshCw, Database, Ticket, Check, Filter, Volume2, VolumeX, BellRing, Trash2 } from 'lucide-react';
import { announceTableOrder } from '../utils/soundAnnouncement';

function StaffDashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Tab Filter Status: 'all', 'in_progress', 'ready', 'completed', 'cancelled'
  const [statusFilter, setStatusFilter] = useState('all');

  // Pengaturan Suara Panggilan Speaker
  const [soundEnabled, setSoundEnabled] = useState(true);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/orders');
      if (!response.ok) throw new Error('Gagal mengambil data dari server');
      const data = await response.json();
      
      const formattedData = data.map((item) => {
        let timeStr = 'Baru saja';
        if (item.created_at) {
          const d = new Date(item.created_at);
          timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return {
          id: item.id,
          ticket_code: item.ticket_code || `TKT-${item.id + 1000}`,
          book: item.book_title || item.book,
          table: item.table_no || item.table,
          status: item.status,
          time: timeStr
        };
      });

      setOrders(formattedData);
      setIsDbConnected(true);
    } catch (err) {
      console.warn('Backend server belum menyala, menampilkan data contoh:', err.message);
      setIsDbConnected(false);
      setOrders([
        { id: 1, ticket_code: 'TKT-1001', book: 'The Design of Everyday Things', table: 'Meja 5', status: 'pending', time: '10:05' },
        { id: 2, ticket_code: 'TKT-1002', book: 'Clean Code', table: 'Meja 12', status: 'searching', time: '10:15' },
        { id: 3, ticket_code: 'TKT-1003', book: 'Atomic Habits', table: 'Meja 3', status: 'ready', time: '09:45' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 4000); // Polling otomatis tiap 4 detik
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (id, newStatus) => {
    // Optimistic UI update
    setOrders((prev) =>
      prev.map((order) => (order.id === id ? { ...order, status: newStatus } : order))
    );

    try {
      await fetch(`http://localhost:5000/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) {
      console.error('Gagal memperbarui status ke database:', err);
    }
  };

  // Ubah status ke ready dan bunyikan pengumuman suara panggilan
  const handleReadyAndAnnounce = (order) => {
    updateStatus(order.id, 'ready');
    if (soundEnabled) {
      announceTableOrder(order.table, order.ticket_code);
    }
  };

  // Hapus satu pesanan spesifik
  const handleDeleteOrder = async (id, ticketCode) => {
    if (!window.confirm(`Hapus pesanan tiket ${ticketCode} dari sistem perpustakaan?`)) return;

    // Optimistic UI update
    setOrders((prev) => prev.filter((order) => order.id !== id));

    try {
      await fetch(`http://localhost:5000/api/orders/${id}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Gagal menghapus pesanan:', err);
    }
  };

  // Bersihkan semua pesanan yang sudah selesai dan dibatalkan sekaligus
  const handleCleanupCompleted = async () => {
    const totalToClean = counts.completed + counts.cancelled;
    if (totalToClean === 0) {
      alert('Tidak ada riwayat pesanan selesai atau dibatalkan untuk dibersihkan.');
      return;
    }

    if (!window.confirm(`Bersihkan ${totalToClean} riwayat pesanan yang sudah Selesai & Dibatalkan agar antrean bersih?`)) return;

    // Optimistic UI update
    setOrders((prev) => prev.filter((o) => o.status !== 'completed' && o.status !== 'cancelled'));

    try {
      await fetch('http://localhost:5000/api/orders/cleanup/completed', {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Gagal membersihkan riwayat pesanan:', err);
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending':
        return <span className="status-badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: 'var(--warning)' }}><Clock size={12} style={{display: 'inline', marginRight: '4px'}}/> Menunggu</span>;
      case 'searching':
        return <span className="status-badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: 'var(--primary-color)' }}><Search size={12} style={{display: 'inline', marginRight: '4px'}}/> Sedang Dicari</span>;
      case 'ready':
        return <span className="status-badge" style={{ background: 'rgba(16, 185, 129, 0.25)', color: 'var(--success)', border: '1px solid var(--success)' }}><CheckCircle size={12} style={{display: 'inline', marginRight: '4px'}}/> Siap Diambil</span>;
      case 'completed':
        return <span className="status-badge" style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)' }}><PackageCheck size={12} style={{display: 'inline', marginRight: '4px'}}/> Selesai (Diserahkan)</span>;
      case 'cancelled':
        return <span className="status-badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)' }}>Dibatalkan</span>;
      default:
        return null;
    }
  };

  // Hitung jumlah data per status untuk badge filter
  const counts = {
    all: orders.length,
    in_progress: orders.filter(o => o.status === 'pending' || o.status === 'searching').length,
    ready: orders.filter(o => o.status === 'ready').length,
    completed: orders.filter(o => o.status === 'completed').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  };

  // Filter gabungan (Tab Status + Kata Kunci Pencarian)
  const filteredOrders = orders.filter(order => {
    // 1. Filter berdasarkan tab status yang dipilih
    if (statusFilter === 'in_progress' && order.status !== 'pending' && order.status !== 'searching') {
      return false;
    }
    if (statusFilter === 'ready' && order.status !== 'ready') {
      return false;
    }
    if (statusFilter === 'completed' && order.status !== 'completed') {
      return false;
    }
    if (statusFilter === 'cancelled' && order.status !== 'cancelled') {
      return false;
    }

    // 2. Filter berdasarkan teks pencarian
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        order.ticket_code.toLowerCase().includes(q) ||
        order.table.toLowerCase().includes(q) ||
        order.book.toLowerCase().includes(q)
      );
    }

    return true;
  });

  return (
    <div className="glass-panel">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Dashboard Staf (Verifikasi Tiket)</h1>
          <p>Kelola dan verifikasi <strong>Kode Tiket</strong> pesanan buku dari pengunjung meja</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary" 
            style={{ 
              padding: '0.45rem 0.8rem', 
              fontSize: '0.82rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              borderColor: soundEnabled ? 'rgba(16, 185, 129, 0.4)' : ''
            }} 
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Klik untuk membisukan pengumuman suara" : "Klik untuk mengaktifkan pengumuman suara"}
          >
            {soundEnabled ? <Volume2 size={15} color="var(--success)" /> : <VolumeX size={15} color="#f87171" />}
            {soundEnabled ? 'Speaker Aktif' : 'Speaker Bisu'}
          </button>

          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.45rem 0.8rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }} 
            onClick={() => announceTableOrder('Meja 3', 'TKT-1003')}
            title="Klik untuk mendengarkan contoh suara panggilan"
          >
            <BellRing size={15} color="var(--primary-color)" /> Uji Suara
          </button>

          <span 
            className="status-badge" 
            style={{ 
              background: isDbConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              color: isDbConnected ? 'var(--success)' : 'var(--warning)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Database size={13} />
            {isDbConnected ? 'MySQL XAMPP' : 'Mode Offline'}
          </span>

          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.45rem 0.8rem', fontSize: '0.85rem' }} 
            onClick={fetchOrders}
            title="Refresh Data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Bar Pencarian Cepat Kode Tiket & Meja */}
      <div style={{ marginBottom: '1.2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '450px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            className="form-control" 
            placeholder="Ketik Kode Tiket (misal: 3714), Nomor Meja, atau Judul..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>
        {searchQuery && (
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.5rem 0.8rem', fontSize: '0.8rem' }}
            onClick={() => setSearchQuery('')}
          >
            Hapus Pencarian
          </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* FILTER TABS STATUS (SEMUA, PERLU DIPROSES, SIAP DIAMBIL, SELESAI) */}
      {/* ========================================================= */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '0.85rem', marginRight: '4px' }}>
          <Filter size={15} /> Filter:
        </div>

        <button 
          className={`btn ${statusFilter === 'all' ? '' : 'btn-secondary'}`}
          style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={() => setStatusFilter('all')}
        >
          Semua
          <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '10px', background: 'rgba(255,255,255,0.18)', fontWeight: '700' }}>
            {counts.all}
          </span>
        </button>

        <button 
          className={`btn ${statusFilter === 'in_progress' ? '' : 'btn-secondary'}`}
          style={{ 
            padding: '0.45rem 0.9rem', 
            fontSize: '0.85rem', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            borderColor: statusFilter === 'in_progress' ? 'var(--warning)' : '',
            background: statusFilter === 'in_progress' ? 'rgba(245, 158, 11, 0.2)' : ''
          }}
          onClick={() => setStatusFilter('in_progress')}
        >
          <Clock size={14} color="var(--warning)" /> Perlu Diproses
          <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.35)', color: 'var(--warning)', fontWeight: '700' }}>
            {counts.in_progress}
          </span>
        </button>

        <button 
          className={`btn ${statusFilter === 'ready' ? '' : 'btn-secondary'}`}
          style={{ 
            padding: '0.45rem 0.9rem', 
            fontSize: '0.85rem', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            borderColor: statusFilter === 'ready' ? 'var(--success)' : '',
            background: statusFilter === 'ready' ? 'rgba(16, 185, 129, 0.2)' : ''
          }}
          onClick={() => setStatusFilter('ready')}
        >
          <CheckCircle size={14} color="var(--success)" /> Siap Diambil
          <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.35)', color: 'var(--success)', fontWeight: '700' }}>
            {counts.ready}
          </span>
        </button>

        <button 
          className={`btn ${statusFilter === 'completed' ? '' : 'btn-secondary'}`}
          style={{ 
            padding: '0.45rem 0.9rem', 
            fontSize: '0.85rem', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            background: statusFilter === 'completed' ? 'rgba(255, 255, 255, 0.15)' : ''
          }}
          onClick={() => setStatusFilter('completed')}
        >
          <PackageCheck size={14} /> Sudah Selesai
          <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '10px', background: 'rgba(255,255,255,0.18)', fontWeight: '700' }}>
            {counts.completed}
          </span>
        </button>

        {counts.cancelled > 0 && (
          <button 
            className={`btn ${statusFilter === 'cancelled' ? '' : 'btn-secondary'}`}
            style={{ 
              padding: '0.45rem 0.9rem', 
              fontSize: '0.85rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              color: '#f87171',
              background: statusFilter === 'cancelled' ? 'rgba(239, 68, 68, 0.2)' : ''
            }}
            onClick={() => setStatusFilter('cancelled')}
          >
            Dibatalkan
            <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.35)', color: '#f87171', fontWeight: '700' }}>
              {counts.cancelled}
            </span>
          </button>
        )}

        {(counts.completed > 0 || counts.cancelled > 0) && (
          <button 
            className="btn btn-secondary" 
            style={{ 
              marginLeft: 'auto',
              padding: '0.42rem 0.85rem', 
              fontSize: '0.8rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              color: '#fca5a5',
              borderColor: 'rgba(239, 68, 68, 0.35)',
              background: 'rgba(239, 68, 68, 0.1)'
            }}
            onClick={handleCleanupCompleted}
            title="Hapus semua riwayat pesanan yang sudah selesai atau dibatalkan agar antrean bersih"
          >
            <Trash2 size={13} /> Bersihkan Selesai ({counts.completed + counts.cancelled})
          </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* DAFTAR PESANAN SESUAI FILTER */}
      {/* ========================================================= */}
      <div className="item-list">
        {filteredOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.15)', borderRadius: '12px' }}>
            <p style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>
              {searchQuery 
                ? `Tidak ditemukan pesanan dengan kata kunci "${searchQuery}"`
                : statusFilter === 'in_progress'
                ? '🎉 Luar biasa! Tidak ada antrean pesanan buku yang perlu diproses saat ini.'
                : statusFilter === 'ready'
                ? 'Tidak ada buku yang sedang menunggu diambil pengunjung di meja staf.'
                : statusFilter === 'completed'
                ? 'Belum ada riwayat pesanan yang selesai hari ini.'
                : 'Belum ada data pesanan.'}
            </p>
            {statusFilter !== 'all' && (
              <button 
                className="btn btn-secondary" 
                style={{ marginTop: '0.8rem', fontSize: '0.8rem' }}
                onClick={() => setStatusFilter('all')}
              >
                Lihat Semua Status
              </button>
            )}
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div 
              key={order.id} 
              className="list-item" 
              style={{ 
                flexDirection: 'column', 
                alignItems: 'stretch', 
                gap: '1rem',
                borderLeft: order.status === 'ready' 
                  ? '4px solid var(--success)' 
                  : order.status === 'searching' || order.status === 'pending'
                  ? '4px solid var(--warning)' 
                  : '1px solid var(--surface-border)',
                background: order.status === 'ready' ? 'rgba(16, 185, 129, 0.05)' : ''
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  {/* Badge Kode Tiket Besar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                    <span 
                      style={{ 
                        background: 'rgba(99, 102, 241, 0.25)', 
                        color: '#c7d2fe', 
                        border: '1px solid var(--primary-color)',
                        padding: '0.2rem 0.6rem', 
                        borderRadius: '6px', 
                        fontFamily: 'monospace', 
                        fontWeight: '700', 
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Ticket size={14} /> {order.ticket_code}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {order.table} • Jam: {order.time}
                    </span>
                  </div>

                  {/* Render Judul Buku (Mendukung Multi-Buku) */}
                  {order.book.includes(',') ? (
                    <div style={{ marginTop: '0.4rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                        Daftar Buku ({order.book.split(',').length} Item):
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {order.book.split(',').map((b, idx) => (
                          <div key={idx} style={{ fontSize: '1.05rem', fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: 'var(--primary-color)', fontSize: '1.2rem' }}>•</span> {b.trim()}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)', marginTop: '2px' }}>
                      {order.book}
                    </h3>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {getStatusBadge(order.status)}
                  <button 
                    onClick={() => handleDeleteOrder(order.id, order.ticket_code)}
                    style={{ 
                      background: 'rgba(239, 68, 68, 0.1)', 
                      border: '1px solid rgba(239, 68, 68, 0.25)', 
                      color: '#fca5a5', 
                      borderRadius: '6px', 
                      padding: '0.25rem 0.55rem', 
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                      transition: 'all 0.2s ease'
                    }}
                    title={`Hapus pesanan tiket ${order.ticket_code}`}
                  >
                    <Trash2 size={12} /> Hapus
                  </button>
                </div>
              </div>

              {/* Tombol Aksi Staf */}
              <div style={{ display: 'flex', gap: '0.6rem', borderTop: '1px solid var(--surface-border)', paddingTop: '0.85rem' }}>
                {order.status === 'pending' && (
                  <button className="btn" style={{ flex: 1, padding: '0.55rem' }} onClick={() => updateStatus(order.id, 'searching')}>
                    <Search size={16} /> 1. Mulai Mencari Buku di Rak
                  </button>
                )}

                {order.status === 'searching' && (
                  <button className="btn" style={{ flex: 1, padding: '0.55rem', background: 'var(--success)' }} onClick={() => handleReadyAndAnnounce(order)}>
                    <Volume2 size={16} /> 2. Buku Ditemukan & Panggil Suara
                  </button>
                )}

                {order.status === 'ready' && (
                  <div style={{ display: 'flex', gap: '0.6rem', flex: 1, flexWrap: 'wrap' }}>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}
                      onClick={() => announceTableOrder(order.table, order.ticket_code)}
                      title="Bunyikan ulang pengumuman suara jika pengunjung belum datang"
                    >
                      <Volume2 size={16} /> Panggil Ulang
                    </button>
                    <button 
                      className="btn" 
                      style={{ 
                        flex: 1, 
                        padding: '0.6rem', 
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: 'white',
                        fontWeight: '700'
                      }} 
                      onClick={() => updateStatus(order.id, 'completed')}
                    >
                      <CheckCircle size={18} /> 3. Cocokkan Tiket & Serahkan Buku
                    </button>
                  </div>
                )}

                {order.status === 'completed' && (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', width: '100%', fontSize: '0.85rem' }}>
                    ✅ Buku telah diserahkan kepada pemegang tiket <strong>{order.ticket_code}</strong>.
                  </p>
                )}

                {order.status === 'cancelled' && (
                  <p style={{ color: 'var(--danger)', textAlign: 'center', width: '100%', fontSize: '0.85rem' }}>
                    ⚠️ Pesanan ini telah dibatalkan oleh pengunjung.
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default StaffDashboard;
