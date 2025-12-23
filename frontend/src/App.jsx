import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import Login from "./pages/Login";
import AnaSayfa from "./pages/AnaSayfa";
import SenaryoGirisi from "./pages/SenaryoGirisi";
import IstasyonEkleme from "./pages/IstasyonYonetimi";
import AracYonetimi from "./pages/AracYonetimi"; 
import KargoGonder from "./pages/KargoGonder"; 
import Kargolarim from "./pages/Kargolarim";
import KullaniciYonetimi from "./pages/KullaniciYonetimi";
import { istasyonlariGetirService } from "./services/api";

export default function App() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [istasyonlar, setIstasyonlar] = useState([]);
  const [isInitialLogin, setIsInitialLogin] = useState(true);

  const [view, setView] = useState(
    () => localStorage.getItem("current_view") || "dashboard"
  );

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
        loadDashboardData();
      } else {
        setLoading(false);
        setRole(null);
        setIsInitialLogin(true); 
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session && isInitialLogin) {
      setView("dashboard");
      localStorage.setItem("current_view", "dashboard");
      setIsInitialLogin(false);
    }
  }, [session, isInitialLogin]);

  useEffect(() => {
    localStorage.setItem("current_view", view);
  }, [view]);

  const loadDashboardData = async () => {
    const data = await istasyonlariGetirService();
    setIstasyonlar(data);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("current_view");
    setSession(null);
    setRole(null);
  };

  const fetchUserRole = async (userId) => {
    const { data } = await supabase.from("users").select("roles(name)").eq("id", userId).single();
    if (data) setRole(data.roles.name);
    setLoading(false);
  };

  const handleNavItemClick = (targetView) => {
    setView(targetView);
    setSidebarOpen(false);
  };

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#121212", color: "white" }}>
        Yükleniyor...
      </div>
    );
  }

  if (!session) {
    return <Login onLogin={setSession} />;
  }

  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column", background: "#121212", color: "white", overflow: "hidden" }}>
      <nav style={navbarStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={menuBtnStyle}>☰</button>
          <span style={{ fontWeight: "bold", fontSize: "1.1rem", textTransform: "uppercase", color: "#4caf50", cursor: "pointer" }} onClick={() => setView("dashboard")}>
            {view === "dashboard" && "🏠 Ana Sayfa"}
            {view === "harita" && "📍 Rota Planlama"}
            {view === "istasyon_yonetimi" && "🏗️ İstasyon Yönetimi"}
            {view === "arac_yonetimi" && "🚛 Araç Yönetimi"}
            {view === "senaryo" && "📋 Senaryo Yönetimi"}
            {view === "kargo_gonder" && "🚀 Kargo Gönderimi"}
            {view === "kargolarim" && "📦 Gönderilerim"}
            {view === "kullanici_yonetimi" && "👥 Kullanicilarim"}
          </span>
        </div>
        <div style={{ fontSize: "0.85rem", color: "#aaa" }}>
          {session.user.email} <span style={{color: "#4caf50"}}>({role})</span> <button onClick={handleSignOut} style={logoutBtnStyle}>Çıkış</button>
        </div>
      </nav>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <aside style={{ width: sidebarOpen ? "260px" : "0", transition: "0.4s", background: "#1e1e1e", borderRight: sidebarOpen ? "1px solid #333" : "none", overflow: "hidden", zIndex: 100 }}>
          <div style={{ padding: "20px", width: "260px" }}>
            <h4 style={{ color: "#4caf50", marginBottom: "20px" }}>MENÜ</h4>
            
            {/* ADMIN ÖZEL MENÜ */}
            {role === "admin" && (
              <>
                <div style={{ ...navItemStyle, background: view === "harita" ? "#333" : "transparent" }} onClick={() => handleNavItemClick("harita")}>📍 Rota Planlama</div>
                <div style={{ ...navItemStyle, background: view === "istasyon_yonetimi" ? "#333" : "transparent" }} onClick={() => handleNavItemClick("istasyon_yonetimi")}>🏗️ İstasyon Yönetimi</div>
                <div style={{ ...navItemStyle, background: view === "arac_yonetimi" ? "#333" : "transparent" }} onClick={() => handleNavItemClick("arac_yonetimi")}>🚛 Araç Yönetimi</div>
                <div style={{ ...navItemStyle, background: view === "senaryo" ? "#333" : "transparent" }} onClick={() => handleNavItemClick("senaryo")}>📋 Senaryo Oluştur</div>
                <div style={{ ...navItemStyle, background: view === "kullanici_yonetimi" ? "#333" : "transparent" }} 
     onClick={() => handleNavItemClick("kullanici_yonetimi")}>👥 Kullanıcı Yönetimi</div>
              </>
            )}

            {/* USER ÖZEL MENÜ */}
            {role === "user" && (
              <>
                <div style={{ ...navItemStyle, background: view === "kargo_gonder" ? "#333" : "transparent" }} onClick={() => handleNavItemClick("kargo_gonder")}>🚀 Kargo Gönder</div>
                <div style={{ ...navItemStyle, background: view === "kargolarim" ? "#333" : "transparent" }} onClick={() => handleNavItemClick("kargolarim")}>📦 Gönderilerim</div>
              </>
            )}
          </div>
        </aside>

        <main style={{ flex: 1, overflow: "auto", padding: "20px" }}>
          {view === "dashboard" && (
            <div style={{ textAlign: "center", marginTop: "30px" }}>
              <h2 style={{ color: "#4caf50", fontSize: "2rem" }}>Hoş Geldin, {session.user.email.split("@")[0]}! 👋</h2>
              <p style={{ color: "#888" }}>{role === "admin" ? "Yönetim Paneli" : "Kullanıcı Paneli"}</p>

              <div style={{ display: "flex", gap: "25px", justifyContent: "center", flexWrap: "wrap", marginTop: "40px" }}>
                {role === "admin" ? (
                  <>
                    <div onClick={() => setView("istasyon_yonetimi")} style={cardStyle}>
                      <h3 style={{color: "#4caf50"}}>📍 İstasyon</h3><p>{istasyonlar.length}</p>
                    </div>
                    <div onClick={() => setView("arac_yonetimi")} style={cardStyle}>
                      <h3 style={{color: "#2196f3"}}>🚛 Araç Filosu</h3><p>4</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div onClick={() => setView("kargo_gonder")} style={{...cardStyle, borderColor: "#2196f3"}}>
                      <h3 style={{color: "#2196f3"}}>🚀 Kargo Gönder</h3><p>+</p>
                    </div>
                    <div onClick={() => setView("kargolarim")} style={cardStyle}>
                      <h3>📦 Gönderilerim</h3><p>Listele</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* SAYFA RENDERLARI */}
          {view === "harita" && (role === "admin" ? <AnaSayfa userRole={role} /> : <div style={errorStyle}>Yetkisiz Erişim</div>)}
          {view === "istasyon_yonetimi" && (role === "admin" ? <IstasyonEkleme /> : <div style={errorStyle}>Yetkisiz Erişim</div>)}
          {view === "arac_yonetimi" && (role === "admin" ? <AracYonetimi /> : <div style={errorStyle}>Yetkisiz Erişim</div>)}
          {view === "senaryo" && (role === "admin" ? <SenaryoGirisi /> : <div style={errorStyle}>Yetkisiz Erişim</div>)}
          {view === "kullanici_yonetimi" && (role === "admin" ? <KullaniciYonetimi /> : <div style={errorStyle}>Yetkisiz Erişim</div>)}
          
          {/* USER ÖZEL SAYFALAR */}
          {view === "kargo_gonder" && <KargoGonder userId={session.user.id} />}
          {view === "kargolarim" && <Kargolarim userId={session.user.id} />}
        </main>
      </div>
    </div>
  );
}

// Stiller
const errorStyle = { textAlign: "center", marginTop: "50px", color: "#ff5252", fontWeight: "bold" };
const cardStyle = { background: "#1e1e1e", padding: "20px", borderRadius: "12px", width: "200px", border: "1px solid #333", cursor: "pointer" };
const navbarStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px", height: "60px", background: "#1a1a1a", borderBottom: "1px solid #333" };
const menuBtnStyle = { background: "none", border: "none", color: "white", fontSize: "24px", cursor: "pointer" };
const logoutBtnStyle = { marginLeft: "15px", padding: "5px 10px", background: "#e74c3c", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" };
const navItemStyle = { padding: "12px", cursor: "pointer", borderRadius: "6px", marginBottom: "5px", transition: "0.2s", color: "#ccc" };