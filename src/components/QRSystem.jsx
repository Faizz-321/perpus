import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Send, Loader2, Ticket, CheckCircle2, Clock, Search, BookOpen, AlertCircle, XCircle, Plus, Check, ChevronLeft, ChevronRight, ChevronDown, Bookmark, MapPin, Volume2, Star, Flame, Sparkles, MessageSquare, Bell, Lock, Eye, ArrowRight, History, Trash2 } from 'lucide-react';
import { announceTableOrder } from '../utils/soundAnnouncement';
import { useModal } from '../context/ModalContext';
import { parseOrderBookTitles, serializeOrderBookTitles } from '../utils/orderBooks';
import { normalizeTableParam, ALL_LIBRARY_TABLES } from '../utils/tableUtils';

// Kunci penyimpanan localStorage
const ORDER_HISTORY_KEY = 'bibliotech_order_history';
const ACTIVE_ORDER_KEY = 'bibliotech_active_order';
const LAST_COMPLETED_KEY = 'bibliotech_last_completed_order';
const TABLE_NO_KEY = 'bibliotech_table_no';

// Ambil riwayat tiket yang tersimpan di HP pengunjung
function getStoredOrderHistory() {
  try {
    const raw = localStorage.getItem(ORDER_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

// Simpan tiket ke dalam riwayat permanen di HP
function saveOrderToHistory(order) {
  if (!order || !order.ticket_code) return;
  try {
    const existing = getStoredOrderHistory();
    const filtered = existing.filter(o => o.id !== order.id && o.ticket_code !== order.ticket_code);
    const updated = [
      {
        ...order,
        status: 'completed',
        completed_at: order.completed_at || new Date().toISOString()
      },
      ...filtered
    ].slice(0, 30);
    localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Gagal menyimpan riwayat pesanan:', e);
  }
}

// Palet warna sampul buku realistis yang elegan
const COVER_THEMES = [
  { bg: 'linear-gradient(145deg, #1e1b4b, #312e81, #0f172a)', border: '#4338ca', accent: '#818cf8', ddc: '#a5b4fc' }, // Midnight Indigo
  { bg: 'linear-gradient(145deg, #4c0519, #881337, #1e293b)', border: '#be123c', accent: '#f43f5e', ddc: '#fda4af' }, // Crimson Velvet
  { bg: 'linear-gradient(145deg, #022c22, #064e3b, #0f172a)', border: '#047857', accent: '#10b981', ddc: '#6ee7b7' }, // Emerald Forest
  { bg: 'linear-gradient(145deg, #3b0764, #581c87, #1e1b4b)', border: '#7e22ce', accent: '#a855f7', ddc: '#d8b4fe' }, // Royal Amethyst
  { bg: 'linear-gradient(145deg, #451a03, #78350f, #1c1917)', border: '#b45309', accent: '#f59e0b', ddc: '#fcd34d' }, // Warm Amber
  { bg: 'linear-gradient(145deg, #042f2e, #115e59, #0f172a)', border: '#0f766e', accent: '#14b8a6', ddc: '#5eead4' }, // Oceanic Teal
  { bg: 'linear-gradient(145deg, #371b26, #701a75, #18181b)', border: '#a21caf', accent: '#e879f9', ddc: '#f0abfc' }, // Obsidian Rose
  { bg: 'linear-gradient(145deg, #0c4a6e, #075985, #1e293b)', border: '#0369a1', accent: '#38bdf8', ddc: '#7dd3fc' }, // Sapphire Blue
];

function getThemeForBook(id, title) {
  const hash = (id * 17 + (title ? title.length * 7 : 0)) % COVER_THEMES.length;
  return COVER_THEMES[hash];
}

function QRSystem() {
  const { showAlert, showConfirm } = useModal();
  const [searchParams] = useSearchParams();
  const urlTableRaw = searchParams.get('meja') || searchParams.get('table') || searchParams.get('m') || searchParams.get('t');
  const detectedTableFromUrl = useMemo(() => normalizeTableParam(urlTableRaw), [urlTableRaw]);
  const [isAutoDetectedFromQr, setIsAutoDetectedFromQr] = useState(() => Boolean(detectedTableFromUrl));

  const [step, setStep] = useState(1);
  const [tableNo, setTableNo] = useState(() => {
    if (detectedTableFromUrl) {
      try {
        localStorage.setItem(TABLE_NO_KEY, detectedTableFromUrl);
      } catch (e) {}
      return detectedTableFromUrl;
    }
    return localStorage.getItem(TABLE_NO_KEY) || '';
  });

  // Sinkronisasi otomatis jika pengunjung scan QR Code meja lain
  useEffect(() => {
    if (detectedTableFromUrl) {
      setTableNo(detectedTableFromUrl);
      try {
        localStorage.setItem(TABLE_NO_KEY, detectedTableFromUrl);
      } catch (e) {}
      setIsAutoDetectedFromQr(true);
    }
  }, [detectedTableFromUrl]);
  
  // Data buku dan filter
  const [books, setBooks] = useState([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [selectedBooks, setSelectedBooks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const categories = useMemo(() => Array.from(new Set(books.map(b => b.category).filter(Boolean))), [books]);
  const [currentPage, setCurrentPage] = useState(1);
  const booksPerPage = 18;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [orderHistory, setOrderHistory] = useState(getStoredOrderHistory);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isConfirmingReceived, setIsConfirmingReceived] = useState(false);
  const prevStatusRef = useRef(null);

  // Status apakah pengunjung sedang memiliki pesanan aktif yang belum selesai/dibatalkan
  const hasActiveOrder = Boolean(
    activeOrder && 
    activeOrder.status && 
    activeOrder.status !== 'completed' && 
    activeOrder.status !== 'cancelled'
  );

  // Sinkronkan nomor meja otomatis jika sudah ada pesanan aktif
  useEffect(() => {
    if (activeOrder?.table_no && !tableNo) {
      setTableNo(activeOrder.table_no);
      localStorage.setItem(TABLE_NO_KEY, activeOrder.table_no);
    }
  }, [activeOrder?.table_no, tableNo]);


  // State untuk Fitur Rating Bintang & Modal Ulasan
  const [ratedBooks, setRatedBooks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('bibliotech_rated_books')) || {};
    } catch (e) {
      return {};
    }
  });
  const [rateModalBook, setRateModalBook] = useState(null);
  const [modalRating, setModalRating] = useState(5);
  const [modalHoverRating, setModalHoverRating] = useState(0);
  const [modalReview, setModalReview] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingSuccessMsg, setRatingSuccessMsg] = useState('');

  // State Izin Web Notification Browser
  const [notifPermission, setNotifPermission] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  const requestNotifPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotifPermission(perm);
        if (perm === 'granted') {
          new Notification('🔔 Notifikasi Panggilan Aktif', {
            body: 'HP Anda akan berbunyi saat buku selesai disiapkan staf perpustakaan!',
            icon: '/Lambang.png'
          });
        }
      } catch (e) {
        console.warn('Izin notifikasi gagal:', e);
      }
    }
  };

  const tables = Array.from({ length: 24 }, (_, i) => `Meja ${i + 1}`);

  // Cek apakah ada nomor meja & tiket yang tersimpan di browser HP saat halaman dibuka
  useEffect(() => {
    // 1. Pulihkan nomor meja pengunjung jika ada
    const savedTable = localStorage.getItem(TABLE_NO_KEY);
    if (savedTable) {
      setTableNo(savedTable);
    }

    // 2. Pulihkan pesanan aktif atau pesanan selesai terakhir
    const saved = localStorage.getItem(ACTIVE_ORDER_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.status !== 'cancelled') {
          setActiveOrder(parsed);
          if (parsed.table_no) {
            setTableNo(parsed.table_no);
          }
          // Tetap buka halaman tiket (Step 2) agar status selesai & ulasan tidak hilang
          setStep(2);
        }
      } catch (e) {
        console.warn('Gagal membaca tiket dari localStorage:', e);
      }
    }
    // Sinkronkan riwayat tiket lokal
    setOrderHistory(getStoredOrderHistory());
  }, []);

  // Otomatis scroll ke atas ketika ganti step (agar tiket langsung terlihat di HP tanpa perlu reload)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [step]);

  // Simpan / update status tiket ke localStorage secara aman tanpa menghapus pesanan selesai
  useEffect(() => {
    if (activeOrder) {
      if (activeOrder.status === 'cancelled') {
        localStorage.removeItem(ACTIVE_ORDER_KEY);
      } else {
        localStorage.setItem(ACTIVE_ORDER_KEY, JSON.stringify(activeOrder));
        if (activeOrder.status === 'completed') {
          saveOrderToHistory(activeOrder);
          localStorage.setItem(LAST_COMPLETED_KEY, JSON.stringify(activeOrder));
          setOrderHistory(getStoredOrderHistory());
        }
      }
      if (activeOrder.table_no) {
        localStorage.setItem(TABLE_NO_KEY, activeOrder.table_no);
      }
    }
  }, [activeOrder]);

  // Kunci scroll halaman saat modal penilaian buku terbuka agar layar tidak bergeser
  useEffect(() => {
    if (rateModalBook) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [rateModalBook]);

  // Ambil 260+ buku inventaris dari database MySQL
  useEffect(() => {
    setLoadingBooks(true);
    fetch('/api/books')
      .then((res) => {
        if (!res.ok) throw new Error('Gagal mengambil katalog');
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setBooks(data);
        }
      })
      .catch((err) => {
        console.warn('Gagal memuat katalog buku:', err.message);
      })
      .finally(() => {
        setLoadingBooks(false);
      });
  }, []);

  // Polling status tiket & panggilan suara secara real-time
  // TETAP AKTIF di latar belakang baik saat pengunjung di tiket (step 2) MAUPUN saat melihat katalog (step 1)
  const lastHandledCallRef = useRef(0);
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    if (!activeOrder?.id) return;

    if (prevStatusRef.current === null) {
      prevStatusRef.current = activeOrder.status;
    }

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/orders/${activeOrder.id}`);
        if (res.ok) {
          const data = await res.json();
          const callCount = Number(data.call_count || 0);
          const previousStatus = prevStatusRef.current;
          prevStatusRef.current = data.status;

          setActiveOrder((prev) => ({
            ...prev,
            status: data.status,
            call_count: callCount,
            last_called_at: data.last_called_at
          }));

          // KETIKA STAF MENEKAN "3. Cocokkan & Serahkan" (STATUS BERUBAH KE 'completed'):
          if (data.status === 'completed' && previousStatus !== 'completed') {
            lastHandledCallRef.current = 0;

            const completedData = {
              ...activeOrder,
              ...data,
              status: 'completed',
              completed_at: data.completed_at || new Date().toISOString()
            };

            // Simpan permanen ke HP pengunjung secara senyap tanpa notifikasi suara
            saveOrderToHistory(completedData);
            localStorage.setItem(ACTIVE_ORDER_KEY, JSON.stringify(completedData));
            localStorage.setItem(LAST_COMPLETED_KEY, JSON.stringify(completedData));
            setOrderHistory(getStoredOrderHistory());

            // Pastikan pengunjung tetap di tampilan tiket selesai (Step 2)
            setStep(2);
          }

          // Jika pesanan berstatus ready dan dipanggil staf (panggilan awal atau panggil ulang)
          if (data.status === 'ready') {
            const effectiveCall = Math.max(1, callCount);
            if (effectiveCall > lastHandledCallRef.current) {
              lastHandledCallRef.current = effectiveCall;

              // 1. Bunyikan suara bel Ding-Dong & suara pengumuman bahasa Indonesia di HP
              announceTableOrder(data.table_no || activeOrder.table_no, data.ticket_code || activeOrder.ticket_code);

              // 2. Munculkan Notifikasi Pop-up di Layar HP jika pengguna sedang membuka tab/aplikasi lain
              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                try {
                  const isRecall = effectiveCall > 1;
                  const notifTitle = isRecall 
                    ? `📢 PANGGILAN ULANG: ${data.table_no || activeOrder.table_no}`
                    : `📚 BUKU SIAP DIAMBIL: ${data.table_no || activeOrder.table_no}`;

                  const notif = new Notification(notifTitle, {
                    body: `Tiket ${data.ticket_code || activeOrder.ticket_code}: Pesanan buku Anda sudah siap. Silakan mengambilnya di meja staf perpustakaan!`,
                    icon: '/Lambang.png',
                    badge: '/Lambang.png',
                    tag: `perpus-order-call-${activeOrder.id}-${effectiveCall}`,
                    renotify: true
                  });

                  notif.onclick = () => {
                    window.focus();
                    announceTableOrder(data.table_no || activeOrder.table_no, data.ticket_code || activeOrder.ticket_code);
                  };
                } catch (e) {
                  console.warn('Gagal memicu notification browser:', e);
                }
              }

              // 3. Jika pengguna sedang asyik di halaman katalog (step 1), munculkan konfirmasi cepat untuk langsung buka tiket
              if (stepRef.current === 1) {
                showConfirm(
                  `Pesanan buku untuk ${data.table_no || activeOrder.table_no} (${data.ticket_code || activeOrder.ticket_code}) sudah SIAP DIAMBIL di Meja Staf! Buka tiket digital sekarang untuk ditunjukkan ke staf?`,
                  {
                    title: '🔔 Buku Sudah Siap!',
                    confirmText: 'Buka Tiket Sekarang',
                    cancelText: 'Tetap di Katalog',
                    type: 'success'
                  }
                ).then((goToTicket) => {
                  if (goToTicket) {
                    setStep(2);
                  }
                });
              }
            }
          } else if (data.status === 'completed' || data.status === 'cancelled') {
            lastHandledCallRef.current = 0;
          }
        }
      } catch (err) {
        // Abaikan jika error jaringan sesaat
      }
    };

    const timer = setInterval(checkStatus, 2500);
    return () => clearInterval(timer);
  }, [activeOrder?.id, activeOrder?.table_no, activeOrder?.ticket_code, showConfirm, showAlert]);

  // Beri tahu server segera saat pengunjung menutup web / tab browser / keluar
  useEffect(() => {
    if (!activeOrder?.id) return;

    const notifyLeave = () => {
      try {
        const url = `/api/orders/${activeOrder.id}/leave`;
        if (navigator.sendBeacon) {
          navigator.sendBeacon(url);
        } else {
          fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
        }
      } catch (e) {}
    };

    window.addEventListener('beforeunload', notifyLeave);
    window.addEventListener('pagehide', notifyLeave);

    return () => {
      window.removeEventListener('beforeunload', notifyLeave);
      window.removeEventListener('pagehide', notifyLeave);
    };
  }, [activeOrder?.id]);


  // Filter & Urutkan daftar buku berdasarkan pencarian, kategori, atau terfavorit
  const filteredBooks = useMemo(() => {
    let result = [...books];

    // Jika filter TERFAVORIT aktif
    if (selectedCategory === 'FAVORITE') {
      result.sort((a, b) => {
        const rDiff = (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0);
        if (Math.abs(rDiff) > 0.05) return rDiff;
        return (b.read_count || 0) - (a.read_count || 0);
      });
    } else if (selectedCategory !== 'ALL') {
      result = result.filter(book => book.category === selectedCategory);
    }

    // Filter Pencarian Judul, Penulis, Kategori & ISBN
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(book => {
        const matchTitle = book.title.toLowerCase().includes(q);
        const matchAuthor = book.author.toLowerCase().includes(q);
        const matchCat = book.category && book.category.toLowerCase().includes(q);
        const matchIsbn = book.isbn && book.isbn.toLowerCase().includes(q);
        return matchTitle || matchAuthor || matchCat || matchIsbn;
      });
    }

    return result;
  }, [books, selectedCategory, searchQuery]);

  // Reset ke halaman 1 jika filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory]);

  // Pagination
  const totalPages = Math.ceil(filteredBooks.length / booksPerPage) || 1;
  const paginatedBooks = useMemo(() => {
    const start = (currentPage - 1) * booksPerPage;
    return filteredBooks.slice(start, start + booksPerPage);
  }, [filteredBooks, currentPage]);

  // Fungsi toggle pilih buku (Maksimal 5 buku)
  const toggleBook = (book) => {
    // Jika masih ada pesanan aktif berjalan, kunci pemilihan buku (hanya boleh lihat)
    if (hasActiveOrder) {
      showAlert(`Anda masih memiliki pesanan aktif (${activeOrder.ticket_code}) di ${activeOrder.table_no}. Selesaikan pesanan Anda terlebih dahulu sebelum memesan buku lain.`, {
        type: 'warning',
        title: 'Pesanan Sedang Berjalan'
      });
      return;
    }

    const isAlreadySelected = selectedBooks.some(b => b.id === book.id || b.title === book.title);
    if (isAlreadySelected) {
      setSelectedBooks(selectedBooks.filter(b => b.id !== book.id && b.title !== book.title));
    } else {
      if (selectedBooks.length >= 5) {
        showAlert('Maksimal 5 buku sekaligus per pesanan agar staf tidak kesulitan membawanya.', {
          type: 'warning',
          title: 'Batas Peminjaman'
        });
        return;
      }
      setSelectedBooks([...selectedBooks, book]);
    }
  };

  // Buka Modal Penilaian untuk buku tertentu
  const openRateModalForBook = (book) => {
    setRateModalBook(book);
    setModalRating(ratedBooks[book.title] || 5);
    setModalHoverRating(0);
    setModalReview('');
    setRatingSuccessMsg('');
  };

  // Kirim pesanan ke database (multi-buku)
  const handleSubmitOrder = async (e) => {
    e.preventDefault();

    if (hasActiveOrder) {
      showAlert(`Anda masih memiliki pesanan aktif (${activeOrder.ticket_code}). Mohon tunggu hingga pesanan selesai sebelum membuat pesanan baru.`, {
        type: 'warning',
        title: 'Pesanan Sedang Berjalan'
      });
      return;
    }

    if (!tableNo) {
      showAlert('Silakan pilih nomor meja Anda terlebih dahulu!', {
        type: 'warning',
        title: 'Pilih Nomor Meja'
      });
      return;
    }

    if (selectedBooks.length === 0) {
      showAlert('Pilih minimal 1 buku yang ingin dipinjam.', {
        type: 'warning',
        title: 'Pilih Buku'
      });
      return;
    }

    setIsSubmitting(true);

    const combinedTitles = serializeOrderBookTitles(selectedBooks);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_title: combinedTitles,
          books_list: selectedBooks.map(b => b.title),
          table_no: tableNo,
        }),
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData.error || 'Gagal menyimpan pesanan ke server');
      }

      const newOrder = {
        id: resData.orderId,
        ticket_code: resData.ticket_code || `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
        book_title: combinedTitles,
        books_list: selectedBooks,
        table_no: tableNo,
        status: 'pending',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setActiveOrder(newOrder);
      localStorage.setItem(ACTIVE_ORDER_KEY, JSON.stringify(newOrder));
      setSelectedBooks([]);
      setStep(2);
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        requestNotifPermission();
      }
    } catch (err) {
      console.warn('Backend offline, menggunakan kode tiket offline lokal:', err.message);
      const offlineOrder = {
        id: Date.now(),
        ticket_code: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
        book_title: combinedTitles,
        books_list: selectedBooks,
        table_no: tableNo,
        status: 'pending',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setActiveOrder(offlineOrder);
      localStorage.setItem(ACTIVE_ORDER_KEY, JSON.stringify(offlineOrder));
      setSelectedBooks([]);
      setStep(2);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Batalkan pesanan (hanya bisa saat status masih 'pending')
  const handleCancelOrder = async () => {
    const confirmed = await showConfirm('Apakah Anda yakin ingin membatalkan pesanan tiket ini?', {
      title: 'Batalkan Pesanan',
      confirmText: 'Ya, Batalkan',
      cancelText: 'Kembali',
      type: 'danger'
    });
    if (!confirmed) return;

    try {
      await fetch(`/api/orders/${activeOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
    } catch (e) {}

    localStorage.removeItem(ACTIVE_ORDER_KEY);
    setActiveOrder(null);
    setSelectedBooks([]);
    setStep(1);
  };

  // Selesai & Pesan Buku Baru (Arsipkan pesanan sebelumnya secara aman ke riwayat HP)
  const handleOrderNewBooks = async () => {
    const ok = await showConfirm(
      'Apakah Anda ingin membuat pesanan peminjaman buku baru? Tiket Anda saat ini akan tetap tersimpan aman di Riwayat Pesanan HP Anda.',
      {
        title: 'Pesan Buku Baru',
        confirmText: 'Ya, Buat Pesanan Baru',
        cancelText: 'Tetap di Tiket Ini',
        type: 'info'
      }
    );
    if (!ok) return;

    if (activeOrder) {
      saveOrderToHistory({
        ...activeOrder,
        status: 'completed',
        completed_at: activeOrder.completed_at || new Date().toISOString()
      });
      localStorage.setItem(LAST_COMPLETED_KEY, JSON.stringify(activeOrder));
    }

    localStorage.removeItem(ACTIVE_ORDER_KEY);
    setActiveOrder(null);
    setSelectedBooks([]);
    setStep(1);
    setOrderHistory(getStoredOrderHistory());
  };

  // Buka tiket tertentu dari modal riwayat pesanan
  const handleViewHistoryOrder = (order) => {
    setActiveOrder(order);
    setStep(2);
    setShowHistoryModal(false);
  };

  // Konfirmasi penerimaan buku oleh pengunjung (tombol "Sudah Saya Terima Bukunya")
  const handleConfirmReceived = async () => {
    if (!activeOrder?.id) return;
    setIsConfirmingReceived(true);
    try {
      if (activeOrder.status !== 'completed') {
        await fetch(`/api/orders/${activeOrder.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed' }),
        }).catch(() => {});
      }

      const updated = {
        ...activeOrder,
        status: 'completed',
        visitor_received: true,
        received_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setActiveOrder(updated);
      localStorage.setItem(ACTIVE_ORDER_KEY, JSON.stringify(updated));
      localStorage.setItem(LAST_COMPLETED_KEY, JSON.stringify(updated));
      saveOrderToHistory(updated);
      setOrderHistory(getStoredOrderHistory());
    } catch (err) {
      console.warn('Gagal konfirmasi terima buku:', err);
    } finally {
      setIsConfirmingReceived(false);
    }
  };

  // Bersihkan seluruh riwayat pesanan yang tersimpan di HP ini
  const handleClearHistory = async () => {
    const ok = await showConfirm('Apakah Anda yakin ingin menghapus seluruh riwayat pesanan tiket yang tersimpan di HP ini?', {
      title: 'Hapus Riwayat Pesanan',
      confirmText: 'Ya, Hapus Semua',
      cancelText: 'Batal',
      type: 'danger'
    });
    if (!ok) return;
    localStorage.removeItem(ORDER_HISTORY_KEY);
    localStorage.removeItem(LAST_COMPLETED_KEY);
    setOrderHistory([]);
  };


  // Handler Kirim Rating dari Modal Popup (baik dari katalog maupun tiket selesai)
  const handleRateModalSubmit = async () => {
    if (!rateModalBook) return;
    setIsSubmittingRating(true);
    try {
      let res;
      if (rateModalBook.id) {
        res = await fetch(`/api/books/${rateModalBook.id}/rate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rating: modalRating,
            review_text: modalReview,
            table_no: activeOrder?.table_no || tableNo || 'Pengunjung Kios'
          })
        });
      } else {
        res = await fetch('/api/books/rate-by-title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: rateModalBook.title,
            rating: modalRating,
            review_text: modalReview,
            table_no: activeOrder?.table_no || tableNo || 'Pengunjung Kios'
          })
        });
      }

      const data = await res.json();
      const newRated = { ...ratedBooks, [rateModalBook.title]: modalRating };
      setRatedBooks(newRated);
      localStorage.setItem('bibliotech_rated_books', JSON.stringify(newRated));

      if (data.book) {
        setBooks(prev => prev.map(b => b.id === data.book.id ? { ...b, ...data.book } : b));
      }

      setRatingSuccessMsg(`⭐ Terima kasih! Penilaian ${modalRating} bintang untuk "${rateModalBook.title}" berhasil dicatat.`);
      setTimeout(() => {
        setRateModalBook(null);
        setRatingSuccessMsg('');
        setModalReview('');
      }, 1500);
    } catch (err) {
      console.error('Gagal mengirim ulasan:', err);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const getStepIndex = (status) => {
    switch (status) {
      case 'pending': return 1;
      case 'searching': return 2;
      case 'ready': return 3;
      case 'completed': return 4;
      default: return 1;
    }
  };

  const currentStepIdx = getStepIndex(activeOrder?.status);

  return (
    <div className="glass-panel">
      {step === 1 && (
        <div>
          {/* Banner Status Pesanan Aktif saat Pengunjung Melihat-lihat Katalog */}
          {hasActiveOrder && (
            <div 
              className={`active-order-floating-banner ${activeOrder.status === 'ready' ? 'pulse-ready' : ''}`}
              style={{
                background: activeOrder.status === 'ready' 
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.28), rgba(6, 78, 59, 0.55))'
                  : activeOrder.status === 'searching'
                  ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.28), rgba(49, 46, 129, 0.55))'
                  : 'linear-gradient(135deg, rgba(245, 158, 11, 0.22), rgba(120, 53, 15, 0.5))',
                border: `1.5px solid ${
                  activeOrder.status === 'ready' ? '#10b981' : activeOrder.status === 'searching' ? '#6366f1' : '#f59e0b'
                }`,
                borderRadius: '16px',
                padding: '1rem 1.25rem',
                marginBottom: '1.8rem',
                boxShadow: activeOrder.status === 'ready' 
                  ? '0 0 25px rgba(16, 185, 129, 0.45)' 
                  : '0 8px 24px rgba(0,0,0,0.3)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                position: 'sticky',
                top: '0.8rem',
                zIndex: 90
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '260px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: activeOrder.status === 'ready' ? '#10b981' : activeOrder.status === 'searching' ? '#6366f1' : '#f59e0b',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
                }}>
                  {activeOrder.status === 'ready' ? (
                    <Bell size={24} />
                  ) : activeOrder.status === 'searching' ? (
                    <Search size={22} className="animate-spin" />
                  ) : (
                    <Clock size={22} />
                  )}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8' }}>
                      Status Pesanan: {activeOrder.table_no}
                    </span>
                    <span style={{
                      background: 'rgba(255, 255, 255, 0.12)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: '700',
                      color: '#ffffff',
                      letterSpacing: '0.5px'
                    }}>
                      {activeOrder.ticket_code}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '1rem',
                    fontWeight: '700',
                    color: activeOrder.status === 'ready' ? '#34d399' : activeOrder.status === 'searching' ? '#a5b4fc' : '#fbbf24',
                    marginTop: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    {activeOrder.status === 'ready' && '🔔 BUKU SUDAH SIAP DIAMBIL DI MEJA STAF!'}
                    {activeOrder.status === 'searching' && '🔍 Staf sedang mengambil buku Anda di rak...'}
                    {activeOrder.status === 'pending' && '⏳ Pesanan dalam antrean menunggu staf...'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.75)', marginTop: '2px' }}>
                    {activeOrder.status === 'ready' 
                      ? 'Silakan menuju ke meja staf sekarang dan sebutkan nomor tiket Anda!'
                      : 'Layar ini sedang dalam mode lihat buku. Suara bel akan berbunyi otomatis saat buku siap.'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {activeOrder.status === 'ready' && (
                  <button
                    type="button"
                    onClick={() => announceTableOrder(activeOrder.table_no, activeOrder.ticket_code)}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.55rem 0.9rem',
                      fontSize: '0.82rem',
                      borderRadius: '10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#34d399',
                      borderColor: 'rgba(52, 211, 153, 0.4)'
                    }}
                    title="Dengarkan pengumuman suara panggilan"
                  >
                    <Volume2 size={16} /> Dengar Suara
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn"
                  style={{
                    padding: '0.55rem 1.2rem',
                    fontSize: '0.88rem',
                    fontWeight: '700',
                    borderRadius: '10px',
                    background: activeOrder.status === 'ready' 
                      ? 'linear-gradient(135deg, #10b981, #059669)' 
                      : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    boxShadow: activeOrder.status === 'ready' 
                      ? '0 0 15px rgba(16, 185, 129, 0.5)' 
                      : '0 0 15px var(--primary-glow)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Ticket size={17} /> Buka Tiket Digital <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Quick bar Riwayat Pesanan & Tiket Tersimpan di bagian atas katalog */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="btn btn-secondary"
              style={{
                padding: '0.45rem 1.15rem',
                fontSize: '0.84rem',
                fontWeight: '600',
                borderRadius: '20px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: '#facc15',
                borderColor: 'rgba(250, 204, 21, 0.45)',
                background: 'rgba(250, 204, 21, 0.08)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}
              title="Lihat riwayat tiket peminjaman yang tersimpan di HP ini"
            >
              <History size={15} /> Riwayat Pesanan Saya ({orderHistory.length})
            </button>

            {activeOrder && (
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn btn-secondary"
                style={{
                  padding: '0.45rem 1.15rem',
                  fontSize: '0.84rem',
                  fontWeight: '600',
                  borderRadius: '20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: activeOrder.status === 'completed' ? '#34d399' : '#818cf8',
                  borderColor: activeOrder.status === 'completed' ? 'rgba(52, 211, 153, 0.45)' : 'rgba(99, 102, 241, 0.45)',
                  background: activeOrder.status === 'completed' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(99, 102, 241, 0.12)'
                }}
                title="Buka tiket digital"
              >
                <Ticket size={15} /> Tiket {activeOrder.status === 'completed' ? 'Selesai' : 'Aktif'}: {activeOrder.ticket_code} ({activeOrder.table_no})
              </button>
            )}
          </div>

          {/* Banner jika pesanan selesai dan tersimpan di HP */}
          {!hasActiveOrder && activeOrder && activeOrder.status === 'completed' && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(6, 78, 59, 0.45))',
              border: '1.5px solid #10b981',
              borderRadius: '14px',
              padding: '1.1rem 1.3rem',
              marginBottom: '1.8rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              boxShadow: '0 4px 20px rgba(16, 185, 129, 0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <CheckCircle2 size={26} color="#34d399" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: '800', color: '#34d399', fontSize: '0.98rem' }}>
                    ✅ Pesanan Tiket {activeOrder.ticket_code} ({activeOrder.table_no}) Telah Selesai!
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#e2e8f0', marginTop: '2px', lineHeight: 1.4 }}>
                    Buku telah diserahkan di meja staf &amp; <strong>tersimpan aman di HP ini</strong>. Selamat membaca! Anda dapat memberi ulasan atau memesan buku baru kembali.
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button 
                  type="button"
                  className="btn btn-secondary" 
                  onClick={() => setStep(2)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: '600' }}
                >
                  <Ticket size={15} /> Buka Tiket / Beri Ulasan
                </button>
                <button 
                  type="button"
                  className="btn" 
                  onClick={handleOrderNewBooks}
                  style={{ padding: '0.5rem 1.1rem', fontSize: '0.85rem', fontWeight: '700', background: 'var(--primary-color)' }}
                >
                  <Plus size={15} /> Pesan Buku Baru
                </button>
              </div>
            </div>
          )}

          <div className="page-header" style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1>Katalog & Pesan Buku Meja</h1>
            <p>Koleksi Buku Resmi <strong>Perpustakaan Umum Kota Parepare</strong></p>
          </div>

          {/* Pemilihan / Deteksi Nomor Meja Pengunjung */}
          <div style={{ 
            maxWidth: '440px', 
            margin: '0 auto 2rem auto', 
            background: isAutoDetectedFromQr ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.16), rgba(6, 78, 59, 0.28))' : 'rgba(0,0,0,0.25)', 
            padding: '1.25rem', 
            borderRadius: '16px', 
            border: isAutoDetectedFromQr ? '1.5px solid rgba(16, 185, 129, 0.55)' : '1px solid var(--surface-border)',
            boxShadow: isAutoDetectedFromQr ? '0 8px 24px rgba(16, 185, 129, 0.18)' : 'none',
            transition: 'all 0.3s ease'
          }}>
            {isAutoDetectedFromQr && tableNo ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  background: 'rgba(16, 185, 129, 0.25)', 
                  color: '#34d399', 
                  padding: '4px 12px', 
                  borderRadius: '20px', 
                  fontSize: '0.78rem', 
                  fontWeight: '700', 
                  marginBottom: '0.6rem',
                  border: '1px solid rgba(16, 185, 129, 0.45)'
                }}>
                  <Sparkles size={14} /> Terdeteksi Otomatis dari Barcode Meja
                </div>
                
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: '900', 
                  color: '#ffffff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px', 
                  marginBottom: '0.3rem' 
                }}>
                  <MapPin size={24} color="#10b981" /> {tableNo}
                </div>

                <p style={{ fontSize: '0.8rem', color: '#cbd5e1', margin: '0 0 0.8rem 0', lineHeight: 1.4 }}>
                  Pesanan buku Anda akan disiapkan dan diantar staf ke meja ini.
                </p>

                {!hasActiveOrder && (
                  <button
                    type="button"
                    onClick={() => setIsAutoDetectedFromQr(false)}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: '#94a3b8', 
                      fontSize: '0.75rem', 
                      textDecoration: 'underline', 
                      cursor: 'pointer',
                      padding: '4px 8px'
                    }}
                  >
                    Bukan meja ini? Ganti nomor meja manual
                  </button>
                )}
              </div>
            ) : (
              <>
                <label style={{ display: 'block', textAlign: 'center', fontWeight: '600', marginBottom: '0.6rem' }}>
                  📍 Anda Duduk di Meja Berapa?
                </label>
                <select 
                  className="form-control" 
                  value={tableNo} 
                  onChange={(e) => {
                    setTableNo(e.target.value);
                    try {
                      localStorage.setItem(TABLE_NO_KEY, e.target.value);
                    } catch (err) {}
                  }}
                  disabled={hasActiveOrder}
                  style={{ background: 'rgba(25, 27, 36, 0.95)', fontSize: '1rem', fontWeight: '600', opacity: hasActiveOrder ? 0.75 : 1, cursor: hasActiveOrder ? 'not-allowed' : 'pointer' }}
                >
                  <option value="" disabled>-- Pilih Nomor Meja Anda --</option>
                  {tables.map(table => (
                    <option key={table} value={table}>{table}</option>
                  ))}
                </select>
                {detectedTableFromUrl && !isAutoDetectedFromQr && (
                  <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setTableNo(detectedTableFromUrl);
                        setIsAutoDetectedFromQr(true);
                      }}
                      style={{ background: 'none', border: 'none', color: '#34d399', fontSize: '0.75rem', textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      Kembalikan ke {detectedTableFromUrl} (dari Barcode)
                    </button>
                  </div>
                )}
              </>
            )}

            {hasActiveOrder && (
              <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#fbbf24', marginTop: '6px' }}>
                🔒 Meja dikunci ke <strong>{activeOrder.table_no}</strong> karena ada pesanan berjalan.
              </p>
            )}
          </div>

          {/* Bar Pencarian Buku & Filter Kategori / Favorit */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.8rem' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                className="form-control" 
                placeholder="Cari judul buku, pengarang, kategori, atau ISBN (misal: 978...)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '3rem', fontSize: '0.95rem' }}
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

            {/* Bar Tab Filter Ringkas & Rapi dengan Dropdown Toggle Kategori */}
            <div className="filter-shelf-container" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Tombol Toggle Semua Buku */}
              <button 
                type="button"
                className={`btn ${selectedCategory === 'ALL' ? '' : 'btn-secondary'}`}
                style={{ 
                  padding: '0.42rem 1rem', 
                  fontSize: '0.84rem',
                  borderRadius: '20px',
                  background: selectedCategory === 'ALL' ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.05)',
                  borderColor: selectedCategory === 'ALL' ? 'var(--primary-color)' : 'var(--surface-border)',
                  fontWeight: '600',
                  boxShadow: selectedCategory === 'ALL' ? '0 0 14px var(--primary-glow)' : 'none'
                }}
                onClick={() => setSelectedCategory('ALL')}
              >
                📚 Semua Buku ({books.length})
              </button>

              {/* Tombol Toggle Terfavorit */}
              <button 
                type="button"
                className={`btn ${selectedCategory === 'FAVORITE' ? '' : 'btn-secondary'}`}
                style={{ 
                  padding: '0.42rem 1rem', 
                  fontSize: '0.84rem',
                  borderRadius: '20px',
                  background: selectedCategory === 'FAVORITE' 
                    ? 'linear-gradient(135deg, #f59e0b, #d97706)' 
                    : 'rgba(245, 158, 11, 0.1)',
                  borderColor: selectedCategory === 'FAVORITE' 
                    ? '#f59e0b' 
                    : 'rgba(245, 158, 11, 0.35)',
                  color: selectedCategory === 'FAVORITE' ? '#ffffff' : '#fcd34d',
                  fontWeight: '600',
                  boxShadow: selectedCategory === 'FAVORITE' ? '0 0 14px rgba(245, 158, 11, 0.5)' : 'none'
                }}
                onClick={() => setSelectedCategory('FAVORITE')}
              >
                ⭐ Terfavorit
              </button>

              {/* Toggle Dropdown Pemilih Kategori */}
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <select 
                  value={selectedCategory !== 'ALL' && selectedCategory !== 'FAVORITE' ? selectedCategory : ''}
                  onChange={(e) => setSelectedCategory(e.target.value || 'ALL')}
                  style={{
                    padding: '0.42rem 2.2rem 0.42rem 1rem',
                    fontSize: '0.84rem',
                    borderRadius: '20px',
                    fontWeight: '600',
                    background: selectedCategory !== 'ALL' && selectedCategory !== 'FAVORITE' 
                      ? 'var(--primary-color)' 
                      : 'rgba(255, 255, 255, 0.05)',
                    color: selectedCategory !== 'ALL' && selectedCategory !== 'FAVORITE' ? '#ffffff' : 'var(--text-main)',
                    border: selectedCategory !== 'ALL' && selectedCategory !== 'FAVORITE'
                      ? '1px solid var(--primary-color)'
                      : '1px solid var(--surface-border)',
                    cursor: 'pointer',
                    outline: 'none',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    boxShadow: selectedCategory !== 'ALL' && selectedCategory !== 'FAVORITE' ? '0 0 14px var(--primary-glow)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <option value="" style={{ background: '#1e293b', color: '#cbd5e1' }}>
                    🏷️ {selectedCategory !== 'ALL' && selectedCategory !== 'FAVORITE' ? `Kategori: ${selectedCategory}` : `Pilih Kategori (${categories.length})...`}
                  </option>
                  {categories.map(cat => (
                    <option key={cat} value={cat} style={{ background: '#1e293b', color: '#ffffff' }}>
                      {cat}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: '12px', pointerEvents: 'none', color: selectedCategory !== 'ALL' && selectedCategory !== 'FAVORITE' ? '#ffffff' : 'var(--text-muted)' }} />
              </div>

              {/* Tombol Reset Cepat jika Filter Kategori Sedang Aktif */}
              {selectedCategory !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('ALL')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    textDecoration: 'underline'
                  }}
                  title="Kembalikan ke semua buku"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Bar Status Pemilihan Buku */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              {selectedCategory === 'FAVORITE' ? (
                <span>Menampilkan <strong>{filteredBooks.length}</strong> buku (koleksi rating tertinggi)</span>
              ) : (
                <span>Menampilkan <strong>{filteredBooks.length}</strong> buku {selectedCategory !== 'ALL' ? `kategori ${selectedCategory}` : ''}</span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {hasActiveOrder ? (
                <span style={{ 
                  background: 'rgba(245, 158, 11, 0.15)', 
                  border: '1px solid rgba(245, 158, 11, 0.35)', 
                  color: '#fcd34d', 
                  padding: '0.35rem 0.9rem', 
                  borderRadius: '20px', 
                  fontSize: '0.82rem', 
                  fontWeight: '700',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Lock size={13} /> Mode Lihat Buku (Pesanan Sedang Diproses)
                </span>
              ) : (
                <span style={{ 
                  background: selectedBooks.length > 0 ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255,255,255,0.08)', 
                  border: selectedBooks.length > 0 ? '1.5px solid var(--primary-color)' : '1px solid var(--surface-border)', 
                  color: selectedBooks.length > 0 ? '#c7d2fe' : 'var(--text-muted)', 
                  padding: '0.35rem 0.9rem', 
                  borderRadius: '20px', 
                  fontSize: '0.85rem', 
                  fontWeight: '700' 
                }}>
                  Buku Dipilih: {selectedBooks.length}/5
                </span>
              )}
            </div>
          </div>

          {/* Banner Pemberitahuan Mode Lihat-Lihat saat Ada Pesanan Aktif */}
          {hasActiveOrder && (
            <div style={{
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              borderRadius: '12px',
              padding: '0.8rem 1.1rem',
              marginBottom: '1.4rem',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '0.85rem',
              color: '#cbd5e1'
            }}>
              <Eye size={20} color="#818cf8" style={{ flexShrink: 0 }} />
              <span>
                <strong>Mode Lihat Katalog:</strong> Anda dapat menjelajahi koleksi, lokasi rak, dan membaca ulasan buku. Pemesanan buku lain baru bisa dilakukan setelah pesanan aktif <strong>({activeOrder.ticket_code})</strong> selesai diambil.
              </span>
            </div>
          )}

          {/* ========================================================= */}
          {/* MOBILE ORDER BAR (DI ATAS DAFTAR BUKU - IKUT SCROLL ALAMI) */}
          {/* ========================================================= */}
          {selectedBooks.length > 0 && !hasActiveOrder && (
            <div className="mobile-order-bar">
              <div className="floating-order-info">
                <div className="floating-order-badge-row">
                  <span className="floating-order-tag">
                    KERANJANG PINJAM
                  </span>
                  <span className="floating-order-count">
                    ({selectedBooks.length}/5 Buku)
                  </span>
                </div>
                <div className="floating-order-titles" title={selectedBooks.map(b => b.title).join(' • ')}>
                  📚 {selectedBooks.map(b => b.title).join(' • ')}
                </div>
              </div>

              <div className="floating-order-actions">
                <button 
                  type="button"
                  className="btn btn-secondary floating-order-btn-cancel" 
                  onClick={() => setSelectedBooks([])}
                >
                  Batal
                </button>

                <button 
                  type="button"
                  className="btn floating-order-btn-submit" 
                  onClick={handleSubmitOrder} 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Memproses...
                    </>
                  ) : (
                    <>
                      <Send size={16} /> Pesan {selectedBooks.length} Buku Sekarang
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loadingBooks ? (
            <div style={{ textAlign: 'center', padding: '4rem 0' }}>
              <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary-color)', margin: '0 auto' }} />
              <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                Menghubungkan ke database MySQL & memuat katalog 260+ buku...
              </p>
            </div>
          ) : filteredBooks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
              <BookOpen size={42} style={{ color: 'var(--text-muted)', margin: '0 auto' }} />
              <p style={{ marginTop: '0.4rem', fontSize: '0.9rem' }}>
                Tidak ada buku dengan kata kunci "{searchQuery}" pada filter saat ini.
              </p>
              <button 
                className="btn btn-secondary" 
                style={{ marginTop: '1rem', fontSize: '0.85rem' }} 
                onClick={() => { setSearchQuery(''); setSelectedCategory('ALL'); }}
              >
                Reset Pencarian
              </button>
            </div>
          ) : (
            /* ========================================================= */
            /* GRID COVER BUKU REALISTIS DENGAN BINTANG RATING */
            /* ========================================================= */
            <div className="book-list">
              {paginatedBooks.map((book) => {
                const isSelected = selectedBooks.some(b => b.id === book.id || b.title === book.title);
                const theme = getThemeForBook(book.id, book.title);
                const isFavorite = (parseFloat(book.rating) >= 4.8 && (book.read_count >= 15 || book.rating_count >= 10));

                return (
                  <div 
                    key={book.id} 
                    className={`book-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => openRateModalForBook(book)}
                    style={{ cursor: 'pointer', position: 'relative' }}
                    title="Tekan buku untuk melihat ulasan & memberi rating bintang"
                  >
                    {/* Tombol Checklist/Pilih Pinjam Cepat di Pojok Kanan Atas */}
                    <div
                      className="book-select-badge"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasActiveOrder) {
                          showAlert(`Anda sedang memiliki pesanan aktif (${activeOrder.ticket_code}) di ${activeOrder.table_no}. Selesaikan pesanan Anda terlebih dahulu sebelum memesan buku lain.`, {
                            type: 'warning',
                            title: 'Mode Lihat Saja'
                          });
                          return;
                        }
                        toggleBook(book);
                      }}
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        zIndex: 4,
                        cursor: hasActiveOrder ? 'default' : 'pointer'
                      }}
                      title={
                        hasActiveOrder
                          ? `Pesanan aktif (${activeOrder.ticket_code}) sedang berjalan. Selesaikan dahulu sebelum memesan buku lain.`
                          : isSelected
                          ? "Batalkan pilihan pinjam"
                          : "Pilih buku ini untuk dipinjam"
                      }
                    >
                      {hasActiveOrder ? (
                        <div style={{
                          background: 'rgba(15, 23, 42, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.25)',
                          color: '#94a3b8',
                          borderRadius: '14px',
                          padding: '3px 8px',
                          fontSize: '0.68rem',
                          fontWeight: '700',
                          backdropFilter: 'blur(4px)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <Lock size={11} color="#f59e0b" /> Lihat
                        </div>
                      ) : isSelected ? (
                        <div style={{ 
                          width: '28px', 
                          height: '28px', 
                          background: 'var(--primary-color)', 
                          borderRadius: '50%', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          color: 'white',
                          boxShadow: '0 0 12px var(--primary-glow)'
                        }}>
                          <Check size={16} strokeWidth={3} />
                        </div>
                      ) : (
                        <div style={{
                          background: 'rgba(0, 0, 0, 0.65)',
                          border: '1px solid rgba(255, 255, 255, 0.25)',
                          color: '#e2e8f0',
                          borderRadius: '14px',
                          padding: '3px 8px',
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          backdropFilter: 'blur(4px)',
                          transition: 'all 0.2s ease'
                        }}>
                          + Pilih
                        </div>
                      )}
                    </div>

                    {/* Badge Favorit Pembaca (Jika Rating Tinggi) */}
                    {isFavorite && !isSelected && (
                      <div 
                        className="book-favorite-badge"
                        style={{ 
                          position: 'absolute', 
                          top: '10px', 
                          left: '10px', 
                          background: 'linear-gradient(135deg, #f59e0b, #d97706)', 
                          color: '#ffffff', 
                          padding: '2px 7px', 
                          borderRadius: '6px', 
                          fontSize: '0.62rem', 
                          fontWeight: '800', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '3px',
                          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.45)',
                          zIndex: 2,
                          letterSpacing: '0.4px'
                        }}>
                        <Flame size={10} fill="#ffffff" strokeWidth={0} /> FAVORIT
                      </div>
                    )}

                    {/* Sampul Buku 3D Realistis atau Gambar dari API */}
                    {book.cover_url ? (
                      <div className="book-cover-wrapper" style={{ padding: 0, overflow: 'hidden', border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column' }}>
                        <img 
                          src={book.cover_url} 
                          alt={`Sampul ${book.title}`} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          onLoad={(e) => {
                            if (e.target.naturalWidth <= 1) {
                              e.target.style.display = 'none';
                              if (e.target.nextSibling) {
                                e.target.nextSibling.style.display = 'flex';
                                e.target.nextSibling.style.height = '100%';
                              }
                            }
                          }}
                          onError={(e) => { 
                            e.target.style.display = 'none'; 
                            if (e.target.nextSibling) {
                              e.target.nextSibling.style.display = 'flex'; 
                              e.target.nextSibling.style.height = '100%';
                            }
                          }}
                        />
                        <div style={{ display: 'none', width: '100%', height: '100%', background: theme.bg, flexDirection: 'column', position: 'relative', flex: 1 }}>
                          <div className="book-cover-ddc">DDC {book.classification || '813'}</div>
                          <div className="book-cover-title" style={{ marginTop: 'auto', marginBottom: 'auto' }}>{book.title}</div>
                          <div className="book-cover-author" style={{ marginTop: 'auto' }}>✍️ {book.author}</div>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="book-cover-wrapper"
                        style={{ 
                          background: theme.bg,
                          borderColor: theme.border
                        }}
                      >
                        {/* DDC Classification Badge */}
                        <div className="book-cover-ddc">
                          DDC {book.classification || '813'}
                        </div>

                        {/* Judul Buku Bergaya Serif Elegan */}
                        <div className="book-cover-title">
                          {book.title}
                        </div>

                        {/* Penulis Buku */}
                        <div className="book-cover-author">
                          ✍️ {book.author}
                        </div>
                      </div>
                    )}

                    {/* Info Tambahan di Bawah Cover */}
                    <div>
                      <div className="book-title" title={book.title}>
                        {book.title}
                      </div>
                      <div className="book-author" title={book.author}>
                        {book.author}
                      </div>

                      {/* Bar Informasi: Kategori di Kiri, Rating Bintang di Kanan Bawah */}
                      <div className="book-meta-row" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.72rem' }}>
                        <span style={{ 
                          background: 'rgba(255,255,255,0.07)', 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          color: '#94a3b8',
                          display: 'inline-flex',
                          alignItems: 'center',
                          fontWeight: '500'
                        }}>
                          {book.category || 'Koleksi Umum'}
                        </span>

                        {/* Kolom Kanan Bawah: Rating Bintang & Slot Stok Buku */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                          {/* Indikator Bintang Rating */}
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              color: '#facc15',
                              fontWeight: '700',
                              background: 'rgba(250, 204, 21, 0.12)',
                              padding: '2px 7px',
                              borderRadius: '12px',
                              border: '1px solid rgba(250, 204, 21, 0.28)',
                              fontSize: '0.72rem'
                            }}
                          >
                            <Star size={11} fill="#facc15" strokeWidth={0} /> {parseFloat(book.rating || 4.5).toFixed(1)}
                          </div>
                          {/* (Slot di bawah rating disiapkan untuk stok buku nantinya) */}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ========================================================= */}
          {/* KONTROL PAGINATION */}
          {/* ========================================================= */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2.5rem' }}>
              <button 
                className="btn btn-secondary" 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
              >
                <ChevronLeft size={16} /> Sebelumnya
              </button>

              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong>
              </span>

              <button 
                className="btn btn-secondary" 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
              >
                Berikutnya <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* ========================================================= */}
          {/* DESKTOP ORDER BAR: STICKY DI BAWAH (HANYA DESKTOP) */}
          {/* ========================================================= */}
          {selectedBooks.length > 0 && !hasActiveOrder && (
            <div className="desktop-order-bar">
              <div className="floating-order-info">
                <div className="floating-order-badge-row">
                  <span className="floating-order-tag">
                    KERANJANG PINJAM
                  </span>
                  <span className="floating-order-count">
                    ({selectedBooks.length}/5 Buku)
                  </span>
                </div>
                <div className="floating-order-titles" title={selectedBooks.map(b => b.title).join(' • ')}>
                  📚 {selectedBooks.map(b => b.title).join(' • ')}
                </div>
              </div>

              <div className="floating-order-actions">
                <button 
                  type="button"
                  className="btn btn-secondary floating-order-btn-cancel" 
                  onClick={() => setSelectedBooks([])}
                >
                  Batal
                </button>

                <button 
                  type="button"
                  className="btn floating-order-btn-submit" 
                  onClick={handleSubmitOrder} 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Memproses...
                    </>
                  ) : (
                    <>
                      <Send size={16} /> Pesan {selectedBooks.length} Buku Sekarang
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAMPILAN TIKET PENGAMBILAN DIGITAL (RINGKAS & TANPA SCROLL) */}
      {/* ========================================================= */}
      {step === 2 && activeOrder && (
        <div style={{ padding: '1rem 0' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            {activeOrder.status === 'completed' ? (
              <span className="status-badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '0.45rem 1.15rem', border: '1.5px solid rgba(16, 185, 129, 0.45)', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={16} /> Tiket Selesai: {activeOrder.table_no} (Tersimpan di HP)
              </span>
            ) : (
              <span className="status-badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: 'var(--primary-color)', padding: '0.4rem 1rem' }}>
                Tiket Aktif: {activeOrder.table_no}
              </span>
            )}
            <h1 style={{ marginTop: '0.5rem', fontSize: '1.8rem' }}>
              {activeOrder.status === 'completed' ? 'Tiket Peminjaman Selesai' : 'Tiket Pengambilan Digital'}
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>
              {activeOrder.status === 'completed' 
                ? 'Buku telah diserahkan oleh staf perpustakaan. Data tiket tersimpan aman di HP Anda.'
                : 'Tunjukkan nomor tiket ini ke staf saat penyerahan buku'}
            </p>

            {/* Tombol Cepat Navigasi Katalog & Riwayat */}
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn btn-secondary"
                style={{
                  padding: '0.55rem 1.35rem',
                  borderRadius: '24px',
                  fontSize: '0.86rem',
                  fontWeight: '600',
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderColor: 'rgba(99, 102, 241, 0.4)',
                  color: '#e0e7ff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.25)'
                }}
              >
                <BookOpen size={16} color="#818cf8" />
                <span>Lihat Koleksi Buku di Katalog</span>
                <ArrowRight size={14} color="#818cf8" />
              </button>

              <button
                type="button"
                onClick={() => setShowHistoryModal(true)}
                className="btn btn-secondary"
                style={{
                  padding: '0.55rem 1.25rem',
                  borderRadius: '24px',
                  fontSize: '0.86rem',
                  fontWeight: '600',
                  background: 'rgba(250, 204, 21, 0.1)',
                  borderColor: 'rgba(250, 204, 21, 0.45)',
                  color: '#facc15',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)'
                }}
              >
                <History size={16} color="#facc15" />
                <span>Riwayat Tiket ({orderHistory.length})</span>
              </button>
            </div>

            {/* Banner Izin Notifikasi Web Push di HP */}
            {notifPermission === 'default' && (
              <div style={{
                margin: '1rem auto 0',
                maxWidth: '460px',
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1.5px solid rgba(99, 102, 241, 0.45)',
                borderRadius: '12px',
                padding: '0.8rem 1.1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.8rem',
                textAlign: 'left'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700', fontSize: '0.88rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Bell size={16} color="#fbbf24" /> Aktifkan Notifikasi di HP
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: '2px' }}>
                    Agar HP berbunyi saat dipanggil staf, meskipun buka aplikasi lain
                  </div>
                </div>
                <button
                  type="button"
                  onClick={requestNotifPermission}
                  className="btn"
                  style={{
                    padding: '0.45rem 0.9rem',
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    borderRadius: '8px'
                  }}
                >
                  Izinkan 🔔
                </button>
              </div>
            )}

            {notifPermission === 'granted' && (
              <div style={{
                margin: '0.8rem auto 0',
                maxWidth: '460px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '10px',
                padding: '0.45rem 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '0.78rem',
                color: '#6ee7b7',
                fontWeight: '600'
              }}>
                <CheckCircle2 size={15} /> Notifikasi HP Aktif (HP akan berbunyi saat dipanggil staf)
              </div>
            )}
          </div>


          <div className="ticket-wrapper">
            <div className="ticket-container">
              {/* Lubang tiket visual */}
              <div className="ticket-cutout-left"></div>
              <div className="ticket-cutout-right"></div>

              {/* Header Tiket */}
              <div className="ticket-header">
                <div style={{ fontSize: '0.8rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <img src="/Lambang.png" alt="Lambang" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                  <img src="/logo-perpus.png" alt="Logo Perpus" style={{ width: '20px', height: '20px', objectFit: 'contain' }} onError={(e) => { e.currentTarget.src = '/logo perpus.jpg'; }} />
                  <img src="/logo-ilkom.png" alt="Logo Ilkom" style={{ width: '20px', height: '20px', objectFit: 'contain' }} onError={(e) => { e.currentTarget.src = '/logo ilkom.jpg'; }} />
                  PERPUSTAKAAN UMUM KOTA PAREPARE
                </div>

                <div className="ticket-code-badge">
                  {activeOrder.ticket_code}
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.6rem' }}>
                  Lokasi: <strong>{activeOrder.table_no}</strong> • Jam Pesan: {activeOrder.time}
                </p>
              </div>

              {/* Isi Tiket */}
              <div className="ticket-body">
                {/* Daftar Buku yang Dipesan dengan Tombol Rating Cepat Langsung di Kartu */}
                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1.2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '1px' }}>
                      Daftar Buku yang Dipesan:
                    </div>
                    {activeOrder.status === 'completed' && (
                      <span style={{ fontSize: '0.75rem', color: '#facc15', fontWeight: '600' }}>
                        *Tekan buku untuk beri rating
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {parseOrderBookTitles(activeOrder.book_title, books).map((titleWithShelf, idx) => {
                      const cleanT = titleWithShelf.replace(/\[.*?\]/g, '').trim();
                      const isRated = ratedBooks[cleanT];
                      const foundBook = books.find(b => b.title.toLowerCase().trim() === cleanT.toLowerCase().trim()) || {
                        id: null,
                        title: cleanT,
                        author: 'Koleksi Perpustakaan',
                        shelf_location: titleWithShelf.includes('[') ? titleWithShelf.match(/\[(.*?)\]/)?.[1] || 'Lemari 3' : 'Lemari 3'
                      };

                      return (
                        <div 
                          key={idx} 
                          onClick={() => {
                            // Tekan buku untuk langsung memunculkan modal penilaian (tanpa scroll ke bawah)
                            openRateModalForBook(foundBook);
                          }}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: isRated ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                            border: isRated ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(250, 204, 21, 0.25)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          title="Tekan buku untuk beri bintang penilaian"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(99,102,241,0.25)', color: '#a5b4fc', fontSize: '0.75rem', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {idx + 1}
                            </span>
                            <span style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)' }}>
                              {cleanT}
                            </span>
                          </div>

                          <div>
                            {isRated ? (
                              <span style={{ color: 'var(--success)', fontSize: '0.8rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={14} /> {isRated} ⭐
                              </span>
                            ) : (
                              <span style={{ 
                                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                color: '#ffffff',
                                padding: '3px 9px',
                                borderRadius: '20px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)'
                              }}>
                                <Star size={11} fill="#ffffff" strokeWidth={0} /> Beri Rating
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Status Realtime Banner */}
                {activeOrder.status === 'ready' ? (
                  <div className="pulse-ready" style={{ background: 'rgba(16, 185, 129, 0.25)', border: '1.5px solid var(--success)', borderRadius: '12px', padding: '1rem', textAlign: 'center', marginBottom: '1.2rem' }}>
                    <div style={{ color: 'var(--success)', fontWeight: '700', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <CheckCircle2 size={24} /> BUKU SUDAH SIAP DIAMBIL!
                    </div>
                    <p style={{ fontSize: '0.85rem', marginTop: '4px', color: '#e2e8f0' }}>
                      Silakan menuju ke <strong>Meja Staf</strong> sekarang dan sebutkan kode <strong>{activeOrder.ticket_code}</strong>.
                    </p>
                    <div style={{ marginTop: '0.85rem', display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <button 
                        type="button"
                        onClick={() => announceTableOrder(activeOrder.table_no, activeOrder.ticket_code)}
                        style={{ 
                          background: 'rgba(16, 185, 129, 0.25)',
                          border: '1px solid var(--success)',
                          color: '#d1fae5',
                          padding: '0.38rem 0.9rem',
                          borderRadius: '20px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Volume2 size={14} /> 🔊 Dengarkan Panggilan Suara
                      </button>

                      <button
                        type="button"
                        onClick={handleConfirmReceived}
                        disabled={isConfirmingReceived}
                        className="btn"
                        style={{
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          color: '#ffffff',
                          fontWeight: '700',
                          fontSize: '0.84rem',
                          padding: '0.45rem 1.15rem',
                          borderRadius: '20px',
                          border: 'none',
                          boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        {isConfirmingReceived ? (
                          <>
                            <Loader2 size={15} className="animate-spin" /> Menyimpan...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={15} /> Saya Sudah Terima Buku
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : activeOrder.status === 'searching' ? (
                  <div style={{ background: 'rgba(99, 102, 241, 0.2)', border: '1px solid var(--primary-color)', borderRadius: '12px', padding: '1rem', textAlign: 'center', marginBottom: '1.2rem' }}>
                    <div style={{ color: '#a5b4fc', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <Search size={18} className="animate-spin" /> Staf Sedang Menyiapkan Buku Anda...
                    </div>
                    <p style={{ fontSize: '0.8rem', marginTop: '4px', color: 'var(--text-muted)' }}>
                      Mohon tetap duduk di {activeOrder.table_no}, layar ini otomatis berubah saat buku siap.
                    </p>
                  </div>
                ) : activeOrder.status === 'completed' ? (
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.22), rgba(6, 78, 59, 0.5))',
                    border: '1.5px solid #10b981',
                    borderRadius: '14px',
                    padding: '1.25rem',
                    textAlign: 'center',
                    marginBottom: '1.2rem',
                    boxShadow: '0 0 25px rgba(16, 185, 129, 0.25)'
                  }}>
                    <div style={{ color: '#34d399', fontWeight: '800', fontSize: '1.12rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <CheckCircle2 size={24} /> BUKU SUDAH DISERAHKAN OLEH STAF
                    </div>
                    <p style={{ fontSize: '0.88rem', marginTop: '6px', color: '#f1f5f9', lineHeight: 1.5 }}>
                      Buku pesanan untuk <strong>{activeOrder.table_no}</strong> ({activeOrder.ticket_code}) telah diserahkan oleh staf perpustakaan.
                    </p>

                    {/* Tombol Konfirmasi Diterima di Bagian Pengunjung */}
                    {!activeOrder.visitor_received ? (
                      <div style={{ marginTop: '0.9rem' }}>
                        <button
                          type="button"
                          onClick={handleConfirmReceived}
                          disabled={isConfirmingReceived}
                          className="btn"
                          style={{
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: '#ffffff',
                            fontWeight: '800',
                            fontSize: '0.92rem',
                            padding: '0.65rem 1.4rem',
                            borderRadius: '24px',
                            border: 'none',
                            boxShadow: '0 4px 20px rgba(16, 185, 129, 0.5)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer'
                          }}
                        >
                          {isConfirmingReceived ? (
                            <>
                              <Loader2 size={18} className="animate-spin" /> Menyimpan...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={18} /> ✅ Sudah Saya Terima Bukunya
                            </>
                          )}
                        </button>
                        <p style={{ fontSize: '0.78rem', color: '#a7f3d0', marginTop: '6px' }}>
                          *Tekan tombol di atas untuk menandai bahwa buku fisik sudah Anda terima
                        </p>
                      </div>
                    ) : (
                      <div style={{
                        marginTop: '0.85rem',
                        background: 'rgba(16, 185, 129, 0.2)',
                        border: '1.5px solid rgba(16, 185, 129, 0.5)',
                        borderRadius: '12px',
                        padding: '0.55rem 1.15rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#6ee7b7',
                        fontSize: '0.88rem',
                        fontWeight: '700'
                      }}>
                        <CheckCircle2 size={18} /> ✓ Buku Telah Anda Terima
                        {activeOrder.received_at ? ` (${activeOrder.received_at})` : ''}
                      </div>
                    )}

                    <p style={{ fontSize: '0.82rem', marginTop: '10px', color: '#cbd5e1' }}>
                      ⭐ Silakan tekan judul buku di atas kapan saja untuk memberikan rating bintang &amp; ulasan Anda.
                    </p>
                  </div>
                ) : (
                  <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '12px', padding: '1rem', textAlign: 'center', marginBottom: '1.2rem' }}>
                    <div style={{ color: 'var(--warning)', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <Clock size={18} /> Menunggu Staf Memproses
                    </div>
                    <p style={{ fontSize: '0.8rem', marginTop: '4px', color: 'var(--text-muted)' }}>
                      Pesanan Anda sudah masuk ke antrean staf perpustakaan.
                    </p>
                  </div>
                )}

                {/* Timeline Stepper Status Ringkas */}
                <div className="ticket-timeline">
                  <div className={`timeline-step ${currentStepIdx >= 1 ? (currentStepIdx > 1 ? 'completed' : 'active') : ''}`}>
                    <div className="timeline-dot">1</div>
                    <div className="timeline-label">Menunggu</div>
                  </div>
                  <div className={`timeline-step ${currentStepIdx >= 2 ? (currentStepIdx > 2 ? 'completed' : 'active') : ''}`}>
                    <div className="timeline-dot">2</div>
                    <div className="timeline-label">Diproses Staf</div>
                  </div>
                  <div className={`timeline-step ${currentStepIdx >= 3 ? (currentStepIdx > 3 ? 'completed' : 'active') : ''}`}>
                    <div className="timeline-dot">3</div>
                    <div className="timeline-label">Siap Diambil</div>
                  </div>
                  <div className={`timeline-step ${currentStepIdx >= 4 ? 'completed' : ''}`}>
                    <div className="timeline-dot">4</div>
                    <div className="timeline-label">Selesai</div>
                  </div>
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.15)', padding: '0.6rem 0.8rem', borderRadius: '8px' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, color: 'var(--primary-color)' }} />
                  <span>
                    {activeOrder.status === 'completed' 
                      ? 'Pesanan telah selesai & tersimpan di HP. Anda dapat memberikan rating bintang atau memesan buku baru.'
                      : 'Sambil menunggu, Anda dapat melihat-lihat koleksi buku lain di katalog. Suara bel akan tetap berbunyi di HP Anda begitu buku siap!'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Area Tombol Navigasi Bawah */}
          <div style={{ textAlign: 'center', marginTop: '1.2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' }}>
            {activeOrder.status === 'completed' && (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button 
                  className="btn" 
                  onClick={handleOrderNewBooks}
                  style={{ padding: '0.75rem 1.8rem', fontSize: '0.95rem', background: 'var(--primary-color)', boxShadow: '0 0 20px var(--primary-glow)', borderRadius: '12px', fontWeight: '700' }}
                >
                  <Plus size={18} /> Pesan Buku Baru
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setStep(1)}
                  style={{ padding: '0.75rem 1.6rem', fontSize: '0.95rem', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <BookOpen size={18} /> Lihat Koleksi Buku
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowHistoryModal(true)}
                  style={{ padding: '0.75rem 1.4rem', fontSize: '0.95rem', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px', borderColor: 'rgba(250, 204, 21, 0.45)', color: '#facc15' }}
                >
                  <History size={18} /> Riwayat Pesanan ({orderHistory.length})
                </button>
              </div>
            )}

            {activeOrder.status === 'pending' && (
              <div>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleCancelOrder}
                  style={{ padding: '0.55rem 1.2rem', fontSize: '0.85rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                >
                  <XCircle size={15} /> Batalkan Pesanan (Salah Pilih Buku)
                </button>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '6px' }}>
                  *Anda dapat membatalkan pesanan sebelum staf mulai menyiapkan buku.
                </p>
              </div>
            )}

            {(activeOrder.status === 'searching' || activeOrder.status === 'ready' || activeOrder.status === 'pending') && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <button 
                  type="button"
                  className="btn btn-secondary" 
                  onClick={() => setStep(1)}
                  style={{ 
                    padding: '0.65rem 1.5rem', 
                    fontSize: '0.9rem', 
                    borderRadius: '24px', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderColor: 'rgba(99, 102, 241, 0.35)',
                    color: '#e0e7ff'
                  }}
                >
                  <BookOpen size={17} color="#818cf8" />
                  <span>Lihat-Lihat Buku Lain di Katalog Sambil Menunggu</span>
                </button>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', background: 'rgba(0,0,0,0.3)', padding: '0.45rem 1.2rem', borderRadius: '20px' }}>
                  <Clock size={14} /> Pesanan aktif sedang berjalan. Selesaikan pesanan tiket ini sebelum memesan buku lain.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL PENILAIAN BUKU PEMBACA (GAMBAR YANG DIKIRIM USER) */}
      {/* ========================================================= */}
      {/* ========================================================= */}
      {/* MODAL PENILAIAN BUKU PEMBACA (GAMBAR YANG DIKIRIM USER) */}
      {/* ========================================================= */}
      {rateModalBook && typeof document !== 'undefined' && createPortal(
        <div 
          className="rate-modal-backdrop"
          style={{
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
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setRateModalBook(null);
          }}
        >
          <div 
            className="rate-modal-card"
            style={{
              background: 'var(--surface-color, #131722)',
              border: '1.5px solid rgba(250, 204, 21, 0.35)',
              borderRadius: '20px',
              padding: '1.5rem 1.25rem',
              maxWidth: '450px',
              width: '92%',
              boxShadow: '0 25px 50px rgba(0,0,0,0.85), 0 0 30px rgba(250, 204, 21, 0.2)',
              textAlign: 'center',
              position: 'relative',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            {ratingSuccessMsg ? (
              <div style={{ padding: '1.5rem 0' }}>
                <CheckCircle2 size={48} color="var(--success)" style={{ margin: '0 auto 1rem auto' }} />
                <h3 style={{ color: 'var(--success)' }}>Penilaian Diterima!</h3>
                <p style={{ color: '#e2e8f0', fontSize: '0.95rem', marginTop: '6px' }}>{ratingSuccessMsg}</p>
              </div>
            ) : (
              <div>
                {/* Header Modal persis seperti screenshot user */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem' }}>
                  <div style={{ textAlign: 'left' }}>
                    <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#facc15', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      ★ PENILAIAN BUKU PEMBACA
                    </span>
                    <h2 style={{ fontSize: '1.35rem', marginTop: '4px', color: 'var(--text-main, #ffffff)', fontWeight: '700' }}>
                      {rateModalBook.title}
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
                      ✍️ {rateModalBook.author} • {rateModalBook.category || 'Koleksi Umum'}
                      {rateModalBook.isbn ? ` • ISBN: ${rateModalBook.isbn}` : ''}
                      {rateModalBook.shelf_location ? ` • 📍 ${rateModalBook.shelf_location}` : ''}
                    </p>
                  </div>
                  <button 
                    onClick={() => setRateModalBook(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted, #94a3b8)', cursor: 'pointer', fontSize: '1.4rem', padding: '4px', lineHeight: 1 }}
                    title="Tutup"
                  >
                    ✕
                  </button>
                </div>

                {/* Tombol Opsi Pinjam Jika Dibuka dari Katalog Pengunjung */}
                {step === 1 && (
                  <div style={{ marginBottom: '1.2rem', textAlign: 'center' }}>
                    {selectedBooks.some(b => b.id === rateModalBook.id || b.title === rateModalBook.title) ? (
                      <button
                        type="button"
                        onClick={() => toggleBook(rateModalBook)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid #ef4444',
                          color: '#fca5a5',
                          padding: '0.45rem 1rem',
                          borderRadius: '20px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        ✓ Buku ini ada di Keranjang Pinjam (Klik untuk Batal)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleBook(rateModalBook)}
                        style={{
                          background: 'rgba(99, 102, 241, 0.2)',
                          border: '1px solid var(--primary-color)',
                          color: '#c7d2fe',
                          padding: '0.45rem 1.1rem',
                          borderRadius: '20px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        + Pilih Buku Ini untuk Dipinjam ke Meja
                      </button>
                    )}
                  </div>
                )}

                {/* Kontainer Bintang Interaktif */}
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.2rem', borderRadius: '12px', marginBottom: '1.2rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '0.8rem' }}>
                    Berikan bintang penilaian Anda untuk buku ini:
                  </div>

                  {/* 5 Bintang Kuning Emas Besar */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '0.6rem' }}>
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isFilled = star <= (modalHoverRating || modalRating);
                      return (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setModalHoverRating(star)}
                          onMouseLeave={() => setModalHoverRating(0)}
                          onClick={() => setModalRating(star)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                          title={`${star} Bintang`}
                        >
                          <Star 
                            size={34} 
                            fill={isFilled ? '#facc15' : 'transparent'} 
                            color={isFilled ? '#facc15' : '#64748b'} 
                            style={{ transform: isFilled ? 'scale(1.2)' : 'scale(1)', transition: 'all 0.15s ease' }}
                          />
                        </button>
                      );
                    })}
                  </div>

                  {/* Label Bintang seperti di gambar */}
                  <div style={{ fontSize: '0.88rem', color: '#facc15', fontWeight: '700' }}>
                    {(modalHoverRating || modalRating) === 1 && '⭐ Kurang Menarik'}
                    {(modalHoverRating || modalRating) === 2 && '⭐⭐ Cukup / Biasa Saja'}
                    {(modalHoverRating || modalRating) === 3 && '⭐⭐⭐ Cukup Bagus'}
                    {(modalHoverRating || modalRating) === 4 && '⭐⭐⭐⭐ Sangat Bagus & Berkesan'}
                    {(modalHoverRating || modalRating) === 5 && '⭐⭐⭐⭐⭐ Luar Biasa (Favorit Pembaca)!'}
                  </div>
                </div>

                {/* Form Ulasan Singkat */}
                <div style={{ marginBottom: '1.4rem', textAlign: 'left' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '6px' }}>
                    Ulasan singkat (Opsional):
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: Novelnya penuh inspirasi dan bikin penasaran sampai akhir..."
                    value={modalReview}
                    onChange={(e) => setModalReview(e.target.value)}
                    style={{ fontSize: '0.88rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>

                {/* Tombol Aksi Bawah */}
                <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setRateModalBook(null)}
                    disabled={isSubmittingRating}
                    style={{ padding: '0.55rem 1.2rem', fontSize: '0.9rem' }}
                  >
                    Batal
                  </button>
                  <button
                    className="btn"
                    onClick={handleRateModalSubmit}
                    disabled={isSubmittingRating}
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', color: '#fff', fontWeight: '700', padding: '0.55rem 1.4rem', fontSize: '0.9rem' }}
                  >
                    {isSubmittingRating ? <Loader2 size={16} className="animate-spin" /> : 'Kirim Penilaian'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL RIWAYAT PESANAN PEMINJAMAN BUKU DI HP */}
      {/* ========================================================= */}
      {showHistoryModal && typeof document !== 'undefined' && createPortal(
        <div
          className="rate-modal-backdrop"
          style={{
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
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowHistoryModal(false);
          }}
        >
          <div
            style={{
              background: 'var(--surface-color, #131722)',
              border: '1.5px solid rgba(250, 204, 21, 0.35)',
              borderRadius: '20px',
              padding: '1.5rem',
              maxWidth: '560px',
              width: '94%',
              boxShadow: '0 25px 50px rgba(0,0,0,0.85), 0 0 30px rgba(250, 204, 21, 0.15)',
              position: 'relative',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem', paddingBottom: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#facc15', fontWeight: '800', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  <History size={16} /> Riwayat Pesanan di HP Ini
                </div>
                <h2 style={{ fontSize: '1.35rem', marginTop: '4px', color: '#ffffff', fontWeight: '700' }}>
                  Daftar Peminjaman Buku
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
                  Total {orderHistory.length} tiket peminjaman tersimpan di perangkat ini
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}
                title="Tutup"
              >
                ✕
              </button>
            </div>

            {/* Konten Daftar Tiket */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.9rem', paddingRight: '4px' }}>
              {orderHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <BookOpen size={48} color="#64748b" style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
                  <p style={{ fontWeight: '600', color: '#cbd5e1' }}>Belum ada riwayat pesanan yang tersimpan</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Tiket yang telah diserahkan oleh staf akan otomatis tersimpan permanen di sini.</p>
                </div>
              ) : (
                orderHistory.map((order, idx) => {
                  const isCurrentActive = activeOrder?.id === order.id || activeOrder?.ticket_code === order.ticket_code;
                  return (
                    <div
                      key={order.id || idx}
                      style={{
                        background: isCurrentActive ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                        border: isCurrentActive ? '1.5px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '12px',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                            color: '#ffffff',
                            fontWeight: '800',
                            fontSize: '0.85rem',
                            padding: '3px 10px',
                            borderRadius: '6px',
                            letterSpacing: '0.5px'
                          }}>
                            {order.ticket_code}
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#cbd5e1' }}>
                            {order.table_no}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            background: 'rgba(16, 185, 129, 0.18)',
                            color: '#34d399',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <CheckCircle2 size={12} /> Selesai Diserahkan
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {order.time || ''}
                          </span>
                        </div>
                      </div>

                      {/* Judul Buku */}
                      <div style={{ fontSize: '0.88rem', color: '#e2e8f0', margin: '4px 0', lineHeight: 1.4 }}>
                        📚 <strong>Buku:</strong> {order.book_title || 'Koleksi Buku Perpustakaan'}
                      </div>

                      {/* Tombol Aksi */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                        <button
                          type="button"
                          onClick={() => handleViewHistoryOrder(order)}
                          className="btn"
                          style={{
                            padding: '0.4rem 0.9rem',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            borderRadius: '8px',
                            background: isCurrentActive ? 'rgba(99, 102, 241, 0.35)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <Ticket size={14} /> {isCurrentActive ? 'Sedang Ditampilkan' : 'Buka Tiket Ini'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Modal */}
            <div style={{ marginTop: '1.2rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {orderHistory.length > 0 ? (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f87171',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px'
                  }}
                  title="Hapus riwayat pesanan dari HP"
                >
                  <Trash2 size={14} /> Bersihkan Riwayat
                </button>
              ) : <div />}
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="btn btn-secondary"
                style={{ padding: '0.45rem 1.2rem', fontSize: '0.85rem' }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default QRSystem;
