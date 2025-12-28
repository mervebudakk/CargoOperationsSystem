import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function IstasyonYonetimi() {
  const [istasyonlar, setIstasyonlar] = useState([]);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [yeniIstasyon, setYeniIstasyon] = useState(() => {
    const saved = localStorage.getItem("temp_station");
    // ID alanını state içinde tutmuyoruz, DB otomatik atayacak (bigint)
    return saved ? JSON.parse(saved) : { isim: '', lat: '', lon: '', aktif: true };
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
    // Backend'deki istasyonlar tablosundan tüm alanları çekiyoruz
    const { data, error } = await supabase
      .from("istasyonlar")
      .select("*")
      .order("isim");
    
    if (data) setIstasyonlar(data);
    if (error) console.error("Veri çekme hatası:", error.message);
    setLoading(false);
  };

  const handleSaveStation = async () => {
    if (!yeniIstasyon.isim || !yeniIstasyon.lat || !yeniIstasyon.lon) {
      return alert("Lütfen tüm alanları doldurun!");
    }

    // Backend validasyonuna uygun veri dönüşümü
    const payload = {
      isim: yeniIstasyon.isim.trim(),
      lat: parseFloat(yeniIstasyon.lat),
      lon: parseFloat(yeniIstasyon.lon),
      aktif: yeniIstasyon.aktif ?? true
    };

    // Kocaeli sınırları kontrolü (Backend'deki algorithm_service validasyonu ile uyumlu)
    if (payload.lat < 40.0 || payload.lat > 41.5 || payload.lon < 29.0 || payload.lon > 31.0) {
      if (!window.confirm("Girdiğiniz koordinatlar Kocaeli sınırları dışında görünüyor. Yine de devam etmek istiyor musunuz?")) return;
    }

    if (editId) {
      // GÜNCELLEME (UPDATE)
      const { error } = await supabase
        .from("istasyonlar")
        .update(payload)
        .eq("id", editId);
      
      if (!error) {
        alert("İstasyon başarıyla güncellendi.");
        setEditId(null);
        setYeniIstasyon({ isim: "", lat: "", lon: "", aktif: true });
        fetchIstasyonlar();
      } else {
        alert("Güncelleme hatası: " + error.message);
      }
    } else {
      // YENİ EKLEME (INSERT)
      // ÖNEMLİ: ID atamasını Supabase (PostgreSQL) otomatik yapmalı, elle random sayı vermiyoruz
      const { error } = await supabase
        .from("istasyonlar")
        .insert([payload]);
      
      if (!error) {
        alert("Yeni istasyon başarıyla eklendi.");
        localStorage.removeItem("temp_station");
        setYeniIstasyon({ isim: "", lat: "", lon: "", aktif: true });
        fetchIstasyonlar();
      } else {
        alert("Ekleme hatası: " + error.message);
      }
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const { error } = await supabase
      .from("istasyonlar")
      .update({ aktif: !currentStatus })
      .eq("id", id);
    
    if (!error) fetchIstasyonlar();
  };

  const handleDelete = async (id) => {
    if (window.confirm("Bu istasyonu silmek istediğinize emin misiniz? (Not: Bu istasyonla bağlantılı kargolar ve mesafeler varsa hata alabilirsiniz. Pasife çekmeniz önerilir.)")) {
      const { error } = await supabase.from("istasyonlar").delete().eq("id", id);
      if (!error) {
        alert("İstasyon silindi.");
        fetchIstasyonlar();
      } else {
        alert("Silme hatası: Bu istasyon başka verilerle bağlantılı olabilir.");
      }
    }
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 100px)", gap: "20px", padding: "20px", background: "#0a0a0a" }}>
      
      {/* SOL TARAF: İstasyon Listesi */}
      <div style={panelContainerStyle}>
        <div style={panelHeaderStyle}>
          <h3 style={{ margin: 0, color: "#4caf50" }}>📋 İstasyon Yönetimi</h3>
          <span style={{ fontSize: "0.8rem", color: "#666" }}>{istasyonlar.length} Lokasyon Kayıtlı</span>
        </div>
        
        <div style={{ flex: 1, overflowY: "auto", padding: "15px" }}>
          {loading ? <p style={{ textAlign: "center", color: "#888" }}>Yükleniyor...</p> : (
            <div style={{ display: "grid", gap: "12px" }}>
              {istasyonlar.map(st => (
                <div key={st.id} style={{ 
                  padding: "15px", background: editId === st.id ? "#2e7d3233" : "#1a1a1a", 
                  borderRadius: "10px", border: editId === st.id ? "1px solid #4caf50" : "1px solid #2a2a2a",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  opacity: st.aktif ? 1 : 0.5
                }}>
                  <div>
                    <div style={{ fontWeight: "bold", color: "white" }}>{st.isim}</div>
                    <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "4px" }}>
                      📍 {st.lat.toFixed(6)}, {st.lon.toFixed(6)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => handleToggleStatus(st.id, st.aktif)} title="Aktif/Pasif" style={actionBtnStyle}>
                      {st.aktif ? "🟢" : "🔴"}
                    </button>
                    <button onClick={() => { 
                      setEditId(st.id); 
                      setYeniIstasyon({ isim: st.isim, lat: st.lat.toString(), lon: st.lon.toString(), aktif: st.aktif }); 
                    }} style={{...actionBtnStyle, color: "#2196F3"}}>✏️</button>
                    <button onClick={() => handleDelete(st.id)} style={{ ...actionBtnStyle, color: "#ff5252" }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SAĞ TARAF: Form Alanı */}
      <div style={formContainerStyle}>
        <h3 style={{ marginTop: 0, borderBottom: "1px solid #333", paddingBottom: "15px", color: editId ? "#ff9800" : "#4caf50" }}>
          {editId ? "⚙️ İstasyonu Düzenle" : "➕ Yeni İstasyon"}
        </h3>
        
        <div style={{ display: "grid", gap: "15px", marginTop: "15px" }}>
          <div>
            <label style={labelStyle}>İlçe / İstasyon Adı</label>
            <input style={inpStyle} value={yeniIstasyon.isim} onChange={(e) => setYeniIstasyon({...yeniIstasyon, isim: e.target.value})} placeholder="Örn: Kartepe Toplama Merkezi" />
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Enlem (Lat)</label>
              <input style={inpStyle} type="number" step="any" value={yeniIstasyon.lat} onChange={(e) => setYeniIstasyon({...yeniIstasyon, lat: e.target.value})} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Boylam (Lon)</label>
              <input style={inpStyle} type="number" step="any" value={yeniIstasyon.lon} onChange={(e) => setYeniIstasyon({...yeniIstasyon, lon: e.target.value})} />
            </div>
          </div>
          
          <p style={{ fontSize: "0.7rem", color: "#666", fontStyle: "italic" }}>
            * Haritadan bir noktaya tıklayarak koordinatları otomatik getirebilirsiniz.
          </p>

          <button onClick={handleSaveStation} style={{ ...btnStyle, background: editId ? "#ff9800" : "#4caf50" }}>
            {editId ? "Değişiklikleri Kaydet" : "Sisteme Tanımla"}
          </button>
          
          {editId && (
            <button onClick={() => { setEditId(null); setYeniIstasyon({ isim: "", lat: "", lon: "", aktif: true }); }} style={{ ...btnStyle, background: "#333" }}>
              İptal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const panelContainerStyle = { flex: 1, display: "flex", flexDirection: "column", background: "#1a1a1a", borderRadius: "12px", border: "1px solid #333", overflow: "hidden" };
const panelHeaderStyle = { padding: "20px", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#111" };
const formContainerStyle = { width: "380px", background: "#1a1a1a", padding: "25px", borderRadius: "12px", border: "1px solid #333", alignSelf: "flex-start" };
const labelStyle = { display: "block", marginBottom: "8px", fontSize: "0.85rem", color: "#aaa", fontWeight: "500" };
const inpStyle = { padding: "12px", background: "#0a0a0a", border: "1px solid #333", color: "white", borderRadius: "8px", width: "100%", boxSizing: "border-box", fontSize: "0.9rem" };
const btnStyle = { padding: "14px", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "0.9rem" };
const actionBtnStyle = { background: "transparent", border: "none", cursor: "pointer", padding: "5px", fontSize: "1.1rem" };