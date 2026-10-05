import { useState, useEffect, useMemo, useRef } from 'react';
import { Send, Loader2, Ticket, CheckCircle2, Clock, Search, BookOpen, AlertCircle, XCircle, Plus, Check, ChevronLeft, ChevronRight, Bookmark, MapPin, Volume2, Star, Flame, Sparkles, MessageSquare } from 'lucide-react';
import { announceTableOrder } from '../utils/soundAnnouncement';
import { useModal } from '../context/ModalContext';

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
  const [step, setStep] = useState(1);
  const [tableNo, setTableNo] = useState('');
  
  // Data buku dan filter
  const [books, setBooks] = useState([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [selectedBooks, setSelectedBooks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShelf, setSelectedShelf] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const booksPerPage = 18;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);

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

  const tables = Array.from({ length: 24 }, (_, i) => `Meja ${i + 1}`);

  // Cek apakah ada tiket aktif yang tersimpan di browser
  useEffect(() => {
    const saved = localStorage.getItem('bibliotech_active_order');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.status !== 'completed' && parsed.status !== 'cancelled') {
          setActiveOrder(parsed);
          setStep(2);
        }
      } catch (e) {
        localStorage.removeItem('bibliotech_active_order');
      }
    }
  }, []);

  // Simpan / update status tiket ke localStorage
  useEffect(() => {
    if (activeOrder) {
      if (activeOrder.status === 'completed' || activeOrder.status === 'cancelled') {
        localStorage.removeItem('bibliotech_active_order');
      } else {
        localStorage.setItem('bibliotech_active_order', JSON.stringify(activeOrder));
      }
    }
  }, [activeOrder]);

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

  // Polling status tiket secara real-time saat berada di layar tiket (step 2)
  useEffect(() => {
    if (step !== 2 || !activeOrder?.id) return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/orders/${activeOrder.id}`);
        if (res.ok) {
          const data = await res.json();
          setActiveOrder((prev) => ({
            ...prev,
            status: data.status,
          }));
        }
      } catch (err) {
        // Abaikan jika error jaringan sesaat
      }
    };

    const timer = setInterval(checkStatus, 2500);
    return () => clearInterval(timer);
  }, [step, activeOrder?.id]);

  // Otomatis bunyikan suara panggilan ke HP pengunjung saat pesanan berstatus ready
  const announcedRef = useRef(false);
  useEffect(() => {
    if (activeOrder?.status === 'ready' && !announcedRef.current) {
      announcedRef.current = true;
      announceTableOrder(activeOrder.table_no, activeOrder.ticket_code);
    }
    if (activeOrder?.status !== 'ready') {
      announcedRef.current = false;
    }
  }, [activeOrder?.status, activeOrder?.table_no, activeOrder?.ticket_code]);

  // Filter & Urutkan daftar buku berdasarkan pencarian, rak, atau terfavorit
  const filteredBooks = useMemo(() => {
    let result = [...books];

    // Jika filter TERFAVORIT aktif
    if (selectedShelf === 'FAVORITE') {
      result.sort((a, b) => {
        const rDiff = (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0);
        if (Math.abs(rDiff) > 0.05) return rDiff;
        return (b.read_count || 0) - (a.read_count || 0);
      });
    } else if (selectedShelf !== 'ALL') {
      // Filter Rak spesifik
      result = result.filter(book => 
        book.shelf_location && book.shelf_location.toLowerCase().includes(`rak ${selectedShelf.toLowerCase()}`)
      );
    }

    // Filter Pencarian Judul & Penulis
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(book => {
        const matchTitle = book.title.toLowerCase().includes(q);
        const matchAuthor = book.author.toLowerCase().includes(q);
        const matchShelf = book.shelf_location && book.shelf_location.toLowerCase().includes(q);
        return matchTitle || matchAuthor || matchShelf;
      });
    }

    return result;
  }, [books, selectedShelf, searchQuery]);

  // Reset ke halaman 1 jika filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedShelf]);

  // Pagination
  const totalPages = Math.ceil(filteredBooks.length / booksPerPage) || 1;
  const paginatedBooks = useMemo(() => {
    const start = (currentPage - 1) * booksPerPage;
    return filteredBooks.slice(start, start + booksPerPage);
  }, [filteredBooks, currentPage]);

  // Fungsi toggle pilih buku (Maksimal 3 buku)
  const toggleBook = (book) => {
    const isAlreadySelected = selectedBooks.some(b => b.id === book.id || b.title === book.title);
    if (isAlreadySelected) {
      setSelectedBooks(selectedBooks.filter(b => b.id !== book.id && b.title !== book.title));
    } else {
      if (selectedBooks.length >= 3) {
        showAlert('Maksimal 3 buku sekaligus per pesanan agar staf tidak kesulitan membawanya.', {
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

    const combinedTitles = selectedBooks.map(b => {
      const rakInfo = b.shelf_location ? b.shelf_location.replace('Lemari 3, ', '') : 'Rak 1';
      return `${b.title} [${rakInfo}]`;
    }).join(', ');

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_title: combinedTitles,
          table_no: tableNo,
        }),
      });

      const resData = await res.json();

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
      localStorage.setItem('bibliotech_active_order', JSON.stringify(newOrder));
      setStep(2);
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
      localStorage.setItem('bibliotech_active_order', JSON.stringify(offlineOrder));
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

    localStorage.removeItem('bibliotech_active_order');
    setActiveOrder(null);
    setSelectedBooks([]);
    setStep(1);
  };

  // Selesai & Pesan Buku Baru (Hanya bisa saat status 'completed')
  const handleOrderNewBooks = () => {
    localStorage.removeItem('bibliotech_active_order');
    setActiveOrder(null);
    setSelectedBooks([]);
    setStep(1);
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
          <div className="page-header" style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1>Katalog & Pesan Buku Meja</h1>
            <p>Koleksi Buku Resmi <strong>Perpustakaan Umum Kota Parepare</strong> (Lemari 3, Rak 1 - 5)</p>
          </div>

          {/* Pemilihan Nomor Meja Pengunjung */}
          <div style={{ maxWidth: '420px', margin: '0 auto 2rem auto', background: 'rgba(0,0,0,0.25)', padding: '1.2rem', borderRadius: '14px', border: '1px solid var(--surface-border)' }}>
            <label style={{ display: 'block', textAlign: 'center', fontWeight: '600', marginBottom: '0.6rem' }}>
              📍 Anda Duduk di Meja Berapa?
            </label>
            <select 
              className="form-control" 
              value={tableNo} 
              onChange={(e) => setTableNo(e.target.value)}
              style={{ background: 'rgba(25, 27, 36, 0.95)', fontSize: '1rem', fontWeight: '600' }}
            >
              <option value="" disabled>-- Pilih Nomor Meja Anda --</option>
              {tables.map(table => (
                <option key={table} value={table}>{table}</option>
              ))}
            </select>
          </div>

          {/* Bar Pencarian Buku & Filter Rak / Favorit */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.8rem' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                className="form-control" 
                placeholder="Cari judul novel (misal: Rindu, Sewu Dino, Marmut Merah Jambu) atau pengarang (Tere Liye, Fiersa Besari)..."
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

            {/* Tombol Tab Filter Rak & Koleksi Terfavorit */}
            <div className="filter-shelf-container" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginRight: '4px' }}>
                <MapPin size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Filter:
              </span>
              {[
                { id: 'ALL', label: `Semua Rak (${books.length})` },
                { id: 'FAVORITE', label: '⭐ Koleksi Terfavorit', isSpecial: true },
                { id: '1', label: 'Rak 1' },
                { id: '2', label: 'Rak 2' },
                { id: '3', label: 'Rak 3' },
                { id: '4', label: 'Rak 4' },
                { id: '5', label: 'Rak 5' }
              ].map(shelf => {
                const isActive = selectedShelf === shelf.id;
                return (
                  <button 
                    key={shelf.id}
                    className={`btn ${isActive ? '' : 'btn-secondary'}`}
                    style={{ 
                      padding: '0.4rem 0.85rem', 
                      fontSize: '0.82rem',
                      background: isActive 
                        ? (shelf.isSpecial ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'var(--primary-color)') 
                        : (shelf.isSpecial ? 'rgba(245, 158, 11, 0.15)' : ''),
                      borderColor: isActive 
                        ? (shelf.isSpecial ? '#f59e0b' : 'var(--primary-color)') 
                        : (shelf.isSpecial ? 'rgba(245, 158, 11, 0.4)' : ''),
                      color: shelf.isSpecial && !isActive ? '#fcd34d' : '',
                      boxShadow: isActive && shelf.isSpecial ? '0 0 14px rgba(245, 158, 11, 0.5)' : ''
                    }}
                    onClick={() => setSelectedShelf(shelf.id)}
                  >
                    {shelf.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bar Status Pemilihan Buku */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              {selectedShelf === 'FAVORITE' ? (
                <span>Menampilkan <strong>{filteredBooks.length}</strong> buku (diurutkan berdasarkan bintang rating tertinggi & paling sering dibaca)</span>
              ) : (
                <span>Menampilkan <strong>{filteredBooks.length}</strong> buku {selectedShelf !== 'ALL' ? `di Rak ${selectedShelf}` : ''}</span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ 
                background: selectedBooks.length > 0 ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255,255,255,0.08)', 
                border: selectedBooks.length > 0 ? '1.5px solid var(--primary-color)' : '1px solid var(--surface-border)', 
                color: selectedBooks.length > 0 ? '#c7d2fe' : 'var(--text-muted)', 
                padding: '0.35rem 0.9rem', 
                borderRadius: '20px', 
                fontSize: '0.85rem', 
                fontWeight: '700' 
              }}>
                Buku Dipilih: {selectedBooks.length}/3
              </span>
            </div>
          </div>

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
                onClick={() => { setSearchQuery(''); setSelectedShelf('ALL'); }}
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
                        toggleBook(book);
                      }}
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        zIndex: 4,
                        cursor: 'pointer'
                      }}
                      title={isSelected ? "Batalkan pilihan pinjam" : "Pilih buku ini untuk dipinjam"}
                    >
                      {isSelected ? (
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

                    {/* Sampul Buku 3D Realistis */}
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

                    {/* Info Tambahan di Bawah Cover */}
                    <div>
                      <div className="book-title" title={book.title}>
                        {book.title}
                      </div>
                      <div className="book-author" title={book.author}>
                        {book.author}
                      </div>

                      {/* Bar Informasi: Lokasi Rak & Bintang Rating */}
                      <div className="book-meta-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.72rem' }}>
                        <span style={{ 
                          background: 'rgba(255,255,255,0.06)', 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          color: '#cbd5e1',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <MapPin size={11} /> {book.shelf_location ? book.shelf_location.replace('Lemari 3, ', '') : 'Rak 1'}
                        </span>

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
                          <span style={{ color: 'var(--text-muted)', fontWeight: '400', fontSize: '0.66rem' }}>
                            ({book.read_count || 10}x)
                          </span>
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
          {/* FLOATING ACTION BAR: KONFIRMASI PEMESANAN BUKU */}
          {/* ========================================================= */}
          {selectedBooks.length > 0 && (
            <div className="floating-order-bar" style={{ 
              position: 'sticky', 
              bottom: '1.5rem', 
              marginTop: '2.5rem', 
              background: 'linear-gradient(135deg, rgba(20, 24, 38, 0.95), rgba(15, 17, 26, 0.98))', 
              border: '1.5px solid var(--primary-color)', 
              borderRadius: '16px', 
              padding: '1rem 1.4rem', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              boxShadow: '0 12px 30px rgba(0,0,0,0.5)', 
              backdropFilter: 'blur(12px)', 
              zIndex: 100, 
              flexWrap: 'wrap', 
              gap: '1rem' 
            }}>
              <div>
                <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#a5b4fc', fontWeight: '700' }}>
                  Keranjang Pinjam ({selectedBooks.length}/3 Buku)
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#fff', marginTop: '2px' }}>
                  {selectedBooks.map(b => b.title).join(' • ')}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setSelectedBooks([])}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                  Batal
                </button>

                <button 
                  className="btn" 
                  onClick={handleSubmitOrder} 
                  disabled={isSubmitting}
                  style={{ padding: '0.65rem 1.6rem', fontSize: '0.95rem', background: 'var(--primary-color)', boxShadow: '0 0 15px var(--primary-glow)' }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Memproses Tiket...
                    </>
                  ) : (
                    <>
                      <Send size={18} /> Pesan {selectedBooks.length} Buku Sekarang
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
            <span className="status-badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: 'var(--primary-color)', padding: '0.4rem 1rem' }}>
              Tiket Aktif: {activeOrder.table_no}
            </span>
            <h1 style={{ marginTop: '0.5rem', fontSize: '1.8rem' }}>Tiket Pengambilan Digital</h1>
            <p style={{ color: 'var(--text-muted)' }}>Tunjukkan nomor tiket ini ke staf saat penyerahan buku</p>
          </div>

          <div className="ticket-wrapper">
            <div className="ticket-container">
              {/* Lubang tiket visual */}
              <div className="ticket-cutout-left"></div>
              <div className="ticket-cutout-right"></div>

              {/* Header Tiket */}
              <div className="ticket-header">
                <div style={{ fontSize: '0.8rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <img src="/Lambang.png" alt="Logo" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
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
                    {activeOrder.book_title.split(',').map((titleWithShelf, idx) => {
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
                    <button 
                      onClick={() => announceTableOrder(activeOrder.table_no, activeOrder.ticket_code)}
                      style={{ 
                        marginTop: '0.75rem',
                        background: 'rgba(16, 185, 129, 0.25)',
                        border: '1px solid var(--success)',
                        color: '#d1fae5',
                        padding: '0.35rem 0.9rem',
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
                  </div>
                ) : activeOrder.status === 'searching' ? (
                  <div style={{ background: 'rgba(99, 102, 241, 0.2)', border: '1px solid var(--primary-color)', borderRadius: '12px', padding: '1rem', textAlign: 'center', marginBottom: '1.2rem' }}>
                    <div style={{ color: '#a5b4fc', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <Search size={18} className="animate-spin" /> Staf Sedang Mengambil Buku di Rak...
                    </div>
                    <p style={{ fontSize: '0.8rem', marginTop: '4px', color: 'var(--text-muted)' }}>
                      Mohon tetap duduk di {activeOrder.table_no}, layar ini otomatis berubah saat buku siap.
                    </p>
                  </div>
                ) : activeOrder.status === 'completed' ? (
                  <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '12px', padding: '1rem', textAlign: 'center', marginBottom: '1.2rem' }}>
                    <div style={{ color: 'var(--success)', fontWeight: '700', fontSize: '1.05rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <CheckCircle2 size={20} /> Buku Telah Diterima!
                    </div>
                    <p style={{ fontSize: '0.82rem', marginTop: '4px', color: '#e2e8f0' }}>
                      Selamat membaca! Tekan judul buku di atas kapan saja untuk memberikan bintang ulasan Anda.
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
                    <div className="timeline-label">Dicari di Rak</div>
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
                      ? 'Pesanan telah selesai. Anda dapat memberikan rating bintang atau memesan buku baru.'
                      : `Layar terkunci pada tiket ${activeOrder.ticket_code} agar antrean buku Anda tidak terganggu.`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Area Tombol Navigasi Bawah */}
          <div style={{ textAlign: 'center', marginTop: '1.2rem' }}>
            {activeOrder.status === 'completed' && (
              <button 
                className="btn" 
                onClick={handleOrderNewBooks}
                style={{ padding: '0.75rem 2rem', fontSize: '0.95rem', background: 'var(--primary-color)', boxShadow: '0 0 20px var(--primary-glow)' }}
              >
                <Plus size={18} /> Pesan Buku Baru
              </button>
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
                  *Anda dapat membatalkan pesanan sebelum staf mulai mencari buku di rak.
                </p>
              </div>
            )}

            {(activeOrder.status === 'searching' || activeOrder.status === 'ready') && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem', background: 'rgba(0,0,0,0.3)', padding: '0.5rem 1.2rem', borderRadius: '20px' }}>
                <Clock size={14} /> Pesanan aktif sedang berjalan. Harap ambil buku di meja staf terlebih dahulu.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL PENILAIAN BUKU PEMBACA (GAMBAR YANG DIKIRIM USER) */}
      {/* ========================================================= */}
      {rateModalBook && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--surface-color, #131722)',
            border: '1.5px solid rgba(250, 204, 21, 0.35)',
            borderRadius: '16px',
            padding: '1.8rem',
            maxWidth: '460px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            textAlign: 'center',
            position: 'relative'
          }}>
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
                      ✍️ {rateModalBook.author} • {rateModalBook.shelf_location || 'Lemari 3'}
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
        </div>
      )}
    </div>
  );
}

export default QRSystem;
