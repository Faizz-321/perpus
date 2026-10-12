import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, CheckCircle2, XCircle, Clock, Maximize2, Minimize2, 
  RefreshCw, MapPin, Sparkles, Monitor, BookOpen, 
  Radio, Info, Filter, ArrowRight, ShieldCheck, QrCode, AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../context/ModalContext';

// Zona default di Perpustakaan Umum Kota Parepare
const ZONES = [
  'Semua Zona',
  'Zona Baca Utama',
  'Zona Komputer & Riset',
  'Zona Baca Tenang',
  'Bilik Diskusi'
];

// Data fallback jika backend offline
const FALLBACK_TABLES = [
  { id: 1, table_number: 'Meja 01', zone: 'Zona Baca Utama', capacity: 4, status: 'available', occupied_at: null, current_user_name: null, pos_x: 1, pos_y: 1 },
  { id: 2, table_number: 'Meja 02', zone: 'Zona Baca Utama', capacity: 4, status: 'occupied', occupied_at: new Date(Date.now() - 35 * 60000).toISOString(), current_user_name: 'Pengunjung', pos_x: 1, pos_y: 2 },
  { id: 3, table_number: 'Meja 03', zone: 'Zona Baca Utama', capacity: 4, status: 'available', occupied_at: null, current_user_name: null, pos_x: 1, pos_y: 3 },
  { id: 4, table_number: 'Meja 04', zone: 'Zona Baca Utama', capacity: 4, status: 'occupied', occupied_at: new Date(Date.now() - 70 * 60000).toISOString(), current_user_name: 'Pengunjung', pos_x: 1, pos_y: 4 },
  { id: 5, table_number: 'Meja 05', zone: 'Zona Baca Utama', capacity: 4, status: 'available', occupied_at: null, current_user_name: null, pos_x: 2, pos_y: 1 },
  { id: 6, table_number: 'Meja 06', zone: 'Zona Baca Utama', capacity: 4, status: 'available', occupied_at: null, current_user_name: null, pos_x: 2, pos_y: 2 },
  { id: 7, table_number: 'Meja 07', zone: 'Zona Komputer & Riset', capacity: 2, status: 'occupied', occupied_at: new Date(Date.now() - 20 * 60000).toISOString(), current_user_name: 'Pengunjung', pos_x: 2, pos_y: 3 },
  { id: 8, table_number: 'Meja 08', zone: 'Zona Komputer & Riset', capacity: 2, status: 'available', occupied_at: null, current_user_name: null, pos_x: 2, pos_y: 4 },
  { id: 9, table_number: 'Meja 09', zone: 'Zona Komputer & Riset', capacity: 2, status: 'available', occupied_at: null, current_user_name: null, pos_x: 3, pos_y: 1 },
  { id: 10, table_number: 'Meja 10', zone: 'Zona Komputer & Riset', capacity: 2, status: 'occupied', occupied_at: new Date(Date.now() - 50 * 60000).toISOString(), current_user_name: 'Pengunjung', pos_x: 3, pos_y: 2 },
  { id: 11, table_number: 'Meja 11', zone: 'Zona Baca Tenang', capacity: 4, status: 'available', occupied_at: null, current_user_name: null, pos_x: 3, pos_y: 3 },
  { id: 12, table_number: 'Meja 12', zone: 'Zona Baca Tenang', capacity: 4, status: 'occupied', occupied_at: new Date(Date.now() - 15 * 60000).toISOString(), current_user_name: 'Pengunjung', pos_x: 3, pos_y: 4 },
  { id: 13, table_number: 'Meja 13', zone: 'Zona Baca Tenang', capacity: 4, status: 'available', occupied_at: null, current_user_name: null, pos_x: 4, pos_y: 1 },
  { id: 14, table_number: 'Meja 14', zone: 'Zona Baca Tenang', capacity: 4, status: 'available', occupied_at: null, current_user_name: null, pos_x: 4, pos_y: 2 },
  { id: 15, table_number: 'Meja 15', zone: 'Bilik Diskusi', capacity: 6, status: 'reserved', occupied_at: null, current_user_name: 'Komunitas Literasi', pos_x: 4, pos_y: 3 },
  { id: 16, table_number: 'Meja 16', zone: 'Bilik Diskusi', capacity: 6, status: 'available', occupied_at: null, current_user_name: null, pos_x: 4, pos_y: 4 }
];

