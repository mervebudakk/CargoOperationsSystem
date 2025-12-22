import { useEffect, useState } from "react";
import Harita from "../components/map";
import {
  istasyonlariGetirService,
  rotayiHesaplaService,
} from "../services/api";

function AnaSayfa({ userRole }) {
  const [istasyonlar, setIstasyonlar] = useState([]);
  const [rota, setRota] = useState([]);
  const [bilgi, setBilgi] = useState("Sistem Hazır");

  useEffect(() => {
    istasyonlariGetirService()
      .then(setIstasyonlar)
      .catch(() => setBilgi("Veriler alınırken hata oluştu!"));
  }, []);

  // Haritaya tıklandığında koordinatları yakalayıp localStorage'a yazar.
  // Bu sayede IstasyonEkleme.jsx sekmesine geçince veriler orada görünür.
  const handleMapClick = (coords) => {
    const currentTemp = JSON.parse(localStorage.getItem("temp_station") || "{}");
    const updatedTemp = { 
      ...currentTemp, 
      lat: coords.lat.toFixed(6), 
      lon: coords.lng.toFixed(6) 
    };
    localStorage.setItem("temp_station", JSON.stringify(updatedTemp));
    setBilgi(`Koordinat Seçildi: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
  };

  const handleCalculateRoute = async () => {
    setBilgi("Rota hesaplanıyor...");
    try {
      const res = await rotayiHesaplaService();
      setRota(res.arac_rotalari);
      setBilgi("Optimum rotalar oluşturuldu.");
    } catch (error) {
      setBilgi("Rota hesaplama hatası!");
    }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={mapHeaderStyle}>
        <span>{bilgi}</span>
        <button onClick={handleCalculateRoute} style={actionBtn}>
          ROTAYI HESAPLA 🚀
        </button>
      </div>

      <div style={{ flex: 1, position: "relative" }}>
        <Harita
          istasyonlar={istasyonlar}
          rota={rota}
          merkezKonum={[40.8222, 29.9217]}
          role={userRole}
          // Tıklama olayını buraya tekrar bağladık, akış bozulmadı.
          onMapClick={handleMapClick}
        />
      </div>
    </div>
  );
}

const mapHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 20px",
  background: "#1e1e1e",
  borderBottom: "1px solid #333",
};

const actionBtn = {
  padding: "10px 20px",
  background: "#2196F3",
  color: "white",
  border: "none",
  borderRadius: "5px",
  fontWeight: "bold",
  cursor: "pointer",
};

export default AnaSayfa;