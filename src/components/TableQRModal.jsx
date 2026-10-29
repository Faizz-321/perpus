import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { 
  QrCode, Printer, X, Download, Copy, ExternalLink, 
  Sparkles, Check, Globe, RefreshCw, Layers, ChevronLeft, ChevronRight, CheckCircle2
} from 'lucide-react';
import { ALL_LIBRARY_TABLES, generateTableOrderUrl } from '../utils/tableUtils';

// Helper memuat gambar ke Canvas secara aman
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Helper menggambar persegi dengan sudut membulat (Rounded Rectangle)
function drawRoundRect(ctx, x, y, width, height, radius, fill = true, stroke = false) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

// Helper membuat gambar stiker lengkap (Logo + No. Meja + Barcode + Petunjuk + Link)
async function generateFullStickerDataUrl(table, qrDataUrl, baseUrl) {
  const canvas = document.createElement('canvas');
  const width = 800;
  const height = 1080;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // 1. Latar Belakang Kartu Putih Bersih
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // 2. Garis Batas Gunting / Potong Stiker (Dashed Border)
  ctx.save();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 8]);
  drawRoundRect(ctx, 24, 24, width - 48, height - 48, 22, false, true);
  ctx.restore();

  // 3. Load 3 Logo Resmi & Gambar QR
  const [logoParepare, logoPerpus, logoIlkom, qrImage] = await Promise.all([
    loadImage('/Lambang.png'),
    loadImage('/logo-perpus.png').then(img => img || loadImage('/logo perpus.jpg')),
    loadImage('/logo-ilkom.png').then(img => img || loadImage('/logo ilkom.jpg')),
    loadImage(qrDataUrl)
  ]);

  // 4. Render Header 3 Logo Berjajar Rapi
  const logoH = 54;
  const gap = 16;
  const w1 = logoParepare ? (logoParepare.width * (logoH / logoParepare.height)) : 54;
  const w2 = logoPerpus ? (logoPerpus.width * (logoH / logoPerpus.height)) : 54;
  const w3 = logoIlkom ? (logoIlkom.width * (logoH / logoIlkom.height)) : 54;
  
  const totalLogosWidth = w1 + gap + 1 + gap + w2 + gap + 1 + gap + w3;
  let currentX = (width - totalLogosWidth) / 2;
  const logoY = 56;

  if (logoParepare) {
    ctx.drawImage(logoParepare, currentX, logoY, w1, logoH);
  }
  currentX += w1 + gap;

  // Garis vertikal 1
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(currentX, logoY + 6);
  ctx.lineTo(currentX, logoY + logoH - 6);
  ctx.stroke();
  currentX += 1 + gap;

  if (logoPerpus) {
    ctx.drawImage(logoPerpus, currentX, logoY, w2, logoH);
  }
  currentX += w2 + gap;

  // Garis vertikal 2
  ctx.beginPath();
  ctx.moveTo(currentX, logoY + 6);
  ctx.lineTo(currentX, logoY + logoH - 6);
  ctx.stroke();
  currentX += 1 + gap;

  if (logoIlkom) {
    ctx.drawImage(logoIlkom, currentX, logoY, w3, logoH);
  }

  // 5. Teks Judul Instansi Resmi
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px "Inter", -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('PERPUSTAKAAN UMUM KOTA PAREPARE', width / 2, 130);

  ctx.fillStyle = '#059669';
  ctx.font = 'bold 13px "Inter", -apple-system, sans-serif';
  ctx.fillText('SISTEM PEMESANAN BUKU DIGITAL RESMI', width / 2, 160);

  // Garis Horisontal Pemisah Header
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(60, 188);
  ctx.lineTo(width - 60, 188);
  ctx.stroke();

  // 6. Badge Nomor Meja (Contoh: MEJA 01)
  const tableNum = table.replace(/\D/g, '').padStart(2, '0');
  const badgeW = 300;
  const badgeH = 56;
  const badgeX = (width - badgeW) / 2;
  const badgeY = 206;

  ctx.fillStyle = '#0f172a';
  drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 12, true, false);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 32px "Inter", -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`MEJA ${tableNum}`, width / 2, badgeY + (badgeH / 2));

  // 7. Kotak Bingkai QR Code
  const qrBoxSize = 470;
  const qrBoxX = (width - qrBoxSize) / 2;
  const qrBoxY = 284;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  drawRoundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 20, true, true);

  // Gambar QR Code Utama
  if (qrImage) {
    const qrImgSize = 430;
    const qrImgX = (width - qrImgSize) / 2;
    const qrImgY = qrBoxY + (qrBoxSize - qrImgSize) / 2;
    ctx.drawImage(qrImage, qrImgX, qrImgY, qrImgSize, qrImgSize);
  }

  // 8. Teks Petunjuk Scan Pengunjung
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 19px "Inter", -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Arahkan kamera HP ke barcode ini untuk memesan buku.', width / 2, 780);

  ctx.fillStyle = '#64748b';
  ctx.font = '600 15px "Inter", -apple-system, sans-serif';
  ctx.fillText('Nomor meja akan otomatis terisi langsung di formulir pesanan!', width / 2, 810);

  // 9. Kotak Tautan URL Meja
  const orderUrl = generateTableOrderUrl(baseUrl, table);
  const urlBoxW = 680;
  const urlBoxH = 42;
  const urlBoxX = (width - urlBoxW) / 2;
  const urlBoxY = 846;

  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  drawRoundRect(ctx, urlBoxX, urlBoxY, urlBoxW, urlBoxH, 8, true, true);

  ctx.fillStyle = '#475569';
  ctx.font = '600 14px "Courier New", monospace, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(orderUrl, width / 2, urlBoxY + (urlBoxH / 2));

  // 10. Footer Resmi
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 13px "Inter", -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('DINAS PERPUSTAKAAN & KEARSIPAN KOTA PAREPARE', width / 2, 920);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'italic 12px "Inter", -apple-system, sans-serif';
  ctx.fillText('Gunting mengikuti garis putus-putus untuk ditempelkan di atas meja baca', width / 2, 946);

  return canvas.toDataURL('image/png');
}

