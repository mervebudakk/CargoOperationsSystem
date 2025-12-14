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
    setRota([]); // Önceki rotayı temizle

    rotayiHesaplaService()
        .then((veri) => {
            
            // Hata Kontrolü
            if (!veri || !veri.arac_rotalari || veri.durum !== "VRP Rotalama Tamamlandı") {
                console.error("VRP Veri Formatı Hatalı veya Başarısız:", veri);
                setBilgi("Kritik Hata: Rota verisi alınamadı.");
                return;
            }

            // VRP'den gelen çoklu rotaları tek bir liste haline getiriyoruz (Harita için)
            let tumCizimKoordinatlari = [];
            
            // Renk paleti tanımlayalım (3 araç için)
            const renkler = ["blue", "red", "green", "orange"];

            // Her bir araç rotasını döngüye al
            veri.arac_rotalari.forEach((arac_rotasi, index) => {
                const cizimKordinatlari = arac_rotasi.cizim_koordinatlari;

                tumCizimKoordinatlari.push({
                    id: arac_rotasi.rota_id, // Bu ID 0, 1 gibi bir sayı olacak
                    yol: cizimKordinatlari,
                    // Index'e göre renk ata: (0 -> blue, 1 -> red)
                    renk: renkler[index % renkler.length], 
                    musteri_sayisi: arac_rotasi.musteriler.length,
                    km: arac_rotasi.toplam_km
                });
            });

            setRota(tumCizimKoordinatlari); 
            
            setBilgi(
                `✅ Rota Tamam! ${veri.arac_sayisi} Araç Kullanıldı. Toplam KM: ${veri.genel_toplam_km.toFixed(2)}`
            ); 

        })
        .catch((hata) => {
            console.error("Rota hesaplama API hatası:", hata);
            setBilgi("Rota hesaplanırken kritik hata oluştu! (Konsolu kontrol et)");
        });
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