import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AracYonetimi() {
  const [araclar, setAraclar] = useState([]);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [form, setForm] = useState({
    isim: '',
    kapasite_kg: '',
    km_basi_maliyet: '1',
    kiralanabilir: false,
    kiralama_maliyeti: '0'
  });

  useEffect(() => {
    fetchAraclar();
  }, []);

  const fetchAraclar = async () => {
    setLoading(true);
    const { data } = await supabase.from("araclar").select("*").order("id");
    if (data) setAraclar(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.isim || !form.kapasite_kg) return alert("İsim ve kapasite alanları zorunludur!");

    const payload = {
      isim: form.isim,
      kapasite_kg: parseInt(form.kapasite_kg),
      km_basi_maliyet: parseFloat(form.km_basi_maliyet),
      kiralanabilir: form.kiralanabilir,
      kiralama_maliyeti: parseFloat(form.kiralama_maliyeti)
    };

    if (editId) {
      const { error } = await supabase.from("araclar").update(payload).eq("id", editId);
      if (!error) {
        setEditId(null);
        setForm({ isim: '', kapasite_kg: '', km_basi_maliyet: '1', kiralanabilir: false, kiralama_maliyeti: '0' });
        fetchAraclar();
      }
    } else {
      const { error } = await supabase.from("araclar").insert([payload]);
      if (!error) {
        setForm({ isim: '', kapasite_kg: '', km_basi_maliyet: '1', kiralanabilir: false, kiralama_maliyeti: '0' });
        fetchAraclar();
      }
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Bu aracı filodan kaldırmak istediğinize emin misiniz?")) {
      const { error } = await supabase.from("araclar").delete().eq("id", id);
      if (!error) fetchAraclar();
    }
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 100px)", gap: "20px", padding: "20px" }}>
      
      {/* SOL TARAF: Araç Listesi */}
      <div style={panelContainerStyle}>
        <div style={panelHeaderStyle}>
          <h3 style={{ margin: 0, color: "#2196F3" }}>🚛 Filo Listesi</h3>
          <span style={{ fontSize: "0.8rem", color: "#888" }}>{araclar.length} Araç Kayıtlı</span>
        </div>
        
        <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
          {loading ? <p style={{ textAlign: "center", color: "#888" }}>Yükleniyor...</p> : (
            <div style={{ display: "grid", gap: "10px" }}>
              {araclar.map(a => (
                <div key={a.id} style={{ 
                  ...cardStyle, 
                  border: editId === a.id ? "1px solid #2196F3" : "1px solid #333",
                  background: a.kiralanabilir ? "#1a237e33" : "#222" 
                }}>
                  <div>
                    <div style={{ fontWeight: "bold", color: "white" }}>{a.isim}</div>
                    <div style={{ fontSize: "0.75rem", color: "#aaa" }}>
                      Kapasite: {a.kapasite_kg} kg | KM Maliyet: {a.km_basi_maliyet}
                    </div>
                    {a.kiralanabilir && <small style={{color: "#ff9800"}}>Kiralık (Bedel: {a.kiralama_maliyeti})</small>}
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={() => { 
                      setEditId(a.id); 
                      setForm({ 
                        isim: a.isim, 
                        kapasite_kg: a.kapasite_kg.toString(), 
                        km_basi_maliyet: a.km_basi_maliyet.toString(),
                        kiralanabilir: a.kiralanabilir,
                        kiralama_maliyeti: a.kiralama_maliyeti.toString()
                      }); 
                    }} style={actionBtnStyle}>✏️</button>
                    <button onClick={() => handleDelete(a.id)} style={{ ...actionBtnStyle, color: "#ff5252" }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SAĞ TARAF: Araç Düzenleme Formu */}
      <div style={formContainerStyle}>
        <h3 style={{ marginTop: 0, borderBottom: "1px solid #333", paddingBottom: "15px", color: editId ? "#ff9800" : "#2196F3" }}>
          {editId ? "Aracı Düzenle" : "Yeni Araç Ekle"}
        </h3>
        
        <div style={{ display: "grid", gap: "15px", marginTop: "15px" }}>
          <div>
            <label style={labelStyle}>Araç Tanımı</label>
            <input style={inpStyle} value={form.isim} onChange={(e) => setForm({...form, isim: e.target.value})} placeholder="Örn: Araç 1 (500 kg)" />
          </div>
          <div>
            <label style={labelStyle}>Taşıma Kapasitesi (kg)</label>
            <input style={inpStyle} type="number" value={form.kapasite_kg} onChange={(e) => setForm({...form, kapasite_kg: e.target.value})} />
          </div>
          <div>
            <label style={labelStyle}>KM Başı Maliyet (Birim)</label>
            <input style={inpStyle} type="number" step="0.1" value={form.km_basi_maliyet} onChange={(e) => setForm({...form, km_basi_maliyet: e.target.value})} />
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", background: "#222", borderRadius: "8px" }}>
            <input type="checkbox" checked={form.kiralanabilir} onChange={(e) => setForm({...form, kiralanabilir: e.target.checked})} />
            <label style={{ fontSize: "0.85rem", color: "white" }}>Bu araç kiralık bir araçtır</label>
          </div>

          {form.kiralanabilir && (
            <div>
              <label style={labelStyle}>Sabit Kiralama Bedeli</label>
              <input style={inpStyle} type="number" value={form.kiralama_maliyeti} onChange={(e) => setForm({...form, kiralama_maliyeti: e.target.value})} />
            </div>
          )}

          <button onClick={handleSave} style={{ ...btnStyle, background: editId ? "#ff9800" : "#2196F3" }}>
            {editId ? "Güncellemeyi Kaydet" : "Filoya Ekle"}
          </button>
          
          {editId && (
            <button onClick={() => { setEditId(null); setForm({ isim: '', kapasite_kg: '', km_basi_maliyet: '1', kiralanabilir: false, kiralama_maliyeti: '0' }); }} style={{ ...btnStyle, background: "#444" }}>
              İptal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Stiller (İstasyonYonetimi ile uyumlu)
const panelContainerStyle = { flex: 1, display: "flex", flexDirection: "column", background: "#1a1a1a", borderRadius: "12px", border: "1px solid #333", overflow: "hidden" };
const panelHeaderStyle = { padding: "20px", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" };
const formContainerStyle = { width: "350px", background: "#1a1a1a", padding: "25px", borderRadius: "12px", border: "1px solid #333", alignSelf: "flex-start" };
const cardStyle = { padding: "15px", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" };
const labelStyle = { display: "block", marginBottom: "8px", fontSize: "0.85rem", color: "#888" };
const inpStyle = { padding: "12px", background: "#111", border: "1px solid #333", color: "white", borderRadius: "8px", width: "100%", boxSizing: "border-box" };
const btnStyle = { padding: "14px", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const actionBtnStyle = { background: "#333", border: "none", color: "#2196F3", cursor: "pointer", padding: "8px", borderRadius: "6px" };