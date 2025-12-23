import { useEffect, useState } from "react";
import Harita from "../components/map";
import { supabase } from "../lib/supabaseClient";
import { istasyonlariGetirService } from "../services/api";

function RotaPlanlama({ userRole }) {
  const [senaryolar, setSenaryolar] = useState([]);
  const [seciliSenaryoId, setSeciliSenaryoId] = useState("");
  const [istasyonlar, setIstasyonlar] = useState([]);
  const [rota, setRota] = useState([]);
  const [bilgi, setBilgi] = useState("Lütfen bir senaryo seçip hesapla butonuna basınız.");
  const [loading, setLoading] = useState(false);

  // 1. Sayfa açıldığında senaryoları ve istasyonları yükle
  useEffect(() => {
    const veriYukle = async () => {
      // Senaryoları çek
      const { data: sData } = await supabase.from("senaryolar").select("*").order("created_at", { ascending: false });
      if (sData) setSenaryolar(sData);

      // İstasyonları çek
      const data = await istasyonlariGetirService();
      setIstasyonlar(data);
    };
    veriYukle();
  }, []);

  // 2. Rota Hesaplama Akışı
  const handleCalculateRoute = async () => {
    if (!seciliSenaryoId) {
      alert("Lütfen önce bir senaryo seçiniz!");
      return;
    }

    setLoading(true);
    setBilgi("Python Backend optimizasyon yapıyor...");
    
    try {
      // Backend'e seçili senaryo ID'sini gönderiyoruz
      const response = await fetch(`http://localhost:8000/solve-route?senaryo_id=${seciliSenaryoId}`);
      const res = await response.json();

      if (res.hata) {
        setBilgi("Hata: " + res.hata);
      } else {
        setRota(res.arac_rotalari);
        setBilgi(`Hesaplama Tamamlandı. Toplam Maliyet: ${res.toplam_maliyet} TL`);
      }
    } catch (error) {
      setBilgi("Rota hesaplama hatası! Backend'in çalıştığından emin olun.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Üst Panel: Kontroller */}
      <div style={mapHeaderStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
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
          <span style={{ fontSize: "0.9rem", color: "#aaa" }}>{bilgi}</span>
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
        {/* Sol Panel: Rota Detay Listesi */}
        {rota.length > 0 && (
          <div style={sidePanelStyle}>
            <h4 style={{ color: "#4caf50", marginBottom: "15px" }}>Araç Rotaları</h4>
            {rota.map((r, idx) => (
              <div key={idx} style={routeCardStyle}>
                <div style={{ fontWeight: "bold", color: "#2196F3" }}>{r.arac_isim}</div>
                <div style={{ fontSize: "0.8rem", margin: "5px 0" }}>
                  {r.rota_duraklari.join(" ➡️ ")}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#888" }}>
                  Mesafe: {r.toplam_km} km | Yük: {r.yuk} kg
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Harita Alanı */}
        <div style={{ flex: 1, position: "relative" }}>
          <Harita
            istasyonlar={istasyonlar}
            rota={rota}
            merkezKonum={[40.8222, 29.9217]}
            role={userRole}
          />
        </div>
      </div>
    </div>
  );
}

// Stiller
const mapHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", background: "#1e1e1e", borderBottom: "1px solid #333" };
const selectStyle = { padding: "8px", background: "#333", color: "white", border: "1px solid #444", borderRadius: "4px", outline: "none" };
const actionBtn = { padding: "10px 20px", color: "white", border: "none", borderRadius: "5px", fontWeight: "bold", cursor: "pointer" };
const sidePanelStyle = { width: "280px", background: "#1a1a1a", borderRight: "1px solid #333", padding: "15px", overflowY: "auto" };
const routeCardStyle = { background: "#222", padding: "12px", borderRadius: "8px", marginBottom: "10px", borderLeft: "4px solid #4caf50" };

export default RotaPlanlama;