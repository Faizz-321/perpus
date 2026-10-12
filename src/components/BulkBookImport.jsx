import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText, ImageIcon, Upload, Sparkles, ListOrdered, CheckCircle2, TriangleAlert, CircleX,
  Save, ArrowLeft, Download, BookPlus, Cpu, X, Repeat, Info, LoaderCircle, Puzzle, Hand,
  ScanText, Filter, Library, Trash2, Check, ChevronRight
} from 'lucide-react';
import { useModal } from '../context/ModalContext';
import { extractBookList, renderCoverPages } from '../utils/bookImport/pdfReader';
import { readAllCovers, getAiStatus } from '../utils/bookImport/coverReader';
import { matchBooksToCovers, matchByOrder, normalizeText, CONFIDENCE } from '../utils/bookImport/coverMatcher';
import './BulkBookImport.css';

const IMPORT_STEPS = [
  { key: 'upload', num: 1, label: 'Unggah PDF', short: 'Unggah' },
  { key: 'processing', num: 2, label: 'Pindai & AI', short: 'Pindai' },
  { key: 'review', num: 3, label: 'Periksa Pasangan', short: 'Periksa' },
  { key: 'done', num: 4, label: 'Katalog Siap', short: 'Katalog' }
];

const CONF_META = {
  [CONFIDENCE.HIGH]: { label: 'Yakin', cls: 'high', Icon: CheckCircle2 },
  [CONFIDENCE.ELIMINATION]: { label: 'Hasil eliminasi', cls: 'elim', Icon: Puzzle },
  [CONFIDENCE.MEDIUM]: { label: 'Ragu, mohon dicek', cls: 'medium', Icon: TriangleAlert },
  [CONFIDENCE.LOW]: { label: 'Pilih manual', cls: 'low', Icon: CircleX },
  [CONFIDENCE.ORDER]: { label: 'Sesuai urutan', cls: 'order', Icon: ListOrdered },
  [CONFIDENCE.MANUAL]: { label: 'Dipilih staf', cls: 'manual', Icon: Hand },
  [CONFIDENCE.NONE]: { label: 'Tanpa sampul', cls: 'none', Icon: ImageIcon }
};

const NEEDS_CHECK = new Set([CONFIDENCE.MEDIUM, CONFIDENCE.LOW, CONFIDENCE.NONE]);
const SAVE_CHUNK = 8;

