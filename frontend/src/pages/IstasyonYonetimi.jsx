import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function IstasyonYonetimi() {
  const [istasyonlar, setIstasyonlar] = useState([]);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [yeniIstasyon, setYeniIstasyon] = useState(() => {
    const saved = localStorage.getItem("temp_station");
    return saved ? JSON.parse(saved) : { isim: '', lat: '', lon: '' };
  });

  useEffect(() => {
    fetchIstasyonlar();
  }, []);

  useEffect(() => {
    if (!editId) {
      localStorage.setItem("temp_station", JSON.stringify(yeniIstasyon));
    }
  }, [yeniIstasyon, editId]);

  const fetchIstasyonlar = async () => {
    setLoading(true);
    const { data } = await supabase.from("istasyonlar").select("*").order("isim");
    if (data) setIstasyonlar(data);
    setLoading(false);
  };

  const handleSaveStation = async () => {
    if (!yeniIstasyon.isim || !yeniIstasyon.lat || !yeniIstasyon.lon) return alert("Boş alan bırakmayın!");

    const payload = {
      isim: yeniIstasyon.isim,
      lat: parseFloat(yeniIstasyon.lat),
      lon: parseFloat(yeniIstasyon.lon),
    };

    if (editId) {
      const { error } = await supabase.from("istasyonlar").update(payload).eq("id", editId);
      if (!error) {
        setEditId(null);
        setYeniIstasyon({ isim: "", lat: "", lon: "" });
        fetchIstasyonlar();
      }
    } else {
      const { error } = await supabase.from("istasyonlar").insert([{ ...payload, id: Math.floor(Math.random() * 100000) }]);
      if (!error) {
        localStorage.removeItem("temp_station");
        setYeniIstasyon({ isim: "", lat: "", lon: "" });
        fetchIstasyonlar();
      }
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Bu istasyonu silmek istediğinize emin misiniz?")) {
      const { error } = await supabase.from("istasyonlar").delete().eq("id", id);
      if (!error) fetchIstasyonlar();
    }
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 100px)", gap: "20px", padding: "20px" }}>
      
      {/* SOL TARAF: Mevcut İstasyon Listesi (Scroll edilebilir) */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#1a1a1a", borderRadius: "12px", border: "1px solid #333", overflow: "hidden" }}>
        <div style={{ padding: "20px", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, color: "#4caf50" }}>📋 İstasyon Listesi</h3>
          <span style={{ fontSize: "0.8rem", color: "#888" }}>{istasyonlar.length} Kayıt</span>
        </div>
        
        <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
          {loading ? <p style={{ textAlign: "center", color: "#888" }}>Yükleniyor...</p> : (
            <div style={{ display: "grid", gap: "10px" }}>
              {istasyonlar.map(st => (
                <div key={st.id} style={{ 
                  padding: "15px", background: editId === st.id ? "#2e7d3233" : "#222", 
                  borderRadius: "8px", border: editId === st.id ? "1px solid #4caf50" : "1px solid #333",
                  display: "flex", justifyContent: "space-between", alignItems: "center" 
                }}>
                  <div>
                    <div style={{ fontWeight: "bold", color: "white" }}>{st.isim}</div>
                    <div style={{ fontSize: "0.75rem", color: "#888" }}>{st.lat.toFixed(4)}, {st.lon.toFixed(4)}</div>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={() => { setEditId(st.id); setYeniIstasyon({ isim: st.isim, lat: st.lat.toString(), lon: st.lon.toString() }); }} style={actionBtnStyle}>✏️</button>
                    <button onClick={() => handleDelete(st.id)} style={{ ...actionBtnStyle, color: "#ff5252" }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SAĞ TARAF: Form Alanı (Sabit) */}
      <div style={{ width: "350px", background: "#1a1a1a", padding: "25px", borderRadius: "12px", border: "1px solid #333", alignSelf: "flex-start" }}>
        <h3 style={{ marginTop: 0, borderBottom: "1px solid #333", paddingBottom: "15px", color: editId ? "#ff9800" : "#4caf50" }}>
          {editId ? "Düzenleme Modu" : "Yeni İstasyon"}
        </h3>
        
        <div style={{ display: "grid", gap: "20px", marginTop: "20px" }}>
          <div>
            <label style={labelStyle}>İlçe Adı</label>
            <input style={inpStyle} value={yeniIstasyon.isim} onChange={(e) => setYeniIstasyon({...yeniIstasyon, isim: e.target.value})} />
          </div>
          <div>
            <label style={labelStyle}>Enlem (Latitude)</label>
            <input style={inpStyle} type="number" step="any" value={yeniIstasyon.lat} onChange={(e) => setYeniIstasyon({...yeniIstasyon, lat: e.target.value})} />
          </div>
          <div>
            <label style={labelStyle}>Boylam (Longitude)</label>
            <input style={inpStyle} type="number" step="any" value={yeniIstasyon.lon} onChange={(e) => setYeniIstasyon({...yeniIstasyon, lon: e.target.value})} />
          </div>

          <button onClick={handleSaveStation} style={{ ...btnStyle, background: editId ? "#ff9800" : "#4caf50" }}>
            {editId ? "Güncellemeyi Tamamla" : "Veritabanına Ekle"}
          </button>
          
          {editId && (
            <button onClick={() => { setEditId(null); setYeniIstasyon({ isim: "", lat: "", lon: "" }); }} style={{ ...btnStyle, background: "#444" }}>
              İptal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle = { display: "block", marginBottom: "8px", fontSize: "0.85rem", color: "#888" };
const inpStyle = { padding: "12px", background: "#111", border: "1px solid #333", color: "white", borderRadius: "8px", width: "100%", boxSizing: "border-box" };
const btnStyle = { padding: "14px", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "1rem", transition: "0.2s" };
const actionBtnStyle = { background: "#333", border: "none", color: "#4caf50", cursor: "pointer", padding: "8px", borderRadius: "6px", fontSize: "1rem" };