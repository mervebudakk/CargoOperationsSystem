// pages/Ayarlar.jsx
import { useState } from "react";

export default function Ayarlar() {
  // Proje başlangıç değerleri: KM maliyeti 1 birim, kiralama 200 birim 
  const [params, setParams] = useState({
    kmMaliyeti: 1,
    kiralamaBedeli: 200,
    varsayilanKapasite: 500
  });

  return (
    <div style={{ padding: "30px", maxWidth: "800px" }}>
      <div style={sectionStyle}>
        <h2 style={{ color: "#4caf50", marginTop: 0, marginBottom: "25px", borderBottom: "1px solid #333", paddingBottom: "15px" }}>
          ⚙️ Sistem Parametreleri
        </h2>
        
        <div style={{ display: "grid", gap: "25px" }}>
          {/* KM Başına Maliyet Ayarı [cite: 37] */}
          <div style={inputGroupStyle}>
            <label style={labelStyle}>KM Başına Yakıt Maliyeti (Birim)</label>
            <p style={helperTextStyle}>Yol maliyeti hesaplamalarında baz alınacak birim değer[cite: 37].</p>
            <input 
              type="number" 
              style={inpStyle} 
              value={params.kmMaliyeti} 
              onChange={(e) => setParams({...params, kmMaliyeti: e.target.value})} 
            />
          </div>

          {/* Araç Kiralama Maliyeti Ayarı [cite: 40] */}
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Araç Kiralama Maliyeti (Birim)</label>
            <p style={helperTextStyle}>Sınırsız araç senaryosunda eklenen her kiralık araç için uygulanacak sabit maliyet[cite: 31, 40].</p>
            <input 
              type="number" 
              style={inpStyle} 
              value={params.kiralamaBedeli} 
              onChange={(e) => setParams({...params, kiralamaBedeli: e.target.value})} 
            />
          </div>

          <button 
            style={btnStyle}
            onClick={() => alert("Sistem parametreleri güncellendi!")}
          >
            Sistem Ayarlarını Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

const sectionStyle = { 
  background: "#1a1a1a", 
  padding: "30px", 
  borderRadius: "12px", 
  border: "1px solid #333" 
}

const labelStyle = { 
  display: "block", 
  marginBottom: "8px", 
  fontSize: "0.85rem", 
  color: "#888", 
  fontWeight: "bold" 
}

const inpStyle = { 
  padding: "12px", 
  background: "#111", 
  color: "white", 
  border: "1px solid #333", 
  borderRadius: "8px", 
  width: "100%", 
  boxSizing: "border-box" 
}

const btnStyle = { 
  padding: "14px", 
  background: "#4caf50", 
  color: "white", 
  border: "none", 
  borderRadius: "8px", 
  cursor: "pointer", 
  fontWeight: "bold",
  fontSize: "1rem"
}

const inputGroupStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "5px"
}

const helperTextStyle = {
  fontSize: "0.75rem",
  color: "#666",
  margin: "0 0 5px 0",
  fontStyle: "italic"
}