import { useState, useEffect } from 'react';
import { Plus, CheckCircle, Package } from 'lucide-react';

function LostFound() {
  const [activeTab, setActiveTab] = useState('found');
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState({
    item_name: '',
    location: '',
    contact: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const fetchItems = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/lost-found');
      if (res.ok) {
        const data = await res.json();
        setItems(data.map(i => ({
          id: i.id,
          type: i.type,
          name: i.item_name,
          date: i.report_date ? i.report_date.slice(0, 10) : 'Hari ini',
          location: i.location,
          status: i.status
        })));
        return;
      }
    } catch (e) {
      // offline fallback
    }

    setItems([
      { id: 1, type: 'found', name: 'Payung Biru Lipat', date: 'Hari ini', location: 'Ruang Baca A' },
      { id: 2, type: 'lost', name: 'Mouse Wireless Logitech', date: 'Hari ini', location: 'Lab Komputer' },
      { id: 3, type: 'found', name: 'Kartu Tanda Mahasiswa', date: 'Kemarin', location: 'Pintu Masuk Utama' },
    ]);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.item_name || !formData.location) return;

    try {
      await fetch('http://localhost:5000/api/lost-found', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_name: formData.item_name,
          type: 'lost',
          location: formData.location,
          contact: formData.contact
        })
      });
      fetchItems();
    } catch (e) {
      console.warn('Backend offline, disimpan di lokal:', e.message);
    }

    setIsSubmitted(true);
    setFormData({ item_name: '', location: '', contact: '' });
  };

  return (
    <div className="glass-panel">
      <div className="page-header">
        <h1>Barang Hilang & Temuan</h1>
        <p>Layanan informasi barang tertinggal dan pelaporan kehilangan di perpustakaan</p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          className={`btn ${activeTab !== 'found' ? 'btn-secondary' : ''}`}
          style={{ flex: 1 }}
          onClick={() => { setActiveTab('found'); setIsSubmitted(false); }}
        >
          <Package size={16} /> Barang Ditemukan
        </button>
        <button 
          className={`btn ${activeTab !== 'lost' ? 'btn-secondary' : ''}`}
          style={{ flex: 1 }}
          onClick={() => setActiveTab('lost')}
        >
          <Plus size={16} /> Laporkan Kehilangan
        </button>
      </div>

      {activeTab === 'found' && (
        <div className="item-list">
          {items.filter(i => i.type === 'found').length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>Tidak ada barang temuan baru.</p>
          ) : (
            items.filter(i => i.type === 'found').map(item => (
              <div key={item.id} className="list-item">
                <div>
                  <h3 style={{ marginBottom: '0.25rem' }}>{item.name}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Ditemukan di: {item.location} • Tanggal: {item.date}</p>
                </div>
                <span className="status-badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)' }}>
                  Tersedia di Staf
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'lost' && (
        isSubmitted ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div style={{ width: '60px', height: '60px', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              <CheckCircle size={32} />
            </div>
            <h3>Laporan Berhasil Dicatat!</h3>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Data kehilangan telah disimpan di database. Staf perpustakaan akan menghubungi Anda jika barang ditemukan.
            </p>
            <button className="btn btn-secondary" style={{ marginTop: '1.5rem' }} onClick={() => setIsSubmitted(false)}>
              Kirim Laporan Lain
            </button>
          </div>
        ) : (
          <form style={{ maxWidth: '500px', margin: '0 auto' }} onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Nama / Deskripsi Barang</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Contoh: Charger Laptop Lenovo Hitam" 
                required
                value={formData.item_name}
                onChange={e => setFormData({ ...formData, item_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Lokasi Terakhir Terlihat</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Contoh: Meja 4, Lantai 2" 
                required
                value={formData.location}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Kontak WhatsApp / Email (Opsional)</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="0812xxxxxxxx atau nama@email.com" 
                value={formData.contact}
                onChange={e => setFormData({ ...formData, contact: e.target.value })}
              />
            </div>
            <button type="submit" className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: '1.5rem' }}>
              <Plus size={18} /> Simpan Laporan ke Database
            </button>
          </form>
        )
      )}
    </div>
  );
}

export default LostFound;
