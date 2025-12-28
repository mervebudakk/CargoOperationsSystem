import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import Login from "./pages/Login";
import IstasyonEkleme from "./pages/IstasyonYonetimi";
import AracYonetimi from "./pages/AracYonetimi";
import SenaryoGirisi from "./pages/SenaryoGirisi";
import KargoOnayMerkezi from "./pages/KargoOnayMerkezi";
import Raporlar from "./pages/Raporlar";
import KullaniciYonetimi from "./pages/KullaniciYonetimi";
import KargoGonder from "./pages/KargoGonder";
import Kargolarim from "./pages/Kargolarim";
import Ayarlar from "./pages/Ayarlar"; 
import Profil from "./pages/Profil";   
import { istasyonlariGetirService } from "./services/api";

export default function App() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [istasyonlar, setIstasyonlar] = useState([]);
  const [bekleyenSayisi, setBekleyenSayisi] = useState(0);
  const [view, setView] = useState(() => localStorage.getItem("current_view") || "dashboard");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
        loadDashboardData();
      } else {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    localStorage.setItem("current_view", view);
  }, [view]);

  const loadDashboardData = async () => {
    const data = await istasyonlariGetirService();
    setIstasyonlar(data);
    const { count } = await supabase.from("kargolar").select("*", { count: 'exact', head: true }).eq("durum", "Beklemede");
    setBekleyenSayisi(count || 0);
  };

  const fetchUserRole = async (userId) => {
    const { data } = await supabase.from("users").select("roles(name)").eq("id", userId).single();
    if (data) setRole(data.roles.name);
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("current_view");
    setSession(null);
  };

  if (loading) return <div style={fullPageCenter}>Yükleniyor...</div>;
  if (!session) return <Login onLogin={setSession} />;

  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column", background: "#121212", color: "white", overflow: "hidden" }}>
      
      {/* ÜST NAVBAR */}
      <nav style={navbarStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={menuBtnStyle}>☰</button>
          <span style={{ fontWeight: "bold", color: "#4caf50", textTransform: "uppercase" }}>
            {view === "dashboard" ? "🏠 ANA SAYFA" : view.replace("_", " ")}
          </span>
        </div>
      </nav>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        
        {/* SIDEBAR: CHATGPT STİLİ */}
        <aside style={{
          width: sidebarOpen ? "260px" : "0",
          transition: "0.4s",
          background: "#1e1e1e",
          borderRight: sidebarOpen ? "1px solid #333" : "none",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}>
          {/* ÜST: Menü Öğeleri */}
          <div style={{ padding: "15px", flex: 1, overflowY: "auto" }}>
            <h4 style={{ color: "#888", fontSize: "0.7rem", marginBottom: "15px", letterSpacing: "1px" }}>MENÜ</h4>
            
            <div style={navItem(view === "dashboard")} onClick={() => setView("dashboard")}>🏠 Ana Sayfa</div>

            {role === "admin" && (
              <>
                <div style={navItem(view === "istasyon_yonetimi")} onClick={() => setView("istasyon_yonetimi")}>🏗️ İstasyonlar</div>
                <div style={navItem(view === "arac_yonetimi")} onClick={() => setView("arac_yonetimi")}>🚛 Araç Filosu</div>
                <div style={navItem(view === "kargo_onay")} onClick={() => setView("kargo_onay")}>
                  📦 Onay Merkezi {bekleyenSayisi > 0 && <span style={badgeStyle}>{bekleyenSayisi}</span>}
                </div>
                <div style={navItem(view === "senaryo")} onClick={() => setView("senaryo")}>📋 Senaryo Yönetimi</div>
                <div style={navItem(view === "kullanici_yonetimi")} onClick={() => setView("kullanici_yonetimi")}>👥 Kullanıcılar</div>
                <div style={navItem(view === "raporlar")} onClick={() => setView("raporlar")}>📊 Raporlar</div>
                <div style={navItem(view === "ayarlar")} onClick={() => setView("ayarlar")}>⚙️ Ayarlar</div>
              </>
            )}

            {role === "user" && (
              <>
                <div style={navItem(view === "kargo_gonder")} onClick={() => setView("kargo_gonder")}>🚀 Kargo Gönder</div>
                <div style={navItem(view === "kargolarim")} onClick={() => setView("kargolarim")}>📦 Kargolarım</div>
              </>
            )}
          </div>

          {/* ALT: Çıkış ve Profil */}
          <div style={{ padding: "15px", borderTop: "1px solid #333", background: "#1a1a1a" }}>
            <div style={{ ...navItem(false), color: "#ff5252", marginBottom: "8px" }} onClick={handleSignOut}>🚪 Çıkış Yap</div>
            <div onClick={() => setView("profil")} style={profileCard(view === "profil")}>
              <div style={avatarStyle}>{session.user.email[0].toUpperCase()}</div>
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: "bold", whiteSpace: "nowrap" }}>{session.user.email.split("@")[0]}</div>
                <div style={{ fontSize: "0.7rem", color: "#888" }}>{role}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* ANA İÇERİK ALANI */}
        <main style={{ flex: 1, overflowY: "auto", padding: "30px", background: "#121212" }}>
          
          {view === "dashboard" && (
            <div style={{ textAlign: "center" }}>
              <h2 style={{ color: "#4caf50" }}>Hoş Geldin! 👋</h2>
              <div style={{ display: "flex", gap: "20px", justifyContent: "center", marginTop: "30px" }}>
                 <div style={dashCard} onClick={() => setView(role === "admin" ? "kargo_onay" : "kargo_gonder")}>
                    <h3>{role === "admin" ? "📦 Bekleyenler" : "🚀 Yeni Gönderi"}</h3>
                    <p>{role === "admin" ? bekleyenSayisi : "+"}</p>
                 </div>
              </div>
            </div>
          )}

          {/* Sayfalar artık dashboard'dan bağımsız çalışıyor */}
          {view === "profil" && <Profil session={session} />}
          {view === "ayarlar" && <Ayarlar />}
          {view === "istasyon_yonetimi" && <IstasyonEkleme />}
          {view === "arac_yonetimi" && <AracYonetimi />}
          {view === "senaryo" && <SenaryoGirisi />}
          {view === "kargo_onay" && <KargoOnayMerkezi />}
          {view === "raporlar" && <Raporlar />}
          {view === "kullanici_yonetimi" && <KullaniciYonetimi />}
          {view === "kargo_gonder" && <KargoGonder userId={session.user.id} />}
          {view === "kargolarim" && <Kargolarim userId={session.user.id} />}
        </main>
      </div>
    </div>
  );
}

