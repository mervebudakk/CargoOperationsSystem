import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient"; 

function Kargolarim({ userId }) {
  const [kargolar, setKargolar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    const fetchMyCargos = async () => {
      if (!userId) return;
      
      setYukleniyor(true);
      try {
        const { data, error } = await supabase
          .from("kargolar")
          .select(`
            id,
            agirlik_kg,
            adet,
            durum,
            olusturma_tarihi,
            istasyonlar!cikis_istasyon_id (isim)
          `)
          .eq("gonderen_id", userId)
          .order("olusturma_tarihi", { ascending: false });

        if (error) throw error;
        setKargolar(data || []);
      } catch (err) {
        console.error("Kargolar çekilemedi:", err.message);
      } finally {
        setYukleniyor(false);
      }
    };

    fetchMyCargos();
  }, [userId]);

  const getDurumRenk = (durum) => {
    switch (durum) {
      case "Beklemede": return "#ff9800"; 
      case "Planlandı": return "#2196f3";   
      case "Yola Çıktı": return "#9c27b0";  
      case "Teslim Edildi": return "#4caf50"; 
      default: return "#aaa";
    }
  };

  return (
    <div style={containerStyle}>
      <div style={headerContainerStyle}>
        <h2 style={{ color: "#2196F3", margin: 0 }}>📦 Gönderdiğim Kargolar</h2>
        <span style={countBadgeStyle}>{kargolar.length} Toplam Kayıt</span>
      </div>

      {yukleniyor ? (
        <div style={messageBoxStyle}>
          <p style={{ color: "#888" }}>Kargo geçmişiniz yükleniyor...</p>
        </div>
      ) : kargolar.length === 0 ? (
        <div style={messageBoxStyle}>
          <p style={{ color: "#aaa" }}>Henüz bir kargo gönderimi yapmadınız.</p>
        </div>
      ) : (
        <div style={tableContainer}>
          <table style={tableStyle}>
            <thead>
              <tr style={headerStyle}>
                <th style={thStyle}>Kalkış İlçesi</th>
                <th style={thStyle}>Ağırlık</th>
                <th style={thStyle}>Adet</th>
                <th style={thStyle}>Durum</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Kayıt Tarihi</th>
              </tr>
            </thead>
            <tbody>
              {kargolar.map((kargo) => (
                <tr key={kargo.id} style={rowStyle}>
                  <td style={tdStyle}>
                    📍 {kargo.istasyonlar?.isim || "Belirlenmedi"}
                  </td>
                  <td style={tdStyle}>{kargo.agirlik_kg} kg</td>
                  <td style={tdStyle}>{kargo.adet} Adet</td>
                  <td style={tdStyle}>
                    <span style={{ 
                      padding: "5px 12px", 
                      borderRadius: "6px", 
                      fontSize: "11px", 
                      fontWeight: "bold",
                      background: `${getDurumRenk(kargo.durum)}22`, 
                      color: getDurumRenk(kargo.durum),
                      border: `1px solid ${getDurumRenk(kargo.durum)}55`
                    }}>
                      {kargo.durum.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", color: "#888" }}>
                    {new Date(kargo.olusturma_tarihi).toLocaleDateString("tr-TR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const containerStyle = { padding: "30px", background: "#0a0a0a", minHeight: "100vh" };
const headerContainerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px" };
const countBadgeStyle = { background: "#1a1a1a", color: "#666", padding: "5px 12px", borderRadius: "20px", fontSize: "0.8rem", border: "1px solid #333" };
const tableContainer = { overflowX: "auto", background: "#141414", borderRadius: "12px", padding: "10px", border: "1px solid #222" };
const tableStyle = { width: "100%", borderCollapse: "collapse", color: "#e0e0e0", textAlign: "left" };
const headerStyle = { borderBottom: "1px solid #333" };
const thStyle = { padding: "15px", color: "#2196F3", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px" };
const tdStyle = { padding: "18px 15px", borderBottom: "1px solid #1a1a1a", fontSize: "0.95rem" };
const rowStyle = { transition: "background 0.2s" };
const messageBoxStyle = { textAlign: "center", padding: "100px 20px", background: "#141414", borderRadius: "12px", border: "2px dashed #222" };

export default Kargolarim;