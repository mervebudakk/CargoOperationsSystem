import { useEffect, useState } from "react";
import Harita from "../components/map";
import { supabase } from "../lib/supabaseClient"; // Senaryoları çekmek için eklendi
import {
  istasyonlariGetirService,
} from "../services/api";

function AnaSayfa({ userRole }) {
  const [istasyonlar, setIstasyonlar] = useState([]);
  const [senaryolar, setSenaryolar] = useState([]); // Yeni
  const [seciliSenaryoId, setSeciliSenaryoId] = useState(""); // Yeni
  const [rota, setRota] = useState([]);
  const [bilgi, setBilgi] = useState("Sistem Hazır");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // İstasyonları Getir
    istasyonlariGetirService()
      .then(setIstasyonlar)
      .catch(() => setBilgi("Veriler alınırken hata oluştu!"));

    // Senaryoları Getir
    const fetchSenaryolar = async () => {
      const { data } = await supabase.from("senaryolar").select("*").order("id");
      if (data) setSenaryolar(data);
    };
    fetchSenaryolar();
  }, []);

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
  if (!seciliSenaryoId) {
    setBilgi("Lütfen önce bir senaryo seçin!");
    return;
  }
  setBilgi("Optimum rota hesaplanıyor...");
  try {
    // Statik servis yerine dinamik senaryo ID'si ile istek atıyoruz
    const response = await fetch(`http://localhost:8000/solve-route?senaryo_id=${seciliSenaryoId}`);
    const res = await response.json();

    if (res.hata) {
      setBilgi("Hata: " + res.hata); // Backend'den gelen spesifik hatayı gösterir
    } else {
      setRota(res.arac_rotalari);
      setBilgi(`Optimum rotalar oluşturuldu. Toplam Maliyet: ${res.toplam_maliyet} TL`);
    }
  } catch (error) {
    setBilgi("Rota hesaplama hatası! Backend bağlantısını kontrol edin.");
  }
};

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={mapHeaderStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          {/* Senaryo Seçici eklendi */}
          <select 
            style={selectStyle} 
            value={seciliSenaryoId} 
            onChange={(e) => setSeciliSenaryoId(e.target.value)}
          >
            <option value="">Senaryo Seçiniz...</option>
            {senaryolar.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <span style={{ fontSize: "0.9rem" }}>{bilgi}</span>
        </div>

        <button 
          onClick={handleCalculateRoute} 
          disabled={loading}
          style={{ ...actionBtn, background: loading ? "#555" : "#2196F3" }}
        >
          {loading ? "Hesaplanıyor..." : "ROTAYI HESAPLA 🚀"}
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Rota Detay Paneli: Sadece rota varsa görünür */}
        {rota.length > 0 && (
          <div style={sidePanelStyle}>
            <h4 style={{ color: "#4caf50", marginTop: 0 }}>Araç Detayları</h4>
            {rota.map((r, idx) => (
              <div key={idx} style={routeCardStyle}>
                <div style={{ fontWeight: "bold", color: "#2196F3" }}>{r.arac_isim}</div>
                <div style={{ fontSize: "0.75rem", margin: "5px 0" }}>
                  {r.rota_duraklari.join(" ➡️ ")} 🏁
                </div>
                <div style={{ fontSize: "0.7rem", color: "#888" }}>
                  Mesafe: {r.toplam_km} km | Maliyet: {r.maliyet} TL
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ flex: 1, position: "relative" }}>
          <Harita
            istasyonlar={istasyonlar}
            rota={rota}
            merkezKonum={[40.8222, 29.9217]}
            role={userRole}
            onMapClick={handleMapClick}
          />
        </div>
      </div>
    </div>
  );
}

// Mevcut stillere eklemeler yapıldı
const mapHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 20px",
  background: "#1e1e1e",
  borderBottom: "1px solid #333",
};

const selectStyle = {
  padding: "8px",
  background: "#333",
  color: "white",
  border: "1px solid #444",
  borderRadius: "4px",
  outline: "none",
  cursor: "pointer"
};

const actionBtn = {
  padding: "10px 20px",
  color: "white",
  border: "none",
  borderRadius: "5px",
  fontWeight: "bold",
  cursor: "pointer",
};

const sidePanelStyle = {
  width: "260px",
  background: "#1a1a1a",
  borderRight: "1px solid #333",
  padding: "15px",
  overflowY: "auto",
  zIndex: 10
};

const routeCardStyle = {
  background: "#222",
  padding: "12px",
  borderRadius: "8px",
  marginBottom: "10px",
  borderLeft: "4px solid #4caf50"
};

export default AnaSayfa;