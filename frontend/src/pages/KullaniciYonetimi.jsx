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

    if (error) {
      console.error("Kullanıcılar yüklenemedi:", error);
    } else {
      // Önce Adminleri üste al, sonra e-postaya göre alfabetik sırala
      // Sıralama mantığı güncellemesi:
const siraliData = data.sort((a, b) => {
  if (a.roles?.name === "admin" && b.roles?.name !== "admin") return -1;
  if (a.roles?.name !== "admin" && b.roles?.name === "admin") return 1;
  // E-posta yerine artık Ad-Soyad ile alfabetik sıralama
  const adA = `${a.first_name} ${a.last_name}`.toLocaleLowerCase('tr');
  const adB = `${b.first_name} ${b.last_name}`.toLocaleLowerCase('tr');
  return adA.localeCompare(adB, 'tr');
});
      setKullanicilar(siraliData);
    }
    setLoading(false);
  };

  // Arama filtresi
  const filtrelenmişKullanicilar = kullanicilar.filter((user) =>
    user.email.toLowerCase().includes(aramaMetni.toLowerCase())
  );

  return (
    <div style={{ padding: "20px" }}>
      <h2 style={{ color: "#4caf50", marginBottom: "20px" }}>👥 Kullanıcı Yönetimi</h2>

      {/* Arama Çubuğu */}
      <div style={{ marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="E-posta ile kullanıcı ara..."
          value={aramaMetni}
          onChange={(e) => setAramaMetni(e.target.value)}
          style={searchInputStyle}
        />
      </div>
      
      <div style={tableWrapperStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse", color: "white" }}>
          <thead>
            <tr style={headerRowStyle}>
                <th style={thStyle}>Ad Soyad</th>
              <th style={thStyle}>E-posta</th>
              <th style={thStyle}>Rol</th>
              <th style={thStyle}>Kayıt Tarihi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="3" style={{textAlign:"center", padding:"20px"}}>Yükleniyor...</td></tr>
            ) : filtrelenmişKullanicilar.length > 0 ? (
              filtrelenmişKullanicilar.map((user) => (
                <tr key={user.id} style={rowStyle}>
                    <td>{user.first_name} {user.last_name}</td>
                  <td style={tdStyle}>{user.email}</td>
                  <td style={tdStyle}>
                    <span style={{ 
                      padding: "4px 10px", 
                      borderRadius: "15px", 
                      background: user.roles?.name === "admin" ? "#d32f2f" : "#1976d2",
                      fontSize: "0.8rem",
                      fontWeight: "bold"
                    }}>
                      {user.roles?.name?.toUpperCase() || "USER"}
                    </span>
                  </td>
                  <td style={tdStyle}>{new Date(user.created_at).toLocaleDateString("tr-TR")}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="3" style={{textAlign:"center", padding:"20px"}}>Kullanıcı bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Stiller
const searchInputStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid #444",
  background: "#2a2a2a",
  color: "white",
  outline: "none",
  fontSize: "1rem"
};

const tableWrapperStyle = {
  background: "#1e1e1e",
  borderRadius: "10px",
  padding: "10px",
  border: "1px solid #333"
};

const headerRowStyle = {
  borderBottom: "2px solid #4caf50",
  textAlign: "left",
  color: "#4caf50"
};

const thStyle = { padding: "15px" };
const tdStyle = { padding: "12px", borderBottom: "1px solid #2a2a2a" };
const rowStyle = { transition: "0.2s" };

export default KullaniciYonetimi;