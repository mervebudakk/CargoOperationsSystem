import { useState, useEffect } from "react";

function Kargolarim({ userId }) {
  const [kargolar, setKargolar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:8000/my-cargos?user_id=${userId}`)
      .then((res) => res.json())
      .then((data) => {
        setKargolar(data);
        setYukleniyor(false);
      })
      .catch((err) => {
        console.error("Kargolar çekilemedi:", err);
        setYukleniyor(false);
      });
  }, [userId]);

  const getDurumRenk = (durum) => {
    switch (durum) {
      case "Beklemede": return "#ff9800"; // Turuncu
      case "Yolda": return "#2196f3";     // Mavi
      case "Teslim Edildi": return "#4caf50"; // Yeşil
      default: return "#aaa";
    }
  };

  return (
    <div style={containerStyle}>
      <h2 style={{ color: "#2196F3", marginBottom: "20px" }}>📦 Gönderdiğim Kargolar</h2>

      {yukleniyor ? (
        <p style={{ color: "white" }}>Yükleniyor...</p>
      ) : kargolar.length === 0 ? (
        <p style={{ color: "#aaa" }}>Henüz bir kargo gönderimi yapmadınız.</p>
      ) : (
        <div style={tableContainer}>
          <table style={tableStyle}>
            <thead>
              <tr style={headerStyle}>
                <th>ID</th>
                <th>Alıcı</th>
                <th>Varış Noktası</th>
                <th>Ağırlık</th>
                <th>Adet</th>
                <th>Durum</th>
                <th>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {kargolar.map((kargo) => (
                <tr key={kargo.id} style={rowStyle}>
                  <td>#{kargo.id}</td>
                  <td>{kargo.alici_isim}</td>
                  <td>{kargo.istasyonlar?.isim || "Belirlenmedi"}</td>
                  <td>{kargo.agirlik_kg} kg</td>
                  <td>{kargo.adet}</td>
                  <td>
                    <span style={{ 
                      padding: "4px 8px", 
                      borderRadius: "4px", 
                      fontSize: "12px", 
                      background: getDurumRenk(kargo.durum), 
                      color: "white" 
                    }}>
                      {kargo.durum}
                    </span>
                  </td>
                  <td>{new Date(kargo.olusturma_tarihi).toLocaleDateString("tr-TR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Stiller
const containerStyle = { padding: "20px", background: "#121212", minHeight: "100vh" };
const tableContainer = { overflowX: "auto", background: "#1e1e1e", borderRadius: "10px", padding: "10px" };
const tableStyle = { width: "100%", borderCollapse: "collapse", color: "white", textAlign: "left" };
const headerStyle = { borderBottom: "2px solid #333", color: "#2196F3" };
const rowStyle = { borderBottom: "1px solid #2a2a2a" };

// Tablo hücreleri için ek stil gerekirse inline verilebilir (th, td { padding: 12px })

export default Kargolarim;