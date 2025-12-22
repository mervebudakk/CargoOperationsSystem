import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function IstasyonEkleme() {
  // Form verilerini tarayıcı hafızasından (localStorage) başlatır
  const [yeniIstasyon, setYeniIstasyon] = useState(() => {
    const saved = localStorage.getItem("temp_station");
    return saved ? JSON.parse(saved) : { isim: '', lat: '', lon: '' };
  });

  // Formdaki her değişiklikte hafızayı günceller
  useEffect(() => {
    localStorage.setItem("temp_station", JSON.stringify(yeniIstasyon));
  }, [yeniIstasyon]);

  const handleSaveStation = async () => {
    if (!yeniIstasyon.isim || !yeniIstasyon.lat || !yeniIstasyon.lon) {
      alert("Lütfen tüm alanları doldurunuz!");
      return;
    }

    const { error } = await supabase.from("istasyonlar").insert([
      {
        id: Math.floor(Math.random() * 100000),
        isim: yeniIstasyon.isim,
        lat: parseFloat(yeniIstasyon.lat),
        lon: parseFloat(yeniIstasyon.lon),
      },
    ]);

    if (error) {
      alert("Hata: " + error.message);
    } else {
      alert("İstasyon başarıyla eklendi!");
      localStorage.removeItem("temp_station"); // Kayıt sonrası hafızayı temizle
      setYeniIstasyon({ isim: "", lat: "", lon: "" });
    }
  };

  return (
    <div style={{ padding: "40px", maxWidth: "600px", margin: "0 auto" }}>
      <h2 style={{ borderBottom: "2px solid #4caf50", paddingBottom: "10px" }}>
        📍 Yeni İstasyon Kaydı
      </h2>
      <p style={{ color: "#aaa", marginBottom: "20px" }}>
        Lütfen ilçenin resmi koordinat bilgilerini manuel olarak giriniz.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div>
          <label style={labelStyle}>İstasyon (İlçe) Adı</label>
          <input
            style={inpStyle}
            placeholder="Örn: Başiskele"
            value={yeniIstasyon.isim}
            onChange={(e) => setYeniIstasyon({ ...yeniIstasyon, isim: e.target.value })}
          />
        </div>

        <div style={{ display: "flex", gap: "15px" }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Enlem (Latitude)</label>
            <input
              style={inpStyle}
              type="number"
              step="any"
              placeholder="40.XXXX"
              value={yeniIstasyon.lat}
              onChange={(e) => setYeniIstasyon({ ...yeniIstasyon, lat: e.target.value })}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Boylam (Longitude)</label>
            <input
              style={inpStyle}
              type="number"
              step="any"
              placeholder="29.XXXX"
              value={yeniIstasyon.lon}
              onChange={(e) => setYeniIstasyon({ ...yeniIstasyon, lon: e.target.value })}
            />
          </div>
        </div>

        <button style={btnStyle} onClick={handleSaveStation}>
          Veritabanına Kaydet
        </button>
      </div>
    </div>
  );
}

const labelStyle = { display: "block", marginBottom: "5px", fontSize: "0.9rem", color: "#4caf50", fontWeight: "bold" };
const inpStyle = { padding: "12px", background: "#222", border: "1px solid #444", color: "white", borderRadius: "6px", width: "100%" };
const btnStyle = { padding: "12px", background: "#4caf50", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" };