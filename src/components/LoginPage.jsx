import { useState } from 'react';
import { BookOpen, Shield, Eye, EyeOff, LogIn, ArrowRight } from 'lucide-react';

const STAFF_PIN = '1234';

function LoginPage({ onLogin }) {
  const [selectedRole, setSelectedRole] = useState(null);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCustomerLogin = () => {
    onLogin('customer');
  };

  const handleStaffLogin = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setTimeout(() => {
      if (pin === STAFF_PIN) {
        onLogin('staff');
      } else {
        setError('PIN salah! Hubungi kepala perpustakaan untuk reset PIN.');
        setPin('');
      }
      setLoading(false);
    }, 600);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      background: 'var(--bg-dark)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', borderRadius: '50%' }} />
      </div>

      <div style={{ width: '100%', maxWidth: '480px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.85rem', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
            <img src="/Lambang.png" alt="Lambang Kota Parepare" style={{ width: '64px', height: '64px', objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(99,102,241,0.3))' }} onError={e => { e.target.style.display = 'none'; }} />
            <div style={{ width: '1.5px', height: '40px', background: 'rgba(255,255,255,0.2)' }} />
            <img src="/logo-perpus.png" alt="Logo Dinas Perpustakaan" style={{ width: '64px', height: '64px', objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(16,185,129,0.3))' }} onError={e => { e.currentTarget.src = '/logo perpus.jpg'; }} />
            <div style={{ width: '1.5px', height: '40px', background: 'rgba(255,255,255,0.2)' }} />
            <img src="/logo-ilkom.png" alt="Logo Ilmu Komputer ITH" style={{ width: '64px', height: '64px', objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(245,158,11,0.3))' }} onError={e => { e.currentTarget.src = '/logo ilkom.jpg'; }} />
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0 0 0.3rem', background: 'linear-gradient(135deg, #a5b4fc, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Perpustakaan Umum</h1>
          <p style={{ color: '#6366f1', fontWeight: '600', fontSize: '1rem', margin: '0 0 0.5rem' }}>Kota Parepare</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Silakan pilih akses yang sesuai</p>
        </div>

        {!selectedRole && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <button
              onClick={handleCustomerLogin}
              className="login-role-btn"
              style={{
                background: 'rgba(99, 102, 241, 0.12)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1.5px solid rgba(99, 102, 241, 0.45)',
                borderRadius: '16px',
                padding: '1.8rem 1.5rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '1.2rem',
                color: '#ffffff'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.border = '1.5px solid rgba(99,102,241,0.85)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 10px 30px rgba(99,102,241,0.3)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.border = '1.5px solid rgba(99,102,241,0.45)';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 15px rgba(99,102,241,0.4)' }}>
                <BookOpen size={26} color="white" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '800', fontSize: '1.15rem', marginBottom: '0.3rem', color: '#ffffff' }}>Saya Pengunjung</div>
                <div style={{ color: '#cbd5e1', fontSize: '0.9rem', fontWeight: '600', lineHeight: 1.5 }}>Cari buku, pesan pinjam, cek barang tertinggal</div>
              </div>
              <ArrowRight size={22} style={{ color: '#a5b4fc', flexShrink: 0 }} />
            </button>

            <button
              onClick={() => setSelectedRole('staff')}
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1.5px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '16px',
                padding: '1.8rem 1.5rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '1.2rem',
                color: '#ffffff'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.border = '1.5px solid rgba(16,185,129,0.85)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 10px 30px rgba(16,185,129,0.25)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.border = '1.5px solid rgba(16,185,129,0.4)';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, #059669, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 15px rgba(16,185,129,0.4)' }}>
                <Shield size={26} color="white" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '800', fontSize: '1.15rem', marginBottom: '0.3rem', color: '#ffffff' }}>Saya Pegawai / Staf</div>
                <div style={{ color: '#cbd5e1', fontSize: '0.9rem', fontWeight: '600', lineHeight: 1.5 }}>Dashboard staf, kelola pesanan dan buku, notifikasi masuk</div>
              </div>
              <ArrowRight size={22} style={{ color: '#6ee7b7', flexShrink: 0 }} />
            </button>
          </div>
        )}

        {selectedRole === 'staff' && (
          <div style={{ background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '16px', padding: '2rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, #059669, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.8rem', boxShadow: '0 4px 15px rgba(16,185,129,0.3)' }}><Shield size={26} color="white" /></div>
              <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.25rem', fontWeight: '800', color: '#ffffff' }}>Login Staf Perpustakaan</h2>
              <p style={{ color: '#cbd5e1', fontSize: '0.9rem', fontWeight: '600', margin: 0 }}>Masukkan PIN akses staf</p>
            </div>

            <form onSubmit={handleStaffLogin}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>PIN Staf</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPin ? 'text' : 'password'} className="form-control" placeholder="Masukkan PIN staf..." value={pin} onChange={e => { setPin(e.target.value); setError(''); }} maxLength={8} autoFocus style={{ paddingRight: '2.8rem', letterSpacing: '0.2em', fontSize: '1.1rem' }} />
                  <button type="button" onClick={() => setShowPin(!showPin)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>{showPin ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
                {error && <p style={{ color: '#f87171', fontSize: '0.83rem', marginTop: '0.5rem' }}>{error}</p>}
              </div>

              <button type="submit" className="btn" disabled={!pin || loading} style={{ width: '100%', background: 'linear-gradient(135deg, #059669, #10b981)', border: 'none', color: '#fff', fontWeight: '700', padding: '0.75rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: (!pin || loading) ? 0.6 : 1, cursor: (!pin || loading) ? 'not-allowed' : 'pointer' }}>
                {loading ? 'Memverifikasi...' : <><LogIn size={18} /> Masuk sebagai Staf</>}
              </button>

              <button type="button" onClick={() => { setSelectedRole(null); setPin(''); setError(''); }} style={{ width: '100%', marginTop: '0.8rem', background: 'none', border: '1px solid var(--surface-border)', color: 'var(--text-muted)', borderRadius: '10px', padding: '0.6rem', cursor: 'pointer', fontSize: '0.88rem' }}>
                ← Kembali ke Pilihan Akses
              </button>
            </form>

            <div style={{ marginTop: '1rem', padding: '0.7rem', borderRadius: '8px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              PIN default: <strong style={{ color: 'var(--primary-color)' }}>1234</strong>
            </div>
          </div>
        )}

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '2rem' }}>Sistem Perpustakaan Umum Kota Parepare © 2026</p>
      </div>
    </div>
  );
}

export default LoginPage;
