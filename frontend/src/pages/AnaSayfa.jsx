import { useEffect, useState } from 'react';
import '../styles/App.css'; 
import Harita from '../components/map'; 
import { istasyonlariGetirService, rotayiHesaplaService } from '../services/api';

function AnaSayfa() {
  const [istasyonlar, setIstasyonlar] = useState([]);
  const [rota, setRota] = useState([]); 
  const [bilgi, setBilgi] = useState("Rotayı Hesaplamak için Butona Basın");

  const merkezKonum = [40.8222, 29.9217]; // İzmit Merkez

  // Sayfa açılınca istasyonları çek
  useEffect(() => {
    istasyonlariGetirService()
      .then((veri) => setIstasyonlar(veri))
      .catch(() => setBilgi("İstasyonlar yüklenemedi!"));
  }, []);

  // Butona basılınca çalışacak fonksiyon
  const handleRotayiHesapla = () => {
    setBilgi("Hesaplanıyor...");

    rotayiHesaplaService()
      .then((veri) => {
        // Gelen veriyi parçalayalım
        const gelenRota = veri.rota;
        const toplamKm = veri.toplam_km;

        // Harita formatına çevir: [lat, lon]
        const cizilecekYol = gelenRota.map(durak => [durak.lat, durak.lon]);

        setRota(cizilecekYol);
        setBilgi(`Rota Oluşturuldu! Toplam Mesafe: ${toplamKm} km`);
      })
      .catch(() => setBilgi("Rota hesaplanırken hata oluştu!"));
  };

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
      
      {/* --- ÜST PANEL (Header) --- */}
      <div style={{ padding: '15px', backgroundColor: '#333', color: 'white', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h2 style={{ margin: 0 }}>Kargo Rota Sistemi 🚚</h2>
        
        <div>
          <span style={{ marginRight: '15px', fontWeight:'bold', color: '#4caf50' }}>{bilgi}</span>
          <button 
            onClick={handleRotayiHesapla}
            style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>
            ROTAYI HESAPLA 🚀
          </button>
        </div>
      </div>

      {/* --- HARİTA ALANI --- */}
      <div style={{ flex: 1 }}>
        {/* Harita bileşenini buraya koyuyoruz ve verileri (props) gönderiyoruz */}
        <Harita 
          istasyonlar={istasyonlar} 
          rota={rota} 
          merkezKonum={merkezKonum} 
        />
      </div>

    </div>
  );
}

export default AnaSayfa;