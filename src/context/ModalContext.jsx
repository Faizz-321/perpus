import { createContext, useContext, useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, HelpCircle, X } from 'lucide-react';

const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [modalState, setModalState] = useState({
    isOpen: false,
    type: 'info', // 'warning', 'success', 'info', 'danger'
    title: '',
    message: '',
    confirmText: 'Mengerti',
    cancelText: 'Batal',
    isConfirm: false,
    resolvePromise: null,
  });

  const showAlert = (message, options = {}) => {
    return new Promise((resolve) => {
      // Deteksi tipe pesan otomatis berdasarkan teks jika tidak ditentukan
      let detectedType = options.type || 'info';
      let defaultTitle = 'Pemberitahuan';

      const msgStr = String(message || '');
      if (
        msgStr.toLowerCase().includes('berhasil') || 
        msgStr.includes('✓') || 
        msgStr.toLowerCase().includes('sukses')
      ) {
        detectedType = 'success';
        defaultTitle = 'Berhasil';
      } else if (
        msgStr.toLowerCase().includes('gagal') || 
        msgStr.toLowerCase().includes('tidak dapat') || 
        msgStr.toLowerCase().includes('error')
      ) {
        detectedType = 'danger';
        defaultTitle = 'Perhatian';
      } else if (
        msgStr.includes('⚠️') || 
        msgStr.toLowerCase().includes('wajib') || 
        msgStr.toLowerCase().includes('pilih') || 
        msgStr.toLowerCase().includes('maksimal') ||
        msgStr.toLowerCase().includes('silakan')
      ) {
        detectedType = 'warning';
        defaultTitle = 'Perhatian';
      }

      setModalState({
        isOpen: true,
        type: detectedType,
        title: options.title || defaultTitle,
        message: msgStr.replace(/^[⚠️📢✓]\s*/, ''), // Bersihkan emoji awalan agar tampilan rapi
        confirmText: options.confirmText || 'Mengerti',
        cancelText: 'Batal',
        isConfirm: false,
        resolvePromise: resolve,
      });
    });
  };

  const showConfirm = (message, options = {}) => {
    return new Promise((resolve) => {
      setModalState({
        isOpen: true,
        type: options.type || 'warning',
        title: options.title || 'Konfirmasi Tindakan',
        message: String(message || '').replace(/^[⚠️📢✓]\s*/, ''),
        confirmText: options.confirmText || 'Ya, Lanjutkan',
        cancelText: options.cancelText || 'Batal',
        isConfirm: true,
        resolvePromise: resolve,
      });
    });
  };

  // Pasang window.alert dan window.confirm override agar semua alert otomatis tampil di tengah
  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (msg) => {
      showAlert(msg);
    };
    window.customAlert = showAlert;
    window.customConfirm = showConfirm;

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  const handleConfirm = () => {
    if (modalState.resolvePromise) {
      modalState.resolvePromise(true);
    }
    setModalState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleCancel = () => {
    if (modalState.resolvePromise) {
      modalState.resolvePromise(false);
    }
    setModalState((prev) => ({ ...prev, isOpen: false }));
  };

  // Keyboard shortcut: Escape untuk batal, Enter untuk konfirmasi
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!modalState.isOpen) return;
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter') {
        handleConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalState.isOpen]);

  // Tema warna icon & border berdasarkan tipe
  const getTheme = () => {
    switch (modalState.type) {
      case 'success':
        return {
          icon: <CheckCircle2 size={34} color="#10b981" />,
          glow: 'rgba(16, 185, 129, 0.25)',
          border: 'rgba(16, 185, 129, 0.4)',
          btnGradient: 'linear-gradient(135deg, #10b981, #059669)',
          iconBg: 'rgba(16, 185, 129, 0.15)',
        };
      case 'warning':
        return {
          icon: <AlertCircle size={34} color="#f59e0b" />,
          glow: 'rgba(245, 158, 11, 0.25)',
          border: 'rgba(245, 158, 11, 0.4)',
          btnGradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
          iconBg: 'rgba(245, 158, 11, 0.15)',
        };
      case 'danger':
        return {
          icon: <AlertCircle size={34} color="#ef4444" />,
          glow: 'rgba(239, 68, 68, 0.25)',
          border: 'rgba(239, 68, 68, 0.4)',
          btnGradient: 'linear-gradient(135deg, #ef4444, #dc2626)',
          iconBg: 'rgba(239, 68, 68, 0.15)',
        };
      case 'info':
      default:
        return {
          icon: modalState.isConfirm ? <HelpCircle size={34} color="#6366f1" /> : <Info size={34} color="#6366f1" />,
          glow: 'rgba(99, 102, 241, 0.25)',
          border: 'rgba(99, 102, 241, 0.4)',
          btnGradient: 'linear-gradient(135deg, #6366f1, #4f46e5)',
          iconBg: 'rgba(99, 102, 241, 0.15)',
        };
    }
  };

  const theme = getTheme();

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm }}>
      {children}

      {/* Modal Popup di Tengah Layar */}
      {modalState.isOpen && (
        <div 
          className="custom-modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'rgba(8, 11, 20, 0.8)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.2rem',
          }}
          onClick={handleCancel}
        >
          <div
            className="custom-modal-card"
            style={{
              background: 'linear-gradient(145deg, #1e2438, #141829)',
              border: `1.5px solid ${theme.border}`,
              borderRadius: '20px',
              padding: '2.2rem 2rem 1.8rem 2rem',
              maxWidth: '430px',
              width: '100%',
              boxShadow: `0 25px 50px rgba(0,0,0,0.8), 0 0 35px ${theme.glow}`,
              textAlign: 'center',
              position: 'relative',
              cursor: 'default',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tombol X Tutup di Sudut Kanan Atas */}
            <button
              onClick={handleCancel}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
              title="Tutup"
            >
              <X size={18} />
            </button>

            {/* Lingkaran Icon Cantik */}
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: theme.iconBg,
                border: `1.5px solid ${theme.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.3rem auto',
                boxShadow: `0 8px 20px ${theme.glow}`,
              }}
            >
              {theme.icon}
            </div>

            {/* Judul Peringatan / Pemberitahuan */}
            <h3
              style={{
                fontSize: '1.3rem',
                fontWeight: '700',
                color: '#fff',
                marginBottom: '0.6rem',
                letterSpacing: '-0.3px',
              }}
            >
              {modalState.title}
            </h3>

            {/* Teks Pesan Peringatan */}
            <p
              style={{
                fontSize: '0.96rem',
                color: '#cbd5e1',
                lineHeight: '1.6',
                marginBottom: '1.8rem',
                whiteSpace: 'pre-line',
              }}
            >
              {modalState.message}
            </p>

            {/* Tombol Aksi */}
            <div
              style={{
                display: 'flex',
                gap: '0.8rem',
                justifyContent: 'center',
              }}
            >
              {modalState.isConfirm && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="btn"
                  style={{
                    flex: 1,
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#94a3b8',
                    padding: '0.75rem 1rem',
                    fontSize: '0.92rem',
                    fontWeight: '600',
                    borderRadius: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {modalState.cancelText}
                </button>
              )}

              <button
                type="button"
                onClick={handleConfirm}
                className="btn"
                style={{
                  flex: 1,
                  background: theme.btnGradient,
                  border: 'none',
                  color: '#fff',
                  padding: '0.75rem 1.4rem',
                  fontSize: '0.92rem',
                  fontWeight: '700',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  boxShadow: `0 4px 15px ${theme.glow}`,
                  letterSpacing: '0.2px',
                }}
                autoFocus
              >
                {modalState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    return {
      showAlert: (msg) => window.customAlert ? window.customAlert(msg) : window.alert(msg),
      showConfirm: (msg) => window.customConfirm ? window.customConfirm(msg) : Promise.resolve(window.confirm(msg)),
    };
  }
  return context;
}
