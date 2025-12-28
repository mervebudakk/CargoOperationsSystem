import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import Login from "./pages/Login";
import IstasyonYonetimi from "./pages/IstasyonYonetimi";
import AracYonetimi from "./pages/AracYonetimi";
import SenaryoGirisi from "./pages/SenaryoGirisi";
import KargoOnayMerkezi from "./pages/KargoOnayMerkezi";
import Raporlar from "./pages/Raporlar";
import KullaniciYonetimi from "./pages/KullaniciYonetimi";
import KargoGonder from "./pages/KargoGonder";
import Kargolarim from "./pages/Kargolarim";
import Ayarlar from "./pages/Ayarlar"; 
import Profil from "./pages/Profil";   
import AnaSayfa from "./pages/AnaSayfa";
import RotaPlanlama from "./pages/RotaPlanlama"

export default function App() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [bekleyenSayisi, setBekleyenSayisi] = useState(0);
  const [view, setView] = useState(() => localStorage.getItem("current_view") || "dashboard");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
        fetchGlobalStats();
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchUserRole(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem("current_view", view);
  }, [view]);

  const fetchGlobalStats = async () => {
    const { count } = await supabase
      .from("kargolar")
      .select("*", { count: 'exact', head: true })
      .eq("durum", "Beklemede");
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

  if (loading) return <div style={fullPageCenter}>Sistem Yükleniyor...</div>;
  if (!session) return <Login onLogin={setSession} />;

  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column", background: "#121212", color: "white", overflow: "hidden" }}>
      
      {/* ÜST NAVBAR */}
      <nav style={navbarStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={menuBtnStyle}>☰</button>
          <span style={{ fontWeight: "bold", color: "#4caf50", letterSpacing: "1px" }}>
            {view.toUpperCase().replace("_", " ")}
          </span>
        </div>
      </nav>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        
        {/* SIDEBAR */}
        <aside style={{
          width: sidebarOpen ? "260px" : "0",
          transition: "0.4s ease",
          background: "#1e1e1e",
          borderRight: sidebarOpen ? "1px solid #333" : "none",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}>
          <div style={{ padding: "20px", flex: 1, overflowY: "auto" }}>
            <h4 style={{ color: "#555", fontSize: "0.7rem", marginBottom: "20px", fontWeight: "bold" }}>NAVİGASYON</h4>
            
            <div style={navItem(view === "dashboard")} onClick={() => setView("dashboard")}>🏠 Ana Sayfa</div>

            {role === "admin" && (
              <>
                <div style={navItem(view === "rota_planlama")} onClick={() => setView("rota_planlama")}>🗺️ Rota Planlama</div>
                <div style={navItem(view === "istasyon_yonetimi")} onClick={() => setView("istasyon_yonetimi")}>🏗️ İstasyonlar</div>
                <div style={navItem(view === "arac_yonetimi")} onClick={() => setView("arac_yonetimi")}>🚛 Araç Filosu</div>
                <div style={navItem(view === "kargo_onay")} onClick={() => setView("kargo_onay")}>
                  📦 Onay Merkezi {bekleyenSayisi > 0 && <span style={badgeStyle}>{bekleyenSayisi}</span>}
                </div>
                <div style={navItem(view === "senaryo")} onClick={() => setView("senaryo")}>📋 Senaryolar</div>
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

          {/* PROFİL VE ÇIKIŞ */}
          <div style={{ padding: "15px", borderTop: "1px solid #333", background: "#1a1a1a" }}>
            <div style={{ ...navItem(false), color: "#ff5252" }} onClick={handleSignOut}>🚪 Çıkış Yap</div>
            <div onClick={() => setView("profil")} style={profileCard(view === "profil")}>
              <div style={avatarStyle}>{session.user.email[0].toUpperCase()}</div>
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: "bold", whiteSpace: "nowrap" }}>{session.user.email.split("@")[0]}</div>
                <div style={{ fontSize: "0.7rem", color: "#666" }}>{role?.toUpperCase()}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* ANA İÇERİK */}
        <main style={{ flex: 1, overflowY: "auto", background: "#121212" }}>
          {view === "dashboard" && <AnaSayfa userRole={role} />}
          {view === "profil" && <Profil session={session} />}
          {view === "ayarlar" && <Ayarlar />}
          {view === "rota_planlama" && <RotaPlanlama />}
          {view === "istasyon_yonetimi" && <IstasyonYonetimi />}
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
  padding: "14px", borderRadius: "10px", cursor: "pointer", marginBottom: "6px", fontSize: "0.95rem",
  background: active ? "rgba(76, 175, 80, 0.15)" : "transparent", color: active ? "#4caf50" : "#aaa",
  display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: active ? "bold" : "normal"
});
const profileCard = (active) => ({
  display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "12px", cursor: "pointer", marginTop: "10px",
  background: active ? "#252525" : "transparent", border: active ? "1px solid #4caf50" : "1px solid transparent"
});
const avatarStyle = { minWidth: "36px", height: "36px", background: "#4caf50", borderRadius: "50%", display: "flex", alignItems: "center", justifyCenter: "center", fontWeight: "bold" };
const badgeStyle = { background: "#e74c3c", color: "white", padding: "2px 8px", borderRadius: "20px", fontSize: "0.65rem", fontWeight: "bold" };
const fullPageCenter = { height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#121212", color: "white", fontSize: "1.2rem" };