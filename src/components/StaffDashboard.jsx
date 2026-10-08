import { useState, useEffect, useRef } from 'react';
import { 
  Clock, Search, CheckCircle, PackageCheck, RefreshCw, Database, Ticket, Check, 
  Filter, Volume2, VolumeX, BellRing, Trash2, Package, Camera, Upload, Eye, X, 
  AlertCircle, Plus, User, CheckCircle2, Phone, MapPin, MessageCircle,
  BookOpen, Edit3, Image, Sparkles, BookPlus
} from 'lucide-react';
import { announceTableOrder } from '../utils/soundAnnouncement';
import { useModal } from '../context/ModalContext';

function StaffDashboard() {
  const { showAlert, showConfirm } = useModal();
  // Modul Aktif: 'orders' (Pesanan Buku Meja), 'lost_found' (Barang Tertinggal), atau 'books' (Kelola & Tambah Buku)
  const [activeModule, setActiveModule] = useState('orders');

  // ========================================================
  // STATE PESANAN BUKU MEJA
  // ========================================================
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // ========================================================
  // STATE BARANG TERTINGGAL (LOST & FOUND)
  // ========================================================
  const [lfItems, setLfItems] = useState([]);
  const [loadingLf, setLoadingLf] = useState(false);
  // lfTab: 'found' (Ditemukan Staf), 'user_reports' (Laporan Pengguna), 'claimed' (Riwayat Selesai)
  const [lfTab, setLfTab] = useState('found');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLfData, setNewLfData] = useState({ item_name: '', location: '', description: '' });

  // State Modal Kamera & Serah Terima Barang Bukti
  const [handoverModalItem, setHandoverModalItem] = useState(null);
  const [handoverData, setHandoverData] = useState({ claimed_by: '', staff_notes: '', proof_photo: null });
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // State Lihat Foto Bukti Pembesaran
  const [viewPhotoItem, setViewPhotoItem] = useState(null);

  // ========================================================
  // STATE MANAJEMEN BUKU (BOOK MANAGEMENT)
  // ========================================================
  const [bookList, setBookList] = useState([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [bookSearch, setBookSearch] = useState('');
  const [bookCatFilter, setBookCatFilter] = useState('all');
  const [showBookModal, setShowBookModal] = useState(false);
  const [editingBookId, setEditingBookId] = useState(null);
  const [bookFormData, setBookFormData] = useState({
    title: '',
    author: '',
    category: 'Sastra & Fiksi',
    classification: '813',
    shelf_location: 'Lemari 3, Rak 1',
    stock: 1,
    cover_url: '',
    cover_image: null
  });
  const [coverPreview, setCoverPreview] = useState('');
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [onlineCoverResults, setOnlineCoverResults] = useState([]);
  const [isSubmittingBook, setIsSubmittingBook] = useState(false);
  const [bookPage, setBookPage] = useState(1);
  const booksPerPage = 18;

  // --------------------------------------------------------
  // FETCH ORDERS (Pesanan Buku)
  // --------------------------------------------------------
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/orders');
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

  // --------------------------------------------------------
  // FETCH LOST & FOUND ITEMS
  // --------------------------------------------------------
  const fetchLostFound = async () => {
    setLoadingLf(true);
    try {
      const res = await fetch('/api/lost-found');
      if (res.ok) {
        const data = await res.json();
        setLfItems(data);
      }
    } catch (e) {
      console.warn('Gagal ambil data lost & found:', e);
    } finally {
      setLoadingLf(false);
    }
  };

  // --------------------------------------------------------
  // FETCH BOOKS (Katalog Buku)
  // --------------------------------------------------------
  const fetchBooks = async () => {
    setLoadingBooks(true);
    try {
      const res = await fetch('/api/books');
      if (res.ok) {
        const data = await res.json();
        setBookList(data);
      }
    } catch (e) {
      console.warn('Gagal ambil data buku:', e);
    } finally {
      setLoadingBooks(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchLostFound();
    fetchBooks();
    const interval = setInterval(() => {
      fetchOrders();
      if (activeModule === 'lost_found') {
        fetchLostFound();
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [activeModule]);

  // --------------------------------------------------------
  // HANDLERS PESANAN BUKU
  // --------------------------------------------------------
  const updateStatus = async (id, newStatus) => {
    setOrders((prev) =>
      prev.map((order) => (order.id === id ? { ...order, status: newStatus } : order))
    );

    try {
      await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) {
      console.error('Gagal memperbarui status ke database:', err);
    }
  };

  const handleReadyAndAnnounce = (order) => {
    updateStatus(order.id, 'ready');
    if (soundEnabled) {
      announceTableOrder(order.table, order.ticket_code);
    }
  };

  const handleDeleteOrder = async (id, ticketCode) => {
    const confirmed = await showConfirm(`Hapus pesanan tiket ${ticketCode} dari sistem perpustakaan?`, {
      title: 'Hapus Pesanan',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      type: 'danger'
    });
    if (!confirmed) return;

    setOrders((prev) => prev.filter((order) => order.id !== id));
    try {
      await fetch(`/api/orders/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Gagal menghapus pesanan:', err);
    }
  };

  const handleCleanupCompleted = async () => {
    const totalToClean = counts.completed + counts.cancelled;
    if (totalToClean === 0) {
      showAlert('Tidak ada riwayat pesanan selesai atau dibatalkan untuk dibersihkan.', {
        type: 'info',
        title: 'Riwayat Bersih'
      });
      return;
    }

    const confirmed = await showConfirm(`Bersihkan ${totalToClean} riwayat pesanan yang sudah Selesai & Dibatalkan agar antrean bersih?`, {
      title: 'Bersihkan Riwayat Pesanan',
      confirmText: 'Ya, Bersihkan',
      cancelText: 'Batal',
      type: 'warning'
    });
    if (!confirmed) return;

    setOrders((prev) => prev.filter((o) => o.status !== 'completed' && o.status !== 'cancelled'));
    try {
      await fetch('/api/orders/cleanup/completed', { method: 'DELETE' });
    } catch (err) {
      console.error('Gagal membersihkan riwayat pesanan:', err);
    }
  };

  // --------------------------------------------------------
  // HANDLERS MANAJEMEN BUKU (BOOK MANAGEMENT)
  // --------------------------------------------------------
  const handleOpenAddBook = () => {
    setEditingBookId(null);
    setBookFormData({
      title: '',
      author: '',
      category: 'Sastra & Fiksi',
      classification: '813',
      shelf_location: 'Lemari 3, Rak 1',
      stock: 1,
      cover_url: '',
      cover_image: null
    });
    setCoverPreview('');
    setOnlineCoverResults([]);
    setShowBookModal(true);
  };

  const handleOpenEditBook = (book) => {
    setEditingBookId(book.id);
    setBookFormData({
      title: book.title || '',
      author: book.author || '',
      category: book.category || 'Umum',
      classification: book.classification || '000',
      shelf_location: book.shelf_location || 'Rak Utama',
      stock: book.stock || 1,
      cover_url: book.cover_url || '',
      cover_image: null
    });
    setCoverPreview(book.cover_url || '');
    setOnlineCoverResults([]);
    setShowBookModal(true);
  };

  const handleCoverFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showAlert('File yang dipilih harus berupa gambar (JPG, PNG, atau WEBP)!', { type: 'warning', title: 'Format Tidak Sesuai' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      setCoverPreview(base64);
      setBookFormData(prev => ({ ...prev, cover_image: base64, cover_url: '' }));
    };
    reader.readAsDataURL(file);
  };

  const handleSearchOnlineCover = async () => {
    if (!bookFormData.title || !bookFormData.title.trim()) {
      showAlert('Ketik judul buku terlebih dahulu untuk mencari sampul online!', { type: 'warning', title: 'Judul Kosong' });
      return;
    }
    setIsSearchingOnline(true);
    setOnlineCoverResults([]);
    try {
      const res = await fetch('/api/books/search-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bookFormData.title, author: bookFormData.author })
      });
      const data = await res.json();
      if (data.covers && data.covers.length > 0) {
        setOnlineCoverResults(data.covers);
      } else {
        showAlert('Tidak ditemukan sampul online yang cocok untuk judul ini. Silakan foto langsung menggunakan kamera HP atau upload file.', { type: 'info', title: 'Sampul Tidak Ditemukan' });
      }
    } catch (err) {
      showAlert('Gagal mencari sampul online: ' + err.message, { type: 'danger', title: 'Gagal' });
    } finally {
      setIsSearchingOnline(false);
    }
  };

  const handleSelectOnlineCover = (url) => {
    setCoverPreview(url);
    setBookFormData(prev => ({ ...prev, cover_url: url, cover_image: null }));
    setOnlineCoverResults([]);
  };

  const handleSaveBook = async (e) => {
    e.preventDefault();
    if (!bookFormData.title.trim() || !bookFormData.author.trim()) {
      showAlert('Judul buku dan nama pengarang wajib diisi!', { type: 'warning', title: 'Data Belum Lengkap' });
      return;
    }

    setIsSubmittingBook(true);
    try {
      const url = editingBookId ? `/api/books/${editingBookId}` : '/api/books';
      const method = editingBookId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookFormData)
      });

      const result = await res.json();

      if (res.ok) {
        showAlert(editingBookId ? 'Data buku berhasil diperbarui!' : 'Buku baru berhasil ditambahkan ke katalog!', {
          type: 'success',
          title: editingBookId ? 'Buku Diperbarui' : 'Buku Ditambahkan'
        });
        setShowBookModal(false);
        fetchBooks();
      } else {
        showAlert('Gagal menyimpan buku: ' + (result.error || 'Terjadi kesalahan pada server'), {
          type: 'danger',
          title: 'Gagal'
        });
      }
    } catch (err) {
      showAlert('Gagal terhubung ke server backend: ' + err.message, { type: 'danger', title: 'Koneksi Gagal' });
    } finally {
      setIsSubmittingBook(false);
    }
  };

  const handleDeleteBook = async (book) => {
    const confirmed = await showConfirm(`Yakin ingin menghapus buku "${book.title}" (${book.author}) dari katalog perpustakaan?`, {
      title: 'Hapus Buku',
      confirmText: 'Ya, Hapus Buku',
      cancelText: 'Batal',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/books/${book.id}`, { method: 'DELETE' });
      if (res.ok) {
        showAlert(`Buku "${book.title}" berhasil dihapus dari sistem.`, { type: 'success', title: 'Buku Dihapus' });
        fetchBooks();
      } else {
        showAlert('Gagal menghapus buku.', { type: 'danger', title: 'Gagal' });
      }
    } catch (err) {
      showAlert('Koneksi gagal: ' + err.message, { type: 'danger', title: 'Error' });
    }
  };

  // --------------------------------------------------------
  // HANDLERS BARANG TERTINGGAL (LOST & FOUND)
  // --------------------------------------------------------
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!newLfData.item_name || !newLfData.location) {
      showAlert('Nama barang dan lokasi wajib diisi!', {
        type: 'warning',
        title: 'Data Belum Lengkap'
      });
      return;
    }

    try {
      const res = await fetch('/api/lost-found', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_name: newLfData.item_name,
          location: newLfData.location,
          description: newLfData.description,
          type: 'found'
        })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        showAlert('Pengumuman barang tertinggal berhasil dipublikasikan ke sisi pengunjung!', {
          type: 'success',
          title: 'Berhasil Dipublikasikan'
        });
        setShowCreateModal(false);
        setNewLfData({ item_name: '', location: '', description: '' });
        fetchLostFound();
      } else {
        showAlert('Gagal menambah barang: ' + (data.error || 'Terjadi kesalahan pada server'), {
          type: 'danger',
          title: 'Gagal Menyimpan'
        });
      }
    } catch (err) {
      console.error('Error saat menambah barang tertinggal:', err);
      showAlert('Gagal terhubung ke server backend! Pastikan backend aktif.', {
        type: 'danger',
        title: 'Koneksi Gagal'
      });
    }
  };

  const handleCreateNewLf = handleCreateAnnouncement;

  // Kamera Control
  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.warn('Gagal akses webcam:', err);
      showAlert('Tidak dapat mengakses kamera secara langsung. Silakan gunakan tombol "Pilih dari Galeri / File Foto" di bawah.', {
        type: 'warning',
        title: 'Kamera Tidak Tersedia'
      });
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setHandoverData(prev => ({ ...prev, proof_photo: dataUrl }));
    stopCamera();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setHandoverData(prev => ({ ...prev, proof_photo: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveHandover = async () => {
    if (!handoverData.claimed_by.trim()) {
      showAlert('Silakan isi Nama Orang yang Mengambil barang.', {
        type: 'warning',
        title: 'Nama Penerima Wajib Diisi'
      });
      return;
    }

    try {
      const res = await fetch(`/api/lost-found/${handoverModalItem.id}/handover`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimed_by: handoverData.claimed_by,
          proof_photo: handoverData.proof_photo,
          staff_notes: handoverData.staff_notes
        })
      });

      if (res.ok) {
        showAlert('Barang berhasil diserahkan ke pemilik dan foto bukti serah terima telah tersimpan!', {
          type: 'success',
          title: 'Serah Terima Berhasil'
        });
        stopCamera();
        setHandoverModalItem(null);
        setHandoverData({ claimed_by: '', staff_notes: '', proof_photo: null });
        fetchLostFound();
      }
    } catch (err) {
      console.error('Gagal mencatat serah terima:', err);
    }
  };

  const handleDeleteLfItem = async (id, name) => {
    const confirmed = await showConfirm(`Hapus catatan barang "${name}" dari arsip sistem?`, {
      title: 'Hapus Catatan Barang',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      type: 'danger'
    });
    if (!confirmed) return;

    try {
      await fetch(`/api/lost-found/${id}`, { method: 'DELETE' });
      fetchLostFound();
    } catch (err) {
      console.error(err);
    }
  };

  // Filter Orders
  const counts = {
    all: orders.length,
    in_progress: orders.filter((o) => o.status === 'pending' || o.status === 'searching').length,
    ready: orders.filter((o) => o.status === 'ready').length,
    completed: orders.filter((o) => o.status === 'completed').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  };

  const filteredOrders = orders.filter((order) => {
    let matchStatus = true;
    if (statusFilter === 'in_progress') matchStatus = order.status === 'pending' || order.status === 'searching';
    else if (statusFilter === 'ready') matchStatus = order.status === 'ready';
    else if (statusFilter === 'completed') matchStatus = order.status === 'completed';
    else if (statusFilter === 'cancelled') matchStatus = order.status === 'cancelled';

    if (!searchQuery.trim()) return matchStatus;
    const q = searchQuery.toLowerCase();
    const matchTicket = order.ticket_code && order.ticket_code.toLowerCase().includes(q);
    const matchTable = order.table && order.table.toLowerCase().includes(q);
    const matchBook = order.book && order.book.toLowerCase().includes(q);
    return matchStatus && (matchTicket || matchTable || matchBook);
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': return <span className="status-badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: 'var(--warning)' }}>1. Perlu Dicari</span>;
      case 'searching': return <span className="status-badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: 'var(--primary-color)' }}>2. Sedang Mengambil</span>;
      case 'ready': return <span className="status-badge" style={{ background: 'rgba(16, 185, 129, 0.25)', color: 'var(--success)', border: '1px solid var(--success)' }}>3. Siap Diambil di Meja</span>;
      case 'completed': return <span className="status-badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>4. Selesai</span>;
      case 'cancelled': return <span className="status-badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)' }}>Dibatalkan</span>;
      default: return null;
    }
  };

  const staffFoundItems = lfItems.filter(i => (i.type === 'found' || !i.type) && i.status !== 'claimed');
  const userReportItems = lfItems.filter(i => i.type === 'lost' && i.status !== 'claimed');
  const claimedLf = lfItems.filter(i => i.status === 'claimed');
  const totalActiveLf = staffFoundItems.length + userReportItems.length;

  return (
    <div className="glass-panel">
      {/* ======================================================== */}
      {/* SWITCHER MODUL UTAMA STAF (PESANAN BUKU vs BARANG TERTINGGAL) */}
      {/* ======================================================== */}
      <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '1.8rem', borderBottom: '1px solid var(--surface-border)', paddingBottom: '1rem', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeModule === 'orders' ? '' : 'btn-secondary'}`}
          style={{
            padding: '0.65rem 1.4rem',
            fontSize: '0.92rem',
            fontWeight: '700',
            background: activeModule === 'orders' ? 'var(--primary-color)' : '',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onClick={() => setActiveModule('orders')}
        >
          <Ticket size={18} /> Antrean Pesanan Buku Meja
          <span style={{ 
            background: activeModule === 'orders' ? 'rgba(255,255,255,0.25)' : 'rgba(99,102,241,0.25)', 
            padding: '2px 8px', 
            borderRadius: '12px', 
            fontSize: '0.75rem' 
          }}>
            {counts.all}
          </span>
        </button>

        <button
          className={`btn ${activeModule === 'lost_found' ? '' : 'btn-secondary'}`}
          style={{
            padding: '0.65rem 1.4rem',
            fontSize: '0.92rem',
            fontWeight: '700',
            background: activeModule === 'lost_found' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '',
            borderColor: activeModule === 'lost_found' ? '#f59e0b' : '',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: activeModule === 'lost_found' ? '#fff' : ''
          }}
          onClick={() => {
            setActiveModule('lost_found');
            fetchLostFound();
          }}
        >
          <Package size={18} /> Kelola Barang Tertinggal & Laporan Pengunjung
          <span style={{ 
            background: activeModule === 'lost_found' ? 'rgba(0,0,0,0.3)' : 'rgba(245,158,11,0.25)', 
            color: activeModule === 'lost_found' ? '#fff' : '#facc15',
            padding: '2px 8px', 
            borderRadius: '12px', 
            fontSize: '0.75rem',
            fontWeight: '800'
          }}>
            {totalActiveLf}
          </span>
          {userReportItems.length > 0 && (
            <span style={{
              background: '#ef4444',
              color: '#fff',
              fontSize: '0.72rem',
              fontWeight: '800',
              padding: '2px 7px',
              borderRadius: '10px'
            }} title={`${userReportItems.length} laporan kehilangan baru dari pengunjung`}>
              {userReportItems.length} Laporan Pengunjung
            </span>
          )}
        </button>

        <button
          className={`btn ${activeModule === 'books' ? '' : 'btn-secondary'}`}
          style={{
            padding: '0.65rem 1.4rem',
            fontSize: '0.92rem',
            fontWeight: '700',
            background: activeModule === 'books' ? 'linear-gradient(135deg, #059669, #10b981)' : '',
            borderColor: activeModule === 'books' ? '#10b981' : '',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: activeModule === 'books' ? '#fff' : ''
          }}
          onClick={() => {
            setActiveModule('books');
            fetchBooks();
          }}
        >
          <BookOpen size={18} /> Katalog & Tambah Buku
          <span style={{ 
            background: activeModule === 'books' ? 'rgba(0,0,0,0.3)' : 'rgba(16,185,129,0.25)', 
            color: activeModule === 'books' ? '#fff' : '#34d399',
            padding: '2px 8px', 
            borderRadius: '12px', 
            fontSize: '0.75rem',
            fontWeight: '800'
          }}>
            {bookList.length}
          </span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* MODUL 1: PESANAN BUKU MEJA */}
      {/* ======================================================== */}
      {activeModule === 'orders' && (
        <div>
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

          {/* Tab Filter Status */}
          <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginRight: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Filter size={14} /> Filter:
              </span>

              {[
                { key: 'all', label: 'Semua Pesanan', count: counts.all },
                { key: 'in_progress', label: 'Perlu Diproses', count: counts.in_progress },
                { key: 'ready', label: 'Siap Diambil', count: counts.ready },
                { key: 'completed', label: 'Sudah Selesai', count: counts.completed },
                { key: 'cancelled', label: 'Dibatalkan', count: counts.cancelled },
              ].map((tab) => {
                const isActive = statusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    className={`btn ${isActive ? '' : 'btn-secondary'}`}
                    style={{
                      padding: '0.35rem 0.8rem',
                      fontSize: '0.82rem',
                      background: isActive ? 'var(--primary-color)' : '',
                      borderColor: isActive ? 'var(--primary-color)' : '',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                    onClick={() => setStatusFilter(tab.key)}
                  >
                    <span>{tab.label}</span>
                    <span
                      style={{
                        background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                      }}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {(counts.completed > 0 || counts.cancelled > 0) && (
              <button
                className="btn btn-secondary"
                style={{
                  padding: '0.35rem 0.8rem',
                  fontSize: '0.8rem',
                  color: '#f87171',
                  borderColor: 'rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
                onClick={handleCleanupCompleted}
                title="Bersihkan semua pesanan yang sudah selesai & dibatalkan agar antrean rapi"
              >
                <Trash2 size={13} /> Bersihkan Selesai ({counts.completed + counts.cancelled})
              </button>
            )}
          </div>

          {/* Grid Kartu Pesanan Buku */}
          <div className="orders-grid">
            {filteredOrders.length === 0 ? (
              <div style={{ textAlign: 'center', gridColumn: '1 / -1', padding: '3rem 0', color: 'var(--text-muted)' }}>
                <Ticket size={40} style={{ margin: '0 auto 0.5rem auto', opacity: 0.4 }} />
                <p>Tidak ada pesanan pada filter saat ini.</p>
              </div>
            ) : (
              filteredOrders.map((order) => (
                <div 
                  key={order.id} 
                  className="order-card"
                  style={{
                    border: order.status === 'ready' 
                      ? '1.5px solid var(--success)' 
                      : order.status === 'searching'
                      ? '1px solid var(--primary-color)'
                      : ''
                  }}
                >
                  <div className="order-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div className="ticket-code-tag">
                        <Ticket size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                        {order.ticket_code}
                      </div>
                      <span className="order-table" style={{ marginLeft: '6px' }}>{order.table}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {getStatusBadge(order.status)}
                      <button
                        onClick={() => handleDeleteOrder(order.id, order.ticket_code)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '3px',
                          borderRadius: '4px',
                          lineHeight: 1
                        }}
                        title={`Hapus pesanan tiket ${order.ticket_code}`}
                      >
                        <Trash2 size={14} style={{ color: '#94a3b8' }} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Daftar Buku */}
                  <div className="order-body" style={{ margin: '0.8rem 0' }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.8px', marginBottom: '4px' }}>
                      Buku yang Dipesan:
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      {order.book.split(',').map((title, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: idx !== order.book.split(',').length - 1 ? '6px' : '0' }}>
                          <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(99,102,241,0.25)', color: '#a5b4fc', fontSize: '0.7rem', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {idx + 1}
                          </span>
                          <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-main)' }}>
                            {title.trim()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="order-footer" style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '0.8rem' }}>
                    <div className="order-time" style={{ marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={14} /> Jam pesan: {order.time}
                    </div>

                    {order.status === 'pending' && (
                      <button 
                        className="btn btn-secondary" 
                        style={{ width: '100%', padding: '0.6rem', color: 'var(--primary-color)', borderColor: 'var(--primary-color)' }}
                        onClick={() => updateStatus(order.id, 'searching')}
                      >
                        <PackageCheck size={18} /> 1. Mulai Mencari Buku di Rak
                      </button>
                    )}

                    {order.status === 'searching' && (
                      <button 
                        className="btn" 
                        style={{ width: '100%', padding: '0.6rem', background: 'var(--success)' }}
                        onClick={() => handleReadyAndAnnounce(order)}
                      >
                        <Check size={18} /> 2. Buku Ditemukan & Panggil Suara
                      </button>
                    )}

                    {order.status === 'ready' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}
                            onClick={() => announceTableOrder(order.table, order.ticket_code)}
                            title="Bunyikan ulang pengumuman suara"
                          >
                            <Volume2 size={14} /> Panggil Ulang
                          </button>

                          <button 
                            className="btn" 
                            style={{ 
                              flex: 2, 
                              padding: '0.6rem', 
                              background: 'linear-gradient(135deg, #10b981, #059669)',
                              color: 'white',
                              fontWeight: '700'
                            }} 
                            onClick={() => updateStatus(order.id, 'completed')}
                          >
                            <CheckCircle size={18} /> 3. Cocokkan & Serahkan
                          </button>
                        </div>
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
      )}

      {/* ======================================================== */}
      {/* MODUL 2: KELOLA BARANG TERTINGGAL & BUKTI FOTO SERAH TERIMA */}
      {/* ======================================================== */}
      {activeModule === 'lost_found' && (
        <div>
          {/* Header Modul Lost & Found */}
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={26} color="#f59e0b" /> Pencatatan Barang Tertinggal
              </h1>
              <p>
                Tulis pengumuman barang yang ditemukan staf di meja belajar, dan <strong>ambil foto orangnya saat serah terima</strong> sebagai bukti sah.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
              <button 
                className="btn"
                style={{ 
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)', 
                  border: 'none', 
                  color: '#fff',
                  fontWeight: '700',
                  padding: '0.6rem 1.2rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)'
                }}
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={18} /> + Tulis Pengumuman Barang Baru
              </button>

              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.55rem 0.9rem' }}
                onClick={fetchLostFound}
                title="Refresh Data"
              >
                <RefreshCw size={15} className={loadingLf ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Sub Tab: Ditemukan Staf vs Laporan Pengguna vs Riwayat Selesai */}
          <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <button
              className={`btn ${lfTab === 'found' ? '' : 'btn-secondary'}`}
              style={{
                background: lfTab === 'found' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '',
                borderColor: lfTab === 'found' ? 'transparent' : 'rgba(245, 158, 11, 0.4)',
                color: lfTab === 'found' ? '#fff' : '#f59e0b',
                padding: '0.55rem 1.2rem',
                fontSize: '0.88rem',
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onClick={() => setLfTab('found')}
            >
              <Package size={17} /> 🏢 Ditemukan Staf ({staffFoundItems.length})
            </button>

            <button
              className={`btn ${lfTab === 'user_reports' ? '' : 'btn-secondary'}`}
              style={{
                background: lfTab === 'user_reports' ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '',
                borderColor: lfTab === 'user_reports' ? 'transparent' : 'rgba(99, 102, 241, 0.4)',
                color: lfTab === 'user_reports' ? '#fff' : '#818cf8',
                padding: '0.55rem 1.2rem',
                fontSize: '0.88rem',
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onClick={() => setLfTab('user_reports')}
            >
              <User size={17} /> 👤 Laporan Pengunjung ({userReportItems.length})
              {userReportItems.length > 0 && (
                <span style={{ 
                  background: lfTab === 'user_reports' ? '#fff' : '#ef4444', 
                  color: lfTab === 'user_reports' ? '#4f46e5' : '#fff', 
                  padding: '1px 6px', 
                  borderRadius: '10px', 
                  fontSize: '0.72rem', 
                  fontWeight: '800' 
                }}>
                  {userReportItems.length}
                </span>
              )}
            </button>

            <button
              className={`btn ${lfTab === 'claimed' ? '' : 'btn-secondary'}`}
              style={{
                background: lfTab === 'claimed' ? 'linear-gradient(135deg, #10b981, #059669)' : '',
                borderColor: lfTab === 'claimed' ? 'transparent' : 'rgba(16, 185, 129, 0.4)',
                color: lfTab === 'claimed' ? '#fff' : '#34d399',
                padding: '0.55rem 1.2rem',
                fontSize: '0.88rem',
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onClick={() => setLfTab('claimed')}
            >
              <CheckCircle2 size={17} /> ✅ Riwayat Sudah Diserahkan ({claimedLf.length})
            </button>
          </div>

          {/* Konten Tab 1: Barang yang Ditemukan Staf */}
          {lfTab === 'found' && (
            <div>
              <div style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '10px',
                padding: '0.8rem 1.1rem',
                marginBottom: '1.2rem',
                fontSize: '0.85rem',
                color: '#fde68a',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <Package size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
                <span>
                  <strong>Tempat Barang Ditemukan Staf:</strong> Daftar barang tertinggal yang ditemukan petugas di area perpus dan saat ini tersimpan aman di meja staf. Diumumkan di web agar pengunjung yang merasa kehilangan dapat datang mengambil.
                </span>
              </div>

              {staffFoundItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                  <Package size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 0.6rem auto' }} />
                  <p style={{ color: 'var(--text-muted)' }}>Tidak ada barang temuan staf yang belum diambil.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.2rem' }}>
                  {staffFoundItems.map(item => (
                    <div 
                      key={item.id}
                      style={{
                        background: 'linear-gradient(135deg, rgba(25, 30, 46, 0.95), rgba(18, 22, 36, 0.98))',
                        border: '1.5px solid rgba(245, 158, 11, 0.4)',
                        borderRadius: '14px',
                        padding: '1.2rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.25)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <span style={{ 
                            background: 'rgba(245, 158, 11, 0.25)', 
                            color: '#facc15', 
                            fontSize: '0.75rem', 
                            fontWeight: '700', 
                            padding: '3px 8px', 
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}>
                            🏢 Ditemukan Staf
                          </span>
                          <button
                            onClick={() => handleDeleteLfItem(item.id, item.item_name)}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                            title="Hapus catatan"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '4px' }}>
                          {item.item_name}
                        </h3>

                        <div style={{ fontSize: '0.82rem', color: '#fcd34d', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <MapPin size={13} /> {item.location}
                        </div>

                        <p style={{ fontSize: '0.88rem', color: '#cbd5e1', background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: '8px', lineHeight: '1.4', marginBottom: '1rem' }}>
                          {item.description || 'Tidak ada keterangan tambahan.'}
                        </p>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} /> Ditemukan: {item.report_date ? item.report_date.slice(0, 10) : 'Hari ini'}
                        </div>

                        {/* Tombol Utama: Serahkan & Ambil Foto Bukti */}
                        <button
                          className="btn"
                          style={{
                            width: '100%',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            border: 'none',
                            color: '#fff',
                            fontWeight: '700',
                            padding: '0.65rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
                          }}
                          onClick={() => {
                            setHandoverModalItem(item);
                            setHandoverData({ claimed_by: '', staff_notes: '', proof_photo: null });
                          }}
                        >
                          <Camera size={18} /> 📸 Serahkan ke Pemilik (Foto Bukti)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Konten Tab 2: Laporan Kehilangan dari Pengunjung */}
          {lfTab === 'user_reports' && (
            <div>
              <div style={{
                background: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: '10px',
                padding: '0.8rem 1.1rem',
                marginBottom: '1.2rem',
                fontSize: '0.85rem',
                color: '#c7d2fe',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <User size={20} color="#818cf8" style={{ flexShrink: 0 }} />
                <span>
                  <strong>Tempat Laporan dari Pengunjung:</strong> Daftar barang hilang yang dilaporkan oleh pengunjung/pengguna perpustakaan lewat website. Jika staf menemukan barang yang cocok, segera hubungi kontak yang tertera.
                </span>
              </div>

              {userReportItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                  <CheckCircle2 size={40} style={{ color: '#818cf8', margin: '0 auto 0.6rem auto' }} />
                  <p style={{ color: 'var(--text-muted)' }}>Tidak ada laporan kehilangan dari pengunjung saat ini.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.2rem' }}>
                  {userReportItems.map(item => {
                    const cleanPhone = item.contact ? item.contact.replace(/[^0-9]/g, '') : '';
                    const waNumber = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
                    const canWhatsApp = cleanPhone.length >= 8;

                    const notFoundMsg = `Halo kak, kami dari Staf Perpustakaan Parepare. Menindaklanjuti laporan kehilangan barang Anda (${item.item_name}), petugas kami telah menyisir dan memeriksa area perpustakaan, namun saat ini barang BELUM DITEMUKAN. Laporan Kakak tetap kami simpan, dan jika sewaktu-waktu ada petugas atau pengunjung lain yang menemukan dan mengantarkannya ke meja staf, kami akan segera mengabari Kakak kembali. Terima kasih atas kesabarannya 🙏`;

                    const foundMsg = `Halo kak, kabar baik dari Staf Perpustakaan Parepare! Mengenai laporan kehilangan barang Anda (${item.item_name}), barang tersebut SUDAH DITEMUKAN dan saat ini tersimpan aman di Meja Pelayanan Staf. Silakan datang ke perpustakaan untuk mengambilnya ya. Terima kasih 🙏`;

                    return (
                      <div 
                        key={item.id}
                        style={{
                          background: 'linear-gradient(135deg, rgba(28, 25, 48, 0.95), rgba(18, 20, 36, 0.98))',
                          border: '1.5px solid rgba(99, 102, 241, 0.45)',
                          borderRadius: '14px',
                          padding: '1.2rem',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxShadow: '0 8px 20px rgba(0,0,0,0.25)'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <span style={{ 
                              background: 'rgba(99, 102, 241, 0.25)', 
                              color: '#a5b4fc', 
                              fontSize: '0.75rem', 
                              fontWeight: '700', 
                              padding: '3px 8px', 
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}>
                              👤 Laporan Pengunjung
                            </span>
                            <button
                              onClick={() => handleDeleteLfItem(item.id, item.item_name)}
                              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                              title="Hapus / Tutup Laporan"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>

                          <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '4px' }}>
                            {item.item_name}
                          </h3>

                          <div style={{ fontSize: '0.82rem', color: '#a5b4fc', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <MapPin size={13} /> Hilang di: {item.location}
                          </div>

                          <p style={{ fontSize: '0.88rem', color: '#cbd5e1', background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: '8px', lineHeight: '1.4', marginBottom: '0.9rem' }}>
                            {item.description || 'Tidak ada ciri-ciri/keterangan tambahan.'}
                          </p>

                          {/* Info Kontak & Tombol Respon WhatsApp Cepat */}
                          <div style={{ 
                            background: 'rgba(99, 102, 241, 0.12)', 
                            border: '1px solid rgba(99, 102, 241, 0.25)', 
                            borderRadius: '10px', 
                            padding: '0.85rem', 
                            marginBottom: '1rem' 
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ fontSize: '0.75rem', color: '#a5b4fc', fontWeight: '600' }}>
                                📞 Kontak Pelapor / Pengunjung:
                              </span>
                              {canWhatsApp && (
                                <span style={{ fontSize: '0.7rem', color: '#86efac', fontWeight: '700' }}>
                                  ● Siap WhatsApp
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#fff', marginBottom: canWhatsApp ? '8px' : '0' }}>
                              {item.contact || '(Tidak mencantumkan kontak)'}
                            </div>

                            {canWhatsApp ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {/* Tombol 1: Kabari Belum Ditemukan (1-Klik WA) */}
                                <a
                                  href={`https://wa.me/${waNumber}?text=${encodeURIComponent(notFoundMsg)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn"
                                  style={{
                                    fontSize: '0.76rem',
                                    padding: '0.45rem 0.8rem',
                                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                    color: '#fff',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    fontWeight: '700',
                                    borderRadius: '7px',
                                    textDecoration: 'none',
                                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)'
                                  }}
                                  title="Kirim pesan sopan bahwa barang belum ditemukan setelah disisir staf"
                                >
                                  <MessageCircle size={15} /> 💬 Kabari Belum Ditemukan (1-Klik WA)
                                </a>

                                {/* Tombol 2: Kabari Sudah Ketemu (1-Klik WA) */}
                                <a
                                  href={`https://wa.me/${waNumber}?text=${encodeURIComponent(foundMsg)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn"
                                  style={{
                                    fontSize: '0.76rem',
                                    padding: '0.45rem 0.8rem',
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    color: '#fff',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    fontWeight: '700',
                                    borderRadius: '7px',
                                    textDecoration: 'none',
                                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
                                  }}
                                  title="Kirim pesan bahwa barang sudah ditemukan dan siap diambil"
                                >
                                  <MessageCircle size={15} /> 💬 Kabari Sudah Ketemu (1-Klik WA)
                                </a>
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                                (Format kontak bukan nomor WhatsApp valid)
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} /> Dilaporkan: {item.report_date ? item.report_date.slice(0, 10) : 'Hari ini'}
                          </div>

                          {/* Tombol Serahkan jika barang ditemukan & diambil */}
                          <button
                            className="btn"
                            style={{
                              width: '100%',
                              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                              border: 'none',
                              color: '#fff',
                              fontWeight: '700',
                              padding: '0.65rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)'
                            }}
                            onClick={() => {
                              setHandoverModalItem(item);
                              setHandoverData({ 
                                claimed_by: '', 
                                staff_notes: `Barang temuan cocok dengan laporan pengunjung (${item.contact || ''})`, 
                                proof_photo: null 
                              });
                            }}
                          >
                            <Camera size={18} /> 📸 Barang Ditemukan (Serah Terima & Foto)
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Konten Tab 3: Riwayat yang Sudah Diserahkan Lengkap dengan Foto Bukti */}
          {lfTab === 'claimed' && (
            <div>
              <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '10px',
                padding: '0.8rem 1.1rem',
                marginBottom: '1.2rem',
                fontSize: '0.85rem',
                color: '#a7f3d0',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <CheckCircle2 size={20} color="#10b981" style={{ flexShrink: 0 }} />
                <span>
                  <strong>Riwayat Selesai Diserahkan:</strong> Seluruh arsip barang yang telah diambil oleh pemiliknya dan dilengkapi foto dokumentasi serah terima sebagai barang bukti sah.
                </span>
              </div>

              {claimedLf.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                  <CheckCircle2 size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 0.6rem auto' }} />
                  <p style={{ color: 'var(--text-muted)' }}>Belum ada riwayat barang yang diserahkan.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.2rem' }}>
                  {claimedLf.map(item => (
                    <div 
                      key={item.id}
                      style={{
                        background: 'linear-gradient(135deg, rgba(20, 30, 40, 0.95), rgba(15, 20, 30, 0.98))',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        borderRadius: '14px',
                        padding: '1.2rem',
                        boxShadow: '0 6px 16px rgba(0,0,0,0.2)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', fontSize: '0.75rem', fontWeight: '700', padding: '2px 8px', borderRadius: '4px' }}>
                            ✓ Sudah Diserahkan
                          </span>
                          <span style={{ 
                            background: item.type === 'lost' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(245, 158, 11, 0.2)', 
                            color: item.type === 'lost' ? '#a5b4fc' : '#fcd34d', 
                            fontSize: '0.72rem', 
                            padding: '2px 6px', 
                            borderRadius: '4px' 
                          }}>
                            {item.type === 'lost' ? '👤 Dari Laporan Pengunjung' : '🏢 Temuan Staf'}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteLfItem(item.id, item.item_name)}
                          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                          title="Hapus riwayat"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <h3 style={{ fontSize: '1.15rem', color: '#fff', marginBottom: '4px' }}>
                        {item.item_name}
                      </h3>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        📍 {item.location}
                      </div>

                      <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.8rem', borderRadius: '8px', marginBottom: '0.8rem', fontSize: '0.85rem' }}>
                        <div style={{ color: 'var(--success)', fontWeight: '700', marginBottom: '2px' }}>
                          👤 Diterima oleh: {item.claimed_by || 'Pemilik'}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                          🕒 Jam serah terima: {item.claimed_at ? new Date(item.claimed_at).toLocaleString('id-ID') : 'Selesai'}
                        </div>
                        {item.staff_notes && (
                          <div style={{ marginTop: '4px', color: '#cbd5e1', fontSize: '0.78rem', fontStyle: 'italic' }}>
                            Catatan: "{item.staff_notes}"
                          </div>
                        )}
                      </div>

                      {/* Tombol Lihat Foto Bukti */}
                      {item.proof_photo ? (
                        <button
                          className="btn btn-secondary"
                          style={{
                            width: '100%',
                            fontSize: '0.82rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            borderColor: 'rgba(16, 185, 129, 0.4)',
                            color: '#a7f3d0'
                          }}
                          onClick={() => setViewPhotoItem(item)}
                        >
                          <Eye size={15} /> 🔍 Lihat Foto Bukti Serah Terima
                        </button>
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                          (Diserahkan tanpa foto)
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODUL 3: KELOLA & TAMBAH BUKU BARU (STAFF BOOK MANAGEMENT) */}
      {/* ======================================================== */}
      {activeModule === 'books' && (
        <div>
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={26} color="#10b981" /> Manajemen Katalog & Input Buku Baru
              </h1>
              <p>
                Kelola koleksi buku perpustakaan. <strong>Tambah buku baru</strong>, unggah foto sampul fisik dari HP/PC, atau edit lokasi rak & stok.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-secondary"
                style={{ padding: '0.6rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={fetchBooks}
                title="Segarkan daftar buku"
              >
                <RefreshCw size={15} className={loadingBooks ? 'spin' : ''} /> Segarkan
              </button>

              <button 
                className="btn"
                style={{ 
                  background: 'linear-gradient(135deg, #059669, #10b981)', 
                  border: 'none', 
                  color: '#fff',
                  fontWeight: '700',
                  padding: '0.65rem 1.4rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)'
                }}
                onClick={handleOpenAddBook}
              >
                <Plus size={18} /> + Tambah Buku Baru
              </button>
            </div>
          </div>

          {/* Filter & Pencarian Buku */}
          <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            marginBottom: '1.5rem', 
            flexWrap: 'wrap', 
            background: 'rgba(0,0,0,0.2)', 
            padding: '1rem', 
            borderRadius: '12px',
            border: '1px solid var(--surface-border)'
          }}>
            <div style={{ flex: '1 1 250px', position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                className="form-control"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="Cari judul buku, nama pengarang, atau lokasi rak..."
                value={bookSearch}
                onChange={(e) => { setBookSearch(e.target.value); setBookPage(1); }}
              />
            </div>

            <div style={{ flex: '0 1 220px' }}>
              <select 
                className="form-control"
                value={bookCatFilter}
                onChange={(e) => { setBookCatFilter(e.target.value); setBookPage(1); }}
              >
                <option value="all">Semua Kategori ({bookList.length})</option>
                {Array.from(new Set(bookList.map(b => b.category).filter(Boolean))).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Konten Daftar Buku */}
          {loadingBooks ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <RefreshCw size={32} className="spin" style={{ margin: '0 auto 1rem auto', color: '#10b981' }} />
              <p style={{ color: 'var(--text-muted)' }}>Memuat katalog buku...</p>
            </div>
          ) : (
            <div>
              {(() => {
                const q = bookSearch.toLowerCase().trim();
                const filtered = bookList.filter(b => {
                  const matchCat = bookCatFilter === 'all' || b.category === bookCatFilter;
                  const matchSearch = !q || 
                    (b.title && b.title.toLowerCase().includes(q)) || 
                    (b.author && b.author.toLowerCase().includes(q)) || 
                    (b.shelf_location && b.shelf_location.toLowerCase().includes(q));
                  return matchCat && matchSearch;
                });

                if (filtered.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                      <AlertCircle size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 0.6rem auto' }} />
                      <p style={{ color: 'var(--text-muted)' }}>Tidak ada buku yang cocok dengan pencarian atau filter.</p>
                      <button className="btn btn-secondary" style={{ marginTop: '0.8rem' }} onClick={() => { setBookSearch(''); setBookCatFilter('all'); }}>
                        Reset Filter
                      </button>
                    </div>
                  );
                }

                const totalPages = Math.ceil(filtered.length / booksPerPage);
                const startIndex = (bookPage - 1) * booksPerPage;
                const pageBooks = filtered.slice(startIndex, startIndex + booksPerPage);

                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <span>Menampilkan <strong>{pageBooks.length}</strong> dari <strong>{filtered.length}</strong> buku</span>
                      <span>Halaman {bookPage} dari {totalPages || 1}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1.2rem' }}>
                      {pageBooks.map(book => (
                        <div 
                          key={book.id}
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--surface-border)',
                            borderRadius: '12px',
                            padding: '1rem',
                            display: 'flex',
                            gap: '1rem',
                            position: 'relative',
                            transition: 'transform 0.2s, border-color 0.2s',
                          }}
                        >
                          {/* Thumbnail Cover */}
                          <div style={{
                            width: '85px',
                            height: '115px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            flexShrink: 0,
                            background: '#1e293b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid rgba(255,255,255,0.1)'
                          }}>
                            {book.cover_url ? (
                              <img 
                                src={book.cover_url} 
                                alt={book.title} 
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            ) : (
                              <div style={{ textAlign: 'center', padding: '6px', fontSize: '0.7rem', color: '#94a3b8' }}>
                                <BookOpen size={24} style={{ margin: '0 auto 4px auto', opacity: 0.6 }} />
                                <span>No Cover</span>
                              </div>
                            )}
                          </div>

                          {/* Info Buku */}
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, minWidth: 0 }}>
                            <div>
                              <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                                  {book.category || 'Umum'}
                                </span>
                                {book.classification && (
                                  <span style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px' }}>
                                    DDC {book.classification}
                                  </span>
                                )}
                              </div>

                              <h4 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '2px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={book.title}>
                                {book.title}
                              </h4>
                              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {book.author}
                              </p>

                              <div style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <MapPin size={12} color="#f59e0b" />
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.shelf_location || 'Rak Utama'}</span>
                              </div>
                            </div>

                            {/* Stok & Tombol Aksi */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                              <span style={{ fontSize: '0.75rem', color: book.stock > 0 ? '#34d399' : '#f87171', fontWeight: '600' }}>
                                Stok: {book.stock || 1}
                              </span>

                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  onClick={() => handleOpenEditBook(book)}
                                  title="Edit data buku"
                                >
                                  <Edit3 size={13} /> Edit
                                </button>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                                  onClick={() => handleDeleteBook(book)}
                                  title="Hapus buku dari katalog"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.8rem', marginTop: '2rem' }}>
                        <button 
                          className="btn btn-secondary" 
                          disabled={bookPage <= 1}
                          onClick={() => setBookPage(p => Math.max(1, p - 1))}
                          style={{ padding: '0.5rem 1rem' }}
                        >
                          ← Sebelumnya
                        </button>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          Halaman <strong>{bookPage}</strong> dari <strong>{totalPages}</strong>
                        </span>
                        <button 
                          className="btn btn-secondary" 
                          disabled={bookPage >= totalPages}
                          onClick={() => setBookPage(p => Math.min(totalPages, p + 1))}
                          style={{ padding: '0.5rem 1rem' }}
                        >
                          Selanjutnya →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: TULIS PENGUMUMAN BARANG BARU (TEKS SAJA) */}
      {/* ======================================================== */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--surface-color)',
            border: '1.5px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '16px',
            padding: '1.8rem',
            maxWidth: '520px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h2 style={{ fontSize: '1.3rem', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={22} color="#f59e0b" /> Catat Barang Tertinggal Baru
              </h2>
              <button 
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.3rem' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.2rem', lineHeight: '1.4' }}>
              Masukkan informasi barang dalam <strong>bentuk tulisan teks saja</strong>. Informasi ini akan langsung muncul di halaman web pengunjung agar mereka bisa tahu barangnya tertinggal.
            </p>

            <form onSubmit={handleCreateAnnouncement}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                  Nama Barang (Teks Singkat)
                </label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Contoh: Cas HP Samsung Type-C Hitam" 
                  required
                  value={newLfData.item_name}
                  onChange={e => setNewLfData({ ...newLfData, item_name: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                  Lokasi Ditemukan
                </label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Contoh: Meja 4 (Lantai 1) atau Ruang Sastra" 
                  required
                  value={newLfData.location}
                  onChange={e => setNewLfData({ ...newLfData, location: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                  Keterangan Tambahan untuk Pengunjung
                </label>
                <textarea 
                  className="form-control" 
                  rows={3}
                  placeholder="Contoh: Tertinggal di colokan bawah meja 4 setelah jam baca siang. Barang disimpan aman di meja staf."
                  value={newLfData.description}
                  onChange={e => setNewLfData({ ...newLfData, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Batal
                </button>

                <button 
                  type="submit" 
                  className="btn"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', color: '#fff', fontWeight: '700' }}
                >
                  📢 Publikasikan ke Pengunjung
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: SERAH TERIMA & FOTO BUKTI PEMILIK */}
      {/* ======================================================== */}
      {handoverModalItem && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--surface-color)',
            border: '1.5px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '16px',
            padding: '1.8rem',
            maxWidth: '560px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.7)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--success)', fontWeight: '800' }}>
                  ✓ SERAH TERIMA BARANG
                </span>
                <h2 style={{ fontSize: '1.3rem', color: 'var(--text-main)', marginTop: '2px' }}>
                  {handoverModalItem.item_name}
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Lokasi: {handoverModalItem.location}
                </p>
              </div>

              <button 
                onClick={() => {
                  stopCamera();
                  setHandoverModalItem(null);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.3rem' }}
              >
                ✕
              </button>
            </div>

            {/* Input Nama Pengambil */}
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '6px' }}>
                👤 Nama Orang yang Mengambil (Wajib):
              </label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Contoh: Ahmad Faisal (Pengunjung Meja 4)" 
                required
                value={handoverData.claimed_by}
                onChange={e => setHandoverData({ ...handoverData, claimed_by: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.2rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Catatan Verifikasi Staf (Opsional):
              </label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Contoh: Sudah dicocokkan dengan tipe HP & kartu tanda mahasiswa miliknya" 
                value={handoverData.staff_notes}
                onChange={e => setHandoverData({ ...handoverData, staff_notes: e.target.value })}
                style={{ fontSize: '0.85rem' }}
              />
            </div>

            {/* AREA FOTO BUKTI SERAH TERIMA */}
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1.5px dashed rgba(255,255,255,0.15)', borderRadius: '12px', padding: '1.2rem', textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: '700', color: '#e2e8f0', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Camera size={18} color="var(--primary-color)" /> Foto Barang Bukti Serah Terima
              </div>

              {/* Tampilan Preview Foto yang Berhasil Diambil */}
              {handoverData.proof_photo ? (
                <div>
                  <img 
                    src={handoverData.proof_photo} 
                    alt="Bukti Foto" 
                    style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '10px', objectFit: 'contain', border: '2px solid var(--success)', marginBottom: '0.8rem' }} 
                  />
                  <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                      onClick={() => setHandoverData(prev => ({ ...prev, proof_photo: null }))}
                    >
                      🔄 Foto Ulang
                    </button>
                  </div>
                </div>
              ) : isCameraActive ? (
                /* Tampilan Video Stream Kamera Live */
                <div>
                  <video 
                    ref={videoRef} 
                    playsInline 
                    muted 
                    style={{ width: '100%', maxHeight: '240px', background: '#000', borderRadius: '10px', objectFit: 'cover', marginBottom: '0.8rem' }} 
                  />
                  <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center' }}>
                    <button
                      type="button"
                      className="btn"
                      style={{ background: 'var(--success)', padding: '0.5rem 1.2rem', fontSize: '0.85rem' }}
                      onClick={capturePhoto}
                    >
                      📸 Jepret Foto Sekarang
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}
                      onClick={stopCamera}
                    >
                      Tutup Kamera
                    </button>
                  </div>
                </div>
              ) : (
                /* Pilihan Buka Kamera atau Upload File */
                <div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Foto orang yang mengambil barang sebagai arsip bukti sah bahwa barang sudah diserahkan:
                  </p>

                  <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn"
                      style={{ background: 'var(--primary-color)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={startCamera}
                    >
                      <Camera size={16} /> Buka Kamera (Jepret Langsung)
                    </button>

                    <label 
                      className="btn btn-secondary" 
                      style={{ fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Upload size={16} /> Pilih dari Galeri / File
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="user" 
                        onChange={handleFileUpload} 
                        style={{ display: 'none' }} 
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Tombol Simpan Serah Terima */}
            <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => {
                  stopCamera();
                  setHandoverModalItem(null);
                }}
              >
                Batal
              </button>

              <button 
                type="button" 
                className="btn"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', fontWeight: '700', padding: '0.65rem 1.4rem' }}
                onClick={handleSaveHandover}
              >
                ✓ Simpan Serah Terima & Foto Bukti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: LIHAT FOTO BUKTI SERAH TERIMA */}
      {/* ======================================================== */}
      {viewPhotoItem && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--surface-color)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '16px',
            padding: '1.5rem',
            maxWidth: '520px',
            width: '100%',
            textAlign: 'center'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Bukti Serah Terima Barang</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Barang: <strong>{viewPhotoItem.item_name}</strong> ({viewPhotoItem.location})
                </p>
              </div>
              <button 
                onClick={() => setViewPhotoItem(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.3rem' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#000', borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <img 
                src={viewPhotoItem.proof_photo} 
                alt="Foto Bukti Orang Pengambil" 
                style={{ maxWidth: '100%', maxHeight: '350px', objectFit: 'contain', display: 'block', margin: '0 auto' }} 
              />
            </div>

            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.8rem', borderRadius: '8px', fontSize: '0.85rem', textAlign: 'left', marginBottom: '1rem' }}>
              <div>👤 <strong>Diterima oleh:</strong> {viewPhotoItem.claimed_by || 'Pemilik Sah'}</div>
              <div>🕒 <strong>Waktu Serah Terima:</strong> {viewPhotoItem.claimed_at ? new Date(viewPhotoItem.claimed_at).toLocaleString('id-ID') : '-'}</div>
              {viewPhotoItem.staff_notes && (
                <div style={{ marginTop: '4px', color: '#cbd5e1' }}>📝 <strong>Catatan Staf:</strong> {viewPhotoItem.staff_notes}</div>
              )}
            </div>

            <button 
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => setViewPhotoItem(null)}
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: INPUT & EDIT BUKU BARU (DENGAN UPLOAD FOTO HP) */}
      {/* ======================================================== */}
      {showBookModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.82)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--surface-color)',
            border: '1.5px solid rgba(16, 185, 129, 0.5)',
            borderRadius: '16px',
            padding: '1.8rem',
            maxWidth: '620px',
            width: '100%',
            boxShadow: '0 25px 50px rgba(0,0,0,0.7)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.8rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#10b981', fontWeight: '800' }}>
                  {editingBookId ? '✏️ EDIT DATA BUKU' : '📚 INPUT BUKU BARU'}
                </span>
                <h2 style={{ fontSize: '1.3rem', color: 'var(--text-main)', marginTop: '2px' }}>
                  {editingBookId ? 'Perbarui Informasi Buku' : 'Tambah Buku ke Koleksi Perpustakaan'}
                </h2>
              </div>
              <button 
                onClick={() => setShowBookModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.3rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBook}>
              {/* Judul & Pengarang */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px' }}>
                  Judul Buku <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Contoh: Laskar Pelangi atau Belajar React & Node.js"
                  required
                  value={bookFormData.title}
                  onChange={e => setBookFormData({ ...bookFormData, title: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px' }}>
                  Nama Pengarang <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Contoh: Andrea Hirata atau Tere Liye"
                  required
                  value={bookFormData.author}
                  onChange={e => setBookFormData({ ...bookFormData, author: e.target.value })}
                />
              </div>

              {/* Kategori & Kode DDC */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px' }}>
                    Kategori / Genre
                  </label>
                  <select 
                    className="form-control"
                    value={bookFormData.category}
                    onChange={e => setBookFormData({ ...bookFormData, category: e.target.value })}
                  >
                    <option value="Sastra & Fiksi">Sastra & Fiksi</option>
                    <option value="Novel">Novel</option>
                    <option value="Teknologi & Manajemen">Teknologi & Manajemen</option>
                    <option value="Komputer & Informasi">Komputer & Informasi</option>
                    <option value="Sains & Matematika">Sains & Matematika</option>
                    <option value="Ilmu Sosial & Pendidikan">Ilmu Sosial & Pendidikan</option>
                    <option value="Filsafat & Psikologi">Filsafat & Psikologi</option>
                    <option value="Agama">Agama</option>
                    <option value="Kesenian & Desain">Kesenian & Desain</option>
                    <option value="Sejarah & Geografi">Sejarah & Geografi</option>
                    <option value="Bahasa">Bahasa</option>
                    <option value="Koleksi Umum">Koleksi Umum</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px' }}>
                    Kode Klasifikasi (DDC)
                  </label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Contoh: 813 atau 004"
                    value={bookFormData.classification}
                    onChange={e => setBookFormData({ ...bookFormData, classification: e.target.value })}
                  />
                </div>
              </div>

              {/* Lokasi Rak & Stok */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.2rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px' }}>
                    Lokasi Rak Fisik di Perpustakaan
                  </label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Contoh: Lemari 3, Rak 2 atau Rak 800"
                    value={bookFormData.shelf_location}
                    onChange={e => setBookFormData({ ...bookFormData, shelf_location: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px' }}>
                    Jumlah Stok
                  </label>
                  <input 
                    type="number" 
                    min="1"
                    className="form-control" 
                    value={bookFormData.stock}
                    onChange={e => setBookFormData({ ...bookFormData, stock: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              {/* Upload Foto Sampul */}
              <div style={{ 
                background: 'rgba(0,0,0,0.25)', 
                padding: '1rem', 
                borderRadius: '12px', 
                border: '1px dashed rgba(255,255,255,0.15)',
                marginBottom: '1.5rem'
              }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '6px', color: '#fff' }}>
                  📸 Foto Sampul Buku (Pilih Salah Satu Cara)
                </label>

                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
                  {/* Tombol Ambil Foto / File */}
                  <label 
                    className="btn btn-secondary" 
                    style={{ 
                      cursor: 'pointer', 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      padding: '0.55rem 1rem',
                      fontSize: '0.85rem'
                    }}
                  >
                    <Camera size={16} color="#34d399" />
                    <span>Upload Foto / Jepret Kamera HP</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={{ display: 'none' }} 
                      onChange={handleCoverFileUpload}
                    />
                  </label>

                  {/* Tombol Cari Online */}
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    style={{ padding: '0.55rem 1rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    onClick={handleSearchOnlineCover}
                    disabled={isSearchingOnline}
                  >
                    <Sparkles size={16} color="#818cf8" />
                    <span>{isSearchingOnline ? 'Mencari...' : 'Cari Cover Online'}</span>
                  </button>
                </div>

                {/* Preview Sampul Jika Ada */}
                {coverPreview ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.6rem', padding: '0.6rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <img 
                      src={coverPreview} 
                      alt="Preview Sampul" 
                      style={{ width: '60px', height: '80px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)' }}
                    />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: '600', display: 'block' }}>
                        ✓ Foto sampul siap dipasang
                      </span>
                      <button 
                        type="button" 
                        style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.75rem', cursor: 'pointer', padding: 0, marginTop: '4px' }}
                        onClick={() => {
                          setCoverPreview('');
                          setBookFormData(prev => ({ ...prev, cover_url: '', cover_image: null }));
                        }}
                      >
                        Hapus Foto
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                    💡 Tips: Jika Anda membuka Dashboard Staf ini di HP, klik <strong>"Upload Foto / Jepret Kamera HP"</strong> untuk langsung memotret sampul buku fisik dengan kamera smartphone.
                  </p>
                )}

                {/* Hasil Rekomendasi Sampul Online Jika Ditemukan */}
                {onlineCoverResults.length > 0 && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.8rem' }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: '600', color: '#a5b4fc', marginBottom: '8px' }}>
                      Pilih salah satu sampul yang ditemukan dari internet:
                    </p>
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
                      {onlineCoverResults.map((c, idx) => (
                        <div 
                          key={idx}
                          style={{
                            cursor: 'pointer',
                            flexShrink: 0,
                            border: coverPreview === c.cover_url ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '6px',
                            overflow: 'hidden'
                          }}
                          onClick={() => handleSelectOnlineCover(c.cover_url)}
                          title={`Pilih: ${c.title}`}
                        >
                          <img src={c.cover_url} alt={c.title} style={{ width: '65px', height: '90px', objectFit: 'cover' }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Tombol Simpan & Batal */}
              <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowBookModal(false)}
                  disabled={isSubmittingBook}
                >
                  Batal
                </button>

                <button 
                  type="submit" 
                  className="btn"
                  style={{ 
                    background: 'linear-gradient(135deg, #059669, #10b981)', 
                    border: 'none', 
                    color: '#fff', 
                    fontWeight: '700',
                    padding: '0.65rem 1.6rem'
                  }}
                  disabled={isSubmittingBook}
                >
                  {isSubmittingBook ? 'Menyimpan...' : (editingBookId ? '💾 Simpan Perubahan' : '💾 Simpan Buku ke Katalog')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StaffDashboard;
