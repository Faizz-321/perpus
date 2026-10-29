import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  BookOpen, Search, ExternalLink, Eye, X, Maximize2, Minimize2, 
  Sparkles, ChevronLeft, ChevronRight, Clock, ArrowRight,
  Folder, Loader2, Download, RefreshCw, AlertCircle, Lock, CheckCircle2, ShieldCheck, Trash2,
  Plus, Upload, Image, FileText, Check
} from 'lucide-react';
import { useModal } from '../context/ModalContext';
import ebooksData from '../data/ebooksData.json';
import { API_URL, resolveMediaUrl } from '../config/api';

const CATEGORY_COLORS = {
  'NOVEL': 'rgba(236, 72, 153, 0.25)',
  'INSPIRASI': 'rgba(245, 158, 11, 0.25)',
  'TIPS & TRIK': 'rgba(16, 185, 129, 0.25)',
  'BACAAN ANAK': 'rgba(59, 130, 246, 0.25)',
  'BIOGRAFI': 'rgba(168, 85, 247, 0.25)',
  'RANDOM': 'rgba(99, 102, 241, 0.25)'
};

const COVER_GRADIENTS = [
  'linear-gradient(145deg, #1e1b4b, #312e81, #0f172a)',
  'linear-gradient(145deg, #4c0519, #881337, #1e293b)',
  'linear-gradient(145deg, #022c22, #064e3b, #0f172a)',
  'linear-gradient(145deg, #3b0764, #581c87, #1e1b4b)',
  'linear-gradient(145deg, #451a03, #78350f, #1c1917)',
  'linear-gradient(145deg, #042f2e, #115e59, #0f172a)',
  'linear-gradient(145deg, #0c4a6e, #075985, #1e293b)'
];

function getCoverGradient(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return COVER_GRADIENTS[Math.abs(hash) % COVER_GRADIENTS.length];
}

const LAST_READ_KEY = 'perpus_last_read_ebooks';

/**
 * Komponen Sampul Buku E-Book:
 * Menggunakan sistem bertingkat (Waterfall Multi-CDN):
 * 1. CDN Drive Storage Asli (Resolusi tinggi s400)
 * 2. CDN Google UserContent /d/
 * 3. Drive Thumbnail resmi
 * 4. Fallback desain cover grafis elegan jika file tidak memiliki sampul
 */
function EBookCover({ book, onClick }) {
  const [imgError, setImgError] = useState(!book.thumbnail);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [urlIndex, setUrlIndex] = useState(0);
  const imgRef = useRef(null);

  const coverGradient = getCoverGradient(book.id);

  // URL sampul: direct Google CDN dan local extracted covers (seperti sistem Lanjutkan Membaca)
  const candidateUrls = useMemo(() => {
    if (!book.id || !book.thumbnail) return [];
    const resolvedThumb = resolveMediaUrl(book.thumbnail);
    const list = [resolvedThumb];
    if (typeof book.thumbnail === 'string' && book.thumbnail !== resolvedThumb) {
      list.push(book.thumbnail);
    }
    if (typeof book.thumbnail === 'string' && book.thumbnail.includes('googleusercontent.com')) {
      list.push(`https://drive.google.com/thumbnail?id=${book.id}&sz=w400`);
    }
    return list;
  }, [book.id, book.thumbnail]);

  // Reset state setiap kali ID buku berganti (misal saat ganti halaman pagination atau search)
  useEffect(() => {
    setUrlIndex(0);
    setImgError(!book.thumbnail);
    // Cek apakah gambar sudah selesai dimuat dari cache browser
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setImgLoaded(true);
    } else {
      setImgLoaded(false);
    }
  }, [book.id, book.thumbnail]);

  const handleImgError = () => {
    if (urlIndex < candidateUrls.length - 1) {
      setUrlIndex(prev => prev + 1);
    } else {
      setImgError(true);
    }
  };

  // Batas waktu pengaman 4 detik agar tidak pernah stuck di animasi spinner
  useEffect(() => {
    if (imgLoaded || imgError) return;
    const timer = setTimeout(() => {
      if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
        setImgLoaded(true);
      } else {
        handleImgError();
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [imgLoaded, imgError, urlIndex]);

  const currentCoverUrl = candidateUrls[urlIndex] || candidateUrls[0];

  return (
    <div 
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        height: '290px',
        borderRadius: '12px',
        marginBottom: '1rem',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: isHovered 
          ? '0 16px 36px rgba(0,0,0,0.65), 0 0 20px rgba(99, 102, 241, 0.35)' 
          : '0 8px 24px rgba(0,0,0,0.45)',
        background: '#090d16',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: isHovered ? '1.5px solid var(--primary-color)' : '1px solid rgba(255,255,255,0.12)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)'
      }}
      title={`Klik untuk membaca ${book.title}`}
    >
      {!imgError ? (
        <>
          {/* Skeleton placeholder selagi gambar cover di-download */}
          {!imgLoaded && (
            <div style={{
              position: 'absolute', inset: 0, background: coverGradient,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '1rem', textAlign: 'center'
            }}>
              <Loader2 size={24} className="animate-spin" style={{ color: '#818cf8', marginBottom: '8px' }} />
              <span style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>Memuat sampul buku...</span>
            </div>
          )}

          <img 
            ref={(el) => {
              imgRef.current = el;
              if (el && el.complete && el.naturalWidth > 0 && !imgLoaded) {
                setImgLoaded(true);
              }
            }}
            key={`${book.id}-${urlIndex}`}
            src={currentCoverUrl}
            alt={book.title}
            referrerPolicy="no-referrer"
            onLoad={() => setImgLoaded(true)}
            onError={handleImgError}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'top center',
              transition: 'transform 0.35s ease',
              transform: isHovered ? 'scale(1.05)' : 'scale(1)',
              opacity: imgLoaded ? 1 : 0
            }}
          />
        </>
      ) : (
        /* Fallback sampul klasik jika PDF tidak memiliki halaman 1 grafis */
        <div style={{
          width: '100%', height: '100%', background: coverGradient,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '1.2rem', position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              background: 'rgba(239, 68, 68, 0.9)', color: '#fff',
              fontSize: '0.68rem', fontWeight: '800', padding: '2px 7px',
              borderRadius: '5px'
            }}>
              PDF
            </span>
          </div>

          <div>
            <h3 style={{
              color: '#ffffff', fontSize: '1.02rem', fontWeight: '800',
              lineHeight: 1.35, textShadow: '0 2px 8px rgba(0,0,0,0.8)',
              display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              {book.title}
            </h3>
          </div>

          <div style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: '600' }}>
            E-Book Digital Perpustakaan
          </div>
        </div>
      )}

      {/* Efek Garis Lipatan Punggung Buku (Book Spine) di sisi kiri */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: '16px',
        background: 'linear-gradient(to right, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)',
        pointerEvents: 'none', zIndex: 2
      }} />

      {/* Badge Kategori Mengambang di Pojok Kanan Atas */}
      <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 2 }}>
        <span style={{
          background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)',
          color: '#ffffff', fontSize: '0.7rem', fontWeight: '700',
          padding: '3px 8px', borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.18)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
        }}>
          {book.category}
        </span>
      </div>

      {/* Overlay Hover "Baca Online Sekarang" */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.5) 50%, transparent 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: '1.2rem',
        opacity: isHovered ? 1 : 0,
        transition: 'opacity 0.25s ease',
        zIndex: 3,
        pointerEvents: 'none'
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          background: 'var(--primary-color)', color: '#fff', padding: '0.6rem 1rem',
          borderRadius: '8px', fontSize: '0.84rem', fontWeight: '700',
          boxShadow: '0 4px 15px var(--primary-glow)'
        }}>
          <Eye size={16} /> Baca E-Book Sekarang
        </div>
      </div>
    </div>
  );
}

