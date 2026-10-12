import { useState, useEffect, useRef } from 'react';
import { 
  Clock, Search, CheckCircle, PackageCheck, RefreshCw, Database, Ticket, Check, 
  Filter, Volume2, VolumeX, BellRing, Trash2, Package, Camera, Upload, Eye, X, 
<<<<<<< HEAD
  AlertCircle, Plus, User, CheckCircle2, Phone, MapPin, MessageCircle, BookOpen, 
  Edit3, Image, Star, Globe, Layers, Save
=======
  AlertCircle, Plus, User, CheckCircle2, Phone, MapPin, MessageCircle, BookPlus,
  ShieldCheck, Sparkles, Menu, ChevronDown 
>>>>>>> d8a935a1542f332fdb77a5846deeedc7ff10698e
} from 'lucide-react';
import { announceTableOrder } from '../utils/soundAnnouncement';
import { useModal } from '../context/ModalContext';
import BulkBookImport from './BulkBookImport';

function StaffDashboard() {
  const { showAlert, showConfirm } = useModal();
  // Modul Aktif: 'orders' | 'lost_found' | 'books'
  const [activeModule, setActiveModule] = useState('orders');
  // State menu filter & modul khusus mobile (HANYA tombol 3 garis di layar HP)
  const [mobileModuleMenuOpen, setMobileModuleMenuOpen] = useState(false);
  const [mobileOrdersMenuOpen, setMobileOrdersMenuOpen] = useState(false);
  const [mobileLfMenuOpen, setMobileLfMenuOpen] = useState(false);

  // ========================================================
  // STATE PESANAN BUKU
  // ========================================================
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // ========================================================
  // STATE MANAJEMEN BUKU (KATALOG)
  // ========================================================
  const [bookList, setBookList] = useState([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [bookSearch, setBookSearch] = useState('');
  const [bookCatFilter, setBookCatFilter] = useState('all');
  const [bookPage, setBookPage] = useState(1);
  const BOOKS_PER_PAGE = 20;

  // State Modal Tambah / Edit Buku
  const [showBookModal, setShowBookModal] = useState(false);
  const [editingBook, setEditingBook] = useState(null); // null = tambah baru, objek = edit
  const [bookForm, setBookForm] = useState({
    title: '', author: '', category: '', classification: '',
    shelf_location: '', stock: 1, cover_url: '', cover_image: null
  });
  const [coverPreview, setCoverPreview] = useState(null);
  const [isSubmittingBook, setIsSubmittingBook] = useState(false);
  const [searchingCover, setSearchingCover] = useState(false);
  const [coverCandidates, setCoverCandidates] = useState([]);
  const bookCoverInputRef = useRef(null);

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
  // FETCH BOOKS (Katalog Buku untuk Staf)
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
      } else if (activeModule === 'books') {
        fetchBooks();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeModule]);

  // --------------------------------------------------------
  // HANDLERS MANAJEMEN BUKU
  // --------------------------------------------------------
  const resetBookForm = () => {
    setBookForm({ title: '', author: '', category: '', classification: '', shelf_location: '', stock: 1, cover_url: '', cover_image: null });
    setCoverPreview(null);
    setCoverCandidates([]);
    setEditingBook(null);
  };

  const handleOpenAddBook = () => {
    resetBookForm();
    setShowBookModal(true);
  };

  const handleOpenEditBook = (book) => {
    setEditingBook(book);
    setBookForm({
      title: book.title || '',
      author: book.author || '',
      category: book.category || '',
      classification: book.classification || '',
      shelf_location: book.shelf_location || '',
      stock: book.stock || 1,
      cover_url: book.cover_url || '',
      cover_image: null
    });
    setCoverPreview(book.cover_url || null);
    setCoverCandidates([]);
    setShowBookModal(true);
  };

  // Upload sampul dari file lokal
  const handleBookCoverFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 800;
        let w = img.width, h = img.height;
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', 0.82);
        setBookForm(prev => ({ ...prev, cover_image: compressed, cover_url: '' }));
        setCoverPreview(compressed);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Cari sampul otomatis via OpenLibrary
  const handleSearchCover = async () => {
    if (!bookForm.title.trim()) {
      showAlert('Isi judul buku terlebih dahulu sebelum mencari sampul.', { type: 'warning' });
      return;
    }
    setSearchingCover(true);
    setCoverCandidates([]);
    try {
      const res = await fetch('/api/books/search-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bookForm.title, author: bookForm.author })
      });
      const data = await res.json();
      if (data.candidates && data.candidates.length > 0) {
        setCoverCandidates(data.candidates);
      } else {
        showAlert('Sampul tidak ditemukan di OpenLibrary. Coba upload foto sendiri.', { type: 'info' });
      }
    } catch (err) {
      showAlert('Gagal terhubung ke server untuk mencari sampul.', { type: 'danger' });
    } finally {
      setSearchingCover(false);
    }
  };

  const handleSelectCoverCandidate = (candidate) => {
    setBookForm(prev => ({ ...prev, cover_url: candidate.cover_url, cover_image: null }));
    setCoverPreview(candidate.cover_url);
    setCoverCandidates([]);
  };

  const handleSubmitBook = async (e) => {
    e.preventDefault();
    if (!bookForm.title.trim()) {
      showAlert('Judul buku wajib diisi!', { type: 'warning', title: 'Data Belum Lengkap' });
      return;
    }
    if (!bookForm.author.trim()) {
      showAlert('Nama pengarang wajib diisi!', { type: 'warning', title: 'Data Belum Lengkap' });
      return;
    }
    setIsSubmittingBook(true);
    try {
      const payload = {
        title: bookForm.title.trim(),
        author: bookForm.author.trim(),
        category: bookForm.category.trim() || 'Umum',
        classification: bookForm.classification.trim() || '000',
        shelf_location: bookForm.shelf_location.trim() || 'Rak Utama',
        stock: parseInt(bookForm.stock) || 1,
        cover_url: bookForm.cover_image ? null : (bookForm.cover_url || null),
        cover_image: bookForm.cover_image || null
      };

      const url = editingBook ? `/api/books/${editingBook.id}` : '/api/books';
      const method = editingBook ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        showAlert(
          editingBook
            ? `Buku "${bookForm.title}" berhasil diperbarui!`
            : `Buku "${bookForm.title}" berhasil ditambahkan ke katalog!`,
          { type: 'success', title: editingBook ? 'Buku Diperbarui' : 'Buku Ditambahkan' }
        );
        setShowBookModal(false);
        resetBookForm();
        fetchBooks();
      } else {
        showAlert(data.error || 'Terjadi kesalahan saat menyimpan buku.', { type: 'danger', title: 'Gagal Menyimpan' });
      }
    } catch (err) {
      showAlert('Gagal terhubung ke server backend: ' + err.message, { type: 'danger', title: 'Koneksi Gagal' });
    } finally {
      setIsSubmittingBook(false);
    }
  };

  const handleDeleteBook = async (book) => {
    const confirmed = await showConfirm(`Yakin ingin menghapus buku "${book.title}" dari katalog perpustakaan?`, {
      title: 'Hapus Buku',
      confirmText: 'Ya, Hapus Buku',
      cancelText: 'Batal',
      type: 'danger'
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/books/${book.id}`, { method: 'DELETE' });
      if (res.ok) {
        showAlert(`Buku "${book.title}" berhasil dihapus.`, { type: 'success', title: 'Buku Dihapus' });
        fetchBooks();
      } else {
        showAlert('Gagal menghapus buku.', { type: 'danger', title: 'Gagal' });
      }
    } catch (err) {
      showAlert('Koneksi gagal: ' + err.message, { type: 'danger', title: 'Error' });
    }
  };

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
      showAlert('Browser HP membatasi streaming kamera di jaringan HTTP (bukan HTTPS). Silakan tekan tombol hijau "Jepret Kamera HP / Pilih Galeri" di bawah untuk langsung memotret dari kamera HP Anda!', {
        type: 'warning',
        title: 'Gunakan Kamera HP / Galeri'
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

    // Kompresi foto secara otomatis sebelum disimpan ke database
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        const MAX_HEIGHT = 1000;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Kompresi ke format JPEG 80% (sekitar ~100KB, sangat aman untuk MySQL)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setHandoverData(prev => ({ ...prev, proof_photo: compressedDataUrl }));
      };
      img.src = event.target.result;
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
        showAlert('Barang berhasil diserahkan ke pemilik dan foto bukti serah terima telah tersimpan di database!', {
          type: 'success',
          title: 'Serah Terima Berhasil'
        });
        stopCamera();
        setHandoverModalItem(null);
        setHandoverData({ claimed_by: '', staff_notes: '', proof_photo: null });
        fetchLostFound();
      } else {
        const errData = await res.json().catch(() => ({}));
        showAlert(errData.error || 'Gagal menyimpan serah terima ke server.', {
          type: 'danger',
          title: 'Gagal Menyimpan'
        });
      }
    } catch (err) {
      console.error('Gagal mencatat serah terima:', err);
      showAlert('Gagal terhubung ke server database saat menyimpan bukti.', {
        type: 'danger',
        title: 'Koneksi Terputus'
      });
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
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
      {/* ======================================================== */}
      {/* HEADER PORTAL PETUGAS PERPUSTAKAAN */}
      {/* ======================================================== */}
      <div className="staff-portal-header">
        <div className="staff-portal-info">
          <div className="staff-portal-avatar">
            <ShieldCheck size={26} />
          </div>
          <div className="staff-portal-title">
            <h2>Portal Staf & Petugas Perpustakaan</h2>
            <p>Pusat kontrol verifikasi tiket meja, arsip lost & found, dan pengadaan katalog buku otomatis</p>
          </div>
        </div>

        <div className="staff-portal-status">
          <span className="staff-status-dot"></span>
          <span>{isDbConnected ? 'MySQL XAMPP Terhubung' : 'Mode Offline'}</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SWITCHER MODUL UTAMA STAF (DESKTOP: GRID, MOBILE: 3-GARIS) */}
      {/* ======================================================== */}
      
      {/* Desktop Only (Web): 3 Kartu Grid Modern - SAMA SEKALI TIDAK DIUBAH */}
      <div className="staff-module-nav desktop-module-nav">
        <button
          type="button"
          className={`staff-nav-btn ${activeModule === 'orders' ? 'active orders' : ''}`}
          onClick={() => setActiveModule('orders')}
        >
          <div className="staff-nav-btn-content">
            <div className="staff-nav-icon">
              <Ticket size={20} />
            </div>
            <div className="staff-nav-labels">
              <span className="staff-nav-label-main">Antrean Pesanan Tiket</span>
              <span className="staff-nav-label-sub">Panggilan meja & verifikasi</span>
            </div>
          </div>
          <span className="staff-nav-badge">{counts.all}</span>
        </button>

        <button
          type="button"
          className={`staff-nav-btn ${activeModule === 'lost_found' ? 'active lost_found' : ''}`}
          onClick={() => {
            setActiveModule('lost_found');
            fetchLostFound();
          }}
        >
          <div className="staff-nav-btn-content">
            <div className="staff-nav-icon">
              <Package size={20} />
            </div>
            <div className="staff-nav-labels">
              <span className="staff-nav-label-main">Barang Tertinggal (Lost & Found)</span>
              <span className="staff-nav-label-sub">Dokumentasi serah terima foto</span>
            </div>
          </div>
          <span className="staff-nav-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {totalActiveLf}
            {userReportItems.length > 0 && (
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} title={`${userReportItems.length} laporan kehilangan baru`} />
            )}
          </span>
        </button>

        <button
<<<<<<< HEAD
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
          <BookOpen size={18} /> Katalog &amp; Tambah Buku
          <span style={{ 
            background: activeModule === 'books' ? 'rgba(0,0,0,0.3)' : 'rgba(16, 185, 129, 0.25)', 
            color: activeModule === 'books' ? '#fff' : '#34d399',
            padding: '2px 8px', 
            borderRadius: '12px', 
            fontSize: '0.75rem',
            fontWeight: '800'
          }}>
            {bookList.length}
          </span>
        </button>
=======
          type="button"
          className={`staff-nav-btn ${activeModule === 'import_books' ? 'active import_books' : ''}`}
          onClick={() => setActiveModule('import_books')}
        >
          <div className="staff-nav-btn-content">
            <div className="staff-nav-icon">
              <BookPlus size={20} />
            </div>
            <div className="staff-nav-labels">
              <span className="staff-nav-label-main">Tambah Buku dari PDF</span>
              <span className="staff-nav-label-sub">AI & OCR pencocok sampul acak</span>
            </div>
          </div>
          <span className="staff-nav-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Sparkles size={12} color="#34d399" /> Otomatis
          </span>
        </button>
      </div>

      {/* Mobile Only: HANYA Tombol Garis 3 (Hamburger Dropdown - Bebas Scroll Samping) */}
      <div className="mobile-module-container">
        <button
          type="button"
          className="mobile-hamburger-btn mobile-module-trigger-btn"
          onClick={() => {
            setMobileModuleMenuOpen(!mobileModuleMenuOpen);
            setMobileOrdersMenuOpen(false);
            setMobileLfMenuOpen(false);
          }}
          aria-expanded={mobileModuleMenuOpen}
          title="Pilih Modul Staf"
        >
          <div className="mobile-hamburger-btn-left">
            <div className="mobile-hamburger-icon">
              <span className="bar" />
              <span className="bar" />
              <span className="bar" />
            </div>
            <span className="mobile-hamburger-active-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              {activeModule === 'orders' && (
                <>
                  <Ticket size={16} color="#818cf8" />
                  <span>Antrean Tiket ({counts.all})</span>
                </>
              )}
              {activeModule === 'lost_found' && (
                <>
                  <Package size={16} color="#f59e0b" />
                  <span>Barang Tertinggal ({totalActiveLf})</span>
                  {userReportItems.length > 0 && (
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444' }} />
                  )}
                </>
              )}
              {activeModule === 'import_books' && (
                <>
                  <BookPlus size={16} color="#34d399" />
                  <span>Tambah Buku PDF</span>
                  <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(52, 211, 153, 0.2)', color: '#34d399', fontWeight: 700 }}>AI</span>
                </>
              )}
            </span>
          </div>
          <ChevronDown size={15} className={`mobile-hamburger-chevron ${mobileModuleMenuOpen ? 'open' : ''}`} />
        </button>

        {mobileModuleMenuOpen && (
          <>
            <div className="mobile-dropdown-backdrop" onClick={() => setMobileModuleMenuOpen(false)} />
            <div className="mobile-filter-dropdown mobile-module-dropdown">
              <button
                type="button"
                className={`mobile-filter-option ${activeModule === 'orders' ? 'active' : ''}`}
                onClick={() => {
                  setActiveModule('orders');
                  setMobileModuleMenuOpen(false);
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Ticket size={16} color="#818cf8" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="mobile-filter-text" style={{ fontWeight: 700 }}>Antrean Pesanan Tiket</span>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Panggilan meja & verifikasi</span>
                  </div>
                </div>
                <span className="mobile-filter-badge">{counts.all}</span>
              </button>

              <button
                type="button"
                className={`mobile-filter-option ${activeModule === 'lost_found' ? 'active lost_found' : ''}`}
                onClick={() => {
                  setActiveModule('lost_found');
                  fetchLostFound();
                  setMobileModuleMenuOpen(false);
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Package size={16} color="#f59e0b" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="mobile-filter-text" style={{ fontWeight: 700 }}>Barang Tertinggal (Lost & Found)</span>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Dokumentasi serah terima foto</span>
                  </div>
                </div>
                <span className="mobile-filter-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {totalActiveLf}
                  {userReportItems.length > 0 && (
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444' }} />
                  )}
                </span>
              </button>

              <button
                type="button"
                className={`mobile-filter-option ${activeModule === 'import_books' ? 'active import_books' : ''}`}
                onClick={() => {
                  setActiveModule('import_books');
                  setMobileModuleMenuOpen(false);
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BookPlus size={16} color="#34d399" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="mobile-filter-text" style={{ fontWeight: 700 }}>Tambah Buku dari PDF</span>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>AI & OCR pencocok sampul acak</span>
                  </div>
                </div>
                <span className="mobile-filter-badge" style={{ color: '#34d399', background: 'rgba(52, 211, 153, 0.15)', border: '1px solid rgba(52, 211, 153, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <Sparkles size={11} color="#34d399" /> Otomatis
                </span>
              </button>
            </div>
          </>
        )}
>>>>>>> d8a935a1542f332fdb77a5846deeedc7ff10698e
      </div>

      {/* ======================================================== */}
      {/* MODUL 1: PESANAN BUKU MEJA */}
      {/* ======================================================== */}
      {activeModule === 'orders' && (
        <div>
          {/* ======================================================== */}
          {/* DECK KONTROL TERPADU: FILTER + CARI + AKSI CEPAT */}
          {/* Tampilan ringkas, tenang, dan tidak ramai di mata */}
          {/* ======================================================== */}
          <div className={`orders-control-deck ${mobileOrdersMenuOpen ? 'menu-open' : ''}`}>
            {/* Desktop Web: Segmented Tab Lengkap (5 Tombol) - HANYA DI DESKTOP */}
            <div className="orders-filter-segment desktop-filter-segment" role="tablist" aria-label="Filter Status Antrean">
              {[
                { key: 'all', label: 'Semua Pesanan', count: counts.all },
                { key: 'in_progress', label: 'Perlu Diproses', count: counts.in_progress },
                { key: 'ready', label: 'Siap Diambil', count: counts.ready },
                { key: 'completed', label: 'Selesai', count: counts.completed },
                { key: 'cancelled', label: 'Dibatalkan', count: counts.cancelled },
              ].map((tab) => {
                const isActive = statusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`orders-segment-btn ${isActive ? 'active' : ''}`}
                    onClick={() => setStatusFilter(tab.key)}
                  >
                    <span>{tab.label}</span>
                    <span className="orders-segment-count">{tab.count}</span>
                  </button>
                );
              })}
            </div>

            {/* Mobile Only: HANYA Tombol Garis 3 (Hamburger Menu) */}
            <div className="mobile-filter-container">
              <button
                type="button"
                className="mobile-hamburger-btn"
                onClick={() => {
                  setMobileOrdersMenuOpen(!mobileOrdersMenuOpen);
                  setMobileModuleMenuOpen(false);
                }}
                aria-expanded={mobileOrdersMenuOpen}
                title="Buka pilihan filter antrean"
              >
                <div className="mobile-hamburger-btn-left">
                  <div className="mobile-hamburger-icon">
                    <span className="bar" />
                    <span className="bar" />
                    <span className="bar" />
                  </div>
                  <span className="mobile-hamburger-active-label">
                    {statusFilter === 'all' && `Semua Pesanan (${counts.all})`}
                    {statusFilter === 'in_progress' && `Perlu Diproses (${counts.in_progress})`}
                    {statusFilter === 'ready' && `Siap Diambil (${counts.ready})`}
                    {statusFilter === 'completed' && `Selesai (${counts.completed})`}
                    {statusFilter === 'cancelled' && `Dibatalkan (${counts.cancelled})`}
                  </span>
                </div>
                <ChevronDown size={14} className={`mobile-hamburger-chevron ${mobileOrdersMenuOpen ? 'open' : ''}`} />
              </button>

              {mobileOrdersMenuOpen && (
                <>
                  <div className="mobile-dropdown-backdrop" onClick={() => setMobileOrdersMenuOpen(false)} />
                  <div className="mobile-filter-dropdown">
                    {[
                      { key: 'all', label: 'Semua Pesanan', count: counts.all },
                      { key: 'in_progress', label: 'Perlu Diproses', count: counts.in_progress },
                      { key: 'ready', label: 'Siap Diambil', count: counts.ready },
                      { key: 'completed', label: 'Selesai', count: counts.completed },
                      { key: 'cancelled', label: 'Dibatalkan', count: counts.cancelled },
                    ].map((tab) => {
                      const isActive = statusFilter === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          className={`mobile-filter-option ${isActive ? 'active' : ''}`}
                          onClick={() => {
                            setStatusFilter(tab.key);
                            setMobileOrdersMenuOpen(false);
                          }}
                        >
                          <span className="mobile-filter-text">{tab.label}</span>
                          <span className="mobile-filter-badge">{tab.count}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Sisi Kanan: Pencarian Ringkas & Utilitas Suara/Refresh */}
            <div className="orders-actions-cluster">
              <div className="orders-search-box">
                <Search size={14} className="orders-search-icon" />
                <input 
                  type="text" 
                  className="orders-search-input" 
                  placeholder="Cari tiket, meja, judul..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button 
                    type="button"
                    className="orders-search-clear"
                    onClick={() => setSearchQuery('')}
                    title="Hapus pencarian"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="orders-utility-group">
                <button 
                  type="button"
                  className={`orders-utility-btn ${soundEnabled ? 'active-audio' : 'muted-audio'}`} 
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  title={soundEnabled ? "Speaker Aktif (klik untuk senyapkan pengumuman)" : "Speaker Senyap (klik untuk nyalakan)"}
                >
                  {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                  <span className="utility-label">{soundEnabled ? 'Suara ON' : 'Mute'}</span>
                </button>

                <button 
                  type="button"
                  className="orders-utility-btn" 
                  onClick={() => announceTableOrder('Meja 3', 'TKT-1003')}
                  title="Klik untuk tes suara pengumuman meja"
                >
                  <BellRing size={15} />
                  <span className="utility-label">Tes Suara</span>
                </button>

                <button 
                  type="button"
                  className="orders-utility-btn orders-refresh-btn" 
                  onClick={fetchOrders}
                  title="Segarkan antrean pesanan"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>

                {(counts.completed > 0 || counts.cancelled > 0) && (
                  <button
                    type="button"
                    className="orders-utility-btn danger"
                    onClick={handleCleanupCompleted}
                    title="Bersihkan pesanan selesai & dibatalkan agar antrean tetap ringkas"
                  >
                    <Trash2 size={13} />
                    <span className="utility-label">Bersihkan ({counts.completed + counts.cancelled})</span>
                  </button>
                )}
              </div>
            </div>
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
          {/* ======================================================== */}
          {/* DECK KONTROL LOST & FOUND: TAB KATEGORI + AKSI CEPAT */}
          {/* ======================================================== */}
          <div className={`orders-control-deck ${mobileLfMenuOpen ? 'menu-open' : ''}`}>
            {/* Desktop Web: Segmented Tab Lengkap (3 Tombol) - HANYA DI DESKTOP */}
            <div className="orders-filter-segment desktop-filter-segment" role="tablist" aria-label="Kategori Barang Tertinggal">
              <button
                type="button"
                className={`orders-segment-btn ${lfTab === 'found' ? 'active' : ''}`}
                style={{
                  background: lfTab === 'found' ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.35), rgba(217, 119, 6, 0.45))' : '',
                  borderColor: lfTab === 'found' ? 'rgba(245, 158, 11, 0.5)' : 'transparent',
                  color: lfTab === 'found' ? '#fff' : '#f59e0b'
                }}
                onClick={() => setLfTab('found')}
              >
                <Package size={15} />
                <span>Ditemukan Staf</span>
                <span className="orders-segment-count">{staffFoundItems.length}</span>
              </button>

              <button
                type="button"
                className={`orders-segment-btn ${lfTab === 'user_reports' ? 'active' : ''}`}
                style={{
                  background: lfTab === 'user_reports' ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.35), rgba(79, 70, 229, 0.45))' : '',
                  borderColor: lfTab === 'user_reports' ? 'rgba(129, 140, 248, 0.5)' : 'transparent',
                  color: lfTab === 'user_reports' ? '#fff' : '#818cf8'
                }}
                onClick={() => setLfTab('user_reports')}
              >
                <User size={15} />
                <span>Laporan Pengunjung</span>
                <span className="orders-segment-count">{userReportItems.length}</span>
              </button>

              <button
                type="button"
                className={`orders-segment-btn ${lfTab === 'claimed' ? 'active' : ''}`}
                style={{
                  background: lfTab === 'claimed' ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.35), rgba(5, 150, 105, 0.45))' : '',
                  borderColor: lfTab === 'claimed' ? 'rgba(52, 211, 153, 0.5)' : 'transparent',
                  color: lfTab === 'claimed' ? '#fff' : '#34d399'
                }}
                onClick={() => setLfTab('claimed')}
              >
                <CheckCircle2 size={15} />
                <span>Riwayat Diserahkan</span>
                <span className="orders-segment-count">{claimedLf.length}</span>
              </button>
            </div>

            {/* Mobile Only: HANYA Tombol Garis 3 (Hamburger Menu) */}
            <div className="mobile-filter-container">
              <button
                type="button"
                className="mobile-hamburger-btn"
                onClick={() => {
                  setMobileLfMenuOpen(!mobileLfMenuOpen);
                  setMobileModuleMenuOpen(false);
                }}
                aria-expanded={mobileLfMenuOpen}
                title="Buka pilihan kategori barang"
              >
                <div className="mobile-hamburger-btn-left">
                  <div className="mobile-hamburger-icon">
                    <span className="bar" />
                    <span className="bar" />
                    <span className="bar" />
                  </div>
                  <span className="mobile-hamburger-active-label">
                    {lfTab === 'found' && `Ditemukan Staf (${staffFoundItems.length})`}
                    {lfTab === 'user_reports' && `Laporan Pengunjung (${userReportItems.length})`}
                    {lfTab === 'claimed' && `Riwayat Diserahkan (${claimedLf.length})`}
                  </span>
                </div>
                <ChevronDown size={14} className={`mobile-hamburger-chevron ${mobileLfMenuOpen ? 'open' : ''}`} />
              </button>

              {mobileLfMenuOpen && (
                <>
                  <div className="mobile-dropdown-backdrop" onClick={() => setMobileLfMenuOpen(false)} />
                  <div className="mobile-filter-dropdown">
                    {[
                      { key: 'found', label: 'Ditemukan Staf', icon: Package, count: staffFoundItems.length, color: '#f59e0b' },
                      { key: 'user_reports', label: 'Laporan Pengunjung', icon: User, count: userReportItems.length, color: '#818cf8' },
                      { key: 'claimed', label: 'Riwayat Diserahkan', icon: CheckCircle2, count: claimedLf.length, color: '#34d399' },
                    ].map((tab) => {
                      const isActive = lfTab === tab.key;
                      const IconComp = tab.icon;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          className={`mobile-filter-option ${isActive ? 'active lost_found' : ''}`}
                          onClick={() => {
                            setLfTab(tab.key);
                            setMobileLfMenuOpen(false);
                          }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <IconComp size={15} color={tab.color} />
                            <span className="mobile-filter-text">{tab.label}</span>
                          </span>
                          <span className="mobile-filter-badge">{tab.count}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Sisi Kanan: Aksi Baru & Refresh */}
            <div className="orders-actions-cluster">
              <button
                type="button"
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: '700',
                  padding: '0.45rem 1rem',
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '9px',
                  boxShadow: '0 2px 10px rgba(245, 158, 11, 0.35)'
                }}
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={15} /> + Pengumuman Barang
              </button>

              <button
                type="button"
                className="orders-utility-btn"
                onClick={fetchLostFound}
                title="Segarkan data lost & found"
              >
                <RefreshCw size={14} className={loadingLf ? 'animate-spin' : ''} />
              </button>
            </div>
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
<<<<<<< HEAD
      {/* MODUL 3: KONTROL STATUS MEJA & OKUPANSI RUANGAN */}
      {/* ======================================================== */}
      {activeModule === 'tables' && (
        <div>
          {/* Header Modul Kontrol Meja */}
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <LayoutGrid size={26} color="#10b981" /> Manajemen Status Meja Real-Time
              </h1>
              <p>
                Pantau okupansi ruangan secara langsung, ubah status meja secara manual jika pengunjung tidak melakukan check-out, atau reset semua meja saat perpustakaan tutup.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-secondary"
                style={{ padding: '0.55rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={fetchStaffTables}
              >
                <RefreshCw size={15} /> Segarkan
              </button>

              <button 
                className="btn btn-secondary"
                style={{ 
                  padding: '0.55rem 1rem', 
                  fontSize: '0.85rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                  color: '#f87171'
                }}
                onClick={handleStaffResetAllTables}
                title="Reset semua status meja menjadi Tersedia / Kosong"
              >
                <Trash2 size={15} /> Reset Semua Meja
              </button>

              <a 
                href="/tables"
                target="_blank"
                rel="noreferrer"
                className="btn"
                style={{ 
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', 
                  border: 'none', 
                  color: '#fff', 
                  fontWeight: '700', 
                  padding: '0.55rem 1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  textDecoration: 'none',
                  fontSize: '0.85rem'
                }}
              >
                <Monitor size={15} /> Buka Layar TV Lobby ↗
              </a>
            </div>
          </div>

          {/* Stats Bar Ringkas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(99,102,241,0.2)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Kapasitas</div>
                <div style={{ fontSize: '1.3rem', fontWeight: '800' }}>{staffStats.total_seats || 56} Kursi <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({staffStats.total_tables || staffTables.length} Meja)</span></div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(239,68,68,0.2)', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <XCircle size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Meja Terisi</div>
                <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#f87171' }}>{staffTables.filter(t => t.status === 'occupied').length} Meja</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(16,185,129,0.2)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Meja Kosong (Tersedia)</div>
                <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#34d399' }}>{staffTables.filter(t => t.status === 'available').length} Meja</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(56,189,248,0.2)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tingkat Keterisian</div>
                <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#38bdf8' }}>{staffStats.occupancy_rate || 0}%</div>
              </div>
            </div>
          </div>

          {/* Filter Zona Meja */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Filter size={14} /> Filter Zona:
            </span>
            {['ALL', 'Zona Baca Utama', 'Zona Komputer & Riset', 'Zona Baca Tenang', 'Bilik Diskusi'].map(z => (
              <button
                key={z}
                className={`btn ${tableZoneFilter === z ? '' : 'btn-secondary'}`}
                style={{
                  padding: '0.35rem 0.8rem',
                  fontSize: '0.8rem',
                  background: tableZoneFilter === z ? 'var(--primary-color)' : '',
                  borderColor: tableZoneFilter === z ? 'var(--primary-color)' : ''
                }}
                onClick={() => setTableZoneFilter(z)}
              >
                {z === 'ALL' ? 'Semua Zona' : z}
              </button>
            ))}
          </div>

          {/* Grid Manajemen Meja */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.2rem' }}>
            {staffTables
              .filter(t => tableZoneFilter === 'ALL' || t.zone === tableZoneFilter)
              .map(table => {
                const isOccupied = table.status === 'occupied';
                const isReserved = table.status === 'reserved';
                const isAvailable = table.status === 'available';

                return (
                  <div
                    key={table.id}
                    className="glass-panel"
                    style={{
                      padding: '1.25rem',
                      borderRadius: '14px',
                      border: isOccupied 
                        ? '1.5px solid rgba(239, 68, 68, 0.5)' 
                        : isReserved 
                        ? '1.5px solid rgba(245, 158, 11, 0.5)' 
                        : '1.5px solid rgba(16, 185, 129, 0.4)',
                      background: isOccupied 
                        ? 'linear-gradient(145deg, rgba(127, 29, 29, 0.2), rgba(15, 23, 42, 0.85))' 
                        : isReserved 
                        ? 'linear-gradient(145deg, rgba(120, 53, 15, 0.2), rgba(15, 23, 42, 0.85))' 
                        : 'linear-gradient(145deg, rgba(6, 78, 59, 0.2), rgba(15, 23, 42, 0.85))',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '1rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: '800', color: '#fff' }}>{table.table_number}</span>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: '800',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '999px',
                          background: isAvailable ? 'rgba(16, 185, 129, 0.2)' : isOccupied ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: isAvailable ? '#34d399' : isOccupied ? '#f87171' : '#fbbf24',
                          border: `1px solid ${isAvailable ? '#10b981' : isOccupied ? '#ef4444' : '#f59e0b'}`
                        }}>
                          {isAvailable ? 'KOSONG' : isOccupied ? 'TERISI' : 'DIPESAN'}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={13} /> {table.zone}
                      </div>

                      <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.6rem 0.8rem', borderRadius: '8px', fontSize: '0.78rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Kapasitas:</span>
                          <span style={{ fontWeight: '700', color: '#fff' }}>{table.capacity} Orang</span>
                        </div>
                        {isOccupied && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Pengguna:</span>
                            <span style={{ fontWeight: '700', color: '#fca5a5' }}>{table.current_user_name || 'Pengunjung'}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tombol Kontrol Staf */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        className="btn"
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          fontSize: '0.8rem',
                          fontWeight: '700',
                          background: isOccupied 
                            ? 'linear-gradient(135deg, #10b981, #059669)' 
                            : 'linear-gradient(135deg, #ef4444, #dc2626)',
                          color: '#fff',
                          border: 'none'
                        }}
                        onClick={() => handleStaffToggleTable(table)}
                      >
                        {isOccupied ? '✓ Set Kosong' : '✕ Set Terisi'}
                      </button>

                      <button
                        className="btn btn-secondary"
                        style={{
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.78rem',
                          borderColor: isReserved ? '#f59e0b' : 'rgba(255,255,255,0.1)'
                        }}
                        onClick={() => handleStaffSetTableStatus(table, isReserved ? 'available' : 'reserved')}
                        title="Set status reservasi khusus / dipesan"
                      >
                        {isReserved ? 'Batal Pesan' : 'Reservasi'}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
=======
      {/* MODUL 3: TAMBAH BUKU DARI PDF (DAFTAR & SAMPUL CERDAS) */}
      {/* ======================================================== */}
      {activeModule === 'import_books' && (
        <BulkBookImport />
>>>>>>> d8a935a1542f332fdb77a5846deeedc7ff10698e
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
                    <label 
                      className="btn" 
                      style={{ 
                        fontSize: '0.85rem', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: '#ffffff',
                        fontWeight: '700',
                        boxShadow: '0 2px 10px rgba(16, 185, 129, 0.35)'
                      }}
                    >
                      <Camera size={16} /> 📷 Jepret Kamera HP / Pilih Galeri
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileUpload} 
                        style={{ display: 'none' }} 
                      />
                    </label>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={startCamera}
                      title="Gunakan webcam bawaan laptop/PC (hanya jika didukung HTTPS/localhost)"
                    >
                      <Camera size={15} /> Buka Webcam Laptop
                    </button>
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
    </div>
  );
}

export default StaffDashboard;
