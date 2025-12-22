import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function SenaryoGirisi() {
  const [senaryolar, setSenaryolar] = useState([]);
  const [seciliSenaryoId, setSeciliSenaryoId] = useState("");
  const [yukler, setYukler] = useState([]);
  const [istasyonlar, setIstasyonlar] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [yeniYuk, setYeniYuk] = useState({ istasyon_id: "", adet: "", agirlik: "" });

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Senaryo değiştiğinde o senaryonun yüklerini getir
  useEffect(() => {
    if (seciliSenaryoId) fetchSenaryoYukleri(seciliSenaryoId);
  }, [seciliSenaryoId]);

  const fetchInitialData = async () => {
    // Mevcut senaryoları ve istasyonları çek
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

  return (
    <div style={{ padding: "20px" }}>
      
      {/* 1. Senaryo Seçimi (Geçmiş Verilerin Korunması İçin) */}
      <div style={sectionStyle}>
        <label style={labelStyle}>İşlem Yapılacak Senaryoyu Seçin:</label>
        <select 
          style={inputStyle} 
          value={seciliSenaryoId} 
          onChange={(e) => setSeciliSenaryoId(e.target.value)}
        >
          <option value="">--- Senaryo Seçin ---</option>
          {senaryolar.map(s => (
            <option key={s.id} value={s.id}>{s.name} ({new Date(s.created_at).toLocaleDateString()})</option>
          ))}
        </select>
      </div>

      {seciliSenaryoId && (
        <div style={{ display: "flex", gap: "20px", marginTop: "20px" }}>
          {/* 2. Yeni Kargo Giriş Formu */}
          <div style={{ ...sectionStyle, flex: 1 }}>
            <h3>➕ Yeni Kargo Girişi</h3>
            <form onSubmit={handleAddLoad} style={{ display: "grid", gap: "10px" }}>
              <select 
                style={inputStyle} 
                value={yeniYuk.istasyon_id}
                onChange={(e) => setYeniYuk({...yeniYuk, istasyon_id: e.target.value})}
              >
                <option value="">Hedef İstasyon</option>
                {istasyonlar.map(i => <option key={i.id} value={i.id}>{i.isim}</option>)}
              </select>
              <input 
                type="number" placeholder="Paket Adedi" style={inputStyle}
                value={yeniYuk.adet} onChange={(e) => setYeniYuk({...yeniYuk, adet: e.target.value})}
              />
              <input 
                type="number" placeholder="Toplam Ağırlık (kg)" style={inputStyle}
                value={yeniYuk.agirlik} onChange={(e) => setYeniYuk({...yeniYuk, agirlik: e.target.value})}
              />
              <button type="submit" style={btnStyle}>Kargoyu Kaydet</button>
            </form>
          </div>

          {/* 3. Senaryo İçeriği (Tablo Görünümü) */}
          <div style={{ ...sectionStyle, flex: 2, maxHeight: "500px", overflowY: "auto" }}>
            <h3>📋 Senaryo Yük Listesi</h3>
            {loading ? <p>Yükleniyor...</p> : (
              <table style={tableStyle}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #444" }}>
                    <th style={thStyle}>İstasyon</th>
                    <th style={thStyle}>Adet</th>
                    <th style={thStyle}>Ağırlık</th>
                  </tr>
                </thead>
                <tbody>
                  {yukler.map((y, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #333" }}>
                      <td style={tdStyle}>{y.istasyonlar?.isim}</td>
                      <td style={tdStyle}>{y.adet}</td>
                      <td style={tdStyle}>{y.agirlik_kg} kg</td>
                    </tr>
                  ))}
                  {yukler.length === 0 && <tr><td colSpan="3" style={{padding: "10px", textAlign: "center"}}>Bu senaryoda henüz yük yok.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Stiller
const sectionStyle = { background: "#1e1e1e", padding: "20px", borderRadius: "10px", border: "1px solid #333" };
const labelStyle = { display: "block", marginBottom: "10px", fontWeight: "bold", color: "#aaa" };
const inputStyle = { padding: "10px", background: "#2a2a2a", color: "white", border: "1px solid #444", borderRadius: "5px", width: "100%" };
const btnStyle = { padding: "12px", background: "#4caf50", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" };
const tableStyle = { width: "100%", borderCollapse: "collapse", marginTop: "10px" };
const thStyle = { textAlign: "left", padding: "10px", color: "#4caf50" };
const tdStyle = { padding: "10px", color: "#ccc" };