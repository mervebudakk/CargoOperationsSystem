import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function SenaryoGirisi() {
  const [senaryolar, setSenaryolar] = useState([]);
  const [seciliSenaryoId, setSeciliSenaryoId] = useState("");
  const [yukler, setYukler] = useState([]);
  const [istasyonlar, setIstasyonlar] = useState([]);
  const [loading, setLoading] = useState(false);
  const [yeniYuk, setYeniYuk] = useState({ istasyon_id: "", adet: "1", agirlik: "" });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (seciliSenaryoId) fetchSenaryoYukleri(seciliSenaryoId);
    else setYukler([]);
  }, [seciliSenaryoId]);

  const fetchInitialData = async () => {
    // Fetching scenarios and stations based on your schema (Table: senaryolar, istasyonlar)
    const { data: sData } = await supabase.from("senaryolar").select("*").order("id", { ascending: true });
    const { data: iData } = await supabase.from("istasyonlar").select("id, isim").order("isim");
    if (sData) setSenaryolar(sData);
    if (iData) setIstasyonlar(iData);
  };

  const fetchSenaryoYukleri = async (sId) => {
  setLoading(true);
  try {
    const { data, error } = await supabase
      .from("senaryo_yukleri")
      .select(`
        id, 
        adet,
        agirlik_kg,
        senaryo_id,
        alim_istasyon_id,
        istasyonlar!fk_senaryo_yukleri_istasyon (isim)
      `)
      .eq("senaryo_id", sId);
    
    if (error) throw error;
    setYukler(data || []);
  } catch (error) {
    console.error("Yükler çekilirken hata oluştu:", error.message);
  } finally {
    setLoading(false);
  }
};

  const handleYukEkle = async () => {
    if (!seciliSenaryoId || !yeniYuk.istasyon_id || !yeniYuk.agirlik) {
      return alert("Lütfen senaryo, istasyon ve ağırlık bilgilerini eksiksiz girin.");
    }

    const sId = parseInt(seciliSenaryoId);
    const iId = parseInt(yeniYuk.istasyon_id);
    const addCount = parseInt(yeniYuk.adet || 1);
    const addWeight = parseInt(yeniYuk.agirlik); // Schema says agirlik_kg is 'integer' in senaryo_yukleri

    setLoading(true);

    try {
      // 1. Check if station already exists in this scenario to prevent Duplicate Key (409)
      const { data: existing, error: fetchErr } = await supabase
        .from("senaryo_yukleri")
        .select("id, adet, agirlik_kg")
        .eq("senaryo_id", sId)
        .eq("alim_istasyon_id", iId)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      if (existing) {
        // 2. UPDATE: Add values to existing record
        const { error: updateErr } = await supabase
          .from("senaryo_yukleri")
          .update({
            adet: existing.adet + addCount,
            agirlik_kg: existing.agirlik_kg + addWeight
          })
          .eq("id", existing.id);
        if (updateErr) throw updateErr;
      } else {
        // 3. INSERT: Create new record using verified schema column names
        const { error: insertErr } = await supabase
          .from("senaryo_yukleri")
          .insert([{
            senaryo_id: sId,
            alim_istasyon_id: iId, // Fixed column name per schema cache error
            adet: addCount,
            agirlik_kg: addWeight
          }]);
        if (insertErr) throw insertErr;
      }

      setYeniYuk({ ...yeniYuk, agirlik: "" });
      fetchSenaryoYukleri(sId);
      
    } catch (error) {
      console.error("Operation Error:", error.message);
      alert("Hata: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleYukSifirla = async (yukId) => {
  try {
    // Veritabanında kaydı silmek yerine değerlerini 0 olarak güncelliyoruz [cite: 258, 263]
    const { error } = await supabase
      .from("senaryo_yukleri")
      .update({ 
        adet: 0, 
        agirlik_kg: 0 
      })
      .eq("id", yukId);

    if (error) throw error;
    
    // Tabloyu güncel verilerle yenile
    fetchSenaryoYukleri(seciliSenaryoId);
  } catch (error) {
    console.error("Yük sıfırlanırken hata:", error.message);
    alert("İşlem başarısız: " + error.message);
  }
};

  // Calculations based on your "Total weight" logic
  const totalWeight = yukler.reduce((acc, curr) => acc + (curr.agirlik_kg || 0), 0);

  return (
    <div style={{ display: "flex", height: "calc(100vh - 100px)", gap: "25px", padding: "20px", background: "#0a0a0a" }}>
      
      {/* SIDEBAR: INPUT */}
      <div style={sidebarStyle}>
        <h3 style={{ color: "#4caf50", marginBottom: "20px" }}>🧪 Simülasyon Girişi</h3>
        
        <div style={formGroup}>
          <label style={labelStyle}>Aktif Senaryo</label>
          <select 
            style={inputStyle} 
            value={seciliSenaryoId} 
            onChange={(e) => setSeciliSenaryoId(e.target.value)}
          >
            <option value="">Senaryo Seçiniz...</option>
            {senaryolar.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
            ))}
          </select>
        </div>

        <div style={{ ...cardStyle, marginTop: "10px" }}>
          <h4 style={{ margin: "0 0 15px 0", fontSize: "0.9rem", color: "#888" }}>Yeni Yük Tanımla</h4>
          <div style={formGroup}>
            <label style={labelStyle}>İstasyon</label>
            <select 
              style={inputStyle} 
              value={yeniYuk.istasyon_id} 
              onChange={(e) => setYeniYuk({...yeniYuk, istasyon_id: e.target.value})}
            >
              <option value="">İstasyon Seçin...</option>
              {istasyonlar.map(i => (
                <option key={i.id} value={i.id}>{i.isim}</option>
              ))}
            </select>
          </div>
          
          <div style={{ display: "flex", gap: "10px" }}>
            <div style={{ ...formGroup, flex: 1 }}>
              <label style={labelStyle}>Miktar (Adet)</label>
              <input type="number" style={inputStyle} value={yeniYuk.adet} onChange={(e) => setYeniYuk({...yeniYuk, adet: e.target.value})} />
            </div>
            <div style={{ ...formGroup, flex: 2 }}>
              <label style={labelStyle}>Toplam Ağırlık (kg)</label>
              <input type="number" style={inputStyle} value={yeniYuk.agirlik} placeholder="Örn: 100" onChange={(e) => setYeniYuk({...yeniYuk, agirlik: e.target.value})} />
            </div>
          </div>

          <button onClick={handleYukEkle} style={addBtnStyle} disabled={!seciliSenaryoId || loading}>
            {loading ? "İşleniyor..." : "Yükü Senaryoya Ekle"}
          </button>
        </div>
      </div>

      {/* MAIN: LIST */}
      <div style={mainContentStyle}>
        <div style={headerActionStyle}>
          <div>
            <h3 style={{ margin: 0, color: "white" }}>📦 Senaryo Detayları</h3>
          </div>
          <div style={statBox}>
            <span style={statLabel}>TOPLAM YÜK</span>
            <span style={statValue}>{totalWeight.toFixed(1)} kg</span>
          </div>
        </div>

        <div style={tableContainer}>
          {yukler.length > 0 ? (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>İstasyon</th>
                  <th style={thStyle}>Miktar</th>
                  <th style={thStyle}>Toplam Ağırlık</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
{yukler.map((yuk, index) => (
  <tr 
    key={`${yuk.senaryo_id}-${yuk.alim_istasyon_id}-${index}`} 
    style={trStyle}
  >
    <td style={tdStyle}>{yuk.istasyonlar?.isim || yuk.alim_istasyon_id}</td>
    <td style={tdStyle}>{yuk.adet}</td>
    <td style={tdStyle}>{yuk.agirlik_kg} kg</td>
    <td style={tdStyle}>
      <button 
        onClick={() => handleYukSifirla(yuk.id)} 
        style={deleteBtnStyle}
      >
        🔄 Sıfırla
      </button>
    </td>
  </tr>
))}
              </tbody>
            </table>
          ) : (
            <div style={emptyState}>Henüz yük tanımlanmamış.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// STYLES
const sidebarStyle = { width: "350px", background: "#141414", padding: "25px", borderRadius: "15px", border: "1px solid #222" };
const mainContentStyle = { flex: 1, display: "flex", flexDirection: "column", background: "#141414", padding: "25px", borderRadius: "15px", border: "1px solid #222", overflow: "hidden" };
const formGroup = { marginBottom: "15px" };
const labelStyle = { display: "block", marginBottom: "8px", fontSize: "0.75rem", color: "#888", fontWeight: "bold", textTransform: "uppercase" };
const inputStyle = { width: "100%", padding: "12px", background: "#0a0a0a", border: "1px solid #333", color: "white", borderRadius: "8px", boxSizing: "border-box", outline: "none" };
const cardStyle = { background: "#1a1a1a", padding: "15px", borderRadius: "10px", border: "1px solid #2a2a2a" };
const addBtnStyle = { width: "100%", padding: "12px", background: "#4caf50", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", marginTop: "10px" };
const tableContainer = { flex: 1, overflowY: "auto", marginTop: "20px" };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thStyle = { textAlign: "left", padding: "12px", color: "#4caf50", fontSize: "0.8rem", borderBottom: "1px solid #333" };
const tdStyle = { padding: "14px 12px", color: "#ccc", fontSize: "0.9rem", borderBottom: "1px solid #1a1a1a" };
const trStyle = { transition: "background 0.2s" };
const deleteBtnStyle = { background: "none", border: "none", color: "#ff5252", cursor: "pointer", fontSize: "0.8rem" };
const headerActionStyle = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #333", paddingBottom: "20px" };
const statBox = { background: "#1a1a1a", padding: "10px 20px", borderRadius: "10px", border: "1px solid #333", display: "flex", flexDirection: "column", alignItems: "center" };
const statLabel = { fontSize: "0.65rem", color: "#666", fontWeight: "bold" };
const statValue = { fontSize: "1.1rem", color: "#fff", fontWeight: "bold" };
const emptyState = { flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: "#444" };