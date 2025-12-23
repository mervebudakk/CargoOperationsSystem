import { useState, useEffect } from "react";
import { istasyonlariGetirService } from "../services/api";

function KargoGonder({ userId }) {
  const [istasyonlar, setIstasyonlar] = useState([]);
  const [form, setForm] = useState({
    alici_isim: "",
    cikis_istasyon_id: "",
    agirlik_kg: "",
    adet: 1
  });
  const [mesaj, setMesaj] = useState("");

  // 1. İstasyonları yükle (Kullanıcının seçebileceği varış noktaları)
  useEffect(() => {
    istasyonlariGetirService().then(setIstasyonlar);
  }, []);

  // 2. Kargo Gönderme İşlemi
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMesaj("Gönderiliyor...");

    try {
      const response = await fetch(`http://localhost:8000/send-cargo?user_id=${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          cikis_istasyon_id: parseInt(form.cikis_istasyon_id),
          agirlik_kg: parseFloat(form.agirlik_kg),
          adet: parseInt(form.adet)
        })
      });

      const res = await response.json();
      if (res.hata) {
        setMesaj("Hata: " + res.hata);
      } else {
        setMesaj("Kargonuz başarıyla oluşturuldu! Admin onayı bekleniyor.");
        setForm({ alici_isim: "", cikis_istasyon_id: "", agirlik_kg: "", adet: 1 });
      }
    } catch (error) {
      setMesaj("Sunucu bağlantı hatası!");
    }
  };

  return (
    <div style={containerStyle}>
      <h2 style={{ color: "#2196F3" }}>📦 Yeni Kargo Gönder</h2>
      <p style={{ color: "#aaa" }}>Lütfen gönderi detaylarını eksiksiz giriniz.</p>

      <form onSubmit={handleSubmit} style={formStyle}>
        <div style={inputGroup}>
          <label>Alıcı Adı Soyadı</label>
          <input 
            type="text" 
            required 
            value={form.alici_isim}
            onChange={(e) => setForm({...form, alici_isim: e.target.value})}
            style={inputStyle}
          />
        </div>

        <div style={inputGroup}>
          <label>Çıkış İlçesi</label>
          <select 
            required 
            value={form.cikis_istasyon_id}
            onChange={(e) => setForm({...form, cikis_istasyon_id: e.target.value})}
            style={inputStyle}
          >
            <option value="">İstasyon Seçiniz...</option>
  {istasyonlar
    .filter(ist => ist.isim !== "KOU Lojistik Merkezi") 
    .map(ist => (
      <option key={ist.id} value={ist.id}>{ist.isim}</option>
    ))
  }
          </select>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <div style={{ ...inputGroup, flex: 1 }}>
            <label>Ağırlık (kg)</label>
            <input 
              type="number" 
              step="0.1" 
              required 
              value={form.agirlik_kg}
              onChange={(e) => setForm({...form, agirlik_kg: e.target.value})}
              style={inputStyle}
            />
          </div>
          <div style={{ ...inputGroup, flex: 1 }}>
            <label>Adet</label>
            <input 
              type="number" 
              required 
              value={form.adet}
              onChange={(e) => setForm({...form, adet: e.target.value})}
              style={inputStyle}
            />
          </div>
        </div>

        <button type="submit" style={buttonStyle}>Kargoyu Oluştur 🚀</button>
        {mesaj && <p style={statusStyle}>{mesaj}</p>}
      </form>
    </div>
  );
}

// Stiller
const containerStyle = { maxWidth: "500px", margin: "40px auto", padding: "20px", background: "#1e1e1e", borderRadius: "10px", border: "1px solid #333" };
const formStyle = { display: "flex", flexDirection: "column", gap: "15px", marginTop: "20px" };
const inputGroup = { display: "flex", flexDirection: "column", gap: "5px" };
const inputStyle = { padding: "12px", borderRadius: "5px", border: "1px solid #444", background: "#2a2a2a", color: "white", outline: "none" };
const buttonStyle = { padding: "12px", background: "#2196F3", color: "white", border: "none", borderRadius: "5px", fontWeight: "bold", cursor: "pointer" };
const statusStyle = { marginTop: "15px", textAlign: "center", color: "#4caf50", fontWeight: "bold" };

export default KargoGonder;