export default function EBookReader({ isStaff: isStaffProp }) {
  const { showAlert, showConfirm } = useModal();
  const isStaff = isStaffProp ?? (typeof window !== 'undefined' && sessionStorage.getItem('perpus_role') === 'staff');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Data katalog e-book (dinamis dari API dengan fallback json lokal)
  const [ebooksList, setEbooksList] = useState(ebooksData);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let isMounted = true;
    fetch(`${API_URL}/ebooks`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setEbooksList(data);
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Modal Pembaca E-Book Aktif
  const [activeBook, setActiveBook] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewerMode, setViewerMode] = useState('preview'); // 'preview' | 'docs' | 'embed'
  const [viewerLoading, setViewerLoading] = useState(true);

  const [lastReadBooks, setLastReadBooks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LAST_READ_KEY)) || [];
    } catch {
      return [];
    }
  });

  // Modal Riwayat Bacaan Pengunjung (Tampil saat tombol diklik agar tampilan lebih rapi)
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Modal Tambah E-Book oleh Staf
  const [showAddEbookModal, setShowAddEbookModal] = useState(false);
  const [ebookForm, setEbookForm] = useState({
    title: '',
    category: 'Koleksi Umum',
    drive_url: '',
    pdf_data: null,
    pdf_filename: '',
    pdf_filesize: '',
    cover_url: '',
    cover_image: null
  });
  const [ebookCoverPreview, setEbookCoverPreview] = useState(null);
  const [isSubmittingEbook, setIsSubmittingEbook] = useState(false);
  const ebookPdfInputRef = useRef(null);
  const ebookCoverInputRef = useRef(null);

  const resetEbookForm = () => {
    setEbookForm({
      title: '',
      category: 'Koleksi Umum',
      drive_url: '',
      pdf_data: null,
      pdf_filename: '',
      pdf_filesize: '',
      cover_url: '',
      cover_image: null
    });
    setEbookCoverPreview(null);
  };

  const handleEbookPdfFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      showAlert('Format file harus berupa dokumen PDF (.pdf).', { type: 'warning', title: 'Format Tidak Sesuai' });
      return;
    }

    const maxSize = 35 * 1024 * 1024;
    if (file.size > maxSize) {
      showAlert('Ukuran file PDF maksimal 35 MB agar sistem tetap ringan dan cepat.', { type: 'warning', title: 'File Terlalu Besar' });
      return;
    }

    const fileSizeStr = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    const reader = new FileReader();
    reader.onload = (ev) => {
      setEbookForm(prev => ({
        ...prev,
        pdf_data: ev.target.result,
        pdf_filename: file.name,
        pdf_filesize: fileSizeStr,
        title: prev.title.trim() ? prev.title : file.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ')
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleEbookCoverFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 800;
        let w = img.width, h = img.height;
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        if (h > MAX) { w = Math.round(h * MAX / h); h = MAX; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', 0.85);
        setEbookForm(prev => ({ ...prev, cover_image: compressed, cover_url: '' }));
        setEbookCoverPreview(compressed);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitEbook = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!ebookForm.title.trim()) {
      showAlert('Judul e-book wajib diisi.', { type: 'warning', title: 'Form Belum Lengkap' });
      return;
    }

    if (!ebookForm.drive_url.trim() && !ebookForm.pdf_data) {
      showAlert('Harap masukkan Link Google Drive atau unggah File Dokumen PDF untuk e-book ini.', { 
        type: 'warning', 
        title: 'Sumber E-Book Diperlukan' 
      });
      return;
    }

    setIsSubmittingEbook(true);
    try {
      const payload = {
        title: ebookForm.title.trim(),
        category: ebookForm.category || 'Koleksi Umum',
        drive_url: ebookForm.drive_url.trim(),
        pdf_data: ebookForm.pdf_data,
        pdf_filename: ebookForm.pdf_filename,
        cover_image: ebookForm.cover_image,
        cover_url: ebookForm.cover_url.trim()
      };

      const res = await fetch(`${API_URL}/ebooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        if (data.data) {
          setEbooksList(prev => [data.data, ...prev]);
        }
        showAlert(`E-Book "${ebookForm.title}" berhasil ditambahkan ke katalog digital perpustakaan!`, {
          title: 'E-Book Ditambahkan',
          type: 'success'
        });
        setShowAddEbookModal(false);
        resetEbookForm();
      } else {
        showAlert(data.error || 'Gagal menambahkan e-book ke katalog perpustakaan.', {
          title: 'Gagal Menyimpan',
          type: 'danger'
        });
      }
    } catch (err) {
      console.error('Error handleSubmitEbook:', err);
      showAlert('Terjadi kesalahan jaringan saat menyimpan e-book.', {
        title: 'Kesalahan Sistem',
        type: 'danger'
      });
    } finally {
      setIsSubmittingEbook(false);
    }
  };

  // Hapus e-book dari katalog oleh staf
  const handleDeleteBook = async (book, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const ok = await showConfirm(
      `Apakah Anda yakin ingin menghapus e-book "${book.title}" dari katalog perpustakaan? E-book ini tidak akan dapat diakses lagi oleh pengunjung.`,
      {
        title: 'Hapus E-Book dari Katalog',
        confirmText: 'Ya, Hapus E-Book',
        cancelText: 'Batal',
        type: 'danger'
      }
    );
    if (!ok) return;

    setDeletingId(book.id);
    try {
      let res = await fetch(`${API_URL}/ebooks/${encodeURIComponent(book.id)}`, {
        method: 'DELETE'
      });
      // Fallback otomatis ke POST /api/ebooks/:id/delete jika HTTP DELETE dibatasi
      if (!res.ok) {
        res = await fetch(`${API_URL}/ebooks/${encodeURIComponent(book.id)}/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: book.id })
        });
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data.success || data.message)) {
        setEbooksList(prev => prev.filter(b => b.id !== book.id));
        if (activeBook && activeBook.id === book.id) {
          setActiveBook(null);
        }
        setLastReadBooks(prev => {
          const updated = prev.filter(b => b.id !== book.id);
          try { localStorage.setItem(LAST_READ_KEY, JSON.stringify(updated)); } catch (e) {}
          return updated;
        });
        showAlert(`E-book "${book.title}" berhasil dihapus dari katalog perpustakaan.`, {
          title: 'Berhasil Dihapus',
          type: 'success'
        });
      } else {
        showAlert(data.error || 'Gagal menghapus e-book dari server.', {
          title: 'Gagal Menghapus',
          type: 'danger'
        });
      }
    } catch (err) {
      console.error('Error delete ebook:', err);
      showAlert('Terjadi kesalahan koneksi saat menghapus e-book: ' + err.message, {
        title: 'Gagal Menghapus',
        type: 'danger'
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Simpan riwayat buku terakhir dibaca (khusus pengunjung) & catat log rekap pengunjung
  const handleOpenReader = (book) => {
    setActiveBook(book);
    setViewerMode('preview');
    setViewerLoading(true);

    if (!isStaff) {
      try {
        const existing = lastReadBooks.filter(b => b.id !== book.id);
        const updated = [book, ...existing].slice(0, 6);
        setLastReadBooks(updated);
        localStorage.setItem(LAST_READ_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Gagal menyimpan riwayat bacaan:', e);
      }

      // Catat log pembaca e-book ke backend untuk statistik rekapitulasi staf
      try {
        fetch(`${API_URL}/ebooks/read-log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ebook_id: book.id,
            title: book.title,
            category: book.category || 'Koleksi Umum'
          })
        }).catch(() => {});
      } catch (err) {}
    }
  };

  // URL iframe sesuai engine reader yang dipilih
  const currentViewerUrl = useMemo(() => {
    if (!activeBook) return '';
    // Jika file PDF lokal hasil upload staf
    if (activeBook.pdfUrl) {
      return resolveMediaUrl(activeBook.pdfUrl);
    }
    // Jika ada Google Drive Preview URL
    if (activeBook.drivePreviewUrl) {
      if (viewerMode === 'docs' && activeBook.id && !activeBook.id.startsWith('ebk_')) {
        return `https://docs.google.com/viewer?srcid=${activeBook.id}&pid=explorer&efh=false&a=v&chrome=false&embedded=true`;
      }
      if (viewerMode === 'embed' && activeBook.driveViewUrl) {
        return activeBook.driveViewUrl;
      }
      return activeBook.drivePreviewUrl;
    }
    if (viewerMode === 'docs') {
      return `https://docs.google.com/viewer?srcid=${activeBook.id}&pid=explorer&efh=false&a=v&chrome=false&embedded=true`;
    }
    if (viewerMode === 'embed') {
      return `https://drive.google.com/file/d/${activeBook.id}/view?usp=sharing`;
    }
    // Default Preview Engine
    return `https://drive.google.com/file/d/${activeBook.id}/preview`;
  }, [activeBook, viewerMode]);

  // Kategori unik dengan jumlah buku
  const categoryStats = useMemo(() => {
    const stats = { 'ALL': ebooksList.length };
    ebooksList.forEach(book => {
      const cat = book.category || 'RANDOM';
      stats[cat] = (stats[cat] || 0) + 1;
    });
    return stats;
  }, [ebooksList]);

  const categories = useMemo(() => {
    return ['ALL', 'NOVEL', 'INSPIRASI', 'TIPS & TRIK', 'BACAAN ANAK', 'BIOGRAFI', 'RANDOM'];
  }, []);

  // Filter buku berdasarkan kategori dan kata kunci pencarian
  const filteredBooks = useMemo(() => {
    let list = ebooksList;
    if (selectedCategory !== 'ALL') {
      list = list.filter(b => b.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(b => 
        b.title.toLowerCase().includes(q) ||
        (b.category && b.category.toLowerCase().includes(q))
      );
    }
    return list;
  }, [ebooksList, selectedCategory, searchQuery]);

  // Reset ke halaman 1 saat filter atau pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredBooks.length / itemsPerPage) || 1;
  const currentBooks = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredBooks.slice(start, start + itemsPerPage);
  }, [filteredBooks, currentPage]);

  return (
    <div className="ebooks-container" style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '5rem' }}>
      {/* Banner Header */}
      <div className="glass-panel" style={{ marginBottom: '2rem', padding: '2.2rem 2rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: isStaff ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)',
            border: isStaff ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(99, 102, 241, 0.4)',
            padding: '0.35rem 0.9rem', borderRadius: '20px',
            color: isStaff ? '#6ee7b7' : '#a5b4fc',
            fontSize: '0.82rem', fontWeight: '700', marginBottom: '1rem'
          }}>
            {isStaff ? <ShieldCheck size={14} color="#34d399" /> : <Sparkles size={14} />}
            {isStaff ? 'MODE PENGELOLAAN STAF: KATALOG E-BOOK' : 'KOLEKSI DIGITAL PERPUSTAKAAN KOTA PAREPARE'}
          </div>
          <h1 style={{ fontSize: '2.1rem', fontWeight: '800', color: '#ffffff', marginBottom: '0.6rem', letterSpacing: '-0.5px' }}>
            {isStaff ? 'Katalog E-Book Perpustakaan' : 'Katalog E-Book & Baca Online'}
          </h1>
          <p style={{ color: '#cbd5e1', fontSize: '0.98rem', maxWidth: '750px', lineHeight: 1.6, marginBottom: '1.4rem' }}>
            {isStaff
              ? `Tersedia ${ebooksList.length} judul koleksi E-Book digital. Staf dapat membaca langsung pratinjau dokumen dan menghapus e-book dari katalog jika diperlukan.`
              : `Akses bebas ${ebooksList.length} judul E-Book digital koleksi Perpustakaan Umum Kota Parepare. Buka dan baca langsung secara digital di HP atau laptop. Khusus dibaca di tempat secara online; fitur unduh dinonaktifkan demi perlindungan hak cipta penerbit & penulis.`}
          </p>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#6ee7b7', padding: '0.45rem 0.95rem', borderRadius: '10px',
              fontSize: '0.82rem', fontWeight: '700'
            }}>
              <CheckCircle2 size={16} color="#34d399" /> Akses Baca Online
            </span>
            {isStaff ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#fca5a5', padding: '0.45rem 0.95rem', borderRadius: '10px',
                  fontSize: '0.82rem', fontWeight: '700'
                }}>
                  <Trash2 size={15} color="#f87171" /> Izin Hapus Koleksi Aktif
                </span>

                <button
                  type="button"
                  onClick={() => setShowAddEbookModal(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    border: '1.5px solid #818cf8',
                    color: '#ffffff', padding: '0.45rem 1rem', borderRadius: '10px',
                    fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Plus size={15} />
                  <span>Tambah E-Book</span>
                </button>
              </div>
            ) : (
              <>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#fca5a5', padding: '0.45rem 0.95rem', borderRadius: '10px',
                  fontSize: '0.82rem', fontWeight: '700'
                }}>
                  <Lock size={15} color="#f87171" /> Dilindungi Hak Cipta (Unduh Nonaktif)
                </span>

                {lastReadBooks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowHistoryModal(true)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '8px',
                      background: 'rgba(251, 191, 36, 0.18)', border: '1.5px solid rgba(251, 191, 36, 0.45)',
                      color: '#fbbf24', padding: '0.45rem 1rem', borderRadius: '10px',
                      fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer',
                      boxShadow: '0 2px 10px rgba(251, 191, 36, 0.15)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(251, 191, 36, 0.28)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(251, 191, 36, 0.18)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                    title="Buka riwayat e-book yang baru saja Anda baca"
                  >
                    <Clock size={15} color="#fbbf24" />
                    <span>Lihat Riwayat Dibaca ({lastReadBooks.length})</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tombol Akses Riwayat Bacaan Pengunjung (Rapi & Tidak Memenuhi Halaman) */}
      {!isStaff && lastReadBooks.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '1.25rem', padding: '0.8rem 1.25rem',
          background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(251, 191, 36, 0.25)',
          borderRadius: '12px', flexWrap: 'wrap', gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', fontSize: '0.86rem' }}>
            <Clock size={16} color="#fbbf24" />
            <span>Ada <strong>{lastReadBooks.length} judul buku</strong> dalam riwayat bacaan Anda</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '0.45rem 1rem', background: 'rgba(251, 191, 36, 0.15)',
                border: '1px solid rgba(251, 191, 36, 0.4)', borderRadius: '8px',
                color: '#fbbf24', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(251, 191, 36, 0.28)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(251, 191, 36, 0.15)'}
            >
              <span>Lihat Riwayat Bacaan</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL POPUP RIWAYAT BACAAN PENGUNJUNG (LEBIH RAPI & BERSIH)*/}
      {/* ========================================================= */}
      {showHistoryModal && (
        <div 
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem', animation: 'fadeIn 0.2s ease'
          }}
          onClick={() => setShowHistoryModal(false)}
        >
          <div 
            className="glass-panel"
            style={{
              width: '100%', maxWidth: '780px', maxHeight: '85vh',
              background: '#0f172a', border: '1px solid rgba(251, 191, 36, 0.35)',
              borderRadius: '16px', display: 'flex', flexDirection: 'column',
              overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.85)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '1.1rem 1.4rem', borderBottom: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#1e293b', flexWrap: 'wrap', gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '10px',
                  background: 'rgba(251, 191, 36, 0.18)', border: '1px solid rgba(251, 191, 36, 0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24'
                }}>
                  <Clock size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    Riwayat Membaca Terakhir
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0, marginTop: '2px' }}>
                    Daftar {lastReadBooks.length} buku digital yang baru-baru ini Anda buka
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setLastReadBooks([]);
                    localStorage.removeItem(LAST_READ_KEY);
                    setShowHistoryModal(false);
                  }}
                  style={{
                    background: 'none', border: 'none', color: '#f87171',
                    fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline',
                    fontWeight: 600
                  }}
                >
                  Hapus Semua Riwayat
                </button>

                <button
                  type="button"
                  onClick={() => setShowHistoryModal(false)}
                  style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  title="Tutup dialog"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body: Cards */}
            <div style={{
              padding: '1.25rem', overflowY: 'auto', flex: 1,
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem'
            }}>
              {lastReadBooks.map(book => {
                const thumbUrl = book.thumbnail 
                  ? resolveMediaUrl(book.thumbnail.replace(/=s\d+$/, '=s200'))
                  : `https://lh3.googleusercontent.com/d/${book.id}=w200`;

                return (
                  <div
                    key={book.id}
                    onClick={() => {
                      setShowHistoryModal(false);
                      handleOpenReader(book);
                    }}
                    style={{
                      padding: '0.85rem', display: 'flex', alignItems: 'center', gap: '12px',
                      cursor: 'pointer', borderRadius: '12px',
                      background: 'rgba(30, 41, 59, 0.75)',
                      border: '1px solid rgba(251, 191, 36, 0.25)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#fbbf24';
                      e.currentTarget.style.background = 'rgba(30, 41, 59, 1)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(251, 191, 36, 0.25)';
                      e.currentTarget.style.background = 'rgba(30, 41, 59, 0.75)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{
                      width: '46px', height: '62px', borderRadius: '6px', flexShrink: 0,
                      overflow: 'hidden', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.4)', position: 'relative'
                    }}>
                      <img 
                        src={thumbUrl}
                        alt={book.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: '700', textTransform: 'uppercase' }}>
                        {book.category}
                      </span>
                      <h4 style={{ fontSize: '0.88rem', fontWeight: '600', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }} title={book.title}>
                        {book.title}
                      </h4>
                      <span style={{ fontSize: '0.76rem', color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontWeight: 600 }}>
                        Lanjutkan Membaca <ArrowRight size={12} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '0.85rem 1.4rem', borderTop: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              background: '#1e293b'
            }}>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                style={{
                  padding: '0.55rem 1.2rem', background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px',
                  color: '#fff', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer'
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar Pencarian & Filter Kategori */}
      <div className="glass-panel" style={{ padding: '1.2rem 1.5rem', marginBottom: '2rem' }}>
        {/* Kolom Pencarian & Tombol Tambah E-Book Staf */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={19} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Cari dari ${ebooksList.length} koleksi E-Book (Ketik judul buku, nama penulis, dll)...`}
              style={{
                width: '100%',
                padding: '0.85rem 1rem 0.85rem 3rem',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1.5px solid var(--surface-border)',
                borderRadius: '12px',
                color: '#ffffff',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--surface-border)'}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {isStaff && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowAddEbookModal(true)}
              style={{
                padding: '0.85rem 1.3rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                borderColor: '#818cf8',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap'
              }}
            >
              <Plus size={18} />
              <span>Tambah E-Book Baru</span>
            </button>
          )}
        </div>

        {/* Bar Kategori Tabs */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px', scrollbarWidth: 'thin' }}>
          {categories.map(cat => {
            const count = categoryStats[cat] || 0;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '7px',
                  padding: '0.55rem 1.1rem', borderRadius: '30px',
                  fontSize: '0.85rem', fontWeight: '700',
                  background: isSelected ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.05)',
                  color: isSelected ? '#ffffff' : 'var(--text-main)',
                  border: isSelected ? '1px solid var(--primary-color)' : '1px solid var(--surface-border)',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  boxShadow: isSelected ? '0 0 15px var(--primary-glow)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <span>{cat === 'ALL' ? 'Semua E-Book' : cat}</span>
                <span style={{
                  fontSize: '0.74rem', padding: '1px 6px', borderRadius: '10px',
                  background: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                  color: isSelected ? '#ffffff' : 'var(--text-muted)'
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Info Hasil Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', color: 'var(--text-muted)', fontSize: '0.9rem', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          Menampilkan <strong>{filteredBooks.length}</strong> buku
          {selectedCategory !== 'ALL' && ` dalam kategori ${selectedCategory}`}
          {searchQuery && ` dengan kata kunci "${searchQuery}"`}
        </div>
        <div>
          Halaman <strong>{currentPage}</strong> dari {totalPages}
        </div>
      </div>

      {/* Grid Kartu E-Book dengan Cover Asli Halaman 1 */}
      {filteredBooks.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <BookOpen size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
          <h3 style={{ color: '#ffffff', marginBottom: '0.5rem' }}>E-Book Tidak Ditemukan</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '1.5rem' }}>
            Tidak ada buku digital yang cocok dengan pencarian "{searchQuery}".
          </p>
          <button 
            type="button" 
            onClick={() => { setSearchQuery(''); setSelectedCategory('ALL'); }}
            style={{
              padding: '0.6rem 1.4rem', background: 'var(--primary-color)', color: '#fff',
              border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700'
            }}
          >
            Tampilkan Semua E-Book
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.4rem', marginBottom: '2.5rem' }}>
          {currentBooks.map(book => {
            return (
              <div 
                key={book.id} 
                className="glass-panel"
                style={{
                  display: 'flex', flexDirection: 'column', padding: '1.1rem',
                  borderRadius: '16px', position: 'relative', overflow: 'hidden',
                  transition: 'all 0.25s ease'
                }}
              >
                {/* Visual Cover Sampul Halaman 1 Asli PDF */}
                <EBookCover book={book} onClick={() => handleOpenReader(book)} />

                {/* Judul & Detail */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <h4 
                    style={{
                      fontSize: '0.95rem', fontWeight: '700', color: '#ffffff',
                      marginBottom: '0.8rem', lineHeight: 1.4,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                    title={book.title}
                  >
                    {book.title}
                  </h4>

                  {/* Tombol Aksi */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                    <button 
                      type="button"
                      onClick={() => handleOpenReader(book)}
                      style={{
                        flex: 1,
                        padding: '0.65rem 0.8rem', background: 'var(--primary-color)',
                        color: '#ffffff', border: 'none', borderRadius: '8px',
                        fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        boxShadow: '0 4px 14px var(--primary-glow)',
                        transition: 'transform 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      <BookOpen size={16} /> Baca Online
                    </button>

                    {isStaff && (
                      <button 
                        type="button"
                        onClick={(e) => handleDeleteBook(book, e)}
                        disabled={deletingId === book.id}
                        title="Hapus E-Book dari Katalog Perpustakaan"
                        style={{
                          padding: '0.65rem 0.85rem',
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          color: '#fca5a5',
                          borderRadius: '8px',
                          fontSize: '0.82rem',
                          fontWeight: '700',
                          cursor: deletingId === book.id ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
                          e.currentTarget.style.borderColor = '#ef4444';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                          e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                        }}
                      >
                        {deletingId === book.id ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Trash2 size={15} />
                        )}
                        <span>Hapus</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Nav */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            disabled={currentPage === 1}
            onClick={() => {
              setCurrentPage(p => Math.max(1, p - 1));
              window.scrollTo({ top: 350, behavior: 'smooth' });
            }}
            style={{
              padding: '0.6rem 1rem', background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--surface-border)', borderRadius: '8px',
              color: currentPage === 1 ? 'var(--text-muted)' : '#ffffff',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.88rem', fontWeight: '600'
            }}
          >
            <ChevronLeft size={16} /> Sebelumnya
          </button>

          <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem', padding: '0 0.8rem' }}>
            Halaman <strong style={{ color: '#fff' }}>{currentPage}</strong> dari {totalPages}
          </span>

          <button
            disabled={currentPage === totalPages}
            onClick={() => {
              setCurrentPage(p => Math.min(totalPages, p + 1));
              window.scrollTo({ top: 350, behavior: 'smooth' });
            }}
            style={{
              padding: '0.6rem 1rem', background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--surface-border)', borderRadius: '8px',
              color: currentPage === totalPages ? 'var(--text-muted)' : '#ffffff',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.88rem', fontWeight: '600'
            }}
          >
            Berikutnya <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL PEMBACA E-BOOK MULTI-ENGINE ONLINE (FULLSCREEN)     */}
      {/* ========================================================= */}
      {activeBook && (
        <div 
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.92)', backdropFilter: 'blur(12px)',
            display: 'flex', flexDirection: 'column',
            padding: isFullscreen ? '0' : '1.2rem',
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <div 
            style={{
              background: '#0f172a', border: isFullscreen ? 'none' : '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: isFullscreen ? '0' : '16px', display: 'flex', flexDirection: 'column',
              flex: 1, overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.85)'
            }}
          >
            {/* Toolbar Reader Atas */}
            <div 
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.85rem 1.4rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                background: '#1e293b', flexWrap: 'wrap', gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                <span style={{
                  background: 'rgba(239, 68, 68, 0.2)', color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.4)', padding: '2px 8px',
                  borderRadius: '6px', fontSize: '0.72rem', fontWeight: '800'
                }}>
                  PDF
                </span>
                <span style={{
                  background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc',
                  padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700'
                }}>
                  {activeBook.category}
                </span>
                <h3 style={{
                  fontSize: '0.98rem', fontWeight: '700', color: '#ffffff',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  maxWidth: '450px'
                }} title={activeBook.title}>
                  {activeBook.title}
                </h3>
              </div>

              {/* Kontrol & Pilihan Server Pratinjau */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* Switcher Server Pratinjau */}
                <div style={{ display: 'inline-flex', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '2px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <button
                    type="button"
                    onClick={() => { setViewerMode('preview'); setViewerLoading(true); }}
                    style={{
                      background: viewerMode === 'preview' ? 'var(--primary-color)' : 'none',
                      color: viewerMode === 'preview' ? '#fff' : 'var(--text-muted)',
                      border: 'none', padding: '4px 10px', borderRadius: '6px',
                      fontSize: '0.76rem', fontWeight: '700', cursor: 'pointer'
                    }}
                    title="Server Pratinjau Google Drive Utama"
                  >
                    Server 1
                  </button>
                  <button
                    type="button"
                    onClick={() => { setViewerMode('docs'); setViewerLoading(true); }}
                    style={{
                      background: viewerMode === 'docs' ? 'var(--primary-color)' : 'none',
                      color: viewerMode === 'docs' ? '#fff' : 'var(--text-muted)',
                      border: 'none', padding: '4px 10px', borderRadius: '6px',
                      fontSize: '0.76rem', fontWeight: '700', cursor: 'pointer'
                    }}
                    title="Server Alternatif Google Docs Viewer (Gunakan jika Server 1 lambat)"
                  >
                    Server 2
                  </button>
                </div>

                <span 
                  style={{
                    padding: '0.45rem 0.85rem', background: 'rgba(239, 68, 68, 0.14)',
                    border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '8px',
                    color: '#fca5a5', fontSize: '0.78rem', fontWeight: '700',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                  title="Dokumen ini hanya untuk dibaca di tempat. Pengunduhan dinonaktifkan."
                >
                  <Lock size={13} color="#f87171" /> Hanya Baca (Unduh Nonaktif)
                </span>

                <button 
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  title={isFullscreen ? 'Keluar Layar Penuh' : 'Mode Layar Penuh'}
                  style={{
                    padding: '0.45rem 0.8rem', background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px',
                    color: '#cbd5e1', fontSize: '0.82rem', fontWeight: '600',
                    display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'
                  }}
                >
                  {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  <span>{isFullscreen ? 'Normal' : 'Layar Penuh'}</span>
                </button>

                {isStaff && (
                  <button 
                    type="button"
                    onClick={() => handleDeleteBook(activeBook)}
                    disabled={deletingId === activeBook.id}
                    title="Hapus E-Book Ini dari Katalog Perpustakaan"
                    style={{
                      padding: '0.45rem 0.85rem', background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.45)', borderRadius: '8px',
                      color: '#fca5a5', fontSize: '0.8rem', fontWeight: '700',
                      display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'
                    }}
                  >
                    {deletingId === activeBook.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    <span>Hapus E-Book</span>
                  </button>
                )}

                <button 
                  type="button"
                  onClick={() => setActiveBook(null)}
                  title="Tutup Pembaca"
                  style={{
                    padding: '0.45rem 0.85rem', background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px',
                    color: '#f87171', fontSize: '0.82rem', fontWeight: '700',
                    display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'
                  }}
                >
                  <X size={16} /> Tutup
                </button>
              </div>
            </div>

            {/* Area Iframe Viewer dengan Loading State & Helper */}
            <div style={{ flex: 1, position: 'relative', background: '#0b0f19', display: 'flex', flexDirection: 'column' }}>
              {viewerLoading && (
                <div style={{
                  position: 'absolute', inset: 0, background: '#0b0f19',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  zIndex: 10
                }}>
                  <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary-color)', marginBottom: '12px' }} />
                  <p style={{ color: '#cbd5e1', fontSize: '0.92rem', fontWeight: '600' }}>
                    Memuat dokumen E-Book dari server...
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '4px' }}>
                    Jika pratinjau belum tampil, coba klik Server 2 atau tombol Tab Baru di kanan atas
                  </p>
                </div>
              )}

              <iframe
                key={`${activeBook.id}-${viewerMode}`}
                src={currentViewerUrl}
                title={activeBook.title}
                width="100%"
                height="100%"
                style={{ border: 'none', display: 'block', flex: 1 }}
                allow="autoplay"
                onLoad={() => setViewerLoading(false)}
              />

              {/* Bar Bantuan Cepat di Bagian Bawah Modal Reader */}
              <div style={{
                padding: '0.6rem 1.4rem', background: '#0f172a', borderTop: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px',
                fontSize: '0.78rem', color: '#94a3b8'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={14} color="#34d399" />
                  <span>
                    Dokumen ini dilindungi hak cipta perpustakaan. Jika tampilan lambat, klik <strong>Server 2</strong>.
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => { setViewerMode(viewerMode === 'preview' ? 'docs' : 'preview'); setViewerLoading(true); }}
                    style={{ background: 'none', border: 'none', color: '#a5b4fc', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.78rem' }}
                  >
                    Ganti ke {viewerMode === 'preview' ? 'Server 2' : 'Server 1'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: TAMBAH E-BOOK OLEH STAF                           */}
      {/* ======================================================== */}
      {showAddEbookModal && (
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
            border: '1.5px solid rgba(129, 140, 248, 0.45)',
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
                  <Sparkles size={22} color="#818cf8" />
                  <span>Tambah E-Book Digital Baru</span>
                </h2>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '4px 0 0' }}>
                  Unggah file PDF atau masukkan link Google Drive untuk menambahkan e-book ke koleksi
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setShowAddEbookModal(false); resetEbookForm(); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.3rem', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitEbook}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Judul E-Book */}
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px', color: '#cbd5e1' }}>
                    Judul E-Book <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Contoh: Filosofi Teras"
                    required
                    value={ebookForm.title}
                    onChange={(e) => setEbookForm({ ...ebookForm, title: e.target.value })}
                  />
                </div>

                {/* Kategori E-Book */}
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px', color: '#cbd5e1' }}>
                    Kategori E-Book
                  </label>
                  <input
                    type="text"
                    list="ebook-reader-cat-list"
                    className="form-control"
                    placeholder="Pilih atau ketik kategori (NOVEL, INSPIRASI, TIPS & TRIK, BIOGRAFI, BACAAN ANAK)..."
                    value={ebookForm.category}
                    onChange={(e) => setEbookForm({ ...ebookForm, category: e.target.value })}
                  />
                  <datalist id="ebook-reader-cat-list">
                    <option value="NOVEL" />
                    <option value="INSPIRASI" />
                    <option value="TIPS & TRIK" />
                    <option value="BACAAN ANAK" />
                    <option value="BIOGRAFI" />
                    <option value="Koleksi Umum" />
                    <option value="RANDOM" />
                  </datalist>
                </div>

                {/* Sumber Dokumen E-Book */}
                <div style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: '12px',
                  padding: '1rem'
                }}>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '4px', color: '#cbd5e1' }}>
                    Sumber Dokumen E-Book <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <p style={{ fontSize: '0.76rem', color: '#94a3b8', margin: '0 0 10px 0' }}>
                    Masukkan tautan Google Drive publik ATAU unggah file PDF langsung dari komputer/HP Anda.
                  </p>

                  {/* Opsi A: Link Google Drive */}
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#a5b4fc', marginBottom: '4px' }}>
                      Opsi A: Link Google Drive
                    </label>
                    <input
                      type="url"
                      className="form-control"
                      placeholder="https://drive.google.com/file/d/1aBcD.../view atau ID file Drive"
                      style={{ fontSize: '0.82rem' }}
                      value={ebookForm.drive_url}
                      onChange={(e) => setEbookForm({ ...ebookForm, drive_url: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0', color: '#64748b', fontSize: '0.74rem', fontWeight: 700 }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                    <span>ATAU</span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                  </div>

                  {/* Opsi B: Upload File Dokumen PDF */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#a5b4fc', marginBottom: '6px' }}>
                      Opsi B: Unggah Dokumen PDF Langsung
                    </label>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => ebookPdfInputRef.current?.click()}
                        style={{ fontSize: '0.8rem', padding: '0.5rem 0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Upload size={14} />
                        <span>{ebookForm.pdf_filename ? 'Ganti File PDF' : 'Pilih File PDF'}</span>
                      </button>
                      <input
                        type="file"
                        ref={ebookPdfInputRef}
                        accept=".pdf,application/pdf"
                        style={{ display: 'none' }}
                        onChange={handleEbookPdfFile}
                      />

                      {ebookForm.pdf_filename && (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '8px',
                          background: 'rgba(99, 102, 241, 0.15)',
                          border: '1px solid rgba(99, 102, 241, 0.35)',
                          color: '#c7d2fe',
                          fontSize: '0.78rem'
                        }}>
                          <FileText size={14} color="#818cf8" />
                          <span style={{ fontWeight: 600 }}>{ebookForm.pdf_filename}</span>
                          {ebookForm.pdf_filesize && <span style={{ color: '#94a3b8' }}>({ebookForm.pdf_filesize})</span>}
                          <button
                            type="button"
                            onClick={() => setEbookForm(prev => ({ ...prev, pdf_data: null, pdf_filename: '', pdf_filesize: '' }))}
                            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0 2px', fontSize: '1rem', lineHeight: 1 }}
                            title="Hapus file PDF"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Foto Sampul E-Book */}
                <div style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '1rem'
                }}>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '8px', color: '#cbd5e1' }}>
                    Foto Sampul E-Book <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>(Opsional)</span>
                  </label>

                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
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
                      {ebookCoverPreview ? (
                        <img
                          src={ebookCoverPreview}
                          alt="Preview Sampul E-Book"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <Image size={24} color="#64748b" />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => ebookCoverInputRef.current?.click()}
                          style={{ fontSize: '0.78rem', padding: '0.45rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                        >
                          <Upload size={13} />
                          <span>Unggah Foto Sampul</span>
                        </button>

                        <input
                          type="file"
                          ref={ebookCoverInputRef}
                          style={{ display: 'none' }}
                          accept="image/*"
                          onChange={handleEbookCoverFile}
                        />

                        {ebookCoverPreview && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                              setEbookCoverPreview(null);
                              setEbookForm(prev => ({ ...prev, cover_url: '', cover_image: null }));
                            }}
                            style={{ fontSize: '0.78rem', padding: '0.45rem 0.65rem', color: '#f87171' }}
                            title="Hapus sampul"
                          >
                            Hapus
                          </button>
                        )}
                      </div>

                      <input
                        type="url"
                        className="form-control"
                        placeholder="Atau tempel URL gambar sampul (https://...)"
                        style={{ fontSize: '0.8rem' }}
                        value={ebookForm.cover_url}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEbookForm({ ...ebookForm, cover_url: val, cover_image: null });
                          setEbookCoverPreview(val || null);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons E-Book */}
              <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'flex-end', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setShowAddEbookModal(false); resetEbookForm(); }}
                  disabled={isSubmittingEbook}
                >
                  Batal
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingEbook}
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    borderColor: '#818cf8',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 700
                  }}
                >
                  {isSubmittingEbook ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Menyimpan E-Book...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Simpan & Publikasikan E-Book</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
