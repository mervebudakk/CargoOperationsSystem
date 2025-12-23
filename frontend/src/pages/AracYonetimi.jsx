import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AracYonetimi() {
  const [araclar, setAraclar] = useState([]);
  const [istasyonlar, setIstasyonlar] = useState([]); // İstasyon listesi eklendi
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [form, setForm] = useState({
    isim: '',
    kapasite_kg: '',
    km_basi_maliyet: '1',
    kiralanabilir: false,
    kiralama_maliyeti: '0',
    baslangic_istasyon_id: '' // Yeni alan: Başlangıç Noktası
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    // Araçları ve İstasyonları aynı anda çekiyoruz
    const { data: aData } = await supabase.from("araclar").select("*, istasyonlar(isim)").order("id");
    const { data: iData } = await supabase.from("istasyonlar").select("id, isim").order("isim");
    
    if (aData) setAraclar(aData);
    if (iData) setIstasyonlar(iData);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.isim || !form.kapasite_kg || !form.baslangic_istasyon_id) {
      return alert("Lütfen isim, kapasite ve başlangıç noktasını seçiniz!");
    }

    const payload = {
      isim: form.isim,
      kapasite_kg: parseInt(form.kapasite_kg),
      km_basi_maliyet: parseFloat(form.km_basi_maliyet),
      kiralanabilir: form.kiralanabilir,
      kiralama_maliyeti: parseFloat(form.kiralama_maliyeti),
      baslangic_istasyon_id: form.baslangic_istasyon_id // Veritabanına kaydedilecek
    };

    if (editId) {
      const { error } = await supabase.from("araclar").update(payload).eq("id", editId);
      if (!error) {
        setEditId(null);
        resetForm();
        fetchInitialData();
      }
    } else {
      const { error } = await supabase.from("araclar").insert([payload]);
      if (!error) {
        resetForm();
        fetchInitialData();
      }
    }
  };

  const resetForm = () => {
    setForm({ isim: '', kapasite_kg: '', km_basi_maliyet: '1', kiralanabilir: false, kiralama_maliyeti: '0', baslangic_istasyon_id: '' });
  };

  // Silme fonksiyonu mevcut kodla aynı kalacak...

  return (
    <div style={{ display: "flex", height: "calc(100vh - 100px)", gap: "20px", padding: "20px" }}>
      
      {/* SOL TARAF: Araç Listesi */}
      <div style={panelContainerStyle}>
        <div style={panelHeaderStyle}>
          <h3 style={{ margin: 0, color: "#2196F3" }}>🚛 Filo ve Başlangıç Noktaları</h3>
        </div>
        
        <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
          {loading ? <p style={{ textAlign: "center", color: "#888" }}>Yükleniyor...</p> : (
            <div style={{ display: "grid", gap: "10px" }}>
              {araclar.map(a => (
                <div key={a.id} style={{ 
                  ...cardStyle, 
                  border: editId === a.id ? "1px solid #2196F3" : "1px solid #333",
                  background: "#222" 
                }}>
                  <div>
                    <div style={{ fontWeight: "bold", color: "white" }}>{a.isim}</div>
                    <div style={{ fontSize: "0.75rem", color: "#aaa" }}>
                      Kapasite: {a.kapasite_kg} kg | Başlangıç: <span style={{color: "#4caf50"}}>{a.istasyonlar?.isim || "Belirlenmedi"}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={() => { 
                      setEditId(a.id); 
                      setForm({ 
                        isim: a.isim, 
                        kapasite_kg: a.kapasite_kg.toString(), 
                        km_basi_maliyet: a.km_basi_maliyet.toString(),
                        kiralanabilir: a.kiralanabilir,
                        kiralama_maliyeti: a.kiralama_maliyeti.toString(),
                        baslangic_istasyon_id: a.baslangic_istasyon_id
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
          {editId ? "Aracı Düzenle" : "Yeni Araç Ekle"}
        </h3>
        
        <div style={{ display: "grid", gap: "15px", marginTop: "15px" }}>
          <div>
            <label style={labelStyle}>Araç Tanımı</label>
            <input style={inpStyle} value={form.isim} onChange={(e) => setForm({...form, isim: e.target.value})} />
          </div>

          {/* YENİ: Başlangıç Noktası Seçimi */}
          <div>
            <label style={labelStyle}>Başlangıç İstasyonu (İlk Kalkış)</label>
            <select style={inpStyle} value={form.baslangic_istasyon_id} onChange={(e) => setForm({...form, baslangic_istasyon_id: e.target.value})}>
              <option value="">İlçe Seçiniz</option>
              {istasyonlar.map(i => <option key={i.id} value={i.id}>{i.isim}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Kapasite (kg)</label>
            <input style={inpStyle} type="number" value={form.kapasite_kg} onChange={(e) => setForm({...form, kapasite_kg: e.target.value})} />
          </div>

          <button onClick={handleSave} style={{ ...btnStyle, background: editId ? "#ff9800" : "#2196F3" }}>
            {editId ? "Güncellemeyi Kaydet" : "Filoya Ekle"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Stiller öncekiyle aynı...
const panelContainerStyle = { flex: 1, display: "flex", flexDirection: "column", background: "#1a1a1a", borderRadius: "12px", border: "1px solid #333", overflow: "hidden" };
const panelHeaderStyle = { padding: "20px", borderBottom: "1px solid #333", display: "flex", justifyContent: "space-between", alignItems: "center" };
const formContainerStyle = { width: "350px", background: "#1a1a1a", padding: "25px", borderRadius: "12px", border: "1px solid #333", alignSelf: "flex-start" };
const cardStyle = { padding: "15px", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" };
const labelStyle = { display: "block", marginBottom: "8px", fontSize: "0.85rem", color: "#888" };
const inpStyle = { padding: "12px", background: "#111", border: "1px solid #333", color: "white", borderRadius: "8px", width: "100%", boxSizing: "border-box" };
const btnStyle = { padding: "14px", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const actionBtnStyle = { background: "#333", border: "none", color: "#2196F3", cursor: "pointer", padding: "8px", borderRadius: "6px" };