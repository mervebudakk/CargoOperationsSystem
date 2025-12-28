import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Profil({ session }) {
  const [loading, setLoading] = useState(false);
  const [mesaj, setMesaj] = useState({ tip: "", metin: "" });
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "", 
    newPassword: ""
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.user?.id) return;
      
      const { data, error } = await supabase
        .from("users")
        .select("first_name, last_name, email")
        .eq("id", session.user.id)
        .single();

      if (data && !error) {
        setFormData(prev => ({
          ...prev,
          firstName: data.first_name || "",
          lastName: data.last_name || "",
          email: data.email || session.user.email
        }));
      }
    };
    fetchProfile();
  }, [session]);

  const handleUpdate = async () => {
    setLoading(true);
    setMesaj({ tip: "", metin: "" });
    
    try {
      const { error: profileError } = await supabase
        .from("users")
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName
        })
        .eq("id", session.user.id);

      if (profileError) throw profileError;

      if (formData.newPassword.trim() !== "") {
        if (formData.newPassword.length < 6) {
          throw new Error("Şifre en az 6 karakter olmalıdır.");
        }
        const { error: authError } = await supabase.auth.updateUser({
          password: formData.newPassword
        });
        if (authError) throw authError;
      }

      setMesaj({ tip: "success", metin: "Profil başarıyla güncellendi. ✅" });
      setFormData(prev => ({ ...prev, newPassword: "" })); 
    } catch (err) {
      setMesaj({ tip: "error", metin: err.message || "Bir hata oluştu." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageContainer}>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <div style={avatarCircle}>
            {formData.firstName[0]?.toUpperCase()}{formData.lastName[0]?.toUpperCase()}
          </div>
          <h2 style={{ margin: "15px 0 5px 0", color: "#fff" }}>Hesap Ayarları</h2>
          <p style={{ color: "#666", fontSize: "0.9rem" }}>Kişisel bilgilerinizi ve güvenliğinizi yönetin</p>
        </div>

        {mesaj.metin && (
          <div style={mesajStyle(mesaj.tip)}>
            {mesaj.metin}
          </div>
        )}

        <div style={formGroup}>
          <label style={labelStyle}>E-posta Adresi (Değiştirilemez)</label>
          <input type="text" style={{ ...inpStyle, opacity: 0.6, cursor: "not-allowed" }} value={formData.email} readOnly />
        </div>

        <div style={{ display: "flex", gap: "15px" }}>
          <div style={{ ...formGroup, flex: 1 }}>
            <label style={labelStyle}>Ad</label>
            <input 
              type="text" 
              style={inpStyle} 
              value={formData.firstName} 
              onChange={(e) => setFormData({...formData, firstName: e.target.value})} 
            />
          </div>
          <div style={{ ...formGroup, flex: 1 }}>
            <label style={labelStyle}>Soyad</label>
            <input 
              type="text" 
              style={inpStyle} 
              value={formData.lastName} 
              onChange={(e) => setFormData({...formData, lastName: e.target.value})} 
            />
          </div>
        </div>

        <div style={{ margin: "20px 0", borderTop: "1px solid #333" }} />

        <div style={formGroup}>
          <label style={labelStyle}>Yeni Şifre</label>
          <input 
            type="password" 
            style={inpStyle} 
            placeholder="Değiştirmek istemiyorsanız boş bırakın"
            value={formData.newPassword} 
            onChange={(e) => setFormData({...formData, newPassword: e.target.value})} 
          />
        </div>

        <button 
          style={{ 
            ...btnStyle, 
            background: loading ? "#222" : "#4caf50",
            cursor: loading ? "not-allowed" : "pointer" 
          }} 
          onClick={handleUpdate}
          disabled={loading}
        >
          {loading ? "⌛ İşleniyor..." : "💾 Değişiklikleri Kaydet"}
        </button>
      </div>
    </div>
  );
}

const pageContainer = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  minHeight: "calc(100vh - 100px)",
  padding: "20px"
};

const containerStyle = {
  width: "100%",
  maxWidth: "500px",
  background: "#141414",
  padding: "40px",
  borderRadius: "16px",
  border: "1px solid #222",
  boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
};

const headerStyle = {
  textAlign: "center",
  marginBottom: "30px"
};

const avatarCircle = {
  width: "70px",
  height: "70px",
  borderRadius: "50%",
  background: "linear-gradient(45deg, #4caf50, #2e7d32)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "1.5rem",
  fontWeight: "bold",
  margin: "0 auto"
};

const formGroup = {
  marginBottom: "20px"
};

const labelStyle = { 
  display: "block", 
  marginBottom: "8px", 
  fontSize: "0.8rem", 
  color: "#888",
  fontWeight: "600",
  textTransform: "uppercase",
  letterSpacing: "0.5px"
};

const inpStyle = { 
  padding: "12px 15px", 
  background: "#0a0a0a", 
  border: "1px solid #333", 
  color: "white", 
  borderRadius: "8px", 
  width: "100%", 
  boxSizing: "border-box",
  outline: "none",
  transition: "border-color 0.2s"
};

const btnStyle = { 
  width: "100%", 
  padding: "14px", 
  color: "white", 
  border: "none", 
  borderRadius: "8px", 
  fontWeight: "bold", 
  fontSize: "1rem",
  marginTop: "10px",
  transition: "0.3s"
};

const mesajStyle = (tip) => ({
  padding: "12px",
  borderRadius: "8px",
  marginBottom: "20px",
  fontSize: "0.9rem",
  textAlign: "center",
  background: tip === "success" ? "rgba(76, 175, 80, 0.1)" : "rgba(244, 67, 54, 0.1)",
  color: tip === "success" ? "#4caf50" : "#f44336",
  border: `1px solid ${tip === "success" ? "#4caf5044" : "#f4433644"}`
});