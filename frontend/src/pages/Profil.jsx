import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Profil({ session }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    newPassword: ""
  });

  // 1. Sayfa açıldığında mevcut isim ve soyisim bilgilerini getir
  useEffect(() => {
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("first_name, last_name")
        .eq("id", session.user.id)
        .single();

      if (data && !error) {
        setFormData(prev => ({
          ...prev,
          firstName: data.first_name || "",
          lastName: data.last_name || ""
        }));
      }
    };
    fetchProfile();
  }, [session]);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      // 2. İsim ve Soyisim Güncelleme (public.users tablosu)
      const { error: profileError } = await supabase
        .from("users")
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName
        })
        .eq("id", session.user.id);

      if (profileError) throw profileError;

      // 3. Şifre Güncelleme (Eğer kutu doluysa)
      if (formData.newPassword.length > 0) {
        if (formData.newPassword.length < 6) {
          alert("Şifre en az 6 karakter olmalıdır!");
          setLoading(false);
          return;
        }
        const { error: authError } = await supabase.auth.updateUser({
          password: formData.newPassword
        });
        if (authError) throw authError;
      }

      alert("Profil başarıyla güncellendi! ✅");
      setFormData(prev => ({ ...prev, newPassword: "" })); // Şifre alanını temizle
    } catch (error) {
      alert("Hata oluştu: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <h2 style={{ color: "#4caf50", marginTop: 0, borderBottom: "1px solid #333", paddingBottom: "15px" }}>
        👤 Profil Ayarlarım
      </h2>
      
      <div style={{ display: "grid", gap: "20px", marginTop: "20px" }}>
        <div>
          <label style={labelStyle}>Adınız</label>
          <input 
            style={inpStyle} 
            value={formData.firstName} 
            onChange={(e) => setFormData({...formData, firstName: e.target.value})} 
          />
        </div>

        <div>
          <label style={labelStyle}>Soyadınız</label>
          <input 
            style={inpStyle} 
            value={formData.lastName} 
            onChange={(e) => setFormData({...formData, lastName: e.target.value})} 
          />
        </div>

        <hr style={{ borderColor: "#333", margin: "10px 0" }} />

        <div>
          <label style={labelStyle}>Yeni Şifre (Değiştirmek istemiyorsanız boş bırakın)</label>
          <input 
            type="password" 
            style={inpStyle} 
            placeholder="••••••"
            value={formData.newPassword} 
            onChange={(e) => setFormData({...formData, newPassword: e.target.value})} 
          />
        </div>

        <button 
          style={{ ...btnStyle, opacity: loading ? 0.6 : 1 }} 
          onClick={handleUpdate}
          disabled={loading}
        >
          {loading ? "Güncelleniyor..." : "Değişiklikleri Kaydet"}
        </button>
      </div>
    </div>
  );
}

// Projenle uyumlu stiller
const containerStyle = {
  maxWidth: "600px",
  margin: "0 auto",
  padding: "30px",
  background: "#1a1a1a",
  borderRadius: "12px",
  border: "1px solid #333"
};

const labelStyle = { display: "block", marginBottom: "8px", fontSize: "0.85rem", color: "#888" };
const inpStyle = { padding: "12px", background: "#111", border: "1px solid #333", color: "white", borderRadius: "8px", width: "100%", boxSizing: "border-box" };
const btnStyle = { padding: "14px", background: "#4caf50", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "1rem" };