import { useState, useEffect } from "react";
import { routeService } from "../services/api"; // Merkezi API servisi

export default function Ayarlar() {
  const [loading, setLoading] = useState(false);
  const [mesaj, setMesaj] = useState({ tip: "", metin: "" });
  
  // Backend'deki 'sistem_ayarlari' tablosu anahtarlarıyla eşleşen state
  const [params, setParams] = useState({
    km_basi_maliyet: 1,
    kiralama_maliyeti_500kg: 200,
    kiralama_maliyeti_750kg: 250,
    kiralama_maliyeti_1000kg: 300
  });

  // 1. Sayfa yüklendiğinde mevcut ayarları DB'den çek
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await routeService.getSettings();
        if (response.basarili) {
          // Gelen veriyi (anahtar:değer formatında) state'e maple
          setParams(prev => ({ ...prev, ...response.ayarlar }));
        }
      } catch (err) {
        console.error("Ayarlar yüklenemedi:", err);
      }
    };
    fetchSettings();
  }, []);

  // 2. Ayarları DB'ye kaydet
  const handleSave = async () => {
    setLoading(true);
    setMesaj({ tip: "", metin: "" });
    
    try {
      // routeService.updateSettings, backend'deki PUT /api/routes/settings endpointini çağırır
      const response = await routeService.updateSettings(params);
      
      if (response.basarili) {
        setMesaj({ tip: "success", metin: "Sistem parametreleri başarıyla güncellendi! ✅" });
      }
    } catch (err) {
      setMesaj({ tip: "error", metin: "Ayarlar kaydedilemedi: " + (err.detail || err.message) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "30px", maxWidth: "800px", background: "#0a0a0a", minHeight: "100vh" }}>
      <div style={sectionStyle}>
        <h2 style={{ color: "#4caf50", marginTop: 0, marginBottom: "10px" }}>
          ⚙️ Sistem Parametreleri
        </h2>
        <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "30px", borderBottom: "1px solid #333", paddingBottom: "15px" }}>
          Rota optimizasyon algoritması bu değerleri maliyet hesabı için kullanır.
        </p>

        {mesaj.metin && (
          <div style={mesajBoxStyle(mesaj.tip)}>{mesaj.metin}</div>
        )}
        
        <div style={{ display: "grid", gap: "25px" }}>
          {/* KM Başına Maliyet Ayarı */}
          <div style={inputGroupStyle}>
            <label style={labelStyle}>KM Başına Yakıt Maliyeti (₺)</label>
            <p style={helperTextStyle}>Araçların katettiği her kilometre için hesaplanacak birim maliyet.</p>
            <input 
              type="number" 
              step="0.1"
              style={inpStyle} 
              value={params.km_basi_maliyet} 
              onChange={(e) => setParams({...params, km_basi_maliyet: parseFloat(e.target.value)})} 
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            {/* Araç Kiralama Maliyetleri (Farklı Kapasiteler İçin) */}
            <div style={inputGroupStyle}>
              <label style={labelStyle}>500kg Kiralama Bedeli</label>
              <input 
                type="number" 
                style={inpStyle} 
                value={params.kiralama_maliyeti_500kg} 
                onChange={(e) => setParams({...params, kiralama_maliyeti_500kg: parseFloat(e.target.value)})} 
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>750kg Kiralama Bedeli</label>
              <input 
                type="number" 
                style={inpStyle} 
                value={params.kiralama_maliyeti_750kg} 
                onChange={(e) => setParams({...params, kiralama_maliyeti_750kg: parseFloat(e.target.value)})} 
              />
            </div>
          </div>

          <button 
            style={{ ...btnStyle, background: loading ? "#222" : "#4caf50" }}
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? "Kaydediliyor..." : "Sistem Ayarlarını Veritabanına Yaz"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Stiller (Dark Mode & Professional UI)
const sectionStyle = { 
  background: "#141414", 
  padding: "30px", 
  borderRadius: "16px", 
  border: "1px solid #222",
  boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
};

const labelStyle = { 
  display: "block", 
  marginBottom: "8px", 
  fontSize: "0.85rem", 
  color: "#aaa", 
  fontWeight: "bold",
  textTransform: "uppercase",
  letterSpacing: "0.5px"
};

const inpStyle = { 
  padding: "14px", 
  background: "#0a0a0a", 
  color: "white", 
  border: "1px solid #333", 
  borderRadius: "8px", 
  width: "100%", 
  boxSizing: "border-box",
  outline: "none",
  fontSize: "1rem"
};

const btnStyle = { 
  padding: "16px", 
  color: "white", 
  border: "none", 
  borderRadius: "10px", 
  cursor: "pointer", 
  fontWeight: "bold",
  fontSize: "1rem",
  transition: "all 0.3s ease",
  marginTop: "10px"
};

const inputGroupStyle = { display: "flex", flexDirection: "column", gap: "5px" };

const helperTextStyle = { fontSize: "0.75rem", color: "#555", margin: "0 0 5px 0", fontStyle: "italic" };

const mesajBoxStyle = (tip) => ({
  padding: "15px",
  borderRadius: "8px",
  marginBottom: "20px",
  background: tip === "success" ? "rgba(76, 175, 80, 0.1)" : "rgba(244, 67, 54, 0.1)",
  color: tip === "success" ? "#4caf50" : "#f44336",
  border: `1px solid ${tip === "success" ? "#4caf5044" : "#f4433644"}`,
  textAlign: "center",
  fontSize: "0.9rem"
});