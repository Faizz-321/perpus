import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  BarChart3, Calendar, Clock, BookOpen, Tablet, TrendingUp, 
  Printer, RefreshCw, Filter, Search, CheckCircle2, AlertCircle, FileText, 
  Layers, Users, ArrowUpRight, Award, ChevronDown, Check, X, BookmarkCheck,
  ChevronLeft, ChevronRight, Hash, PieChart, Ticket, FileSpreadsheet, Table
} from 'lucide-react';
import { parseOrderBookTitles } from '../utils/orderBooks';
import { API_URL } from '../config/api';

/**
 * Komponen Rekapitulasi Pelayanan Perpustakaan (Staf Dashboard)
 * Menyediakan statistik dan rekapitulasi harian, bulanan, dan tahunan untuk:
 * 1. Rekap Pesan Buku Fisik (Meja / Barcode QR)
 * 2. Rekap Membaca E-Book Digital
 * 3. Rekap Terpadu Gabungan
 */
export default function StaffRekap({ onBackToOrders }) {
  // Service Tab: 'books' (Pesan Buku), 'ebooks' (Baca E-Book), 'all' (Gabungan)
  const [activeService, setActiveService] = useState('books');

  // Filter Periode: 'daily', 'monthly', 'yearly', 'all'
  const [period, setPeriod] = useState('daily');

  // Nilai tanggal/bulan/tahun
  const todayDate = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const currentMonth = useMemo(() => todayDate.slice(0, 7), [todayDate]);
  const currentYear = useMemo(() => todayDate.slice(0, 4), [todayDate]);

  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Data Mentah dari Backend
  const [orders, setOrders] = useState([]);
  const [ebookReads, setEbookReads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter Tabel Detail
  const [tableSearch, setTableSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tablePage, setTablePage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // Fetch seluruh data orders & ebook_reads
  const fetchData = async () => {
    setLoading(true);
    try {
      const [resOrders, resEbooks] = await Promise.all([
        fetch(`${API_URL}/orders`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${API_URL}/ebooks/read-log`).then(r => r.ok ? r.json() : []).catch(() => [])
      ]);
      setOrders(Array.isArray(resOrders) ? resOrders : []);
      setEbookReads(Array.isArray(resEbooks) ? resEbooks : []);
    } catch (err) {
      console.warn('Gagal memuat data rekap:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Helper untuk mengecek apakah suatu timestamp masuk ke dalam periode terpilih (Local Timezone)
  const matchesPeriod = (dateInput) => {
    if (!dateInput) return false;
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return false;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;
    const monthStr = `${y}-${m}`;
    const yearStr = String(y);

    if (period === 'daily') {
      return dateStr === selectedDate;
    }
    if (period === 'monthly') {
      return monthStr === selectedMonth;
    }
    if (period === 'yearly') {
      return yearStr === String(selectedYear);
    }
    return true; // 'all'
  };

  // 1. Data Pesanan Buku Fisik yang Terfilter Berdasarkan Periode
  const periodOrders = useMemo(() => {
    return orders.filter(o => matchesPeriod(o.created_at));
  }, [orders, period, selectedDate, selectedMonth, selectedYear]);

  // 2. Data Pembaca E-Book yang Terfilter Berdasarkan Periode
  const periodEbooks = useMemo(() => {
    return ebookReads.filter(e => matchesPeriod(e.read_at));
  }, [ebookReads, period, selectedDate, selectedMonth, selectedYear]);

  // Label periode yang ramah dibaca
  const periodLabel = useMemo(() => {
    if (period === 'daily') {
      try {
        const [y, m, d] = selectedDate.split('-');
        const dateObj = new Date(y, m - 1, d);
        return dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      } catch {
        return selectedDate;
      }
    }
    if (period === 'monthly') {
      try {
        const [y, m] = selectedMonth.split('-');
        const dateObj = new Date(y, m - 1, 1);
        return dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      } catch {
        return selectedMonth;
      }
    }
    if (period === 'yearly') {
      return `Tahun ${selectedYear}`;
    }
    return 'Semua Periode Riwayat';
  }, [period, selectedDate, selectedMonth, selectedYear]);

  // ========================================================
  // AGREGASI STATISTIK PESAN BUKU FISIK
  // ========================================================
  const ordersStats = useMemo(() => {
    let totalTickets = periodOrders.length;
    let totalBookCopies = 0;
    const statusCounts = { completed: 0, ready: 0, searching: 0, pending: 0, cancelled: 0 };
    const bookFrequency = new Map();
    const tableFrequency = new Map();

    periodOrders.forEach(o => {
      const titles = parseOrderBookTitles(o.book_title || o.book);
      totalBookCopies += Math.max(1, titles.length);

      const st = o.status || 'pending';
      if (statusCounts[st] !== undefined) statusCounts[st]++;

      titles.forEach(t => {
        const clean = t.trim();
        if (clean) bookFrequency.set(clean, (bookFrequency.get(clean) || 0) + 1);
      });

      const tbl = o.table_no || o.table || 'Meja';
      tableFrequency.set(tbl, (tableFrequency.get(tbl) || 0) + 1);
    });

    const topBooks = Array.from(bookFrequency.entries())
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const topTables = Array.from(tableFrequency.entries())
      .map(([table, count]) => ({ table, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const completedPercent = totalTickets > 0 ? Math.round((statusCounts.completed / totalTickets) * 100) : 0;

    return {
      totalTickets,
      totalBookCopies,
      statusCounts,
      topBooks,
      topTables,
      completedPercent
    };
  }, [periodOrders]);

  // ========================================================
  // AGREGASI STATISTIK MEMBACA E-BOOK
  // ========================================================
  const ebooksStats = useMemo(() => {
    let totalReads = periodEbooks.length;
    const categoryFrequency = new Map();
    const bookFrequency = new Map();

    periodEbooks.forEach(e => {
      const cat = e.category || 'Koleksi Umum';
      categoryFrequency.set(cat, (categoryFrequency.get(cat) || 0) + 1);

      const title = e.title || 'Tanpa Judul';
      const existing = bookFrequency.get(title) || { title, category: cat, count: 0 };
      existing.count += 1;
      bookFrequency.set(title, existing);
    });

    const topBooks = Array.from(bookFrequency.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const categoriesList = Array.from(categoryFrequency.entries())
      .map(([category, count]) => ({
        category,
        count,
        percent: totalReads > 0 ? Math.round((count / totalReads) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    const uniqueTitlesCount = bookFrequency.size;

    return {
      totalReads,
      uniqueTitlesCount,
      topBooks,
      categoriesList
    };
  }, [periodEbooks]);

  // ========================================================
  // GRAFIK VISUAL TREN AKTIVITAS
  // ========================================================
  const chartData = useMemo(() => {
    if (period === 'daily') {
      // Pembagian per jam layanan perpustakaan: 08:00 s/d 16:00
      const hours = ['08', '09', '10', '11', '12', '13', '14', '15', '16'];
      return hours.map(h => {
        const label = `${h}:00`;
        const orderCount = periodOrders.filter(o => {
          if (!o.created_at) return false;
          const d = new Date(o.created_at);
          return d.getHours() === parseInt(h, 10);
        }).length;

        const ebookCount = periodEbooks.filter(e => {
          if (!e.read_at) return false;
          const d = new Date(e.read_at);
          return d.getHours() === parseInt(h, 10);
        }).length;

        return { label, orders: orderCount, ebooks: ebookCount, total: orderCount + ebookCount };
      });
    }

    if (period === 'monthly') {
      // Pembagian per hari dalam bulan (1 s/d jumlah hari dalam bulan)
      const [y, m] = selectedMonth.split('-').map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      const days = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = String(day).padStart(2, '0');
        const fullDate = `${selectedMonth}-${dayStr}`;
        const orderCount = periodOrders.filter(o => o.created_at && o.created_at.slice(0, 10) === fullDate).length;
        const ebookCount = periodEbooks.filter(e => e.read_at && e.read_at.slice(0, 10) === fullDate).length;
        days.push({ label: `Tgl ${day}`, orders: orderCount, ebooks: ebookCount, total: orderCount + ebookCount });
      }
      return days;
    }

    if (period === 'yearly') {
      // Pembagian 12 Bulan dalam tahun
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 
        'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'
      ];
      return months.map((name, idx) => {
        const mStr = String(idx + 1).padStart(2, '0');
        const ym = `${selectedYear}-${mStr}`;
        const orderCount = periodOrders.filter(o => o.created_at && o.created_at.slice(0, 7) === ym).length;
        const ebookCount = periodEbooks.filter(e => e.read_at && e.read_at.slice(0, 7) === ym).length;
        return { label: name, orders: orderCount, ebooks: ebookCount, total: orderCount + ebookCount };
      });
    }

    // Default 'all': Ringkasan per tahun jika ada
    const yearMap = new Map();
    periodOrders.forEach(o => {
      const y = o.created_at ? o.created_at.slice(0, 4) : '2026';
      const cur = yearMap.get(y) || { label: y, orders: 0, ebooks: 0, total: 0 };
      cur.orders += 1;
      cur.total += 1;
      yearMap.set(y, cur);
    });
    periodEbooks.forEach(e => {
      const y = e.read_at ? e.read_at.slice(0, 4) : '2026';
      const cur = yearMap.get(y) || { label: y, orders: 0, ebooks: 0, total: 0 };
      cur.ebooks += 1;
      cur.total += 1;
      yearMap.set(y, cur);
    });
    return Array.from(yearMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [period, selectedMonth, selectedYear, periodOrders, periodEbooks]);

  // Nilai maksimum untuk skala grafik bar
  const maxChartValue = useMemo(() => {
    let max = 1;
    chartData.forEach(d => {
      const val = activeService === 'books' ? d.orders : activeService === 'ebooks' ? d.ebooks : d.total;
      if (val > max) max = val;
    });
    return max;
  }, [chartData, activeService]);

  // ========================================================
  // FILTER TABEL DETAIL RIWAYAT
  // ========================================================
  const filteredTableRows = useMemo(() => {
    const q = tableSearch.toLowerCase().trim();

    if (activeService === 'books') {
      return periodOrders.filter(o => {
        const matchStatus = statusFilter === 'all' || o.status === statusFilter;
        const titles = parseOrderBookTitles(o.book_title || o.book).join(' ');
        const matchSearch = !q ||
          (o.ticket_code && o.ticket_code.toLowerCase().includes(q)) ||
          (o.table_no && o.table_no.toLowerCase().includes(q)) ||
          titles.toLowerCase().includes(q);
        return matchStatus && matchSearch;
      });
    }

    if (activeService === 'ebooks') {
      return periodEbooks.filter(e => {
        const matchCat = categoryFilter === 'all' || e.category === categoryFilter;
        const matchSearch = !q ||
          (e.title && e.title.toLowerCase().includes(q)) ||
          (e.category && e.category.toLowerCase().includes(q));
        return matchCat && matchSearch;
      });
    }

    // 'all' Gabungan
    const combined = [
      ...periodOrders.map(o => ({ ...o, itemType: 'physical', sortDate: o.created_at })),
      ...periodEbooks.map(e => ({ ...e, itemType: 'ebook', sortDate: e.read_at }))
    ].sort((a, b) => new Date(b.sortDate || 0) - new Date(a.sortDate || 0));

    return combined.filter(item => {
      if (!q) return true;
      if (item.itemType === 'physical') {
        const titles = parseOrderBookTitles(item.book_title || item.book).join(' ');
        return (item.ticket_code && item.ticket_code.toLowerCase().includes(q)) ||
          (item.table_no && item.table_no.toLowerCase().includes(q)) ||
          titles.toLowerCase().includes(q);
      }
      return (item.title && item.title.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q));
    });
  }, [activeService, periodOrders, periodEbooks, tableSearch, statusFilter, categoryFilter]);

  // Pagination Tabel Detail
  const totalTablePages = Math.max(1, Math.ceil(filteredTableRows.length / ITEMS_PER_PAGE));
  const paginatedTableRows = useMemo(() => {
    const start = (tablePage - 1) * ITEMS_PER_PAGE;
    return filteredTableRows.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTableRows, tablePage]);

  // Reset page saat filter tabel berubah
  useEffect(() => {
    setTablePage(1);
  }, [tableSearch, statusFilter, categoryFilter, activeService, period, selectedDate, selectedMonth, selectedYear]);

  // Helper format tanggal: DD/MM/YYYY
  const formatDmy = (dateInput) => {
    if (!dateInput) return '-';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // ========================================================
  // EKSPOR KE EXCEL (.XLSX) - TEPAT 3 KOLOM SESUAI TEMPLATE:
  // [No, tgl/bln/thn, Judul]
  // ========================================================
  const handleExportExcel = (targetType) => {
    const serviceType = targetType || activeService;

    if (serviceType === 'books') {
      // 1. Rekapitulasi Buku Fisik
      const sortedOrders = [...periodOrders].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
      const dataRows = [
        ['No', 'tgl/bln/thn', 'Judul']
      ];

      let counter = 1;
      sortedOrders.forEach(order => {
        const dateStr = formatDmy(order.created_at);
        const titles = parseOrderBookTitles(order.book_title || order.book);
        if (titles.length === 0) {
          dataRows.push([counter++, dateStr, '-']);
        } else {
          titles.forEach(title => {
            dataRows.push([counter++, dateStr, title]);
          });
        }
      });

      const ws = XLSX.utils.aoa_to_sheet(dataRows);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 22 },
        { wch: 110 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      XLSX.writeFile(wb, 'rekapitulasi buku fisik.xlsx');
      return;
    }

    if (serviceType === 'ebooks') {
      // 2. Rekapitulasi E-Book
      const sortedEbooks = [...periodEbooks].sort((a, b) => new Date(a.read_at || 0) - new Date(b.read_at || 0));
      const dataRows = [
        ['No', 'tgl/bln/thn', 'Judul']
      ];

      let counter = 1;
      sortedEbooks.forEach(e => {
        const dateStr = formatDmy(e.read_at);
        dataRows.push([counter++, dateStr, e.title || '-']);
      });

      const ws = XLSX.utils.aoa_to_sheet(dataRows);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 22 },
        { wch: 110 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      XLSX.writeFile(wb, 'rekapitulasi ebook.xlsx');
      return;
    }

    // Jika tab 'all' (Gabungan), unduh file buku fisik lalu e-book
    handleExportExcel('books');
    setTimeout(() => {
      handleExportExcel('ebooks');
    }, 500);
  };



  // ========================================================
  // CETAK LAPORAN RESMI
  // ========================================================
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="rekap-container">
      {/* ======================================================== */}
      {/* 1. HEADER MODUL REKAPITULASI                             */}
      {/* ======================================================== */}
      <div className="rekap-header-card glass-panel no-print">
        <div className="rekap-header-left">
          <div className="rekap-header-icon">
            <BarChart3 size={28} color="#c084fc" />
          </div>
          <div>
            <div className="rekap-header-tag">LAPORAN &amp; STATISTIK PELAYANAN</div>
            <h1 className="rekap-header-title">Rekapitulasi Pelayanan Perpustakaan</h1>
            <p className="rekap-header-desc">
              Analisis statistik pemesanan buku fisik via meja dan pembacaan koleksi e-book digital secara berkala.
            </p>
          </div>
        </div>

        <div className="rekap-header-actions">
          {onBackToOrders && (
            <button
              type="button"
              className="btn btn-secondary bbi-btn-sm"
              onClick={onBackToOrders}
              title="Kembali ke layar antrean tiket meja"
            >
              <Ticket size={15} /> Antrean Tiket
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary bbi-btn-sm"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Muat ulang data terbaru dari server"
          >
            <RefreshCw size={15} className={refreshing ? 'bbi-spin' : ''} />
            <span>{refreshing ? 'Memperbarui...' : 'Segarkan'}</span>
          </button>

          {activeService === 'books' && (
            <button
              type="button"
              className="btn rekap-btn-excel bbi-btn-sm"
              onClick={() => handleExportExcel('books')}
              title="Unduh file rekapitulasi buku fisik (.xlsx) 3 kolom: No, tgl/bln/thn, Judul"
            >
              <FileSpreadsheet size={15} /> Unduh Excel (.xlsx)
            </button>
          )}

          {activeService === 'ebooks' && (
            <button
              type="button"
              className="btn rekap-btn-excel bbi-btn-sm"
              onClick={() => handleExportExcel('ebooks')}
              title="Unduh file rekapitulasi ebook (.xlsx) 3 kolom: No, tgl/bln/thn, Judul"
            >
              <FileSpreadsheet size={15} /> Unduh Excel (.xlsx)
            </button>
          )}

          {activeService === 'all' && (
            <>
              <button
                type="button"
                className="btn rekap-btn-excel bbi-btn-sm"
                onClick={() => handleExportExcel('books')}
                title="Unduh file rekapitulasi buku fisik (.xlsx)"
              >
                <FileSpreadsheet size={15} /> Unduh Buku Fisik (.xlsx)
              </button>
              <button
                type="button"
                className="btn rekap-btn-excel bbi-btn-sm"
                style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', borderColor: '#38bdf8' }}
                onClick={() => handleExportExcel('ebooks')}
                title="Unduh file rekapitulasi ebook (.xlsx)"
              >
                <FileSpreadsheet size={15} /> Unduh Ebook (.xlsx)
              </button>
            </>
          )}



          <button
            type="button"
            className="btn bbi-btn-primary bbi-btn-sm"
            onClick={handlePrint}
            title="Cetak lembar laporan resmi berkop Dinas Perpustakaan"
            style={{ background: 'linear-gradient(135deg, #a855f7, #9333ea)', border: 'none' }}
          >
            <Printer size={15} /> Cetak Laporan
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. TAB LAYANAN: PESAN BUKU VS BACA E-BOOK VS GABUNGAN   */}
      {/* ======================================================== */}
      <div className="rekap-service-tabs-wrap no-print">
        <div className="rekap-service-tabs">
          <button
            type="button"
            className={`rekap-service-tab ${activeService === 'books' ? 'active books' : ''}`}
            onClick={() => setActiveService('books')}
          >
            <BookOpen size={18} />
            <div className="tab-text-wrap">
              <span className="tab-title">Rekap Pesan Buku (Fisik)</span>
              <span className="tab-sub">Pemesanan buku via meja &amp; QR</span>
            </div>
            <span className="tab-counter">{periodOrders.length} Pesanan</span>
          </button>

          <button
            type="button"
            className={`rekap-service-tab ${activeService === 'ebooks' ? 'active ebooks' : ''}`}
            onClick={() => setActiveService('ebooks')}
          >
            <Tablet size={18} />
            <div className="tab-text-wrap">
              <span className="tab-title">Rekap Membaca E-Book</span>
              <span className="tab-sub">Aktivitas pembaca buku digital</span>
            </div>
            <span className="tab-counter">{periodEbooks.length} Sesi Baca</span>
          </button>

          <button
            type="button"
            className={`rekap-service-tab ${activeService === 'all' ? 'active all' : ''}`}
            onClick={() => setActiveService('all')}
          >
            <Layers size={18} />
            <div className="tab-text-wrap">
              <span className="tab-title">Ringkasan Terpadu</span>
              <span className="tab-sub">Seluruh pelayanan buku &amp; e-book</span>
            </div>
            <span className="tab-counter">{periodOrders.length + periodEbooks.length} Total</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. TOOLBAR PILIHAN PERIODE: HARIAN, BULANAN, TAHUNAN    */}
      {/* ======================================================== */}
      <div className="rekap-period-toolbar glass-panel no-print">
        <div className="period-mode-buttons">
          <span className="toolbar-label">
            <Calendar size={15} color="#cbd5e1" /> Periode:
          </span>

          <button
            type="button"
            className={`period-btn ${period === 'daily' ? 'active' : ''}`}
            onClick={() => setPeriod('daily')}
          >
            Harian (Per Hari)
          </button>

          <button
            type="button"
            className={`period-btn ${period === 'monthly' ? 'active' : ''}`}
            onClick={() => setPeriod('monthly')}
          >
            Bulanan (Per Bulan)
          </button>

          <button
            type="button"
            className={`period-btn ${period === 'yearly' ? 'active' : ''}`}
            onClick={() => setPeriod('yearly')}
          >
            Tahunan (Per Tahun)
          </button>

          <button
            type="button"
            className={`period-btn ${period === 'all' ? 'active' : ''}`}
            onClick={() => setPeriod('all')}
          >
            Semua Riwayat
          </button>
        </div>

        {/* Input Pemilih Sesuai Periode yang Aktif */}
        <div className="period-picker-wrap">
          {period === 'daily' && (
            <div className="period-input-group">
              <label htmlFor="rekap-date-input" className="period-input-label">Pilih Tanggal:</label>
              <input
                id="rekap-date-input"
                type="date"
                className="period-input"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
              <button
                type="button"
                className="btn-quick-pill"
                onClick={() => setSelectedDate(todayDate)}
              >
                Hari Ini
              </button>
            </div>
          )}

          {period === 'monthly' && (
            <div className="period-input-group">
              <label htmlFor="rekap-month-input" className="period-input-label">Pilih Bulan &amp; Tahun:</label>
              <input
                id="rekap-month-input"
                type="month"
                className="period-input"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
              />
              <button
                type="button"
                className="btn-quick-pill"
                onClick={() => setSelectedMonth(currentMonth)}
              >
                Bulan Ini
              </button>
            </div>
          )}

          {period === 'yearly' && (
            <div className="period-input-group">
              <label htmlFor="rekap-year-select" className="period-input-label">Pilih Tahun:</label>
              <select
                id="rekap-year-select"
                className="period-input"
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
              >
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
                <option value="2023">2023</option>
              </select>
              <button
                type="button"
                className="btn-quick-pill"
                onClick={() => setSelectedYear(currentYear)}
              >
                Tahun Ini
              </button>
            </div>
          )}

          {period === 'all' && (
            <div className="period-badge-all">
              <span>Menampilkan seluruh arsip data yang tercatat</span>
            </div>
          )}
        </div>
      </div>

      {/* Keterangan Periode Aktif Banner */}
      <div className="rekap-active-banner">
        <div className="banner-left">
          <BookmarkCheck size={18} color="#c084fc" />
          <span>
            Laporan: <strong>{activeService === 'books' ? 'Pemesanan Buku Fisik (Meja)' : activeService === 'ebooks' ? 'Pembacaan E-Book Digital' : 'Ringkasan Seluruh Pelayanan'}</strong> &bull; {periodLabel}
          </span>
        </div>
        <div className="banner-right">
          <span>{loading ? 'Memuat data...' : `Ditemukan ${filteredTableRows.length} catatan`}</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. KARTU STATISTIK UTAMA (METRICS KPI)                   */}
      {/* ======================================================== */}
      <div className="rekap-metrics-grid">
        {/* Metric 1 */}
        <div className="rekap-kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            {activeService === 'ebooks' ? <Tablet size={22} /> : <Ticket size={22} />}
          </div>
          <div className="kpi-content">
            <span className="kpi-label">
              {activeService === 'ebooks' ? 'Total Sesi Baca E-Book' : 'Total Tiket Pesanan'}
            </span>
            <div className="kpi-value">
              {activeService === 'ebooks' ? ebooksStats.totalReads : ordersStats.totalTickets}
            </div>
            <span className="kpi-subtext">
              {activeService === 'ebooks' ? `${ebooksStats.uniqueTitlesCount} judul e-book berbeda` : `Dari ${periodOrders.length} antrean meja`}
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="rekap-kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
            <BookOpen size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">
              {activeService === 'ebooks' ? 'Kategori Terpopuler' : 'Total Eksemplar Buku'}
            </span>
            <div className="kpi-value" style={{ fontSize: activeService === 'ebooks' ? '1.35rem' : '1.8rem' }}>
              {activeService === 'ebooks' 
                ? (ebooksStats.categoriesList[0]?.category || 'Koleksi Umum')
                : ordersStats.totalBookCopies}
            </div>
            <span className="kpi-subtext">
              {activeService === 'ebooks' 
                ? `${ebooksStats.categoriesList[0]?.count || 0} pembaca (${ebooksStats.categoriesList[0]?.percent || 0}%)`
                : 'Buku fisik yang diambil dari rak'}
            </span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="rekap-kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
            <CheckCircle2 size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">
              {activeService === 'ebooks' ? 'Pembaca Rata-Rata' : 'Tingkat Selesai'}
            </span>
            <div className="kpi-value">
              {activeService === 'ebooks' 
                ? (period === 'monthly' ? (ebooksStats.totalReads / 30).toFixed(1) : ebooksStats.totalReads)
                : `${ordersStats.completedPercent}%`}
            </div>
            <span className="kpi-subtext">
              {activeService === 'ebooks' 
                ? 'Sesi baca per hari'
                : `${ordersStats.statusCounts.completed} pesanan berhasil diserahkan`}
            </span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="rekap-kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
            <Award size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">
              {activeService === 'ebooks' ? 'E-Book Paling Diminati' : 'Meja Paling Aktif'}
            </span>
            <div className="kpi-value" style={{ fontSize: '1.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={activeService === 'ebooks' ? (ebooksStats.topBooks[0]?.title || '-') : (ordersStats.topTables[0]?.table || '-')}>
              {activeService === 'ebooks' 
                ? (ebooksStats.topBooks[0]?.title || 'Belum ada data')
                : (ordersStats.topTables[0]?.table || 'Belum ada data')}
            </div>
            <span className="kpi-subtext">
              {activeService === 'ebooks' 
                ? `${ebooksStats.topBooks[0]?.count || 0} kali dibaca pengunjung`
                : `${ordersStats.topTables[0]?.count || 0} kali memesan`}
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. VISUAL CHART TREN AKTIVITAS & PERINGKAT               */}
      {/* ======================================================== */}
      <div className="rekap-analytics-grid no-print">
        {/* Kolom Kiri: Diagram Bar Tren Waktu */}
        <div className="rekap-panel-card glass-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} color="#a855f7" /> Tren Frekuensi Pelayanan
              </h2>
              <span className="panel-subtitle">
                {period === 'daily' ? 'Distribusi aktivitas per jam layanan (08:00 - 16:00)' :
                 period === 'monthly' ? `Aktivitas harian sepanjang bulan ${periodLabel}` :
                 period === 'yearly' ? `Pergerakan 12 bulan sepanjang tahun ${selectedYear}` :
                 'Perbandingan aktivitas per tahun'}
              </span>
            </div>
            <div className="chart-legend">
              {activeService !== 'ebooks' && (
                <span className="legend-item"><span className="legend-dot orders" /> Pesan Buku</span>
              )}
              {activeService !== 'books' && (
                <span className="legend-item"><span className="legend-dot ebooks" /> Baca E-Book</span>
              )}
            </div>
          </div>

          <div className="rekap-bar-chart-container">
            {chartData.length === 0 ? (
              <div className="chart-empty-state">
                <Clock size={32} color="#64748b" />
                <span>Tidak ada data aktivitas pada periode ini</span>
              </div>
            ) : (
              <div className="rekap-bars-wrap">
                {chartData.map((item, idx) => {
                  const ordersHeight = Math.round((item.orders / maxChartValue) * 100);
                  const ebooksHeight = Math.round((item.ebooks / maxChartValue) * 100);
                  const totalVal = activeService === 'books' ? item.orders : activeService === 'ebooks' ? item.ebooks : item.total;

                  return (
                    <div key={idx} className="chart-bar-column">
                      <div className="bar-track">
                        <div className="bar-tooltip">
                          <strong>{item.label}</strong>
                          {activeService !== 'ebooks' && <div>Pesan Buku: {item.orders}</div>}
                          {activeService !== 'books' && <div>Baca E-Book: {item.ebooks}</div>}
                          {activeService === 'all' && <div>Total: {item.total}</div>}
                        </div>

                        {activeService !== 'ebooks' && (
                          <div 
                            className="bar-fill orders" 
                            style={{ height: `${Math.max(item.orders > 0 ? 6 : 0, ordersHeight)}%` }} 
                          />
                        )}
                        {activeService !== 'books' && (
                          <div 
                            className="bar-fill ebooks" 
                            style={{ height: `${Math.max(item.ebooks > 0 ? 6 : 0, ebooksHeight)}%` }} 
                          />
                        )}
                      </div>
                      <span className="bar-number">{totalVal > 0 ? totalVal : ''}</span>
                      <span className="bar-label">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan: Peringkat Top Terpopuler */}
        <div className="rekap-panel-card glass-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Award size={18} color="#f59e0b" /> Paling Diminati ({periodLabel})
              </h2>
              <span className="panel-subtitle">
                {activeService === 'ebooks' ? 'Judul e-book & kategori paling banyak dibaca' : 'Buku fisik & meja paling sering memesan'}
              </span>
            </div>
          </div>

          <div className="rekap-top-lists">
            {activeService === 'ebooks' ? (
              <div>
                <h3 className="sublist-heading">Top E-Book Digital Paling Sering Dibaca</h3>
                {ebooksStats.topBooks.length === 0 ? (
                  <p className="empty-subtext">Belum ada pembaca e-book pada periode ini.</p>
                ) : (
                  <div className="top-item-list">
                    {ebooksStats.topBooks.map((b, i) => (
                      <div key={i} className="top-list-item">
                        <span className={`rank-badge ${i < 3 ? `top-${i+1}` : ''}`}>{i + 1}</span>
                        <div className="item-info">
                          <span className="item-title" title={b.title}>{b.title}</span>
                          <span className="item-category">{b.category}</span>
                        </div>
                        <span className="item-count">{b.count}x dibaca</span>
                      </div>
                    ))}
                  </div>
                )}

                <h3 className="sublist-heading" style={{ marginTop: '1.2rem' }}>Distribusi Kategori E-Book</h3>
                <div className="category-distribution-list">
                  {ebooksStats.categoriesList.map((cat, i) => (
                    <div key={i} className="cat-dist-row">
                      <div className="cat-dist-header">
                        <span>{cat.category}</span>
                        <span><strong>{cat.count}</strong> ({cat.percent}%)</span>
                      </div>
                      <div className="cat-dist-bar-track">
                        <div className="cat-dist-bar-fill" style={{ width: `${cat.percent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <h3 className="sublist-heading">Top Judul Buku Fisik Paling Sering Dipesan</h3>
                {ordersStats.topBooks.length === 0 ? (
                  <p className="empty-subtext">Belum ada pesanan buku pada periode ini.</p>
                ) : (
                  <div className="top-item-list">
                    {ordersStats.topBooks.map((b, i) => (
                      <div key={i} className="top-list-item">
                        <span className={`rank-badge ${i < 3 ? `top-${i+1}` : ''}`}>{i + 1}</span>
                        <div className="item-info">
                          <span className="item-title" title={b.title}>{b.title}</span>
                        </div>
                        <span className="item-count">{b.count}x dipesan</span>
                      </div>
                    ))}
                  </div>
                )}

                <h3 className="sublist-heading" style={{ marginTop: '1.2rem' }}>Aktivitas Meja Pemesan Teraktif</h3>
                <div className="table-activity-chips">
                  {ordersStats.topTables.map((t, i) => (
                    <div key={i} className="table-chip">
                      <span className="table-chip-name">{t.table}</span>
                      <span className="table-chip-count">{t.count} tiket</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 6. TABEL DETAIL RIWAYAT DAN PENCARIAN                    */}
      {/* ======================================================== */}
      <div className="rekap-table-card glass-panel no-print">
        <div className="table-card-header">
          <div className="header-info">
            <h2 className="table-card-title">
              Rincian Riwayat Transaksi Pelayanan
            </h2>
            <span className="table-card-sub">
              Daftar seluruh catatan pelayanan yang terekam pada {periodLabel}
            </span>
          </div>

          <div className="table-card-filters">
            {/* Pencarian */}
            <div className="table-search-wrap">
              <Search size={15} color="#94a3b8" />
              <input
                type="text"
                placeholder="Cari judul, tiket, meja..."
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
              />
              {tableSearch && (
                <button type="button" onClick={() => setTableSearch('')} className="clear-search-btn">
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filter Status Khusus Pesan Buku */}
            {activeService === 'books' && (
              <select
                className="table-filter-select"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">Semua Status</option>
                <option value="completed">Selesai Diserahkan</option>
                <option value="ready">Siap Diambil</option>
                <option value="searching">Sedang Diambil</option>
                <option value="pending">Menunggu</option>
                <option value="cancelled">Dibatalkan</option>
              </select>
            )}

            {/* Filter Kategori Khusus E-Book */}
            {activeService === 'ebooks' && (
              <select
                className="table-filter-select"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
              >
                <option value="all">Semua Kategori</option>
                {ebooksStats.categoriesList.map(c => (
                  <option key={c.category} value={c.category}>{c.category}</option>
                ))}
              </select>
            )}

            {/* Tombol Ekspor Cepat Langsung di Header Tabel */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
              <button
                type="button"
                className="rekap-quick-export-btn excel"
                onClick={() => handleExportExcel(activeService === 'all' ? 'books' : activeService)}
                title="Unduh tabel hasil filter ini ke Microsoft Excel (.xlsx)"
              >
                <FileSpreadsheet size={13} /> Unduh Excel (.xlsx)
              </button>
            </div>
          </div>
        </div>

        {/* Tabel Data */}
        <div className="rekap-table-wrapper">
          <table className="rekap-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>No</th>
                <th style={{ width: '150px' }}>Waktu Pelayanan</th>
                {activeService === 'all' && <th style={{ width: '130px' }}>Layanan</th>}
                <th style={{ width: '140px' }}>{activeService === 'ebooks' ? 'Kategori' : 'No. Tiket / Meja'}</th>
                <th>Judul Buku / E-Book</th>
                <th style={{ width: '130px', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTableRows.length === 0 ? (
                <tr>
                  <td colSpan={activeService === 'all' ? 6 : 5} className="table-empty-row">
                    <AlertCircle size={28} color="#64748b" style={{ margin: '0 auto 8px' }} />
                    <div>Tidak ada catatan transaksi yang sesuai dengan filter periode ini.</div>
                  </td>
                </tr>
              ) : (
                paginatedTableRows.map((row, idx) => {
                  const num = (tablePage - 1) * ITEMS_PER_PAGE + idx + 1;
                  const isPhysical = activeService === 'books' || row.itemType === 'physical';

                  if (isPhysical) {
                    const titles = parseOrderBookTitles(row.book_title || row.book);
                    const timeDate = row.created_at ? new Date(row.created_at).toLocaleString('id-ID', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    }) : '-';

                    return (
                      <tr key={`order-${row.id || idx}`}>
                        <td>{num}</td>
                        <td className="time-cell">{timeDate}</td>
                        {activeService === 'all' && (
                          <td><span className="service-badge physical">Buku Fisik</span></td>
                        )}
                        <td>
                          <div style={{ fontWeight: 700, color: '#ffffff' }}>{row.ticket_code}</div>
                          <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{row.table_no || row.table}</div>
                        </td>
                        <td>
                          <div className="book-titles-list">
                            {titles.map((t, ti) => (
                              <div key={ti} className="book-title-item">
                                {titles.length > 1 && <span className="title-bullet">&bull;</span>}
                                <span>{t}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`status-pill ${row.status || 'pending'}`}>
                            {row.status === 'completed' ? 'Selesai' :
                             row.status === 'ready' ? 'Siap Diambil' :
                             row.status === 'searching' ? 'Sedang Diambil' :
                             row.status === 'cancelled' ? 'Dibatalkan' : 'Menunggu'}
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  // E-Book row
                  const timeDate = row.read_at ? new Date(row.read_at).toLocaleString('id-ID', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  }) : '-';

                  return (
                    <tr key={`ebook-${row.id || idx}`}>
                      <td>{num}</td>
                      <td className="time-cell">{timeDate}</td>
                      {activeService === 'all' && (
                        <td><span className="service-badge digital">E-Book</span></td>
                      )}
                      <td>
                        <span className="ebook-category-tag">{row.category || 'Koleksi Umum'}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#ffffff' }}>{row.title}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="status-pill completed">Dibaca</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginasi Tabel */}
        {totalTablePages > 1 && (
          <div className="table-pagination">
            <span className="page-info">
              Halaman {tablePage} dari {totalTablePages} ({filteredTableRows.length} total baris)
            </span>
            <div className="page-nav-btns">
              <button
                type="button"
                className="page-btn"
                disabled={tablePage === 1}
                onClick={() => setTablePage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} /> Sebelumnya
              </button>
              <button
                type="button"
                className="page-btn"
                disabled={tablePage === totalTablePages}
                onClick={() => setTablePage(p => Math.min(totalTablePages, p + 1))}
              >
                Berikutnya <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 7. FORMAT CETAK DOKUMEN RESMI (HANYA MUNCUL SAAT PRINT) */}
      {/* ======================================================== */}
      <div className="print-report-sheet print-only">
        {/* Kop Dinas Resmi */}
        <div className="print-kop-header">
          <div className="kop-logos">
            <img src="/Lambang.png" alt="Lambang Parepare" style={{ width: '55px', height: 'auto' }} />
            <img src="/logo-perpus.png" alt="Logo Perpus" style={{ width: '55px', height: 'auto' }} onError={(e) => { e.currentTarget.src = '/logo perpus.jpg'; }} />
            <img src="/logo-ilkom.png" alt="Logo ITH" style={{ width: '55px', height: 'auto' }} onError={(e) => { e.currentTarget.src = '/logo ilkom.jpg'; }} />
          </div>
          <div className="kop-text">
            <h3>PEMERINTAH KOTA PAREPARE</h3>
            <h2>DINAS PERPUSTAKAAN DAN KEARSIPAN</h2>
            <p>Jalan Pemuda No. 1, Kota Parepare, Sulawesi Selatan &bull; Layanan Terpadu Perpustakaan Modern</p>
          </div>
        </div>

        <div className="print-divider" />

        {/* Judul Laporan */}
        <div className="print-title-section">
          <h2>LAPORAN REKAPITULASI PELAYANAN PERPUSTAKAAN</h2>
          <p className="print-period-text">
            Layanan: {activeService === 'books' ? 'Pemesanan Buku Fisik (Meja)' : activeService === 'ebooks' ? 'Pembacaan E-Book Digital' : 'Pemesanan Buku Fisik &amp; E-Book Digital'}
          </p>
          <p className="print-period-date">
            Periode: <strong>{periodLabel}</strong>
          </p>
        </div>

        {/* Ringkasan Angka Statistik Resmi */}
        <div className="print-summary-boxes">
          <div className="print-box">
            <span className="box-label">Total Pelayanan</span>
            <span className="box-val">
              {activeService === 'books' ? `${ordersStats.totalTickets} Tiket (${ordersStats.totalBookCopies} Buku)` :
               activeService === 'ebooks' ? `${ebooksStats.totalReads} Sesi Baca` :
               `${ordersStats.totalTickets + ebooksStats.totalReads} Layanan`}
            </span>
          </div>

          <div className="print-box">
            <span className="box-label">Tingkat Keberhasilan</span>
            <span className="box-val">
              {activeService === 'ebooks' ? '100% Digital' : `${ordersStats.completedPercent}% Selesai`}
            </span>
          </div>

          <div className="print-box">
            <span className="box-label">Koleksi Terfavorit</span>
            <span className="box-val" style={{ fontSize: '0.82rem' }}>
              {activeService === 'ebooks' 
                ? (ebooksStats.topBooks[0]?.title || '-')
                : (ordersStats.topBooks[0]?.title || '-')}
            </span>
          </div>
        </div>

        {/* Tabel Data Print */}
        <table className="print-table">
          <thead>
            <tr>
              <th style={{ width: '30px' }}>No</th>
              <th style={{ width: '100px' }}>Waktu</th>
              <th style={{ width: '90px' }}>Tiket / ID</th>
              <th style={{ width: '80px' }}>Meja/Kategori</th>
              <th>Judul Buku / E-Book</th>
              <th style={{ width: '70px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredTableRows.slice(0, 100).map((row, idx) => {
              const isPhysical = activeService === 'books' || row.itemType === 'physical';
              const timeDate = isPhysical 
                ? (row.created_at ? new Date(row.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-')
                : (row.read_at ? new Date(row.read_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-');

              const titleText = isPhysical 
                ? parseOrderBookTitles(row.book_title || row.book).join('; ')
                : row.title;

              return (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td>{timeDate}</td>
                  <td>{isPhysical ? row.ticket_code : 'E-BOOK'}</td>
                  <td>{isPhysical ? row.table_no : row.category}</td>
                  <td>{titleText}</td>
                  <td>{isPhysical ? (row.status === 'completed' ? 'Selesai' : row.status) : 'Dibaca'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Kolom Tanda Tangan Resmi Pengesahan */}
        <div className="print-signatures">
          <div className="sig-col">
            <p>Mengetahui,</p>
            <p><strong>Kepala Bidang Pelayanan Perpustakaan</strong></p>
            <div className="sig-space" />
            <p className="sig-name">_____________________________</p>
            <p className="sig-nip">NIP. ...................................................</p>
          </div>

          <div className="sig-col">
            <p>Parepare, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p><strong>Petugas / Staf Pengelola Layanan</strong></p>
            <div className="sig-space" />
            <p className="sig-name">_____________________________</p>
            <p className="sig-nip">NIP. ...................................................</p>
          </div>
        </div>
      </div>
    </div>
  );
}
