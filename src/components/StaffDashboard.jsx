import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { 
  Clock, Search, CheckCircle, PackageCheck, RefreshCw, Database, Ticket, Check, 
  Filter, Volume2, VolumeX, BellRing, Bell, Trash2, Package, Camera, Upload, Eye, X, 
  AlertCircle, Plus, User, CheckCircle2, Phone, MapPin, MessageCircle, BookOpen, 
  Edit3, Image, Star, Globe, Layers, Save, BookPlus, ShieldCheck, Sparkles, Menu, ChevronDown, LayoutGrid,
  ChevronLeft, ChevronRight, Library, QrCode
} from 'lucide-react';
import { announceTableOrder, playNewOrderAlarm } from '../utils/soundAnnouncement';
import { useModal } from '../context/ModalContext';
import { parseOrderBookTitles } from '../utils/orderBooks';
import BulkBookImport from './BulkBookImport';
import TableQRModal from './TableQRModal';

function StaffDashboard() {
  const { showAlert, showConfirm } = useModal();
  const [showTableQrModal, setShowTableQrModal] = useState(false);

  // Dengarkan event pembukaan modal barcode meja dari navigasi atas
  useEffect(() => {
    const handleOpenTableQr = () => setShowTableQrModal(true);
    window.addEventListener('open_table_qr_modal', handleOpenTableQr);
    return () => window.removeEventListener('open_table_qr_modal', handleOpenTableQr);
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();
  const currentTabParam = searchParams.get('tab');
  const activeModule = (currentTabParam === 'lost_found' || currentTabParam === 'import_books' || currentTabParam === 'books')
    ? currentTabParam
    : 'orders';

  const setActiveModule = (newMod) => {
    if (newMod === 'orders') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: newMod });
    }
  };

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
  const [visitorCallEnabled, setVisitorCallEnabled] = useState(() => {
    return localStorage.getItem('perpus_visitor_call_sound') !== 'false';
  });
  const [callingOrderId, setCallingOrderId] = useState(null);

  const handleToggleVisitorCall = () => {
    const nextState = !visitorCallEnabled;
    setVisitorCallEnabled(nextState);
    localStorage.setItem('perpus_visitor_call_sound', String(nextState));
    window.dispatchEvent(new CustomEvent('perpus_visitor_call_toggle', { detail: nextState }));
  };

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

  // Perhitungan Kategori, Statistik, dan Filter Buku Staf
  const bookCategories = useMemo(() => {
    const cats = new Set();
    bookList.forEach(b => {
      if (b.category && b.category.trim()) cats.add(b.category.trim());
    });
    return Array.from(cats).sort((a, b) => a.localeCompare(b));
  }, [bookList]);

  const totalBookStock = useMemo(() => {
    return bookList.reduce((acc, b) => acc + (parseInt(b.stock) || 0), 0);
  }, [bookList]);

  const booksWithShelf = useMemo(() => {
    return bookList.filter(b => b.shelf_location && b.shelf_location.trim() && !b.shelf_location.toLowerCase().includes('belum')).length;
  }, [bookList]);

  const filteredBooks = useMemo(() => {
    return bookList.filter(book => {
      const matchCat = bookCatFilter === 'all' || (book.category && book.category.toLowerCase() === bookCatFilter.toLowerCase());
      const q = bookSearch.trim().toLowerCase();
      const matchSearch = !q ||
        (book.title && book.title.toLowerCase().includes(q)) ||
        (book.author && book.author.toLowerCase().includes(q)) ||
        (book.category && book.category.toLowerCase().includes(q)) ||
        (book.shelf_location && book.shelf_location.toLowerCase().includes(q)) ||
        (book.classification && String(book.classification).toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [bookList, bookCatFilter, bookSearch]);

  const totalBookPages = Math.max(1, Math.ceil(filteredBooks.length / BOOKS_PER_PAGE));
  const paginatedBooks = useMemo(() => {
    return filteredBooks.slice((bookPage - 1) * BOOKS_PER_PAGE, bookPage * BOOKS_PER_PAGE);
  }, [filteredBooks, bookPage]);

  // Reset halaman buku saat pencarian atau filter kategori berubah
  useEffect(() => {
    setBookPage(1);
  }, [bookSearch, bookCatFilter]);

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
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isSubmittingHandover, setIsSubmittingHandover] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // State Lihat Foto Bukti Pembesaran
  const [viewPhotoItem, setViewPhotoItem] = useState(null);

  // Kunci scroll body saat modal staf terbuka agar layar tidak bergeser
  useEffect(() => {
    if (showCreateModal || handoverModalItem || viewPhotoItem || showBookModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showCreateModal, handoverModalItem, viewPhotoItem, showBookModal]);

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
          time: timeStr,
          visitor_online: Boolean(item.visitor_online),
          visitor_last_seen_ms: item.visitor_last_seen_ms || null
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

    // Kirim sinyal seketika agar alarm pesanan di header StaffNav langsung berhenti tanpa jeda
    window.dispatchEvent(new CustomEvent('perpus_order_status_changed', { detail: { id, newStatus } }));

    try {
      await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      window.dispatchEvent(new CustomEvent('perpus_order_status_changed', { detail: { id, newStatus } }));
    } catch (err) {
      console.error('Gagal memperbarui status ke database:', err);
    }
  };

  const handleReadyAndAnnounce = async (order) => {
    updateStatus(order.id, 'ready');
    setCallingOrderId(order.id);
    try {
      await announceTableOrder(order.table, order.ticket_code, { muted: !visitorCallEnabled });
    } catch (err) {
      console.warn('Gagal memutar pengumuman siap:', err);
    } finally {
      setCallingOrderId(null);
    }
  };

  const handleRecallOrder = async (order) => {
    if (callingOrderId) return;
    setCallingOrderId(order.id);

    // Kirim sinyal panggil ulang ke backend agar HP pengunjung / TV Lobby berbunyi
    try {
      await fetch(`/api/orders/${order.id}/call`, { method: 'POST' });
    } catch (err) {
      console.warn('Gagal kirim panggil ulang ke backend:', err);
    }

    try {
      // Jalankan pemanggilan suara sampai selesai secara aktual
      // Jika visitorCallEnabled === false (staf mute), audio tetap diputar dalam mode senyap (muted: true)
      // sehingga tombol menunggu sampai suara benar-benar selesai baru aktif kembali!
      await announceTableOrder(order.table, order.ticket_code, { muted: !visitorCallEnabled });
    } catch (err) {
      console.warn('Gagal memutar suara panggil ulang:', err);
    } finally {
      setCallingOrderId(null);
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
    if (!navigator?.mediaDevices?.getUserMedia) {
      document.getElementById('handover-camera-input')?.click();
      return;
    }
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
      console.warn('Gagal akses webcam, beralih ke input kamera native:', err);
      setIsCameraActive(false);
      document.getElementById('handover-camera-input')?.click();
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

  // Fungsi kompresi gambar ultra-cepat menggunakan createImageBitmap & konversi otomatis HEIC
  const compressImageFile = async (file) => {
    let processedBlob = file;

    // 1. Konversi otomatis jika file berformat HEIC/HEIF (umum pada kamera HP Xiaomi/iPhone)
    const isHeic = file.name?.match(/\.(heic|heif)$/i) || file.type === 'image/heic' || file.type === 'image/heif';
    if (isHeic) {
      try {
        const heic2anyModule = await import('heic2any');
        const heic2any = heic2anyModule.default || heic2anyModule;
        const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.75 });
        processedBlob = Array.isArray(converted) ? converted[0] : converted;
      } catch (heicErr) {
        console.warn('Konversi HEIC dilewati/gagal, lanjut coba decode langsung:', heicErr);
      }
    }

    // 2. Gunakan native createImageBitmap jika didukung (Sangat cepat ~50ms di Android/Chromium/Brave)
    if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
      try {
        const bitmap = await createImageBitmap(processedBlob);
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = bitmap.width;
        let height = bitmap.height;

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

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(bitmap, 0, 0, width, height);
          bitmap.close(); // Bebaskan memori GPU segera
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
          if (dataUrl && dataUrl.length > 100) {
            return dataUrl;
          }
        }
      } catch (bmpErr) {
        console.warn('createImageBitmap tidak dapat memproses file ini, mencoba fallback:', bmpErr);
      }
    }

    // 3. Fallback aman menggunakan Image + ObjectURL dengan batas waktu (Watchdog Timer 4 detik)
    return new Promise((resolve, reject) => {
      let objectUrl = null;
      let isDone = false;

      const timer = setTimeout(() => {
        if (!isDone) {
          isDone = true;
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          reject(new Error('Waktu pemrosesan foto habis. Silakan pilih foto lain atau ambil langsung dari kamera.'));
        }
      }, 4000);

      try {
        objectUrl = URL.createObjectURL(processedBlob);
        const img = new Image();
        img.onload = () => {
          if (isDone) return;
          isDone = true;
          clearTimeout(timer);
          try {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;
            let width = img.naturalWidth || img.width || 640;
            let height = img.naturalHeight || img.height || 480;

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
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
            URL.revokeObjectURL(objectUrl);
            resolve(dataUrl);
          } catch (canvasErr) {
            URL.revokeObjectURL(objectUrl);
            reject(canvasErr);
          }
        };

        img.onerror = () => {
          if (isDone) return;
          isDone = true;
          clearTimeout(timer);
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Format foto tidak didukung oleh browser HP Anda (misal format RAW/DNG). Gunakan foto JPEG standar.'));
        };

        img.src = objectUrl;
      } catch (err) {
        if (!isDone) {
          isDone = true;
          clearTimeout(timer);
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          reject(err);
        }
      }
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (e.target) {
      e.target.value = '';
    }
    if (!file) return;

    setIsProcessingPhoto(true);

    try {
      const compressedDataUrl = await compressImageFile(file);
      setHandoverData(prev => ({ ...prev, proof_photo: compressedDataUrl }));
    } catch (err) {
      console.error('Gagal memproses foto:', err);
      showAlert(err.message || 'Gagal memproses foto. Silakan coba pilih foto lain.', {
        type: 'danger',
        title: 'Gagal Memproses Foto'
      });
    } finally {
      // Selalu matikan status loading agar tidak macet di layar
      setIsProcessingPhoto(false);
    }
  };

  const executeSaveHandover = async () => {
    setIsSubmittingHandover(true);
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
    } finally {
      setIsSubmittingHandover(false);
    }
  };

  const handleSaveHandover = async () => {
    if (!handoverData.claimed_by.trim()) {
      showAlert('Silakan isi Nama Orang yang Mengambil barang.', {
        type: 'warning',
        title: 'Nama Penerima Wajib Diisi'
      });
      return;
    }

    if (isProcessingPhoto) {
      showAlert('Foto sedang diproses dan dikompres oleh sistem. Mohon tunggu beberapa detik...', {
        type: 'warning',
        title: 'Sedang Memproses Foto'
      });
      return;
    }

    // Jika pengguna belum mengambil foto bukti sama sekali
    if (!handoverData.proof_photo) {
      const proceed = await showConfirm(
        'Foto bukti serah terima belum diambil atau belum terlampir. Apakah Anda yakin ingin menyelesaikan serah terima tanpa bukti foto?',
        {
          title: 'Serahkan Tanpa Foto Bukti?',
          confirmText: 'Ya, Tetap Lanjut Tanpa Foto',
          cancelText: 'Batal, Mau Foto Dulu',
          type: 'warning'
        }
      );
      if (!proceed) return;
    }

    await executeSaveHandover();
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

        <div className="staff-portal-header-actions">
          {/* Tombol Cepat Barcode Meja: Langsung Kelihatan di Bagian Paling Atas Tanpa Perlu Scroll! */}
          <button 
            type="button"
            className="staff-header-qr-btn"
            onClick={() => setShowTableQrModal(true)}
            title="Buka generator & cetak stiker Barcode Meja (QR Code) untuk ditempel di meja pengunjung"
          >
            <div className="staff-header-qr-icon">
              <QrCode size={19} />
            </div>
            <div className="staff-header-qr-content">
              <span className="staff-header-qr-title">Barcode Meja Pengunjung</span>
              <span className="staff-header-qr-sub">Cetak & Bagikan QR 24 Meja</span>
            </div>
            <span className="staff-header-qr-pill">Buka QR</span>
          </button>

          <div className="staff-portal-status">
            <span className="staff-status-dot"></span>
            <span>{isDbConnected ? 'MySQL XAMPP Terhubung' : 'Mode Offline'}</span>
          </div>
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
          type="button"
          className={`staff-nav-btn ${activeModule === 'books' ? 'active books' : ''}`}
          onClick={() => {
            setActiveModule('books');
            fetchBooks();
          }}
        >
          <div className="staff-nav-btn-content">
            <div className="staff-nav-icon">
              <BookOpen size={20} />
            </div>
            <div className="staff-nav-labels">
              <span className="staff-nav-label-main">Katalog Buku</span>
              <span className="staff-nav-label-sub">Kelola Koleksi</span>
            </div>
          </div>
          <span className="staff-nav-badge">
            {bookList.length}
          </span>
        </button>

        <button
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
              {activeModule === 'books' && (
                <>
                  <BookOpen size={16} color="#38bdf8" />
                  <span>Katalog Buku ({bookList.length})</span>
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
                className={`mobile-filter-option ${activeModule === 'books' ? 'active books' : ''}`}
                onClick={() => {
                  setActiveModule('books');
                  fetchBooks();
                  setMobileModuleMenuOpen(false);
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(14, 165, 233, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BookOpen size={16} color="#38bdf8" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="mobile-filter-text" style={{ fontWeight: 700 }}>Katalog Buku</span>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Kelola koleksi perpustakaan</span>
                  </div>
                </div>
                <span className="mobile-filter-badge">{bookList.length}</span>
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
                  className={`orders-utility-btn ${visitorCallEnabled ? 'active-audio' : 'muted-audio'}`} 
                  onClick={handleToggleVisitorCall}
                  title={visitorCallEnabled 
                    ? "Speaker Panggilan Meja Aktif (klik untuk senyapkan suara panggilan meja pengunjung. Tidak mematikan alarm notifikasi)" 
                    : "Speaker Panggilan Meja Senyap (klik untuk nyalakan suara panggilan meja pengunjung. Alarm notifikasi tetap berbunyi)"}
                >
                  {visitorCallEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                  <span className="utility-label">{visitorCallEnabled ? 'Panggilan ON' : 'Mute Panggilan'}</span>
                </button>

                <button 
                  type="button"
                  className="orders-utility-btn" 
                  onClick={() => announceTableOrder('Meja 3', 'TKT-1003', { muted: !visitorCallEnabled })}
                  title="Klik untuk tes suara panggilan meja pengunjung"
                >
                  <BellRing size={15} />
                  <span className="utility-label">Tes Panggilan</span>
                </button>

                <button 
                  type="button"
                  className="orders-utility-btn" 
                  onClick={() => setShowTableQrModal(true)}
                  title="Buka generator & cetak stiker Barcode Meja (QR Code) untuk ditempel di meja pengunjung"
                  style={{ color: '#34d399' }}
                >
                  <QrCode size={15} color="#10b981" />
                  <span className="utility-label">Stiker Barcode Meja</span>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <div className="ticket-code-tag">
                          <Ticket size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                          {order.ticket_code}
                        </div>
                        <span className="order-table">{order.table}</span>
                      </div>

                      {/* Indikator Status Pengunjung di Website */}
                      <div style={{ marginTop: '6px' }}>
                        {order.visitor_online ? (
                          <span 
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.72rem',
                              fontWeight: '700',
                              color: '#10b981',
                              background: 'rgba(16, 185, 129, 0.12)',
                              border: '1px solid rgba(16, 185, 129, 0.35)',
                              padding: '2px 8px',
                              borderRadius: '20px'
                            }}
                            title="Pengunjung sedang aktif membuka website di HP / meja"
                          >
                            <span style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              backgroundColor: '#10b981',
                              boxShadow: '0 0 6px #10b981',
                              display: 'inline-block'
                            }} />
                            🟢 Aktif di Web
                          </span>
                        ) : (
                          <span 
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.72rem',
                              fontWeight: '700',
                              color: '#ef4444',
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              padding: '2px 8px',
                              borderRadius: '20px'
                            }}
                            title="Pengunjung telah keluar atau menutup tab browser"
                          >
                            <span style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              backgroundColor: '#ef4444',
                              display: 'inline-block'
                            }} />
                            🔴 Web Ditutup
                          </span>
                        )}
                      </div>
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
                      {parseOrderBookTitles(order.book, bookList).map((title, idx, allTitles) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: idx !== allTitles.length - 1 ? '6px' : '0' }}>
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
                        {!order.visitor_online && (
                          <div style={{
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            borderRadius: '8px',
                            padding: '7px 10px',
                            fontSize: '0.74rem',
                            color: '#fca5a5',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '6px',
                            lineHeight: 1.4
                          }}>
                            <AlertCircle size={15} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                            <span>
                              <strong>Pengunjung sudah menutup web:</strong> Panggilan di layar HP tidak muncul. Silakan panggil nomor <strong>{order.table}</strong> melalui <strong>speaker ruangan</strong> atau antarkan langsung bukunya ke mejanya.
                            </span>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ 
                              flex: 1, 
                              padding: '0.5rem', 
                              fontSize: '0.8rem',
                              opacity: callingOrderId ? 0.6 : 1,
                              cursor: callingOrderId ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                            disabled={Boolean(callingOrderId)}
                            onClick={() => handleRecallOrder(order)}
                            title={
                              callingOrderId 
                                ? 'Harap tunggu hingga suara panggilan selesai...' 
                                : visitorCallEnabled 
                                  ? 'Bunyikan ulang pengumuman suara ke HP pengunjung' 
                                  : 'Panggil ulang ke HP pengunjung (speaker staf dalam mode mute)'
                            }
                          >
                            <Volume2 size={14} className={callingOrderId === order.id ? 'animate-pulse' : ''} />
                            {callingOrderId === order.id ? 'Memanggil...' : 'Panggil Ulang'}
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%' }}>
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', width: '100%', fontSize: '0.85rem', margin: 0 }}>
                          ✅ Buku telah diserahkan kepada pemegang tiket <strong>{order.ticket_code}</strong>.
                        </p>
                        <button 
                          className="btn btn-secondary" 
                          style={{ 
                            width: '100%', 
                            padding: '0.55rem', 
                            fontSize: '0.82rem', 
                            color: '#f59e0b', 
                            borderColor: 'rgba(245, 158, 11, 0.45)', 
                            background: 'rgba(245, 158, 11, 0.08)',
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: '6px',
                            marginTop: '4px'
                          }}
                          onClick={() => updateStatus(order.id, 'ready')}
                          title="Buka kembali tiket ini ke status Siap Diambil agar bisa dipanggil ulang atau diserahkan lagi"
                        >
                          <RefreshCw size={14} /> Buka Kembali (Bisa Dipanggil Ulang)
                        </button>
                      </div>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ fontSize: '0.75rem', color: '#fca5a5', textAlign: 'center' }}>
                            (Diserahkan tanpa foto bukti)
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{
                              width: '100%',
                              fontSize: '0.8rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              borderColor: 'rgba(245, 158, 11, 0.4)',
                              color: '#fde047'
                            }}
                            onClick={() => {
                              setHandoverModalItem(item);
                              setHandoverData({
                                claimed_by: item.claimed_by || '',
                                staff_notes: item.staff_notes || '',
                                proof_photo: null
                              });
                            }}
                          >
                            <Camera size={14} /> 📸 Tambah / Foto Bukti Susulan
                          </button>
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
                type="button"
                className="btn btn-primary"
                style={{ 
                  background: 'linear-gradient(135deg, #10b981, #059669)', 
                  border: 'none', 
                  color: '#fff', 
                  fontWeight: '700', 
                  padding: '0.55rem 1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                }}
                onClick={() => setShowTableQrModal(true)}
                title="Buka generator & cetak stiker Barcode Meja (QR Code) untuk ditempel di meja pengunjung"
              >
                <QrCode size={16} /> Cetak Barcode Meja
              </button>

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
      )}

      {/* ======================================================== */}
      {/* MODUL: KATALOG BUKU PERPUSTAKAAN (STAFF INVENTORY)      */}
      {/* ======================================================== */}
      {activeModule === 'books' && (
        <div style={{ animation: 'staffFadeIn 0.3s ease' }}>
          {/* Header Deck Katalog Buku */}
          <div className="orders-control-deck" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(14, 165, 233, 0.2)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                boxShadow: '0 4px 14px rgba(14, 165, 233, 0.25)'
              }}>
                <BookOpen size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.18rem', fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.01em' }}>
                  Katalog & Inventaris Buku
                </h2>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0, marginTop: '2px' }}>
                  Kelola database koleksi, nomor rak fisik, ketersediaan stok, dan foto sampul
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={fetchBooks}
                title="Segarkan data buku"
                disabled={loadingBooks}
                style={{ padding: '0.55rem 0.85rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={14} className={loadingBooks ? 'animate-spin' : ''} />
                <span>Segarkan</span>
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleOpenAddBook}
                style={{
                  padding: '0.55rem 1rem',
                  fontSize: '0.84rem',
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  borderColor: '#38bdf8',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700
                }}
              >
                <Plus size={16} />
                <span>Tambah Buku Baru</span>
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="books-stats-grid">
            <div className="books-stat-card">
              <div className="books-stat-icon" style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8' }}>
                <BookOpen size={22} />
              </div>
              <div>
                <div className="books-stat-val">{bookList.length}</div>
                <div className="books-stat-lbl">Total Judul Koleksi</div>
              </div>
            </div>

            <div className="books-stat-card">
              <div className="books-stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                <Library size={22} />
              </div>
              <div>
                <div className="books-stat-val">{totalBookStock}</div>
                <div className="books-stat-lbl">Total Stok Eksemplar</div>
              </div>
            </div>

            <div className="books-stat-card">
              <div className="books-stat-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
                <Layers size={22} />
              </div>
              <div>
                <div className="books-stat-val">{bookCategories.length}</div>
                <div className="books-stat-lbl">Kategori Bidang Ilmu</div>
              </div>
            </div>

            <div className="books-stat-card">
              <div className="books-stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                <MapPin size={22} />
              </div>
              <div>
                <div className="books-stat-val">{booksWithShelf}</div>
                <div className="books-stat-lbl">Lokasi Rak Terdata</div>
              </div>
            </div>
          </div>

          {/* Toolbar: Search & Category Filter */}
          <div className="books-toolbar">
            <div className="books-search-box">
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                className="books-search-input"
                placeholder="Cari judul, pengarang, rak, atau DDC..."
                value={bookSearch}
                onChange={(e) => setBookSearch(e.target.value)}
              />
              {bookSearch && (
                <button
                  type="button"
                  onClick={() => setBookSearch('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={15} color="#94a3b8" />
                <select
                  className="books-cat-select"
                  value={bookCatFilter}
                  onChange={(e) => setBookCatFilter(e.target.value)}
                >
                  <option value="all">Semua Kategori ({bookList.length})</option>
                  {bookCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {(bookSearch || bookCatFilter !== 'all') && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setBookSearch('');
                    setBookCatFilter('all');
                  }}
                  style={{ padding: '0.55rem 0.85rem', fontSize: '0.78rem' }}
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          {/* Main Book Table */}
          <div className="books-table-container">
            <div className="books-table-responsive">
              <table className="books-table">
                <thead>
                  <tr>
                    <th style={{ width: '60px', textAlign: 'center' }}>Sampul</th>
                    <th>Judul & Penulis</th>
                    <th style={{ width: '150px' }}>Kategori & DDC</th>
                    <th style={{ width: '170px' }}>Lokasi Rak Fisik</th>
                    <th style={{ width: '130px', textAlign: 'center' }}>Stok Fisik</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingBooks && bookList.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                        <RefreshCw size={28} className="animate-spin" style={{ color: '#38bdf8', margin: '0 auto 10px' }} />
                        <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Memuat data katalog buku perpustakaan...</div>
                      </td>
                    </tr>
                  ) : filteredBooks.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                        <div style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '16px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto 12px',
                          color: '#64748b'
                        }}>
                          <BookOpen size={28} />
                        </div>
                        <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '1rem', marginBottom: '4px' }}>
                          Buku Tidak Ditemukan
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.85rem', maxWidth: '380px', margin: '0 auto 1rem' }}>
                          Tidak ada koleksi buku yang cocok dengan kata kunci &quot;{bookSearch}&quot; atau filter yang dipilih.
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => { setBookSearch(''); setBookCatFilter('all'); }}
                          style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }}
                        >
                          Tampilkan Semua Buku
                        </button>
                      </td>
                    </tr>
                  ) : (
                    paginatedBooks.map((book) => {
                      const stockNum = parseInt(book.stock) || 0;
                      return (
                        <tr key={book.id}>
                          {/* Sampul Thumbnail */}
                          <td style={{ textAlign: 'center' }}>
                            {book.cover_url ? (
                              <img
                                src={book.cover_url}
                                alt={book.title}
                                className="books-thumb"
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  if (e.currentTarget.nextSibling) {
                                    e.currentTarget.nextSibling.style.display = 'flex';
                                  }
                                }}
                              />
                            ) : null}
                            <div
                              className="books-thumb"
                              style={{ display: book.cover_url ? 'none' : 'flex' }}
                              title="Belum ada sampul"
                            >
                              <BookOpen size={18} />
                            </div>
                          </td>

                          {/* Judul & Penulis */}
                          <td>
                            <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.94rem', lineHeight: '1.35', marginBottom: '3px' }}>
                              {book.title}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span>✍️ {book.author || 'Penulis Tidak Diketahui'}</span>
                              {book.rating > 0 && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#facc15', fontWeight: 600 }}>
                                  <Star size={12} fill="#facc15" /> {Number(book.rating).toFixed(1)}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Kategori & DDC */}
                          <td>
                            <div style={{
                              display: 'inline-block',
                              fontSize: '0.76rem',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: 'rgba(99, 102, 241, 0.15)',
                              color: '#a5b4fc',
                              marginBottom: '3px'
                            }}>
                              {book.category || 'Umum'}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              DDC: {book.classification || '000'}
                            </div>
                          </td>

                          {/* Lokasi Rak Fisik */}
                          <td>
                            <span className="books-shelf-pill">
                              <MapPin size={12} />
                              <span>{book.shelf_location || 'Belum Diatur'}</span>
                            </span>
                          </td>

                          {/* Stok Fisik */}
                          <td style={{ textAlign: 'center' }}>
                            <span className={`books-stock-pill ${stockNum > 0 ? 'in-stock' : 'out-stock'}`}>
                              {stockNum > 0 ? `Tersedia (${stockNum})` : 'Habis (0)'}
                            </span>
                          </td>

                          {/* Aksi: Edit & Hapus */}
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                className="books-btn-edit"
                                onClick={() => handleOpenEditBook(book)}
                                title="Edit data buku & lokasi rak"
                              >
                                <Edit3 size={13} />
                                <span>Edit</span>
                              </button>

                              <button
                                type="button"
                                className="books-btn-delete"
                                onClick={() => handleDeleteBook(book)}
                                title="Hapus buku dari katalog"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            {filteredBooks.length > 0 && (
              <div className="books-pagination-bar">
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Menampilkan <strong>{Math.min((bookPage - 1) * BOOKS_PER_PAGE + 1, filteredBooks.length)}</strong> - <strong>{Math.min(bookPage * BOOKS_PER_PAGE, filteredBooks.length)}</strong> dari <strong>{filteredBooks.length}</strong> buku
                  {filteredBooks.length !== bookList.length && (
                    <span style={{ marginLeft: '4px', color: '#64748b' }}>
                      (difilter dari {bookList.length} total buku)
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="books-page-btn"
                    disabled={bookPage <= 1}
                    onClick={() => setBookPage(prev => Math.max(1, prev - 1))}
                  >
                    <ChevronLeft size={14} />
                    <span>Sebelumnya</span>
                  </button>

                  <span style={{ fontSize: '0.8rem', color: '#cbd5e1', padding: '0 4px', fontWeight: 600 }}>
                    {bookPage} / {totalBookPages}
                  </span>

                  <button
                    type="button"
                    className="books-page-btn"
                    disabled={bookPage >= totalBookPages}
                    onClick={() => setBookPage(prev => Math.min(totalBookPages, prev + 1))}
                  >
                    <span>Selanjutnya</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODUL: TAMBAH BUKU DARI PDF (DAFTAR & SAMPUL CERDAS) */}
      {/* ======================================================== */}
      {activeModule === 'import_books' && (
        <BulkBookImport />
      )}

      {/* ======================================================== */}
      {/* MODAL 1: TULIS PENGUMUMAN BARANG BARU (TEKS SAJA) */}
      {/* ======================================================== */}
      {showCreateModal && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '1rem',
          overflowY: 'auto'
        }}>
          <div style={{
            background: 'var(--surface-color)',
            border: '1.5px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '16px',
            padding: '1.8rem',
            maxWidth: '520px',
            width: '92%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px rgba(0,0,0,0.85)'
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
        </div>,
        document.body
      )}

      {/* ======================================================== */}
      {/* MODAL 2: SERAH TERIMA & FOTO BUKTI PEMILIK */}
      {/* ======================================================== */}
      {handoverModalItem && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '1rem',
          overflowY: 'auto'
        }}>
          <div style={{
            background: 'var(--surface-color)',
            border: '1.5px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '16px',
            padding: '1.5rem 1.2rem',
            maxWidth: '560px',
            width: '92%',
            boxShadow: '0 25px 50px rgba(0,0,0,0.85)',
            maxHeight: '90vh',
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

              {/* Hidden File Inputs untuk Kamera & Galeri (Bebas Masalah Event Bubbling Mobile) */}
              <input 
                ref={cameraInputRef}
                id="handover-camera-input"
                type="file" 
                accept="image/jpeg,image/png,image/webp" 
                capture="environment"
                onChange={handleFileUpload} 
                style={{ display: 'none' }} 
              />
              <input 
                ref={galleryInputRef}
                id="handover-gallery-input"
                type="file" 
                accept="image/jpeg,image/png,image/webp" 
                onChange={handleFileUpload} 
                style={{ display: 'none' }} 
              />

              {/* Status Sedang Memproses / Mengompres Foto */}
              {isProcessingPhoto ? (
                <div style={{ padding: '1.5rem 0.5rem', textAlign: 'center' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    margin: '0 auto 12px auto',
                    border: '3px solid rgba(255,255,255,0.2)',
                    borderTopColor: '#10b981',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                  <div style={{ fontSize: '0.92rem', color: '#6ee7b7', fontWeight: '700' }}>
                    Sedang Mengompres & Memproses Foto...
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                    Mohon tunggu sebentar, foto sedang disiapkan agar ringan disimpan ke server.
                  </p>
                </div>
              ) : handoverData.proof_photo ? (
                /* Tampilan Preview Foto yang Berhasil Diambil */
                <div>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(16, 185, 129, 0.2)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    color: '#a7f3d0',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    marginBottom: '0.8rem'
                  }}>
                    <CheckCircle2 size={15} color="#10b981" /> Foto Bukti Siap Disimpan
                  </div>
                  <div>
                    <img 
                      src={handoverData.proof_photo} 
                      alt="Bukti Foto" 
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '220px', 
                        borderRadius: '10px', 
                        objectFit: 'contain', 
                        border: '2px solid var(--success)', 
                        marginBottom: '0.8rem',
                        boxShadow: '0 4px 14px rgba(0,0,0,0.4)'
                      }} 
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      onClick={() => cameraInputRef.current?.click()}
                      title="Ambil foto ulang menggunakan kamera"
                    >
                      <Camera size={14} /> 🔄 Foto Ulang (Kamera)
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      onClick={() => galleryInputRef.current?.click()}
                      title="Pilih foto lain dari galeri"
                    >
                      <Upload size={14} /> 📁 Ganti dari Galeri
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                      onClick={() => setHandoverData(prev => ({ ...prev, proof_photo: null }))}
                      title="Hapus foto ini"
                    >
                      <Trash2 size={14} /> Hapus
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
                    {/* Tombol Jepret Langsung dengan Kamera HP (Bisa di HTTP & HTTPS tanpa kendala) */}
                    <button 
                      type="button"
                      className="btn" 
                      onClick={() => cameraInputRef.current?.click()}
                      style={{ 
                        fontSize: '0.85rem', 
                        cursor: 'pointer', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: '#ffffff',
                        fontWeight: '700',
                        padding: '0.65rem 1.1rem',
                        borderRadius: '10px',
                        boxShadow: '0 2px 10px rgba(16, 185, 129, 0.35)',
                        border: 'none'
                      }}
                      title="Buka kamera HP langsung untuk memotret penerima barang"
                    >
                      <Camera size={18} /> 📸 Jepret Kamera HP Langsung
                    </button>

                    {/* Tombol Pilih dari Galeri HP / File Foto */}
                    <button 
                      type="button"
                      className="btn btn-secondary" 
                      onClick={() => galleryInputRef.current?.click()}
                      style={{ 
                        fontSize: '0.85rem', 
                        cursor: 'pointer', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        padding: '0.65rem 1rem',
                        borderRadius: '10px'
                      }}
                      title="Pilih foto yang sudah ada dari galeri"
                    >
                      <Upload size={16} /> 📁 Pilih dari Galeri
                    </button>

                    {/* Tombol Webcam Laptop (Hanya Tampil di Laptop/PC dengan HTTPS/localhost) */}
                    {typeof window !== 'undefined' && window.isSecureContext && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && (
                      <button
                        type="button"
                        className="btn btn-secondary desktop-webcam-btn"
                        style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        onClick={startCamera}
                        title="Gunakan webcam bawaan laptop/PC"
                      >
                        <Camera size={15} /> Buka Webcam Laptop
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Tombol Simpan Serah Terima */}
            <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="btn btn-secondary"
                disabled={isSubmittingHandover}
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
                disabled={isProcessingPhoto || isSubmittingHandover}
                style={{ 
                  background: 'linear-gradient(135deg, #10b981, #059669)', 
                  border: 'none', 
                  color: '#fff', 
                  fontWeight: '700', 
                  padding: '0.65rem 1.4rem',
                  opacity: (isProcessingPhoto || isSubmittingHandover) ? 0.7 : 1,
                  cursor: (isProcessingPhoto || isSubmittingHandover) ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onClick={handleSaveHandover}
              >
                {isSubmittingHandover ? '⏳ Menyimpan Bukti...' : isProcessingPhoto ? '⏳ Memproses Foto...' : '✓ Simpan Serah Terima & Foto Bukti'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ======================================================== */}
      {/* MODAL 3: LIHAT FOTO BUKTI SERAH TERIMA */}
      {/* ======================================================== */}
      {viewPhotoItem && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '1rem',
          overflowY: 'auto'
        }}>
          <div style={{
            background: 'var(--surface-color)',
            border: '1.5px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '16px',
            padding: '1.5rem',
            maxWidth: '520px',
            width: '92%',
            textAlign: 'center',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px rgba(0,0,0,0.85)'
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
        </div>,
        document.body
      )}

      {/* ======================================================== */}
      {/* MODAL: TAMBAH / EDIT BUKU KATALOG (PORTAL)               */}
      {/* ======================================================== */}
      {showBookModal && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '1rem',
          overflowY: 'auto'
        }}>
          <div style={{
            background: 'var(--surface-color)',
            border: '1.5px solid rgba(56, 189, 248, 0.45)',
            borderRadius: '16px',
            padding: '1.8rem',
            maxWidth: '620px',
            width: '94%',
            maxHeight: '92vh',
            overflowY: 'auto',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                  <BookOpen size={22} color="#38bdf8" />
                  {editingBook ? 'Edit Data Buku' : 'Tambah Buku Baru'}
                </h2>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '4px 0 0' }}>
                  {editingBook ? `Perbarui informasi koleksi untuk "${editingBook.title}"` : 'Masukkan informasi buku baru ke dalam database perpustakaan'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setShowBookModal(false); resetBookForm(); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.3rem', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitBook}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Judul Buku */}
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px', color: '#cbd5e1' }}>
                    Judul Buku <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: Laskar Pelangi"
                    required
                    value={bookForm.title}
                    onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                  />
                </div>

                {/* Pengarang / Penulis */}
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px', color: '#cbd5e1' }}>
                    Pengarang / Penulis <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: Andrea Hirata"
                    required
                    value={bookForm.author}
                    onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                  />
                </div>

                {/* Grid 2 Kolom: Kategori & Nomor Klasifikasi */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px', color: '#cbd5e1' }}>
                      Kategori
                    </label>
                    <input
                      type="text"
                      list="categories-list"
                      className="form-control"
                      placeholder="Contoh: Fiksi, Sains, Sejarah..."
                      value={bookForm.category}
                      onChange={(e) => setBookForm({ ...bookForm, category: e.target.value })}
                    />
                    <datalist id="categories-list">
                      {bookCategories.map(c => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px', color: '#cbd5e1' }}>
                      Nomor Klasifikasi (DDC)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Contoh: 813 atau 005.1"
                      value={bookForm.classification}
                      onChange={(e) => setBookForm({ ...bookForm, classification: e.target.value })}
                    />
                  </div>
                </div>

                {/* Grid 2 Kolom: Lokasi Rak Fisik & Stok */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px', color: '#cbd5e1' }}>
                      Lokasi Rak Fisik <span style={{ color: '#38bdf8', fontSize: '0.75rem' }}>(Penting untuk Pengunjung)</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Contoh: Rak A-02, Baris 3"
                      value={bookForm.shelf_location}
                      onChange={(e) => setBookForm({ ...bookForm, shelf_location: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px', color: '#cbd5e1' }}>
                      Jumlah Stok Eksemplar
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="form-control"
                      placeholder="1"
                      value={bookForm.stock}
                      onChange={(e) => setBookForm({ ...bookForm, stock: e.target.value })}
                    />
                  </div>
                </div>

                {/* Box Pengaturan Sampul Buku */}
                <div style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '1rem'
                }}>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '8px', color: '#cbd5e1' }}>
                    Foto Sampul Buku
                  </label>

                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {/* Thumbnail Preview */}
                    <div style={{
                      width: '64px',
                      height: '90px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}>
                      {coverPreview ? (
                        <img
                          src={coverPreview}
                          alt="Preview Sampul"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <Image size={24} color="#64748b" />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        {/* Tombol Cari Otomatis via OpenLibrary */}
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleSearchCover}
                          disabled={searchingCover}
                          style={{ fontSize: '0.78rem', padding: '0.45rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                        >
                          <Sparkles size={13} color="#38bdf8" />
                          <span>{searchingCover ? 'Mencari...' : 'Cari Sampul Online'}</span>
                        </button>

                        {/* Tombol Upload File Lokal */}
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => bookCoverInputRef.current?.click()}
                          style={{ fontSize: '0.78rem', padding: '0.45rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                        >
                          <Upload size={13} />
                          <span>Unggah Foto</span>
                        </button>

                        <input
                          type="file"
                          ref={bookCoverInputRef}
                          style={{ display: 'none' }}
                          accept="image/*"
                          onChange={handleBookCoverFile}
                        />

                        {coverPreview && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                              setCoverPreview(null);
                              setBookForm(prev => ({ ...prev, cover_url: '', cover_image: null }));
                            }}
                            style={{ fontSize: '0.78rem', padding: '0.45rem 0.65rem', color: '#f87171' }}
                            title="Hapus sampul"
                          >
                            Hapus
                          </button>
                        )}
                      </div>

                      {/* Kandidat Sampul dari OpenLibrary */}
                      {coverCandidates.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginBottom: '6px', fontWeight: 600 }}>
                            Pilih salah satu sampul yang cocok:
                          </div>
                          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
                            {coverCandidates.map((c, i) => (
                              <div
                                key={i}
                                className="books-cover-candidate-card"
                                onClick={() => handleSelectCoverCandidate(c)}
                                title={c.title}
                              >
                                <img
                                  src={c.cover_url}
                                  alt={c.title}
                                  style={{ width: '100%', height: '70px', objectFit: 'cover', borderRadius: '4px' }}
                                />
                                <div style={{ fontSize: '0.65rem', color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                                  Pilih #{i + 1}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Input manual URL sampul */}
                      <input
                        type="url"
                        className="form-control"
                        placeholder="Atau tempel URL gambar sampul (https://...)"
                        style={{ fontSize: '0.8rem', marginTop: '6px' }}
                        value={bookForm.cover_url}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBookForm({ ...bookForm, cover_url: val, cover_image: null });
                          setCoverPreview(val || null);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'flex-end', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setShowBookModal(false); resetBookForm(); }}
                  disabled={isSubmittingBook}
                >
                  Batal
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingBook}
                  style={{
                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                    borderColor: '#38bdf8',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 700
                  }}
                >
                  {isSubmittingBook ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>{editingBook ? 'Simpan Perubahan' : 'Tambahkan ke Katalog'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Generator & Cetak Barcode Meja */}
      <TableQRModal 
        isOpen={showTableQrModal} 
        onClose={() => setShowTableQrModal(false)} 
      />
    </div>
  );
}

export default StaffDashboard;