export default function TableMonitoring() {
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useModal();

  const [tables, setTables] = useState(FALLBACK_TABLES);
  const [stats, setStats] = useState({
    total_tables: 16,
    total_seats: 56,
    occupied_tables: 5,
    occupied_seats: 16,
    available_tables: 11,
    available_seats: 40,
    occupancy_rate: 31
  });
  const [loading, setLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState(new Date());
  const [selectedZone, setSelectedZone] = useState('Semua Zona');
  const [selectedTable, setSelectedTable] = useState(null);
  const [isTvMode, setIsTvMode] = useState(false);
  const [currentTimeWita, setCurrentTimeWita] = useState('');
  const [currentDateWita, setCurrentDateWita] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  const containerRef = useRef(null);

  // Update jam digital WITA (Kota Parepare)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Makassar',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      const dateStr = now.toLocaleDateString('id-ID', {
        timeZone: 'Asia/Makassar',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      setCurrentTimeWita(timeStr + ' WITA');
      setCurrentDateWita(dateStr);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch data meja secara real-time dari backend
  const fetchTableData = async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const res = await fetch('/api/tables');
      if (res.ok) {
        const data = await res.json();
        if (data.tables && Array.isArray(data.tables) && data.tables.length > 0) {
          setTables(data.tables);
          if (data.stats) {
            setStats(data.stats);
          }
          setLastSyncTime(new Date());
        }
      }
    } catch (err) {
      // Backend belum nyala, gunakan data lokal dan hitung statistik otomatis
      calculateFallbackStats(tables);
    } finally {
      if (isManual) setLoading(false);
    }
  };

  const calculateFallbackStats = (currentTables) => {
    const totalTables = currentTables.length;
    let totalSeats = 0;
    let occupiedTables = 0;
    let occupiedSeats = 0;
    let availableTables = 0;
    let availableSeats = 0;

    currentTables.forEach(t => {
      const cap = t.capacity || 4;
      totalSeats += cap;
      if (t.status === 'occupied') {
        occupiedTables++;
        occupiedSeats += cap;
      } else if (t.status === 'available') {
        availableTables++;
        availableSeats += cap;
      }
    });

    const occupancyRate = totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0;
    setStats({
      total_tables: totalTables,
      total_seats: totalSeats,
      occupied_tables: occupiedTables,
      occupied_seats: occupiedSeats,
      available_tables: availableTables,
      available_seats: availableSeats,
      occupancy_rate: occupancyRate
    });
    setLastSyncTime(new Date());
  };

  // Polling data otomatis setiap 3 detik
  useEffect(() => {
    fetchTableData(true);
    const interval = setInterval(() => {
      fetchTableData(false);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Toggle Fullscreen untuk Mode TV Display Lobby
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsTvMode(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsTvMode(false);
    }
  };

  // Listener tombol Escape atau perubahan status fullscreen browser
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsTvMode(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Filter meja berdasarkan zona
  const filteredTables = useMemo(() => {
    if (selectedZone === 'Semua Zona') return tables;
    return tables.filter(t => t.zone === selectedZone);
  }, [tables, selectedZone]);

  // Handler Check-In Langsung dari Meja
  const handleDirectCheckin = async (table) => {
    setIsActionLoading(true);
    try {
      const res = await fetch('/api/tables/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_number: table.table_number,
          user_name: 'Pengunjung',
          session_token: 'manual_' + Date.now()
        })
      });

      if (res.ok) {
        showAlert(`Berhasil Check-In di ${table.table_number}! Status meja kini Terisi.`, {
          type: 'success',
          title: 'Check-In Berhasil'
        });
        fetchTableData(false);
        setSelectedTable(prev => prev ? { ...prev, status: 'occupied', occupied_at: new Date().toISOString() } : null);
      } else {
        // Local update fallback
        setTables(prev => prev.map(t => t.id === table.id ? { ...t, status: 'occupied', occupied_at: new Date().toISOString() } : t));
        showAlert(`Check-In di ${table.table_number} berhasil diterapkan (Mode Lokal).`, { type: 'success' });
      }
    } catch (e) {
      setTables(prev => prev.map(t => t.id === table.id ? { ...t, status: 'occupied', occupied_at: new Date().toISOString() } : t));
      showAlert(`Check-In di ${table.table_number} berhasil disimpan secara lokal.`, { type: 'success' });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handler Release / Check-Out Meja
  const handleDirectCheckout = async (table) => {
    const confirmed = await showConfirm(`Kosongkan status ${table.table_number}? Meja akan kembali berstatus Tersedia untuk pengunjung lain.`, {
      title: 'Kosongkan Meja',
      confirmText: 'Ya, Kosongkan',
      cancelText: 'Batal',
      type: 'warning'
    });

    if (!confirmed) return;

    setIsActionLoading(true);
    try {
      const res = await fetch('/api/tables/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_number: table.table_number, id: table.id })
      });

      if (res.ok) {
        showAlert(`${table.table_number} berhasil dikosongkan. Tersedia kembali!`, {
          type: 'success',
          title: 'Meja Dikosongkan'
        });
        fetchTableData(false);
        setSelectedTable(prev => prev ? { ...prev, status: 'available', occupied_at: null, current_user_name: null } : null);
      } else {
        setTables(prev => prev.map(t => t.id === table.id ? { ...t, status: 'available', occupied_at: null, current_user_name: null } : t));
      }
    } catch (e) {
      setTables(prev => prev.map(t => t.id === table.id ? { ...t, status: 'available', occupied_at: null, current_user_name: null } : t));
    } finally {
      setIsActionLoading(false);
    }
  };

  // Hitung durasi pemakaian jika meja sedang terisi
  const getOccupancyDuration = (occupiedAt) => {
    if (!occupiedAt) return 'Baru saja';
    const diffMs = Date.now() - new Date(occupiedAt).getTime();
    const diffMins = Math.max(1, Math.floor(diffMs / 60000));
    if (diffMins < 60) return `${diffMins} menit lalu`;
    const hours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;
    return `${hours} jam ${remainingMins} menit lalu`;
  };

  // Status density badge
  const getCrowdLevel = (rate) => {
    if (rate < 40) return { label: 'Lenggang • Banyak Tempat Kosong', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
    if (rate < 75) return { label: 'Kondusif • Kursi Tersedia', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' };
    if (rate < 90) return { label: 'Cukup Ramai • Tempat Terbatas', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' };
    return { label: 'Sangat Penuh • Hampir Semua Terisi', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' };
  };

  const crowd = getCrowdLevel(stats.occupancy_rate);

  return (
    <div className={`table-monitoring-wrapper ${isTvMode ? 'tv-display-mode' : ''}`} ref={containerRef}>
      {/* ========================================================
          HEADER & KONTROL MODE
      ======================================================== */}
      <div className="monitoring-header-card glass-panel">
        <div className="monitoring-header-content">
          <div className="title-section">
            <div className="live-status-pill">
              <span className="pulse-dot"></span>
              <span className="live-text">REAL-TIME MONITORING</span>
              <span className="sync-time">
                • {lastSyncTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <h1>Pemantauan Status & Ketersediaan Meja</h1>
            <p>Denah visual interaktif dan okupansi kursi ruang baca Perpustakaan Umum Kota Parepare</p>
          </div>

          <div className="header-actions">
            <div className="parepare-clock-widget">
              <div className="clock-time">{currentTimeWita || '00:00:00 WITA'}</div>
              <div className="clock-date">{currentDateWita || 'Kota Parepare, Sulsel'}</div>
            </div>

            <button 
              className={`tv-mode-btn ${isTvMode ? 'active' : ''}`}
              onClick={toggleFullscreen}
              title="Aktifkan tampilan layar monitor TV untuk lobby perpustakaan"
            >
              {isTvMode ? <Minimize2 size={18} /> : <Monitor size={18} />}
              <span>{isTvMode ? 'Keluar Mode TV' : 'Mode TV Display Lobby'}</span>
            </button>
          </div>
        </div>

        {/* Ticker Pengumuman Khusus TV Mode */}
        {isTvMode && (
          <div className="tv-announcement-ticker">
            <div className="ticker-badge">PENGUMUMAN LOBBY</div>
            <div className="ticker-text">
              🏛️ Selamat Datang di Perpustakaan Umum Kota Parepare • Jam Layanan: 08.00 - 16.00 WITA • Silakan pilih meja hijau yang masih tersedia • Scan QR Code di meja Anda untuk memesan buku langsung tanpa antre.
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          RINGKASAN KAPASITAS RUANGAN (STATISTIK REAL-TIME)
      ======================================================== */}
      <div className="occupancy-stats-grid">
        {/* Total Kursi & Meja */}
        <div className="stat-card glass-panel stat-total">
          <div className="stat-icon-wrapper">
            <Users size={26} />
          </div>
          <div className="stat-details">
            <span className="stat-label">Total Kapasitas</span>
            <div className="stat-number-row">
              <span className="stat-value">{stats.total_seats}</span>
              <span className="stat-unit">Kursi</span>
              <span className="stat-sub">({stats.total_tables} Meja)</span>
            </div>
          </div>
        </div>

        {/* Kursi Terisi */}
        <div className="stat-card glass-panel stat-occupied">
          <div className="stat-icon-wrapper">
            <XCircle size={26} />
          </div>
          <div className="stat-details">
            <span className="stat-label">Sedang Digunakan</span>
            <div className="stat-number-row">
              <span className="stat-value text-danger">{stats.occupied_seats}</span>
              <span className="stat-unit">Kursi</span>
              <span className="stat-sub">({stats.occupied_tables} Meja Terisi)</span>
            </div>
          </div>
        </div>

        {/* Kursi Tersedia */}
        <div className="stat-card glass-panel stat-available">
          <div className="stat-icon-wrapper">
            <CheckCircle2 size={26} />
          </div>
          <div className="stat-details">
            <span className="stat-label">Kursi Kosong (Tersedia)</span>
            <div className="stat-number-row">
              <span className="stat-value text-success">{stats.available_seats}</span>
              <span className="stat-unit">Kursi</span>
              <span className="stat-sub">({stats.available_tables} Meja Siap Pakai)</span>
            </div>
          </div>
        </div>

        {/* Persentase Okupansi & Status Kepadatan */}
        <div className="stat-card glass-panel stat-rate">
          <div className="rate-header">
            <span className="stat-label">Tingkat Keterisian</span>
            <span className="rate-percent">{stats.occupancy_rate}%</span>
          </div>
          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill" 
              style={{ 
                width: `${stats.occupancy_rate}%`,
                background: stats.occupancy_rate > 80 ? 'var(--danger)' : stats.occupancy_rate > 50 ? 'var(--warning)' : 'var(--success)'
              }}
            ></div>
          </div>
          <div className="crowd-badge" style={{ color: crowd.color, backgroundColor: crowd.bg }}>
            <span className="crowd-dot" style={{ backgroundColor: crowd.color }}></span>
            <span>{crowd.label}</span>
          </div>
        </div>
      </div>

      {/* ========================================================
          FILTER ZONA & KETERANGAN STATUS (LEGEND)
      ======================================================== */}
      <div className="filter-and-legend-bar glass-panel">
        <div className="zone-filter-tabs">
          <span className="filter-title"><Filter size={15} /> Zona Ruangan:</span>
          <div className="zone-buttons-wrapper">
            {ZONES.map((zone) => (
              <button
                key={zone}
                className={`zone-tab-btn ${selectedZone === zone ? 'active' : ''}`}
                onClick={() => setSelectedZone(zone)}
              >
                {zone}
              </button>
            ))}
          </div>
        </div>

        <div className="status-legend">
          <div className="legend-item">
            <span className="legend-box available-box"></span>
            <span>Kosong / Tersedia ({tables.filter(t => t.status === 'available').length})</span>
          </div>
          <div className="legend-item">
            <span className="legend-box occupied-box"></span>
            <span>Terisi ({tables.filter(t => t.status === 'occupied').length})</span>
          </div>
          <div className="legend-item">
            <span className="legend-box reserved-box"></span>
            <span>Dipesan ({tables.filter(t => t.status === 'reserved').length})</span>
          </div>
        </div>
      </div>

      {/* ========================================================
          DENAH PETA VISUAL INTERAKTIF (INTERACTIVE FLOOR PLAN)
      ======================================================== */}
      <div className="floorplan-container glass-panel">
        {/* Landmark Ruangan Perpustakaan */}
        <div className="floorplan-layout-boundary">
          <div className="room-landmark entrance-landmark">
            <div className="landmark-line"></div>
            <div className="landmark-tag">🚪 PINTU MASUK UTAMA / LOBBY PERPUSTAKAAN</div>
          </div>

          <div className="room-landmark staff-landmark">
            <div className="landmark-tag">💼 MEJA LAYANAN & PENGAMBILAN BUKU (STAF)</div>
          </div>

          <div className="room-landmark bookshelf-landmark">
            <div className="landmark-tag">📚 LEMARI KOLEKSI BUKU & SASTRA (RAK 1 - 5)</div>
          </div>

          {/* Grid Tata Letak Meja */}
          <div className="table-visual-grid">
            {filteredTables.map((table) => {
              const isOccupied = table.status === 'occupied';
              const isReserved = table.status === 'reserved';
              const isAvailable = table.status === 'available';

              return (
                <div
                  key={table.id}
                  className={`table-visual-card ${table.status} ${selectedTable?.id === table.id ? 'active-selected' : ''}`}
                  onClick={() => setSelectedTable(table)}
                >
                  {/* Visual Kursi Atas */}
                  <div className="seats-row top-seats">
                    {Array.from({ length: Math.ceil(table.capacity / 2) }).map((_, idx) => (
                      <span key={idx} className={`seat-dot ${isOccupied ? 'seat-occupied' : 'seat-available'}`}></span>
                    ))}
                  </div>

                  {/* Badan Meja Fisik */}
                  <div className="table-surface">
                    <div className="table-top-bar">
                      <span className="table-id-badge">{table.table_number}</span>
                      <span className={`status-pill-mini ${table.status}`}>
                        {isAvailable ? 'KOSONG' : isOccupied ? 'TERISI' : 'DIPESAN'}
                      </span>
                    </div>

                    <div className="table-zone-label">
                      {table.zone.replace('Zona ', '')}
                    </div>

                    <div className="table-meta-bottom">
                      <span className="seat-count-text">{table.capacity} Kursi</span>
                      {isOccupied && (
                        <span className="time-elapsed-tag">
                          <Clock size={11} /> {getOccupancyDuration(table.occupied_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Visual Kursi Bawah */}
                  <div className="seats-row bottom-seats">
                    {Array.from({ length: Math.floor(table.capacity / 2) }).map((_, idx) => (
                      <span key={idx} className={`seat-dot ${isOccupied ? 'seat-occupied' : 'seat-available'}`}></span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================
          MODAL / DETAIL MEJA TERPILIH (POPUP ACTIONS)
      ======================================================== */}
      {selectedTable && (
        <div className="modal-backdrop-custom" onClick={() => setSelectedTable(null)}>
          <div className="table-detail-modal glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="detail-modal-header">
              <div className="modal-title-group">
                <span className="modal-table-badge">{selectedTable.table_number}</span>
                <div>
                  <h3>Detail Status {selectedTable.table_number}</h3>
                  <p className="zone-subtitle"><MapPin size={14} /> {selectedTable.zone}</p>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedTable(null)}>✕</button>
            </div>

            <div className="detail-modal-body">
              <div className="detail-info-grid">
                <div className="info-box">
                  <span className="info-box-label">Status Saat Ini</span>
                  <div className="info-status-value">
                    <span className={`status-indicator-circle ${selectedTable.status}`}></span>
                    <span className="status-name">
                      {selectedTable.status === 'available' ? 'Tersedia (Kosong)' : selectedTable.status === 'occupied' ? 'Sedang Digunakan' : 'Dalam Reservasi'}
                    </span>
                  </div>
                </div>

                <div className="info-box">
                  <span className="info-box-label">Kapasitas Duduk</span>
                  <div className="info-bold-value">{selectedTable.capacity} Orang / Kursi</div>
                </div>

                {selectedTable.status === 'occupied' && (
                  <>
                    <div className="info-box">
                      <span className="info-box-label">Pengguna / Sesi</span>
                      <div className="info-bold-value">{selectedTable.current_user_name || 'Pengunjung Perpustakaan'}</div>
                    </div>

                    <div className="info-box">
                      <span className="info-box-label">Waktu Mulai Digunakan</span>
                      <div className="info-bold-value text-accent">
                        {selectedTable.occupied_at 
                          ? new Date(selectedTable.occupied_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ` (${getOccupancyDuration(selectedTable.occupied_at)})`
                          : 'Baru saja'}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="modal-action-buttons">
                {selectedTable.status === 'available' ? (
                  <>
                    <button 
                      className="btn btn-primary"
                      disabled={isActionLoading}
                      onClick={() => handleDirectCheckin(selectedTable)}
                    >
                      <CheckCircle2 size={18} /> Check-In Sekarang di Meja Ini
                    </button>

                    <button 
                      className="btn btn-secondary"
                      onClick={() => navigate(`/qr-system?table=${encodeURIComponent(selectedTable.table_number)}`)}
                    >
                      <BookOpen size={18} /> Pesan Pinjam Buku ke Meja Ini
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      className="btn btn-danger-outline"
                      disabled={isActionLoading}
                      onClick={() => handleDirectCheckout(selectedTable)}
                    >
                      <XCircle size={18} /> Selesai Baca / Kosongkan Meja
                    </button>

                    <button 
                      className="btn btn-secondary"
                      onClick={() => navigate(`/qr-system?table=${encodeURIComponent(selectedTable.table_number)}`)}
                    >
                      <BookOpen size={18} /> Tambah Pesanan Buku
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Petunjuk QR Code untuk Pengunjung Baru */}
      <div className="qr-hint-banner glass-panel">
        <div className="qr-hint-icon">
          <QrCode size={36} />
        </div>
        <div className="qr-hint-text">
          <h4>Ingin Memesan Buku dari Meja Anda?</h4>
          <p>Setiap meja dilengkapi stiker QR Code resmi. Pindai langsung menggunakan kamera HP Anda untuk memesan buku favorit tanpa perlu beranjak dari tempat duduk.</p>
        </div>
        <button 
          className="btn btn-sm btn-outline-white"
          onClick={() => navigate('/qr-system')}
        >
          Buka Portal Pinjam Buku <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
