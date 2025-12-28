import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AracYonetimi() {
  const [araclar, setAraclar] = useState([]);
  const [istasyonlar, setIstasyonlar] = useState([]);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [form, setForm] = useState({
    isim: '',
    kapasite_kg: '',
    km_basi_maliyet: '1.0', // Backend: double precision
    kiralanabilir: false,   // Backend: boolean
    kiralama_maliyeti: '0', // Backend: double precision
    baslangic_istasyon_id: '',
    aktif: true             // Backend: boolean (default true)
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    // İlişkisel veri çekme: istasyonlar(isim) backend'deki Foreign Key üzerinden çalışır
    const { data: aData } = await supabase
      .from("araclar")
      .select("*, istasyonlar(isim)")
      .order("id");
    
    const { data: iData } = await supabase
      .from("istasyonlar")
      .select("id, isim")
      .eq("aktif", true) // Sadece aktif istasyonları kalkış noktası yapabiliriz
      .order("isim");
    
    if (aData) setAraclar(aData);
    if (iData) setIstasyonlar(iData);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.isim || !form.kapasite_kg || !form.baslangic_istasyon_id) {
      return alert("Lütfen isim, kapasite ve başlangıç noktasını seçiniz!");
    }

    // Backend veri tiplerine tam uyum için dönüşüm
    const payload = {
      isim: form.isim,
      kapasite_kg: parseInt(form.kapasite_kg),
      km_basi_maliyet: parseFloat(form.km_basi_maliyet),
      kiralanabilir: form.kiralanabilir,
      kiralama_maliyeti: parseFloat(form.kiralama_maliyeti),
      baslangic_istasyon_id: parseInt(form.baslangic_istasyon_id),
      aktif: form.aktif
    };

    if (editId) {
      const { error } = await supabase.from("araclar").update(payload).eq("id", editId);
      if (!error) {
        alert("Araç güncellendi.");
        setEditId(null);
        resetForm();
        fetchInitialData();
      } else {
        alert("Güncelleme hatası: " + error.message);
      }
    } else {
      const { error } = await supabase.from("araclar").insert([payload]);
      if (!error) {
        alert("Yeni araç filoya eklendi.");
        resetForm();
        fetchInitialData();
      } else {
        alert("Ekleme hatası: " + error.message);
      }
    }
  };

  const resetForm = () => {
    setForm({ 
      isim: '', 
      kapasite_kg: '', 
      km_basi_maliyet: '1.0', 
      kiralanabilir: false, 
      kiralama_maliyeti: '0', 
      baslangic_istasyon_id: '',
      aktif: true 
    });
  };

  const handleToggleAktif = async (id, mevcutDurum) => {
    const { error } = await supabase
      .from("araclar")
      .update({ aktif: !mevcutDurum })
      .eq("id", id);
    if (!error) fetchInitialData();
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 100px)", gap: "20px", padding: "20px", background: "#0a0a0a" }}>
      
      {/* SOL TARAF: Araç Listesi */}
      <div style={panelContainerStyle}>
        <div style={panelHeaderStyle}>
          <h3 style={{ margin: 0, color: "#2196F3" }}>🚛 Araç Filosu Yönetimi</h3>
          <span style={{ fontSize: "0.8rem", color: "#666" }}>{araclar.length} Araç Kayıtlı</span>
        </div>
        
        <div style={{ flex: 1, overflowY: "auto", padding: "15px" }}>
          {loading ? <p style={{ textAlign: "center", color: "#888" }}>Yükleniyor...</p> : (
            <div style={{ display: "grid", gap: "12px" }}>
              {araclar.map(a => (
                <div key={a.id} style={{ 
                  ...cardStyle, 
                  border: editId === a.id ? "2px solid #2196F3" : "1px solid #333",
                  opacity: a.aktif ? 1 : 0.5
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontWeight: "bold", color: "white" }}>{a.isim}</span>
                      {a.kiralanabilir && <span style={badgeStyle}>Kiralık</span>}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#aaa", marginTop: "4px" }}>
                      Kapasite: <strong>{a.kapasite_kg} kg</strong> | 
                      Maliyet: <strong>{a.km_basi_maliyet} TL/km</strong>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#888" }}>
                      Kalkış: <span style={{color: "#4caf50"}}>{a.istasyonlar?.isim || "Belirlenmedi"}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button onClick={() => handleToggleAktif(a.id, a.aktif)} style={{...actionBtnStyle, color: a.aktif ? "#4caf50" : "#f44336"}}>
                      {a.aktif ? "🟢" : "🔴"}
                    </button>
                    <button onClick={() => { 
                      setEditId(a.id); 
                      setForm({ 
                        isim: a.isim, 
                        kapasite_kg: a.kapasite_kg.toString(), 
                        km_basi_maliyet: a.km_basi_maliyet.toString(),
                        kiralanabilir: a.kiralanabilir,
                        kiralama_maliyeti: a.kiralama_maliyeti.toString(),
                        baslangic_istasyon_id: a.baslangic_istasyon_id,
                        aktif: a.aktif
                      }); 
                    }} style={actionBtnStyle}>✏️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SAĞ TARAF: Form Alanı */}
      <div style={formContainerStyle}>
        <h3 style={{ marginTop: 0, borderBottom: "1px solid #333", paddingBottom: "15px", color: editId ? "#ff9800" : "#2196F3" }}>
          {editId ? "⚙️ Aracı Düzenle" : "➕ Yeni Araç Ekle"}
        </h3>
        
        <div style={{ display: "grid", gap: "15px", marginTop: "15px" }}>
          <div>
            <label style={labelStyle}>Araç İsmi / Plaka</label>
            <input style={inpStyle} value={form.isim} onChange={(e) => setForm({...form, isim: e.target.value})} placeholder="Örn: 41 ABC 41" />
          </div>

          <div>
            <label style={labelStyle}>Başlangıç İstasyonu (Sabah Kalkış)</label>
            <select style={inpStyle} value={form.baslangic_istasyon_id} onChange={(e) => setForm({...form, baslangic_istasyon_id: e.target.value})}>
              <option value="">Lütfen Seçiniz</option>
              {istasyonlar.map(i => <option key={i.id} value={i.id}>{i.isim}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Kapasite (kg)</label>
              <input style={inpStyle} type="number" value={form.kapasite_kg} onChange={(e) => setForm({...form, kapasite_kg: e.target.value})} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Maliyet (TL/km)</label>
              <input style={inpStyle} type="number" step="0.1" value={form.km_basi_maliyet} onChange={(e) => setForm({...form, km_basi_maliyet: e.target.value})} />
            </div>
          </div>

          <div style={{ background: "#222", padding: "12px", borderRadius: "8px", border: "1px solid #333" }}>
            <label style={{ ...labelStyle, display: "flex", alignItems: "center", cursor: "pointer", margin: 0 }}>
              <input 
                type="checkbox" 
                checked={form.kiralanabilir} 
                onChange={(e) => setForm({...form, kiralanabilir: e.target.checked})} 
                style={{ marginRight: "10px" }}
              />
              Dışarıdan Kiralanabilir Araç
            </label>
            {form.kiralanabilir && (
              <div style={{ marginTop: "10px" }}>
                <label style={labelStyle}>Günlük Kiralama Bedeli (TL)</label>
                <input style={inpStyle} type="number" value={form.kiralama_maliyeti} onChange={(e) => setForm({...form, kiralama_maliyeti: e.target.value})} />
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button onClick={handleSave} style={{ ...btnStyle, flex: 2, background: editId ? "#ff9800" : "#2196F3" }}>
              {editId ? "Güncellemeyi Kaydet" : "Filoya Dahil Et"}
            </button>
            {editId && (
              <button onClick={() => { setEditId(null); resetForm(); }} style={{ ...btnStyle, flex: 1, background: "#333" }}>
                İptal
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Stiller ve Yeni Eklemeler
const panelContainerStyle = { flex: 1, display: "flex", flexDirection: "column", background: "#1a1a1a", borderRadius: "12px", border: "1px solid #333", overflow: "hidden" };
const panelHeaderStyle = { padding: "20px", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#111" };
const formContainerStyle = { width: "380px", background: "#1a1a1a", padding: "25px", borderRadius: "12px", border: "1px solid #333", alignSelf: "flex-start" };
const cardStyle = { padding: "15px", borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#222", transition: "0.2s" };
const labelStyle = { display: "block", marginBottom: "8px", fontSize: "0.85rem", color: "#aaa", fontWeight: "500" };
const inpStyle = { padding: "12px", background: "#0a0a0a", border: "1px solid #333", color: "white", borderRadius: "8px", width: "100%", boxSizing: "border-box", fontSize: "0.9rem" };
const btnStyle = { padding: "14px", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "0.9rem" };
const actionBtnStyle = { background: "transparent", border: "none", cursor: "pointer", padding: "8px", fontSize: "1.1rem" };
const badgeStyle = { background: "#ff980022", color: "#ff9800", padding: "2px 8px", borderRadius: "4px", fontSize: "0.65rem", border: "1px solid #ff980044", textTransform: "uppercase", fontWeight: "bold" };