// frontend/src/pages/AnaSayfa.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { routeService } from "../services/api";

export default function AnaSayfa({ userRole }) {
  const [stats, setStats] = useState({
    bekleyen: 0,
    planlanan: 0,
    aktifArac: 0,
    toplamMaliyet: 0
  });

  useEffect(() => {
    const fetchDashboardStats = async () => {
      // 1. Onay Bekleyen Kargo Sayısı
      const { count: bekleyenCount } = await supabase
        .from("kargolar")
        .select("*", { count: 'exact', head: true })
        .eq("durum", "Beklemede");

      // 2. Bugün Planlanan Kargo Sayısı
      const bugun = new Date().toISOString().split('T')[0];
      const { count: planlananCount } = await supabase
        .from("kargolar")
        .select("*", { count: 'exact', head: true })
        .eq("planlanan_tarih", bugun);

      // 3. Aktif Özmal Araç Sayısı
      const { count: aracCount } = await supabase
        .from("araclar")
        .select("*", { count: 'exact', head: true })
        .eq("aktif", true);

      setStats({
        bekleyen: bekleyenCount || 0,
        planlanan: planlananCount || 0,
        aktifArac: aracCount || 0,
        toplamMaliyet: 0 // İsteğe bağlı olarak rota_ozetleri tablosundan çekilebilir
      });
    };

    fetchDashboardStats();
  }, []);

  return (
    <div style={{ padding: "30px", background: "#121212", minHeight: "100%" }}>
      <h2 style={{ color: "#4caf50", marginBottom: "30px" }}>🚀 Operasyonel Genel Bakış</h2>
      
      <div style={statsGrid}>
        <div style={statCard("#2196F3")}>
          <span style={iconStyle}>📦</span>
          <h3>Onay Bekleyen</h3>
          <p style={valueStyle}>{stats.bekleyen}</p>
          <span style={hintStyle}>Kargo Havuzunda</span>
        </div>

        <div style={statCard("#4caf50")}>
          <span style={iconStyle}>📋</span>
          <h3>Bugün Planlanan</h3>
          <p style={valueStyle}>{stats.planlanan}</p>
          <span style={hintStyle}>Rota Atanmış</span>
        </div>

        <div style={statCard("#ff9800")}>
          <span style={iconStyle}>🚛</span>
          <h3>Aktif Filo</h3>
          <p style={valueStyle}>{stats.aktifArac}</p>
          <span style={hintStyle}>Hazır Özmal Araç</span>
        </div>
      </div>

      {userRole === 'admin' && (
        <div style={infoBox}>
          <h4>📢 Hızlı Aksiyon</h4>
          <p>Sistemde onay bekleyen <strong>{stats.bekleyen}</strong> kargo bulunmaktadır. Planlama yapmak için "Rota Planlama" menüsünü kullanabilirsiniz.</p>
        </div>
      )}
    </div>
  );
}

// Görsel Stiller
const statsGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px" };
const statCard = (color) => ({
  background: "#1e1e1e", padding: "25px", borderRadius: "15px", borderLeft: `6px solid ${color}`,
  boxShadow: "0 4px 15px rgba(0,0,0,0.3)", textAlign: "center"
});
const valueStyle = { fontSize: "3rem", fontWeight: "bold", margin: "10px 0" };
const iconStyle = { fontSize: "2rem" };
const hintStyle = { color: "#666", fontSize: "0.8rem" };
const infoBox = { marginTop: "40px", padding: "20px", background: "rgba(76, 175, 80, 0.1)", borderRadius: "10px", border: "1px solid #4caf50" };