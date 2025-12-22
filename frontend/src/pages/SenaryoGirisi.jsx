import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function SenaryoGirisi() {
  const [senaryolar, setSenaryolar] = useState([]);
  const [seciliSenaryoId, setSeciliSenaryoId] = useState("");
  const [yukler, setYukler] = useState([]);
  const [istasyonlar, setIstasyonlar] = useState([]);
  const [loading, setLoading] = useState(false);
  const [yeniYuk, setYeniYuk] = useState({ istasyon_id: "", adet: "", agirlik: "" });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (seciliSenaryoId) fetchSenaryoYukleri(seciliSenaryoId);
    else setYukler([]);
  }, [seciliSenaryoId]);

  const fetchInitialData = async () => {
    const { data: sData } = await supabase.from("senaryolar").select("*").order("created_at", { ascending: false });
    const { data: iData } = await supabase.from("istasyonlar").select("id, isim").order("isim");
    if (sData) setSenaryolar(sData);
    if (iData) setIstasyonlar(iData);
  };

  const fetchSenaryoYukleri = async (sId) => {
    setLoading(true);
    const { data } = await supabase
      .from("senaryo_yukleri")
      .select("*, istasyonlar(isim)")
      .eq("senaryo_id", sId);
    if (data) setYukler(data);
    setLoading(false);
  };

  const handleAddLoad = async (e) => {
    e.preventDefault();
    if (!seciliSenaryoId || !yeniYuk.istasyon_id) return alert("Senaryo ve istasyon seçiniz!");

    const { error } = await supabase.from("senaryo_yukleri").upsert({
      senaryo_id: seciliSenaryoId,
      alim_istasyon_id: yeniYuk.istasyon_id,
      adet: parseInt(yeniYuk.adet),
      agirlik_kg: parseInt(yeniYuk.agirlik)
    });

    if (error) alert("Hata: " + error.message);
    else {
      fetchSenaryoYukleri(seciliSenaryoId);
      setYeniYuk({ istasyon_id: "", adet: "", agirlik: "" });
    }
  };

  const toplamAgirlik = yukler.reduce((acc, curr) => acc + (curr.agirlik_kg || 0), 0);
  const toplamAdet = yukler.reduce((acc, curr) => acc + (curr.adet || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 100px)", padding: "20px", gap: "20px" }}>
      
      {/* ÜST PANEL: Sadece Seçim */}
      <div style={sectionStyle}>
        <div style={{ maxWidth: "400px" }}>
          <label style={labelStyle}>Aktif Çalışma Senaryosu</label>
          <select style={inputStyle} value={seciliSenaryoId} onChange={(e) => setSeciliSenaryoId(e.target.value)}>
            <option value="">--- Senaryo Seçin ---</option>
            {senaryolar.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({new Date(s.created_at).toLocaleDateString()})</option>
            ))}
          </select>
        </div>
      </div>

      {!seciliSenaryoId ? (
        <div style={emptyStateStyle}>
          <h2 style={{color: "#4caf50"}}>📦 Bir Senaryo Seçerek Başlayın</h2>
          <p>Seçtiğiniz plana ait kargo girişlerini sağ taraftan yapabilirsiniz.</p>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "20px", flex: 1, overflow: "hidden" }}>
          
          {/* LİSTE (SOL) - İstatistikler Başlık İçinde */}
          <div style={{ ...sectionStyle, flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "20px", borderBottom: "1px solid #333", paddingBottom: "15px" }}>
              <h3 style={{ margin: 0, color: "#4caf50" }}>📋 Senaryo Yük Detayları</h3>
              
              {/* İstasyon Yönetimi Formatındaki Kartlar */}
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={statBoxStyle}>
                   <span style={statTitleStyle}>TOPLAM YÜK</span>
                   <span style={statValueStyle}>{toplamAgirlik} kg</span>
                </div>
                <div style={statBoxStyle}>
                   <span style={statTitleStyle}>PAKET ADEDİ</span>
                   <span style={statValueStyle}>{toplamAdet}</span>
                </div>
                <div style={statBoxStyle}>
                   <span style={statTitleStyle}>DURAK</span>
                   <span style={statValueStyle}>{yukler.length}</span>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
              {loading ? <p style={{ textAlign: "center", color: "#888" }}>Veriler çekiliyor...</p> : (
                <table style={tableStyle}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #333" }}>
                      <th style={thStyle}>İstasyon</th>
                      <th style={thStyle}>Adet</th>
                      <th style={thStyle}>Ağırlık</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yukler.map((y, idx) => (
                      <tr key={idx} style={trStyle}>
                        <td style={tdStyle}>{y.istasyonlar?.isim}</td>
                        <td style={tdStyle}>{y.adet}</td>
                        <td style={tdStyle}>{y.agirlik_kg} kg</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <span style={statusBadgeStyle}>Hazır</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* FORM (SAĞ) */}
          <div style={{ ...sectionStyle, width: "350px", alignSelf: "flex-start" }}>
            <h3 style={{ marginTop: 0, color: "#4caf50", borderBottom: "1px solid #333", paddingBottom: "10px" }}>
              ➕ Yük Ekle / Güncelle
            </h3>
            <form onSubmit={handleAddLoad} style={{ display: "grid", gap: "20px", marginTop: "20px" }}>
              <div>
                <label style={labelStyle}>Hedef İstasyon</label>
                <select style={inputStyle} value={yeniYuk.istasyon_id} onChange={(e) => setYeniYuk({...yeniYuk, istasyon_id: e.target.value})} required>
                  <option value="">İlçe Seçiniz</option>
                  {istasyonlar.map(i => <option key={i.id} value={i.id}>{i.isim}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Paket Adedi</label>
                <input type="number" style={inputStyle} required value={yeniYuk.adet} onChange={(e) => setYeniYuk({...yeniYuk, adet: e.target.value})} />
              </div>
              <div>
                <label style={labelStyle}>Toplam Ağırlık (kg)</label>
                <input type="number" style={inputStyle} required value={yeniYuk.agirlik} onChange={(e) => setYeniYuk({...yeniYuk, agirlik: e.target.value})} />
              </div>
              <button type="submit" style={btnStyle}>Veritabanına İşle</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Ortak Stiller
const sectionStyle = { background: "#1a1a1a", padding: "20px", borderRadius: "12px", border: "1px solid #333" };
const labelStyle = { display: "block", marginBottom: "8px", fontSize: "0.85rem", color: "#888", fontWeight: "bold" };
const inputStyle = { padding: "12px", background: "#111", color: "white", border: "1px solid #333", borderRadius: "8px", width: "100%", boxSizing: "border-box" };
const btnStyle = { padding: "14px", background: "#4caf50", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thStyle = { textAlign: "left", padding: "12px", color: "#4caf50", fontSize: "0.85rem", textTransform: "uppercase" };
const tdStyle = { padding: "12px", color: "#ccc", fontSize: "0.9rem" };
const trStyle = { borderBottom: "1px solid #222" };
const statusBadgeStyle = { background: "#2e7d3233", color: "#4caf50", padding: "3px 8px", borderRadius: "4px", fontSize: "0.7rem", border: "1px solid #4caf50" };
const emptyStateStyle = { flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: "#444", border: "2px dashed #222", borderRadius: "12px" };

const statBoxStyle = { 
  background: "#222", 
  padding: "8px 15px", 
  borderRadius: "8px", 
  border: "1px solid #333", 
  display: "flex",        
  alignItems: "center", 
  gap: "8px",             
  minWidth: "fit-content" 
};

const statTitleStyle = { 
  fontSize: "0.65rem", 
  color: "#888", 
  fontWeight: "bold",
  whiteSpace: "nowrap" 
};

const statValueStyle = { 
  fontSize: "0.9rem", 
  color: "#4caf50", 
  fontWeight: "bold",
  whiteSpace: "nowrap" 
};