// STİLLER
const navbarStyle = { height: "60px", background: "#1a1a1a", borderBottom: "1px solid #333", display: "flex", alignItems: "center", padding: "0 20px" };
const menuBtnStyle = { background: "none", border: "none", color: "white", fontSize: "20px", cursor: "pointer" };
const navItem = (active) => ({
  padding: "12px", borderRadius: "8px", cursor: "pointer", marginBottom: "4px", fontSize: "0.9rem",
  background: active ? "#4caf5022" : "transparent", color: active ? "#4caf50" : "#ccc", display: "flex", justifyContent: "space-between"
});
const profileCard = (active) => ({
  display: "flex", alignItems: "center", gap: "10px", padding: "10px", borderRadius: "10px", cursor: "pointer",
  background: active ? "#333" : "transparent", border: active ? "1px solid #4caf50" : "1px solid transparent"
});
const avatarStyle = { width: "32px", height: "32px", background: "#4caf50", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" };
const badgeStyle = { background: "#ff4444", color: "white", padding: "2px 8px", borderRadius: "10px", fontSize: "0.7rem" };
const dashCard = { background: "#1e1e1e", padding: "20px", borderRadius: "15px", border: "1px solid #333", cursor: "pointer", minWidth: "200px" };
const fullPageCenter = { height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#121212", color: "white" };