import React, { useState, useEffect, useMemo, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  QrCode, Printer, X, Download, Copy, ExternalLink, 
  Sparkles, Check, Globe, RefreshCw, Layers 
} from 'lucide-react';
import { ALL_LIBRARY_TABLES, generateTableOrderUrl } from '../utils/tableUtils';

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

  // Filter daftar meja yang ditampilkan
  const tablesToRender = useMemo(() => {
    if (selectedTableFilter === 'ALL') {
      return ALL_LIBRARY_TABLES;
    }
    return [selectedTableFilter];
  }, [selectedTableFilter]);

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
            width: 320,
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

  // Unduh Gambar QR Satuan
  const handleDownloadQr = (table) => {
    const dataUrl = qrCodeDataUrls[table];
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `QR_Code_${table.replace(/\s+/g, '_')}_Perpus_Parepare.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Cetak Stiker Meja (Print)
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="table-qr-modal-overlay">
      <div className="table-qr-modal-dialog">
        {/* Header Modal */}
        <div className="table-qr-modal-header no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ 
              width: '42px', height: '42px', borderRadius: '12px', 
              background: 'linear-gradient(135deg, #10b981, #059669)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
            }}>
              <QrCode size={24} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#ffffff' }}>
                Generator & Cetak Stiker Barcode Meja
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Tempelkan QR Code ini di setiap meja agar nomor meja otomatis terisi saat pengunjung scan dari HP
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="table-qr-close-btn"
            title="Tutup dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Bar Pengaturan URL & Filter (Disembunyikan saat cetak) */}
        <div className="table-qr-toolbar no-print">
          <div className="table-qr-field" style={{ flex: '1 1 320px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '4px' }}>
              <Globe size={14} color="#10b981" /> Tautan Website / Domain Aktif:
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                className="form-control" 
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="Contoh: https://xxx.run.pinggy-free.link atau http://localhost:5173"
                style={{ fontSize: '0.85rem', padding: '0.45rem 0.75rem' }}
              />
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => setBaseUrl(window.location.origin)}
                title="Gunakan alamat website saat ini"
                style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
              >
                <RefreshCw size={13} /> Reset URL
              </button>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>
              💡 Masukkan alamat publik (misal link Pinggy / Cloudflare) jika stiker akan di-scan pengunjung dari HP dengan internet luar.
            </p>
          </div>

          <div className="table-qr-field" style={{ flex: '0 1 200px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '4px' }}>
              <Layers size={14} color="#38bdf8" /> Meja yang Dicetak:
            </label>
            <select 
              className="form-control"
              value={selectedTableFilter}
              onChange={(e) => setSelectedTableFilter(e.target.value)}
              style={{ fontSize: '0.85rem', padding: '0.45rem 0.75rem' }}
            >
              <option value="ALL">Semua Meja (1 - 24)</option>
              {ALL_LIBRARY_TABLES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={handlePrint}
              style={{ 
                background: 'linear-gradient(135deg, #10b981, #059669)', 
                border: 'none', 
                color: '#fff', 
                fontWeight: '700',
                padding: '0.55rem 1.2rem',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
            >
              <Printer size={16} /> Cetak Stiker Meja (Print)
            </button>
          </div>
        </div>

        {/* Area Konten Stiker QR Meja */}
        <div className="table-qr-scroll-content">
          {isGenerating && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              <RefreshCw size={24} className="spin-animation" style={{ marginBottom: '8px' }} />
              <p style={{ margin: 0 }}>Sedang membuat QR Code berkualitas tinggi untuk semua meja...</p>
            </div>
          )}

          <div className="table-qr-grid-container">
            {tablesToRender.map((table) => {
              const dataUrl = qrCodeDataUrls[table];
              const tableNum = table.replace(/\D/g, '').padStart(2, '0');
              const orderUrl = generateTableOrderUrl(baseUrl, table);

              return (
                <div key={table} className="table-qr-card-item">
                  {/* Bagian Atas: Branding Resmi */}
                  <div className="table-qr-card-header">
                    <div className="table-qr-logos">
                      <img src="/Lambang.png" alt="Logo Kota Parepare" />
                      <div className="table-qr-divider" />
                      <img src="/logo-perpus.png" alt="Logo Perpustakaan" onError={(e) => { e.currentTarget.src = '/logo perpus.jpg'; }} />
                      <div className="table-qr-divider" />
                      <img src="/logo-ilkom.png" alt="Logo Ilkom ITH" onError={(e) => { e.currentTarget.src = '/logo ilkom.jpg'; }} />
                    </div>
                    <div className="table-qr-agency-title">PERPUSTAKAAN UMUM KOTA PAREPARE</div>
                    <div className="table-qr-agency-sub">SISTEM PEMESANAN BUKU DIGITAL</div>
                  </div>

                  {/* Bagian Tengah: Gambar QR Code */}
                  <div className="table-qr-image-wrapper">
                    {dataUrl ? (
                      <img src={dataUrl} alt={`QR Code ${table}`} className="table-qr-img" />
                    ) : (
                      <div className="table-qr-placeholder">Memuat QR...</div>
                    )}
                  </div>

                  {/* Nomor Meja & Petunjuk */}
                  <div className="table-qr-card-body">
                    <div className="table-qr-number-badge">
                      MEJA {tableNum}
                    </div>
                    <p className="table-qr-scan-instruction">
                      Arahkan kamera HP ke barcode ini untuk memesan buku. Nomor meja otomatis terisi!
                    </p>
                    <div className="table-qr-url-text">
                      {orderUrl}
                    </div>
                  </div>

                  {/* Aksi Cepat Satuan (Hanya tampil di layar, tidak ikut tercetak) */}
                  <div className="table-qr-card-actions no-print">
                    <button 
                      type="button" 
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleCopyLink(table)}
                      title="Salin tautan meja ini"
                    >
                      {copiedTable === table ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                      {copiedTable === table ? 'Tersalin' : 'Salin'}
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleDownloadQr(table)}
                      title="Unduh file gambar QR Code"
                    >
                      <Download size={13} /> Unduh
                    </button>
                    <a 
                      href={orderUrl}
                      target="_blank" 
                      rel="noreferrer"
                      className="btn btn-sm btn-secondary"
                      title="Buka tes di tab baru"
                    >
                      <ExternalLink size={13} /> Tes
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Petunjuk */}
        <div className="table-qr-modal-footer no-print">
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            <span style={{ color: '#10b981', fontWeight: '700' }}>✨ Siap Cetak:</span> Gunakan kertas stiker A4 atau potong sesuai garis kartu untuk ditempelkan di atas meja baca perpustakaan.
          </div>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '0.45rem 1.1rem', fontSize: '0.85rem' }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
