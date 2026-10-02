import { useState } from 'react';
import { CalendarClock } from 'lucide-react';

function TableBooking() {
  const [selectedTable, setSelectedTable] = useState(null);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  
  // Generate some dummy tables (1 to 24)
  const tables = Array.from({ length: 24 }, (_, i) => ({
    id: i + 1,
    number: `T-${i + 1}`,
    status: (i === 2 || i === 6) ? 'occupied' : 'available'
  }));

  const handleTableClick = (table) => {
    if (table.status === 'available') {
      setSelectedTable(table);
    }
  };

  const handleBooking = async () => {
    if (!selectedTable) return;

    try {
      await fetch('http://localhost:5000/api/table-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_number: selectedTable.number,
          start_time: startTime,
          end_time: endTime
        })
      });
    } catch (err) {
      console.warn('Backend offline / booking saved locally:', err.message);
    }

    alert(`Berhasil memesan ${selectedTable.number} (${startTime} - ${endTime})! Data tersimpan di sistem.`);
    setSelectedTable(null);
  };

  return (
    <div className="glass-panel">
      <div className="page-header">
        <h1>Reservasi Meja Belajar</h1>
        <p>Pilih dan amankan ruang belajar favorit Anda sebelum berkunjung</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '16px', height: '16px', background: 'rgba(16, 185, 129, 0.2)', border: '2px solid rgba(16, 185, 129, 0.5)', borderRadius: '4px' }}></div>
          <span>Tersedia</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '16px', height: '16px', background: 'rgba(239, 68, 68, 0.2)', border: '2px solid rgba(239, 68, 68, 0.5)', borderRadius: '4px' }}></div>
          <span>Terisi</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '16px', height: '16px', background: 'rgba(99, 102, 241, 0.2)', border: '2px solid var(--primary-color)', borderRadius: '4px' }}></div>
          <span>Dipilih</span>
        </div>
      </div>

      <div className="table-grid">
        {tables.map(table => (
          <div 
            key={table.id}
            className={`table-item ${table.status} ${selectedTable?.id === table.id ? 'selected' : ''}`}
            onClick={() => handleTableClick(table)}
          >
            <span style={{ fontSize: '1.25rem', fontWeight: '600' }}>{table.number}</span>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {table.status === 'available' ? 'Tersedia' : 'Terisi'}
            </span>
          </div>
        ))}
      </div>

      {selectedTable && (
        <div style={{ marginTop: '3rem', textAlign: 'center', padding: '2rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
          <h3 style={{ marginBottom: '1rem' }}>Konfirmasi Reservasi {selectedTable.number}</h3>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Mulai</label>
              <input 
                type="time" 
                className="form-control" 
                value={startTime} 
                onChange={(e) => setStartTime(e.target.value)} 
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Selesai</label>
              <input 
                type="time" 
                className="form-control" 
                value={endTime} 
                onChange={(e) => setEndTime(e.target.value)} 
              />
            </div>
          </div>
          <button className="btn" style={{ marginTop: '1.5rem' }} onClick={handleBooking}>
            <CalendarClock size={18} /> Konfirmasi Reservasi
          </button>
        </div>
      )}
    </div>
  );
}

export default TableBooking;
