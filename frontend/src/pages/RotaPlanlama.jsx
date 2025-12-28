import { useEffect, useState } from "react";
import Harita from "../components/map";
import { supabase } from "../lib/supabaseClient";
import { routeService } from "../services/api";

function RotaPlanlama({ userRole }) {
  const [istasyonlar, setIstasyonlar] = useState([]);
  const [senaryolar, setSenaryolar] = useState([]);
  const [seciliSenaryoId, setSeciliSenaryoId] = useState("");
  const [problemTipi, setProblemTipi] = useState("sinirsiz_arac");
  const [rota, setRota] = useState([]);
  const [bilgi, setBilgi] = useState("Sistem Hazır");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchBaslangicVerileri = async () => {
      try {
        const { data: istData } = await supabase.from("istasyonlar").select("*").eq("aktif", true);
        if (istData) setIstasyonlar(istData);

        const { data: senData } = await supabase.from("senaryolar").select("*").order("id");
        if (senData) setSenaryolar(senData);
      } catch (err) {
        setBilgi("Veriler alınırken hata oluştu!");
        console.error("Veri çekme hatası:", err);
      }
    };
    
    fetchBaslangicVerileri();
  }, []);

  const handleMapClick = (coords) => {
    if (userRole !== 'admin') return;
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
    // Senaryo seçimi opsiyonel oldu
    setLoading(true);
    setBilgi("Optimum rota hesaplanıyor (Clarke-Wright)...");
    
    try {
      const requestData = {
        tarih: new Date().toISOString().split('T')[0],
        problem_tipi: problemTipi
      };
      
      // Senaryo seçiliyse ekle (opsiyonel)
      if (seciliSenaryoId) {
        requestData.senaryo_id = parseInt(seciliSenaryoId);
      }

      console.log("Request Data:", requestData); // Debug

      const res = await routeService.planRoute(requestData);

      console.log("API Response:", res); // Debug

      if (res.basarili) {
        setRota(res.rotalar);
        
        // Özet bilgileri göster
        const ozet = res.ozet;
        const mesaj = `Hesaplandı! 
          ${ozet.kullanilan_arac_sayisi} araç, 
          ${ozet.toplam_km.toFixed(1)} km, 
          ${ozet.toplam_maliyet.toFixed(2)} TL
          ${ozet.reddedilen_kargo_sayisi > 0 ? ` (${ozet.reddedilen_kargo_sayisi} kargo reddedildi)` : ''}`;
        
        setBilgi(mesaj);
      } else {
        setBilgi("Hata: " + (res.mesaj || "Bilinmeyen bir hata oluştu"));
      }
    } catch (error) {
      console.error("Rota hesaplama hatası:", error);
      
      // Detaylı hata mesajı
      if (error.response) {
        // Backend'den dönen hata
        const detay = error.response.data?.detail || error.response.statusText;
        setBilgi(`Backend Hatası: ${detay}`);
      } else if (error.request) {
        // Backend'e ulaşılamadı
        setBilgi("Backend'e bağlanılamıyor! Sunucu çalışıyor mu?");
      } else {
        // Diğer hatalar
        setBilgi("Hata: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={mapHeaderStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          {/* Senaryo Seçici - OPSIYONEL */}
          <select 
            style={selectStyle} 
            value={seciliSenaryoId} 
            onChange={(e) => setSeciliSenaryoId(e.target.value)}
          >
            <option value="">Tüm Bekleyen Kargolar</option>
            {senaryolar.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Problem Tipi Seçici */}
          <select 
            style={selectStyle} 
            value={problemTipi} 
            onChange={(e) => setProblemTipi(e.target.value)}
          >
            <option value="sinirsiz_arac">♾️ Sınırsız Araç (Kiralama Dahil)</option>
            <option value="belirli_arac">🚚 Sadece Mevcut Araçlar</option>
          </select>

          <span style={{ fontSize: "0.9rem", color: "#aaa" }}>{bilgi}</span>
        </div>

        <button 
          onClick={handleCalculateRoute} 
          disabled={loading}
          style={{ ...actionBtn, background: loading ? "#555" : "#4caf50" }}
        >
          {loading ? "⏳ Hesaplanıyor..." : "ROTAYI HESAPLA 🚀"}
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Rota Detay Paneli */}
        {rota.length > 0 && (
          <div style={sidePanelStyle}>
            <h4 style={{ color: "#4caf50", marginTop: 0, borderBottom: "1px solid #333", paddingBottom: "10px" }}>
              🚛 Sefer Planı ({rota.length} Rota)
            </h4>
            {rota.map((r, idx) => (
              <div key={idx} style={routeCardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                   <span style={{ fontWeight: "bold", color: r.arac_id.toString().includes('KIRALIK') ? "#ff9800" : "#2196F3" }}>
                     {r.arac_id.toString().includes('KIRALIK') ? "💰 " : "🚚 "}
                     {r.arac_isim}
                   </span>
                   <span style={{ fontSize: "0.7rem", background: "#333", padding: "2px 5px", borderRadius: "4px" }}>
                      %{r.doluluk_orani} Dolu
                   </span>
                </div>
                
                {/* Durakları listeleme */}
                <div style={{ fontSize: "0.75rem", margin: "10px 0", color: "#ddd" }}>
                  {r.duraklar && r.duraklar.map((d, dIdx) => (
                    <div key={dIdx} style={{ marginBottom: "3px" }}>
                      {d.sira}. {d.istasyon_isim} {dIdx < r.duraklar.length - 1 ? "↓" : "🏁"}
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: "0.7rem", color: "#888", borderTop: "1px solid #333", paddingTop: "5px" }}>
                  📏 Mesafe: {r.toplam_km.toFixed(1)} km <br/>
                  📦 Yük: {r.yuk_kg} kg | 💰 Maliyet: {r.maliyet.toFixed(1)} TL
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

// Stiller
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
  transition: "0.3s"
};

const sidePanelStyle = {
  width: "280px",
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
  marginBottom: "12px",
  borderLeft: "4px solid #4caf50",
  boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
};

export default RotaPlanlama;