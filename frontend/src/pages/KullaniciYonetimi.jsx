import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

function KullaniciYonetimi() {
  const [kullanicilar, setKullanicilar] = useState([]);
  const [aramaMetni, setAramaMetni] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    kullanicilariGetir();
  }, []);

  const kullanicilariGetir = async () => {
    setLoading(true);
    try {
      // Backend şemanızdaki users ve roles tablosu ilişkisini kullanıyoruz
      const { data, error } = await supabase
        .from("users")
        .select(`
          id,
          email,
          first_name,
          last_name,
          created_at,
          roles (name)
        `);

      if (error) throw error;

      // Önce Adminleri üste al, sonra Ad-Soyad ile alfabetik sırala
      const siraliData = data.sort((a, b) => {
        const roleA = a.roles?.name?.toLowerCase() || "";
        const roleB = b.roles?.name?.toLowerCase() || "";
        
        if (roleA === "admin" && roleB !== "admin") return -1;
        if (roleA !== "admin" && roleB === "admin") return 1;

        const adA = `${a.first_name} ${a.last_name}`.toLocaleLowerCase('tr');
        const adB = `${b.first_name} ${b.last_name}`.toLocaleLowerCase('tr');
        return adA.localeCompare(adB, 'tr');
      });

      setKullanicilar(siraliData);
    } catch (error) {
      console.error("Kullanıcılar yüklenemedi:", error.message);
    } finally {
      setLoading(false);
    }
  };

  // Arama filtresi: Hem e-posta hem de isim soyisimde arama yapar
  const filtrelenmişKullanicilar = kullanicilar.filter((user) => {
    const tamAd = `${user.first_name} ${user.last_name}`.toLowerCase();
    const email = user.email.toLowerCase();
    const aranan = aramaMetni.toLowerCase();
    return tamAd.includes(aranan) || email.includes(aranan);
  });

  return (
    <div style={{ padding: "30px", background: "#0a0a0a", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div>
          <h2 style={{ color: "#4caf50", margin: 0 }}>👥 Kullanıcı Yönetimi</h2>
          <p style={{ color: "#666", fontSize: "0.9rem", marginTop: "5px" }}>Sistemdeki kayıtlı personel ve yöneticiler</p>
        </div>
        <div style={{ fontSize: "0.9rem", color: "#888", background: "#1a1a1a", padding: "8px 15px", borderRadius: "8px", border: "1px solid #333" }}>
          Toplam: <strong>{filtrelenmişKullanicilar.length}</strong> Kullanıcı
        </div>
      </div>

      {/* Arama Çubuğu */}
      <div style={{ marginBottom: "25px", position: "relative" }}>
        <input
          type="text"
          placeholder="İsim veya e-posta ile kullanıcı ara..."
          value={aramaMetni}
          onChange={(e) => setAramaMetni(e.target.value)}
          style={searchInputStyle}
        />
        <span style={{ position: "absolute", right: "15px", top: "12px", color: "#444" }}>🔍</span>
      </div>
      
      <div style={tableWrapperStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse", color: "#e0e0e0" }}>
          <thead>
            <tr style={headerRowStyle}>
              <th style={thStyle}>Ad Soyad</th>
              <th style={thStyle}>E-posta</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Rol</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Kayıt Tarihi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" style={{textAlign:"center", padding:"40px", color: "#666"}}>Veriler yükleniyor...</td></tr>
            ) : filtrelenmişKullanicilar.length > 0 ? (
              filtrelenmişKullanicilar.map((user) => (
                <tr key={user.id} style={rowStyle}>
                  <td style={{ ...tdStyle, fontWeight: "600", color: "#fff" }}>
                    {user.first_name} {user.last_name}
                  </td>
                  <td style={tdStyle}>{user.email}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <span style={{ 
                      padding: "4px 12px", 
                      borderRadius: "6px", 
                      background: user.roles?.name === "admin" ? "rgba(211, 47, 47, 0.15)" : "rgba(25, 118, 210, 0.15)",
                      color: user.roles?.name === "admin" ? "#ff5252" : "#64b5f6",
                      border: `1px solid ${user.roles?.name === "admin" ? "rgba(211, 47, 47, 0.3)" : "rgba(25, 118, 210, 0.3)"}`,
                      fontSize: "0.75rem",
                      fontWeight: "bold",
                      letterSpacing: "0.5px"
                    }}>
                      {user.roles?.name?.toUpperCase() || "USER"}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", color: "#888", fontSize: "0.85rem" }}>
                    {new Date(user.created_at).toLocaleDateString("tr-TR")}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="4" style={{textAlign:"center", padding:"40px", color: "#666"}}>Kullanıcı bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Stiller ve Tasarım İyileştirmeleri
const searchInputStyle = {
  width: "100%",
  padding: "14px 20px",
  borderRadius: "10px",
  border: "1px solid #333",
  background: "#1a1a1a",
  color: "white",
  outline: "none",
  fontSize: "0.95rem",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
  ":focus": {
    borderColor: "#4caf50"
  }
};

const tableWrapperStyle = {
  background: "#141414",
  borderRadius: "12px",
  padding: "5px",
  border: "1px solid #222",
  overflow: "hidden"
};

const headerRowStyle = {
  background: "rgba(76, 175, 80, 0.05)",
  textAlign: "left",
  color: "#4caf50"
};

const thStyle = { 
  padding: "18px 20px", 
  fontSize: "0.8rem", 
  textTransform: "uppercase", 
  letterSpacing: "1px",
  borderBottom: "1px solid #222"
};

const tdStyle = { 
  padding: "16px 20px", 
  borderBottom: "1px solid #1a1a1a" 
};

const rowStyle = { 
  transition: "background 0.2s",
  cursor: "default",
  "&:hover": {
    background: "#1a1a1a"
  }
};

export default KullaniciYonetimi;