export default function TableQRModal({ isOpen, onClose }) {
  const [baseUrl, setBaseUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'http://localhost:5173';
  });

  const [selectedTableFilter, setSelectedTableFilter] = useState('ALL');
  const [qrCodeDataUrls, setQrCodeDataUrls] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedTable, setCopiedTable] = useState(null);
  const [downloadingTable, setDownloadingTable] = useState(null);

  // Deteksi jenis tunnel / URL yang sedang aktif
  const tunnelBadge = useMemo(() => {
    const url = (baseUrl || '').toLowerCase();
    if (url.includes('trycloudflare.com')) {
      return { label: 'Cloudflare Tunnel Aktif', type: 'cloudflare' };
    }
    if (url.includes('pinggy')) {
      return { label: 'Pinggy Tunnel Aktif', type: 'pinggy' };
    }
    if (url.includes('ngrok')) {
      return { label: 'Ngrok Tunnel Aktif', type: 'ngrok' };
    }
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      return { label: 'Jaringan Lokal (Localhost)', type: 'local' };
    }
    return { label: 'Domain Kustom', type: 'custom' };
  }, [baseUrl]);

  // Filter daftar meja yang ditampilkan
  const tablesToRender = useMemo(() => {
    if (selectedTableFilter === 'ALL') {
      return ALL_LIBRARY_TABLES;
    }
    return [selectedTableFilter];
  }, [selectedTableFilter]);

  // Index meja saat ini jika mode single meja
  const currentTableIndex = useMemo(() => {
    if (selectedTableFilter === 'ALL') return -1;
    return ALL_LIBRARY_TABLES.indexOf(selectedTableFilter);
  }, [selectedTableFilter]);

  const handlePrevTable = () => {
    if (currentTableIndex > 0) {
      setSelectedTableFilter(ALL_LIBRARY_TABLES[currentTableIndex - 1]);
    } else {
      setSelectedTableFilter(ALL_LIBRARY_TABLES[ALL_LIBRARY_TABLES.length - 1]);
    }
  };

  const handleNextTable = () => {
    if (currentTableIndex < ALL_LIBRARY_TABLES.length - 1) {
      setSelectedTableFilter(ALL_LIBRARY_TABLES[currentTableIndex + 1]);
    } else {
      setSelectedTableFilter(ALL_LIBRARY_TABLES[0]);
    }
  };

  // Generate QR Code untuk setiap meja secara asinkron
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsGenerating(true);

    async function generateAllQrs() {
      const results = {};
      for (const table of ALL_LIBRARY_TABLES) {
        const orderUrl = generateTableOrderUrl(baseUrl, table);
        try {
          const dataUrl = await QRCode.toDataURL(orderUrl, {
            width: 360,
            margin: 1,
            color: {
              dark: '#0f172a',
              light: '#ffffff',
            },
            errorCorrectionLevel: 'M',
          });
          results[table] = dataUrl;
        } catch (err) {
          console.warn(`Gagal membuat QR untuk ${table}:`, err);
        }
      }

      if (isMounted) {
        setQrCodeDataUrls(results);
        setIsGenerating(false);
      }
    }

    generateAllQrs();

    return () => {
      isMounted = false;
    };
  }, [isOpen, baseUrl]);

  // Salin Link Meja
  const handleCopyLink = (table) => {
    const orderUrl = generateTableOrderUrl(baseUrl, table);
    navigator.clipboard.writeText(orderUrl);
    setCopiedTable(table);
    setTimeout(() => setCopiedTable(null), 2500);
  };

  // Unduh STIKER LENGKAP Satuan (Logo + No. Meja + Barcode + Petunjuk)
  const handleDownloadFullSticker = async (table) => {
    const dataUrl = qrCodeDataUrls[table];
    if (!dataUrl) return;

    setDownloadingTable(table);
    try {
      const fullStickerDataUrl = await generateFullStickerDataUrl(table, dataUrl, baseUrl);
      
      const link = document.createElement('a');
      link.href = fullStickerDataUrl;
      const tableClean = table.replace(/\s+/g, '_');
      link.download = `Stiker_Barcode_${tableClean}_Perpus_Parepare.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Gagal membuat stiker lengkap, fallback ke QR saja:', err);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `QR_Code_${table.replace(/\s+/g, '_')}_Perpus_Parepare.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloadingTable(null);
    }
  };

  // Cetak Stiker Meja (Print)
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="table-qr-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="table-qr-modal-dialog">
        {/* Header Modal Ringkas & Modern */}
        <div className="table-qr-modal-header no-print">
          <div className="table-qr-header-title-box">
            <div className="table-qr-header-icon">
              <QrCode size={22} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 className="table-qr-title">
                  Generator & Cetak Stiker Barcode Meja
                </h2>
                <span className="table-qr-count-badge">24 Meja Resmi</span>
              </div>
              <p className="table-qr-subtitle">
                Arahkan kamera HP ke stiker meja agar nomor meja otomatis terisi saat pengunjung memesan buku
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              type="button" 
              className="table-qr-btn-print"
              onClick={handlePrint}
              title="Cetak stiker barcode meja pada kertas A4"
            >
              <Printer size={16} />
              <span>Cetak Stiker (Print A4)</span>
            </button>

            <button 
              type="button" 
              onClick={onClose} 
              className="table-qr-close-btn"
              title="Tutup dialog"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Toolbar Pengaturan URL Ringkas */}
        <div className="table-qr-toolbar no-print">
          <div className="table-qr-url-row">
            <div className="table-qr-url-label">
              <Globe size={15} color="#10b981" />
              <span>Tautan Domain Aktif:</span>
              <span className={`table-qr-tunnel-badge ${tunnelBadge.type}`}>
                {tunnelBadge.label}
              </span>
            </div>

            <div className="table-qr-url-input-wrap">
              <input 
                type="text" 
                className="table-qr-url-input" 
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="Contoh: https://xxx.trycloudflare.com atau http://localhost:5173"
              />
              <button 
                type="button" 
                className="table-qr-btn-reset-url"
                onClick={() => setBaseUrl(window.location.origin)}
                title="Gunakan alamat website browser saat ini"
              >
                <RefreshCw size={13} />
                <span>Reset Asal</span>
              </button>
            </div>
          </div>

          {/* Baris Quick Meja Selector (Horizontal Pills) Agar Langsung Kelihatan di Atas */}
          <div className="table-qr-pills-container">
            <div className="table-qr-pills-label">
              <Layers size={14} color="#38bdf8" />
              <span>Pilih Tampilan:</span>
            </div>

            <div className="table-qr-pills-scroll">
              <button
                type="button"
                className={`table-qr-pill ${selectedTableFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setSelectedTableFilter('ALL')}
              >
                Semua Meja (1 - 24)
              </button>

              {ALL_LIBRARY_TABLES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`table-qr-pill ${selectedTableFilter === t ? 'active' : ''}`}
                  onClick={() => setSelectedTableFilter(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Banner Navigasi saat 1 Meja Dipilih */}
        {selectedTableFilter !== 'ALL' && (
          <div className="table-qr-single-nav-banner no-print">
            <button 
              type="button" 
              className="table-qr-nav-arrow" 
              onClick={handlePrevTable}
              title="Meja Sebelumnya"
            >
              <ChevronLeft size={16} /> <span>Sebelumnya</span>
            </button>

            <div className="table-qr-nav-info">
              <span>Menampilkan: <strong>{selectedTableFilter}</strong></span>
              <button 
                type="button" 
                className="table-qr-btn-show-all" 
                onClick={() => setSelectedTableFilter('ALL')}
              >
                Tampilkan Semua Meja
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="table-qr-nav-arrow"
                onClick={() => handleDownloadFullSticker(selectedTableFilter)}
                disabled={downloadingTable === selectedTableFilter}
                style={{ background: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981', color: '#34d399' }}
                title="Unduh file gambar stiker utuh (Logo, No. Meja, Barcode, Petunjuk)"
              >
                {downloadingTable === selectedTableFilter ? (
                  <RefreshCw size={14} className="spin-animation" />
                ) : (
                  <Download size={14} />
                )}
                <span>{downloadingTable === selectedTableFilter ? 'Membuat...' : `Unduh Stiker ${selectedTableFilter}`}</span>
              </button>

              <button 
                type="button" 
                className="table-qr-nav-arrow" 
                onClick={handleNextTable}
                title="Meja Selanjutnya"
              >
                <span>Selanjutnya</span> <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Area Konten Stiker QR Meja */}
        <div className={`table-qr-scroll-content ${selectedTableFilter !== 'ALL' ? 'single-view' : ''}`}>
          {isGenerating && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              <RefreshCw size={26} className="spin-animation" style={{ marginBottom: '8px', color: '#10b981' }} />
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1' }}>Sedang membuat QR Code berkualitas tinggi untuk semua meja...</p>
            </div>
          )}

          <div className={`table-qr-grid-container ${selectedTableFilter !== 'ALL' ? 'single-grid' : ''}`}>
            {tablesToRender.map((table) => {
              const dataUrl = qrCodeDataUrls[table];
              const tableNum = table.replace(/\D/g, '').padStart(2, '0');
              const orderUrl = generateTableOrderUrl(baseUrl, table);
              const isDownloadingThis = downloadingTable === table;

              return (
                <div key={table} className="table-qr-card-item">
                  {/* Bagian Atas: Badge Meja & Logo Resmi */}
                  <div className="table-qr-card-header">
                    <div className="table-qr-logos">
                      <img src="/Lambang.png" alt="Logo Parepare" title="Kota Parepare" />
                      <div className="table-qr-divider" />
                      <img src="/logo-perpus.png" alt="Logo Perpustakaan" onError={(e) => { e.currentTarget.src = '/logo perpus.jpg'; }} />
                      <div className="table-qr-divider" />
                      <img src="/logo-ilkom.png" alt="Logo Ilkom ITH" onError={(e) => { e.currentTarget.src = '/logo ilkom.jpg'; }} />
                    </div>
                    <div className="table-qr-agency-title">PERPUSTAKAAN UMUM KOTA PAREPARE</div>
                    <div className="table-qr-agency-sub">SISTEM PEMESANAN BUKU DIGITAL RESMI</div>
                  </div>

                  {/* Badge Nomor Meja Langsung Kelihatan di Atas */}
                  <div className="table-qr-number-badge">
                    MEJA {tableNum}
                  </div>

                  {/* Bagian Tengah: Gambar QR Code / Barcode Utama */}
                  <div className="table-qr-image-wrapper">
                    {dataUrl ? (
                      <img src={dataUrl} alt={`QR Code ${table}`} className="table-qr-img" />
                    ) : (
                      <div className="table-qr-placeholder">Memuat QR...</div>
                    )}
                  </div>

                  {/* Nomor Meja & Petunjuk */}
                  <div className="table-qr-card-body">
                    <p className="table-qr-scan-instruction">
                      Arahkan kamera HP ke barcode ini untuk memesan buku. Nomor meja otomatis terisi!
                    </p>
                    <div className="table-qr-url-text" title={orderUrl}>
                      {orderUrl}
                    </div>
                  </div>

                  {/* Aksi Cepat Satuan (Hanya tampil di layar, tidak ikut tercetak) */}
                  <div className="table-qr-card-actions no-print">
                    <button 
                      type="button" 
                      className="btn-qr-action btn-copy"
                      onClick={() => handleCopyLink(table)}
                      title="Salin tautan meja ini"
                    >
                      {copiedTable === table ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                      <span>{copiedTable === table ? 'Tersalin' : 'Salin Link'}</span>
                    </button>
                    
                    {/* Tombol Unduh Stiker Lengkap: Mengunduh gambar stiker utuh (Logo, No. Meja, Barcode, Petunjuk) */}
                    <button 
                      type="button" 
                      className="btn-qr-action btn-download"
                      onClick={() => handleDownloadFullSticker(table)}
                      disabled={isDownloadingThis}
                      title="Unduh stiker lengkap utuh (Logo, Nomor Meja, Barcode, Petunjuk, & URL)"
                    >
                      {isDownloadingThis ? (
                        <RefreshCw size={13} className="spin-animation" />
                      ) : (
                        <Download size={13} />
                      )}
                      <span>{isDownloadingThis ? 'Memproses...' : 'Unduh Stiker Lengkap'}</span>
                    </button>

                    <a 
                      href={orderUrl}
                      target="_blank" 
                      rel="noreferrer"
                      className="btn-qr-action btn-test"
                      title="Tes buka tautan pesanan meja ini di tab baru"
                    >
                      <ExternalLink size={13} />
                      <span>Tes Buka</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Petunjuk */}
        <div className="table-qr-modal-footer no-print">
          <div style={{ fontSize: '0.82rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#10b981', fontWeight: '700' }}>Siap Cetak:</span>
            <span>Tombol <strong>Unduh Stiker Lengkap</strong> akan mengunduh gambar utuh kartu meja (dengan 3 Logo resmi, Nomor Meja, Barcode, dan Petunjuk).</span>
          </div>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '0.45rem 1.2rem', fontSize: '0.85rem' }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