function DropZone({ id, icon: Icon, title, hint, accept, multiple, files, onFiles, accent, badge }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const list = files ? Array.from(files) : [];

  return (
    <div
      id={id}
      className={`bbi-drop ${dragOver ? 'is-over' : ''} ${list.length ? 'has-file' : ''} accent-${accent}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
      }}
      role="button"
      tabIndex={0}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={(e) => e.target.files?.length && onFiles(e.target.files)}
      />
      {badge && <span className="bbi-drop-badge">{badge}</span>}
      <div className="bbi-drop-icon">
        <Icon size={32} />
      </div>
      <div className="bbi-drop-title">{title}</div>
      {list.length === 0 ? (
        <div className="bbi-drop-hint">{hint}</div>
      ) : (
        <div className="bbi-drop-files">
          {list.slice(0, 3).map((f) => (
            <span key={f.name} className="bbi-file-chip">
              <CheckCircle2 size={14} color="#10b981" /> {f.name} <small>({(f.size / 1024).toFixed(0)} KB)</small>
            </span>
          ))}
          {list.length > 3 && <span className="bbi-file-chip">+{list.length - 3} file lain</span>}
          <span className="bbi-drop-change">Klik untuk ganti file</span>
        </div>
      )}
    </div>
  );
}

function BulkBookImport() {
  const { showAlert, showConfirm } = useModal();

  const [step, setStep] = useState('upload'); // upload | processing | review | done
  const [listFile, setListFile] = useState(null);
  const [coverFiles, setCoverFiles] = useState(null);
  const [mode, setMode] = useState('smart'); // smart | order
  const [engine, setEngine] = useState('tesseract'); // tesseract | gemini
  const [aiStatus, setAiStatus] = useState({ gemini: false });
  const [defaults, setDefaults] = useState({ category: 'Koleksi Umum', shelf_location: 'Rak Koleksi Utama', stock: 1 });
  const [showFormat, setShowFormat] = useState(false);

  const [progress, setProgress] = useState({ percent: 0, stage: '', detail: '' });
  const [rows, setRows] = useState([]);
  const [covers, setCovers] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [onlyNeedsCheck, setOnlyNeedsCheck] = useState(false);
  const [pickerRowKey, setPickerRowKey] = useState(null);
  const [expandedOcr, setExpandedOcr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);

  useEffect(() => {
    getAiStatus().then((s) => {
      setAiStatus(s);
      if (s.gemini) setEngine('gemini');
    });
  }, []);

  const coverByIndex = useMemo(() => {
    const m = new Map();
    covers.forEach((c) => m.set(c.index, c));
    return m;
  }, [covers]);

  const stats = useMemo(() => {
    const s = { total: rows.length, included: 0, high: 0, check: 0, exists: 0 };
    rows.forEach((r) => {
      if (r.include) s.included++;
      if ([CONFIDENCE.HIGH, CONFIDENCE.ELIMINATION, CONFIDENCE.ORDER, CONFIDENCE.MANUAL].includes(r.confidence)) s.high++;
      if (NEEDS_CHECK.has(r.confidence)) s.check++;
      if (r.exists) s.exists++;
    });
    return s;
  }, [rows]);

  const unusedCovers = useMemo(() => {
    const used = new Set(rows.map((r) => r.coverIndex).filter((v) => v !== null));
    return covers.filter((c) => !used.has(c.index));
  }, [rows, covers]);

  const visibleRows = onlyNeedsCheck ? rows.filter((r) => NEEDS_CHECK.has(r.confidence) || r.exists) : rows;

  // ------------------------------------------------------------
  // PROSES: baca PDF → render sampul → baca tulisan → cocokkan
  // ------------------------------------------------------------
  const handleProcess = async () => {
    if (!listFile) {
      showAlert('Silakan unggah PDF Daftar Judul & Penulis terlebih dahulu.', { type: 'warning', title: 'File Belum Lengkap' });
      return;
    }
    if (!coverFiles || coverFiles.length === 0) {
      showAlert('Silakan unggah PDF Sampul terlebih dahulu.', { type: 'warning', title: 'File Belum Lengkap' });
      return;
    }

    setStep('processing');
    setWarnings([]);
    const warn = [];

    try {
      // 1. Daftar judul
      setProgress({ percent: 5, stage: 'Membaca PDF daftar judul & penulis...', detail: listFile.name });
      const list = await extractBookList(listFile);
      warn.push(...list.warnings);

      // 2. Sampul jadi gambar
      setProgress({ percent: 15, stage: 'Mengubah halaman sampul menjadi gambar...', detail: '' });
      const rendered = await renderCoverPages(coverFiles, (done) =>
        setProgress((p) => ({ ...p, percent: Math.min(35, 15 + done), detail: `${done} sampul diproses` }))
      );
      if (rendered.length === 0) throw new Error('Tidak ada halaman sampul yang bisa dibaca dari file yang diunggah.');

      if (rendered.length !== list.rows.length) {
        warn.unshift(
          `Jumlah tidak sama: ${list.rows.length} judul, tetapi ${rendered.length} sampul. ` +
            (rendered.length < list.rows.length ? 'Beberapa buku akan tanpa sampul.' : 'Ada sampul yang tidak terpakai.')
        );
      }

      // 3. Baca tulisan sampul (khusus mode cerdas)
      let coverData = rendered.map((c) => ({ ...c, ocrText: '' }));
      let matches;
      if (mode === 'smart') {
        const ocrResults = await readAllCovers(rendered, list.rows, engine, ({ done, total, stage }) =>
          setProgress({
            percent: 35 + Math.round((done / Math.max(1, total)) * 58),
            stage,
            detail: engine === 'gemini' ? 'Mesin: Gemini AI Vision' : 'Mesin: Tesseract OCR (di browser)'
          })
        );
        const ocrMap = new Map(ocrResults.map((r) => [r.index, r]));
        coverData = rendered.map((c) => ({ ...c, ocrText: ocrMap.get(c.index)?.ocrText || '', engine: ocrMap.get(c.index)?.engine }));

        setProgress({ percent: 95, stage: 'Mencocokkan sampul dengan judul...', detail: 'Hungarian Algorithm' });
        matches = matchBooksToCovers(list.rows, coverData);
      } else {
        matches = matchByOrder(list.rows, coverData);
      }

      // 4. Cek duplikat dengan katalog
      let existing = new Set();
      try {
        const res = await fetch('/api/books');
        if (res.ok) {
          const books = await res.json();
          existing = new Set(books.map((b) => normalizeText(b.title)));
        }
      } catch {
        warn.push('Tidak bisa mengecek duplikat karena server katalog tidak merespons.');
      }

      const newRows = list.rows.map((r, i) => {
        const exists = existing.has(normalizeText(r.title));
        return {
          key: `row-${i}`,
          no: i + 1,
          ...r,
          include: !exists,
          exists,
          coverIndex: matches[i].coverIndex,
          score: matches[i].score,
          confidence: matches[i].confidence
        };
      });

      setCovers(coverData);
      setRows(newRows);
      setWarnings(warn);
      setOnlyNeedsCheck(false);
      setProgress({ percent: 100, stage: 'Selesai!', detail: '' });
      setStep('review');
    } catch (err) {
      console.error('Gagal memproses import:', err);
      setStep('upload');
      showAlert(err.message || 'Terjadi kesalahan saat memproses file.', { type: 'danger', title: 'Gagal Memproses' });
    }
  };

  // ------------------------------------------------------------
  // EDIT HASIL
  // ------------------------------------------------------------
  const updateRow = (key, patch) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  // Pasang sampul ke buku; jika sampul sudah dipakai buku lain → tukar
  const assignCover = (rowKey, coverIndex) => {
    setRows((prev) => {
      const target = prev.find((r) => r.key === rowKey);
      if (!target) return prev;
      const oldCover = target.coverIndex;
      return prev.map((r) => {
        if (r.key === rowKey) {
          return { ...r, coverIndex, confidence: coverIndex === null ? CONFIDENCE.NONE : CONFIDENCE.MANUAL };
        }
        if (coverIndex !== null && r.coverIndex === coverIndex) {
          return { ...r, coverIndex: oldCover, confidence: oldCover === null ? CONFIDENCE.NONE : CONFIDENCE.MANUAL };
        }
        return r;
      });
    });
    setPickerRowKey(null);
  };

  const handleReset = async () => {
    if (step === 'review') {
      const ok = await showConfirm('Hasil pencocokan saat ini akan dibuang. Ulangi dari awal?', {
        title: 'Ulangi Import',
        confirmText: 'Ya, Ulangi',
        cancelText: 'Batal',
        type: 'warning'
      });
      if (!ok) return;
    }
    setStep('upload');
    setRows([]);
    setCovers([]);
    setWarnings([]);
    setSaveResult(null);
  };

  const handleStartOver = () => {
    setListFile(null);
    setCoverFiles(null);
    setRows([]);
    setCovers([]);
    setWarnings([]);
    setSaveResult(null);
    setStep('upload');
  };

  // ------------------------------------------------------------
  // SIMPAN KE DATABASE
  // ------------------------------------------------------------
  const handleSave = async () => {
    const toSave = rows.filter((r) => r.include);
    if (toSave.length === 0) {
      showAlert('Tidak ada buku yang dicentang untuk disimpan.', { type: 'warning', title: 'Belum Ada Pilihan' });
      return;
    }
    const empty = toSave.find((r) => !r.title.trim());
    if (empty) {
      showAlert(`Buku nomor ${empty.no} belum memiliki judul.`, { type: 'warning', title: 'Judul Kosong' });
      return;
    }

    const unchecked = toSave.filter((r) => NEEDS_CHECK.has(r.confidence)).length;
    const ok = await showConfirm(
      `Simpan ${toSave.length} buku ke katalog?` +
        (unchecked ? `\n\n⚠️ Masih ada ${unchecked} buku yang ditandai perlu dicek / tanpa sampul.` : ''),
      { title: 'Simpan ke Katalog', confirmText: 'Ya, Simpan', cancelText: 'Periksa Lagi', type: unchecked ? 'warning' : 'info' }
    );
    if (!ok) return;

    setSaving(true);
    const savedAll = [];
    const failedAll = [];
    try {
      for (let i = 0; i < toSave.length; i += SAVE_CHUNK) {
        const chunk = toSave.slice(i, i + SAVE_CHUNK);
        const res = await fetch('/api/books/bulk-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            books: chunk.map((r) => ({
              title: r.title,
              author: r.author,
              publisher: r.publisher,
              publish_year: r.year,
              category: defaults.category,
              shelf_location: defaults.shelf_location,
              stock: defaults.stock,
              cover_image: r.coverIndex !== null ? coverByIndex.get(r.coverIndex)?.dataUrl : null
            }))
          })
        });
        const data = await res.json().catch(() => ({}));
        if (Array.isArray(data.saved)) savedAll.push(...data.saved.map((s) => ({ ...s, title: chunk[s.index]?.title })));
        if (Array.isArray(data.failed)) failedAll.push(...data.failed.map((f) => ({ ...f, title: chunk[f.index]?.title })));
        if (!res.ok && !data.saved) throw new Error(data.error || 'Server menolak permintaan');
      }
      setSaveResult({ saved: savedAll, failed: failedAll });
      setStep('done');
    } catch (err) {
      showAlert(
        `Gagal menyimpan: ${err.message}. ${savedAll.length ? `${savedAll.length} buku sempat tersimpan.` : ''} Pastikan backend & MySQL XAMPP aktif.`,
        { type: 'danger', title: 'Gagal Menyimpan' }
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLoadSampleFiles = async () => {
    try {
      const listRes = await fetch('/templates/contoh_daftar_buku_tabel.pdf');
      const listBlob = await listRes.blob();
      const listF = new File([listBlob], 'contoh_daftar_buku_tabel.pdf', { type: 'application/pdf' });

      const coverRes = await fetch('/templates/contoh_sampul_acak.pdf');
      const coverBlob = await coverRes.blob();
      const coverF = new File([coverBlob], 'contoh_sampul_acak.pdf', { type: 'application/pdf' });

      setListFile(listF);
      setCoverFiles([coverF]);
      showAlert('2 File contoh (Daftar 15 Buku & 15 Sampul Teracak) berhasil dimuat! Silakan klik tombol "Proses & Cocokkan Otomatis".', {
        type: 'success',
        title: 'Sampel Berhasil Dimuat'
      });
    } catch (err) {
      showAlert('Gagal memuat file contoh: ' + err.message, { type: 'warning' });
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  const pickerRow = rows.find((r) => r.key === pickerRowKey);
  const curStepIdx = IMPORT_STEPS.findIndex((s) => s.key === step);
  const curStepObj = IMPORT_STEPS[curStepIdx] || IMPORT_STEPS[0];

  return (
    <div className="bbi">
      <div className="bbi-header">
        <div className="bbi-header-text">
          <h1>
            <BookPlus size={26} /> Tambah Buku dari PDF
          </h1>
          <p>
            Unggah <strong>1 PDF daftar judul & penulis</strong> dan <strong>1 PDF sampul</strong>. Sistem akan membaca,
            mencocokkan, lalu Anda cukup memeriksa sebelum disimpan ke katalog.
          </p>
        </div>

        <div className="bbi-steps-container">
          <div className="bbi-steps-mobile-header">
            <span className="bbi-steps-mobile-badge">Langkah {curStepIdx + 1} dari 4</span>
            <span className="bbi-steps-mobile-active-label">{curStepObj.label}</span>
          </div>

          <div className="bbi-steps" role="navigation" aria-label="Alur Tambah Buku">
            <div className="bbi-steps-track">
              <div
                className="bbi-steps-progress"
                style={{ width: `${(curStepIdx / (IMPORT_STEPS.length - 1)) * 100}%` }}
              />
            </div>

            {IMPORT_STEPS.map((s, i) => {
              const isPassed = i < curStepIdx;
              const isActive = i === curStepIdx;
              return (
                <div key={s.key} className="bbi-step-wrapper">
                  <div className={`bbi-step ${isActive ? 'active' : ''} ${isPassed ? 'passed' : ''}`}>
                    <div className="bbi-step-circle">
                      {isPassed ? <Check size={12} strokeWidth={3} /> : s.num}
                    </div>
                    <span className="bbi-step-label-full">{s.label}</span>
                    <span className="bbi-step-label-short">{s.short}</span>
                  </div>
                  {i < IMPORT_STEPS.length - 1 && (
                    <span className="bbi-step-separator">
                      <ChevronRight size={13} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ================= STEP 1: UNGGAH ================= */}
      {step === 'upload' && (
        <div className="bbi-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>
          {/* Hero Banner Konsep */}
          <div className="bbi-hero-banner">
            <div className="bbi-hero-content">
              <div className="bbi-hero-icon">
                <Sparkles size={24} />
              </div>
              <div>
                <div className="bbi-hero-title">Metode Dual PDF Cerdas (Bisa 15+ Buku Sekaligus)</div>
                <p className="bbi-hero-desc">
                  Tidak perlu upload satu per satu. Cukup 1 file daftar dan 1 file sampul. Urutan gambar sampul <strong>boleh teracak</strong>, sistem cerdas akan memasangkannya kembali secara otomatis!
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary bbi-btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.4)', color: '#a7f3d0' }}
              onClick={handleLoadSampleFiles}
            >
              <Sparkles size={14} color="#34d399" /> ⚡ Coba dengan 15 Sampel Otomatis
            </button>
          </div>

          <div className="bbi-drop-grid">
            <DropZone
              id="bbi-drop-list"
              icon={FileText}
              accent="indigo"
              badge="Wajib · PDF Berisi Teks"
              title="1. PDF Daftar Judul & Penulis"
              hint="Seret file ke sini atau klik untuk memilih (.pdf). Berisi baris/tabel buku."
              accept="application/pdf,.pdf"
              files={listFile ? [listFile] : null}
              onFiles={(f) => setListFile(f[0])}
            />
            <DropZone
              id="bbi-drop-covers"
              icon={ImageIcon}
              accent="amber"
              badge="Wajib · 1 Halaman = 1 Sampul"
              title="2. PDF Sampul (Urutan Boleh Acak)"
              hint="Seret file PDF sampul ke sini atau beberapa foto gambar (.jpg/.png)"
              accept="application/pdf,.pdf,image/*"
              multiple
              files={coverFiles}
              onFiles={(f) => setCoverFiles(f)}
            />
          </div>

          <button type="button" className="bbi-format-toggle" onClick={() => setShowFormat((v) => !v)}>
            <Info size={16} /> {showFormat ? 'Sembunyikan' : 'Lihat'} panduan format PDF & unduh contoh file
          </button>

          {showFormat && (
            <div className="bbi-format bbi-fade">
              <div className="bbi-format-col">
                <h4>Format A: Tabel (Direkomendasikan)</h4>
                <table className="bbi-format-table">
                  <thead>
                    <tr><th>No</th><th>Judul</th><th>Penulis</th><th>Penerbit</th><th>Tahun</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>1</td><td>Laskar Pelangi</td><td>Andrea Hirata</td><td>Bentang</td><td>2005</td></tr>
                    <tr><td>2</td><td>Bumi</td><td>Tere Liye</td><td>Gramedia</td><td>2014</td></tr>
                  </tbody>
                </table>
                <small style={{ color: '#94a3b8' }}>Dibuat dari Word/Excel lalu simpan sebagai PDF.</small>
              </div>
              <div className="bbi-format-col">
                <h4>Format B: Satu Baris per Buku</h4>
                <pre className="bbi-format-pre">{`1. Laskar Pelangi | Andrea Hirata
2. Bumi | Tere Liye
3. Ayat-Ayat Cinta | Habiburrahman El Shirazy`}</pre>
                <small style={{ color: '#94a3b8' }}>
                  Gunakan pemisah garis tegak <b>|</b>, bukan strip.
                </small>
              </div>
              <div className="bbi-format-downloads">
                <span>Unduh File Template:</span>
                <a href="/templates/contoh_daftar_buku_tabel.pdf" download className="bbi-btn-download">
                  <Download size={13} /> Contoh Tabel PDF
                </a>
                <a href="/templates/contoh_daftar_buku_baris.pdf" download className="bbi-btn-download">
                  <Download size={13} /> Contoh Baris PDF
                </a>
                <a href="/templates/contoh_sampul_acak.pdf" download className="bbi-btn-download">
                  <Download size={13} /> Contoh Sampul Acak (15 Hal)
                </a>
              </div>
            </div>
          )}

          <div className="bbi-options">
            <div className="bbi-option-card">
              <div className="bbi-option-header">
                <Sparkles size={16} color="#10b981" /> Metode Pencocokan Sampul
              </div>
              <div className="bbi-seg">
                <button
                  id="bbi-mode-smart"
                  type="button"
                  className={`bbi-seg-btn ${mode === 'smart' ? 'active' : ''}`}
                  onClick={() => setMode('smart')}
                >
                  <Sparkles size={18} />
                  <span>
                    <b>Pencocok Cerdas</b>
                    <small>Sampul acak, dicocokkan otomatis</small>
                  </span>
                </button>
                <button
                  id="bbi-mode-order"
                  type="button"
                  className={`bbi-seg-btn ${mode === 'order' ? 'active' : ''}`}
                  onClick={() => setMode('order')}
                >
                  <ListOrdered size={18} />
                  <span>
                    <b>Sesuai Urutan</b>
                    <small>Judul #1 = sampul hal #1</small>
                  </span>
                </button>
              </div>
            </div>

            {mode === 'smart' && (
              <div className="bbi-option-card">
                <div className="bbi-option-header">
                  <Cpu size={16} color="#6366f1" /> Mesin Pembaca Teks Sampul
                </div>
                <div className="bbi-seg">
                  <button
                    id="bbi-engine-tesseract"
                    type="button"
                    className={`bbi-seg-btn ${engine === 'tesseract' ? 'active' : ''}`}
                    onClick={() => setEngine('tesseract')}
                  >
                    <ScanText size={18} />
                    <span>
                      <b>Tesseract OCR</b>
                      <small>Gratis, jalan di browser (offline)</small>
                    </span>
                  </button>
                  <button
                    id="bbi-engine-gemini"
                    type="button"
                    className={`bbi-seg-btn ${engine === 'gemini' ? 'active' : ''}`}
                    onClick={() => aiStatus.gemini && setEngine('gemini')}
                    disabled={!aiStatus.gemini}
                    title={aiStatus.gemini ? '' : 'Isi GEMINI_API_KEY di backend/.env lalu restart backend'}
                  >
                    <Cpu size={18} />
                    <span>
                      <b>Gemini AI Vision</b>
                      <small>{aiStatus.gemini ? 'Akurat untuk font hias' : 'Butuh API Key di .env'}</small>
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bbi-defaults">
            <div className="bbi-option-header">
              <Library size={16} color="#38bdf8" /> Data Default Buku (Bisa diedit nanti di halaman review)
            </div>
            <div className="bbi-defaults-grid">
              <label>
                Kategori Koleksi
                <input
                  id="bbi-default-category"
                  className="form-control"
                  value={defaults.category}
                  onChange={(e) => setDefaults({ ...defaults, category: e.target.value })}
                />
              </label>
              <label>
                Lokasi Rak Penyimpanan
                <input
                  id="bbi-default-shelf"
                  className="form-control"
                  value={defaults.shelf_location}
                  onChange={(e) => setDefaults({ ...defaults, shelf_location: e.target.value })}
                />
              </label>
              <label>
                Jumlah Stok per Buku
                <input
                  id="bbi-default-stock"
                  type="number"
                  min={1}
                  className="form-control"
                  value={defaults.stock}
                  onChange={(e) => setDefaults({ ...defaults, stock: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                />
              </label>
            </div>
          </div>

          <div className="bbi-actions">
            <button
              id="bbi-process"
              type="button"
              className="bbi-btn-process"
              onClick={handleProcess}
              disabled={!listFile || !coverFiles}
            >
              <Sparkles size={20} /> Mulai Proses & Cocokkan Cerdas
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 2: PROSES ================= */}
      {step === 'processing' && (
        <div className="bbi-processing bbi-fade">
          <div className="bbi-scan-ring">
            <LoaderCircle size={50} className="bbi-spin bbi-scan-icon" />
          </div>
          <h3>{progress.stage}</h3>
          <p className="bbi-muted">{progress.detail}</p>
          <div className="bbi-progress">
            <div className="bbi-progress-bar" style={{ width: `${progress.percent}%` }} />
          </div>
          <div className="bbi-progress-num">{progress.percent}%</div>
          {mode === 'smart' && engine === 'tesseract' && (
            <p className="bbi-muted bbi-small">
              Pertama kali digunakan, Tesseract mengunduh modul bahasa (±10 MB). Proses berikutnya akan lebih cepat.
            </p>
          )}
        </div>
      )}

      {/* ================= STEP 3: PERIKSA ================= */}
      {step === 'review' && (
        <div className="bbi-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>
          <div className="bbi-stats">
            <div className="bbi-stat total">
              <div className="bbi-stat-icon">
                <Library size={22} />
              </div>
              <div className="bbi-stat-info">
                <b>{stats.total}</b>
                <span>Judul Terbaca</span>
              </div>
            </div>
            <div className="bbi-stat covers">
              <div className="bbi-stat-icon">
                <ImageIcon size={22} />
              </div>
              <div className="bbi-stat-info">
                <b>{covers.length}</b>
                <span>Sampul Terbaca</span>
              </div>
            </div>
            <div className="bbi-stat high">
              <div className="bbi-stat-icon">
                <CheckCircle2 size={22} />
              </div>
              <div className="bbi-stat-info">
                <b>{stats.high}</b>
                <span>Cocok Akurat</span>
              </div>
            </div>
            <div className={`bbi-stat ${stats.check ? 'check' : ''}`}>
              <div className="bbi-stat-icon">
                <TriangleAlert size={22} />
              </div>
              <div className="bbi-stat-info">
                <b>{stats.check}</b>
                <span>Perlu Dicek</span>
              </div>
            </div>
            {stats.exists > 0 && (
              <div className="bbi-stat danger">
                <div className="bbi-stat-icon">
                  <Library size={22} />
                </div>
                <div className="bbi-stat-info">
                  <b>{stats.exists}</b>
                  <span>Ada di Database</span>
                </div>
              </div>
            )}
          </div>

          {warnings.length > 0 && (
            <div className="bbi-warnings">
              {warnings.map((w, i) => (
                <div key={i}>
                  <TriangleAlert size={14} /> {w}
                </div>
              ))}
            </div>
          )}

          <div className="bbi-toolbar">
            <label className="bbi-filter-chip">
              <input type="checkbox" checked={onlyNeedsCheck} onChange={(e) => setOnlyNeedsCheck(e.target.checked)} />
              <Filter size={15} /> Tampilkan hanya yang perlu dicek ({stats.check})
            </label>
            <span className="bbi-muted bbi-small">
              💡 <strong>Tips:</strong> Klik foto sampul buku untuk mengganti atau menukarnya langsung.
            </span>
          </div>

          <div className="bbi-grid">
            {visibleRows.map((r) => {
              const cover = r.coverIndex !== null ? coverByIndex.get(r.coverIndex) : null;
              const meta = CONF_META[r.confidence] || CONF_META[CONFIDENCE.NONE];
              const MetaIcon = meta.Icon;
              return (
                <div key={r.key} className={`bbi-card conf-${meta.cls} ${r.include ? '' : 'excluded'}`}>
                  <div className="bbi-card-cover" onClick={() => setPickerRowKey(r.key)} title="Klik untuk mengganti sampul">
                    {cover ? <img src={cover.dataUrl} alt={`Sampul ${r.title}`} /> : <div className="bbi-no-cover"><ImageIcon size={28} />Belum ada sampul</div>}
                    <div className="bbi-card-cover-overlay">
                      <Repeat size={16} /> Ganti sampul
                    </div>
                    {cover && <span className="bbi-page-tag">{cover.source}</span>}
                  </div>

                  <div className="bbi-card-body">
                    <div className="bbi-card-top">
                      <span className="bbi-no">#{r.no}</span>
                      <span className={`bbi-badge ${meta.cls}`}>
                        <MetaIcon size={12} /> {meta.label}
                        {mode === 'smart' && r.confidence !== CONFIDENCE.MANUAL && r.confidence !== CONFIDENCE.NONE && (
                          <em>{Math.round(r.score * 100)}%</em>
                        )}
                      </span>
                    </div>

                    <label className="bbi-field">
                      <span>Judul</span>
                      <input className="form-control" value={r.title} onChange={(e) => updateRow(r.key, { title: e.target.value })} />
                    </label>
                    <label className="bbi-field">
                      <span>Penulis</span>
                      <input className="form-control" value={r.author} onChange={(e) => updateRow(r.key, { author: e.target.value })} />
                    </label>
                    <div className="bbi-field-row">
                      <label className="bbi-field">
                        <span>Penerbit</span>
                        <input className="form-control" value={r.publisher} onChange={(e) => updateRow(r.key, { publisher: e.target.value })} />
                      </label>
                      <label className="bbi-field bbi-field-year">
                        <span>Tahun</span>
                        <input className="form-control" value={r.year} onChange={(e) => updateRow(r.key, { year: e.target.value })} />
                      </label>
                    </div>

                    {r.exists && <div className="bbi-exists">Judul ini sudah ada di katalog, jadi tidak dicentang otomatis.</div>}

                    {cover && mode === 'smart' && (
                      <button
                        type="button"
                        className="bbi-ocr-toggle"
                        onClick={() => setExpandedOcr(expandedOcr === r.key ? null : r.key)}
                      >
                        <ScanText size={12} /> {expandedOcr === r.key ? 'Sembunyikan' : 'Lihat'} teks yang terbaca dari sampul
                      </button>
                    )}
                    {expandedOcr === r.key && cover && (
                      <div className="bbi-ocr-text">{cover.ocrText || '(tidak ada teks terbaca)'}</div>
                    )}

                    <label className="bbi-check bbi-include">
                      <input type="checkbox" checked={r.include} onChange={(e) => updateRow(r.key, { include: e.target.checked })} />
                      Simpan buku ini
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          {unusedCovers.length > 0 && (
            <div className="bbi-unused">
              <h4>
                <ImageIcon size={16} /> Sampul belum terpakai ({unusedCovers.length})
              </h4>
              <div className="bbi-unused-list">
                {unusedCovers.map((c) => (
                  <div key={c.index} className="bbi-unused-item">
                    <img src={c.dataUrl} alt={c.source} />
                    <span>{c.source}</span>
                  </div>
                ))}
              </div>
              <small className="bbi-muted">Klik sampul pada kartu buku lalu pilih salah satu sampul ini untuk memasangnya.</small>
            </div>
          )}

          <div className="bbi-actions-sticky">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={handleReset} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <ArrowLeft size={16} /> Ulangi dari Awal
              </button>
              <span className="bbi-muted bbi-small" style={{ color: '#cbd5e1' }}>
                ✓ Siap menyimpan <strong>{stats.included}</strong> dari {stats.total} buku yang dipilih
              </span>
            </div>

            <button id="bbi-save" type="button" className="bbi-btn-process" onClick={handleSave} disabled={saving}>
              {saving ? <LoaderCircle size={18} className="bbi-spin" /> : <Save size={18} />}
              {saving ? 'Sedang Menyimpan...' : `Simpan ${stats.included} Buku ke Katalog`}
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 4: SELESAI ================= */}
      {step === 'done' && saveResult && (
        <div className="bbi-done bbi-fade">
          <div className="bbi-done-icon">
            <CheckCircle2 size={54} />
          </div>
          <h2>{saveResult.saved.length} buku berhasil ditambahkan ke katalog!</h2>
          {saveResult.failed.length > 0 && (
            <div className="bbi-warnings">
              {saveResult.failed.map((f, i) => (
                <div key={i}>
                  <CircleX size={14} /> {f.title || `Buku #${f.index + 1}`}: {f.error}
                </div>
              ))}
            </div>
          )}
          <div className="bbi-done-list">
            {saveResult.saved.slice(0, 24).map((s) => (
              <div key={s.id} className="bbi-done-item">
                {s.cover_url ? <img src={s.cover_url} alt={s.title} /> : <div className="bbi-no-cover small"><ImageIcon size={18} /></div>}
                <span>{s.title}</span>
              </div>
            ))}
          </div>
          <button type="button" className="btn bbi-btn-primary" onClick={handleStartOver}>
            <Upload size={16} /> Import Buku Lagi
          </button>
        </div>
      )}

      {/* ================= MODAL PILIH SAMPUL ================= */}
      {pickerRow && (
        <div className="bbi-modal-backdrop" onClick={() => setPickerRowKey(null)}>
          <div className="bbi-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bbi-modal-head">
              <div>
                <span className="bbi-muted bbi-small">Pilih sampul untuk</span>
                <h3>
                  #{pickerRow.no} {pickerRow.title}
                </h3>
                <span className="bbi-muted bbi-small">{pickerRow.author}</span>
              </div>
              <button type="button" className="bbi-icon-btn" onClick={() => setPickerRowKey(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="bbi-picker-grid">
              {covers.map((c) => {
                const owner = rows.find((r) => r.coverIndex === c.index);
                const isCurrent = pickerRow.coverIndex === c.index;
                return (
                  <button
                    key={c.index}
                    type="button"
                    className={`bbi-picker-item ${isCurrent ? 'current' : ''}`}
                    onClick={() => assignCover(pickerRow.key, c.index)}
                  >
                    <img src={c.dataUrl} alt={c.source} />
                    <span className="bbi-picker-src">{c.source}</span>
                    <span className="bbi-picker-owner">
                      {isCurrent ? '✓ Sampul saat ini' : owner ? `Dipakai #${owner.no} (akan ditukar)` : 'Belum terpakai'}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="bbi-modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => assignCover(pickerRow.key, null)}>
                <Trash2 size={14} /> Kosongkan sampul buku ini
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BulkBookImport;
