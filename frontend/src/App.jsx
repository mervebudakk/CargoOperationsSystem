import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import Login from "./pages/Login";
import AnaSayfa from "./pages/AnaSayfa";
import SenaryoGirisi from "./pages/SenaryoGirisi";
import IstasyonEkleme from "./pages/IstasyonEkleme"; 
import { istasyonlariGetirService } from "./services/api";

export default function App() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [istasyonlar, setIstasyonlar] = useState([]);
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
        loadDashboardData();
      } else {
        setLoading(false);
        setRole(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

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
    setView(view === targetView ? "dashboard" : targetView);
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
            {view === "senaryo" && "📦 Kargo & Senaryo Girişi"}
          </span>
        </div>
        <div style={{ fontSize: "0.85rem", color: "#aaa" }}>
          {session.user.email} <button onClick={handleSignOut} style={logoutBtnStyle}>Çıkış</button>
        </div>
      </nav>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <aside style={{ width: sidebarOpen ? "260px" : "0", transition: "0.4s", background: "#1e1e1e", borderRight: sidebarOpen ? "1px solid #333" : "none", overflow: "hidden", zIndex: 100 }}>
          <div style={{ padding: "20px", width: "260px" }}>
            <h4 style={{ color: "#4caf50", marginBottom: "20px" }}>MENÜ</h4>
            {role === "admin" && (
              <>
                <div style={{ ...navItemStyle, background: view === "harita" ? "#333" : "transparent" }} onClick={() => handleNavItemClick("harita")}>📍 Rota Planlama</div>
                <div style={{ ...navItemStyle, background: view === "istasyon_yonetimi" ? "#333" : "transparent" }} onClick={() => handleNavItemClick("istasyon_yonetimi")}>🏗️ İstasyon Yönetimi</div>
              </>
            )}
            <div style={{ ...navItemStyle, background: view === "senaryo" ? "#333" : "transparent" }} onClick={() => handleNavItemClick("senaryo")}>📦 Kargo Girişi</div>
          </div>
        </aside>

        <main style={{ flex: 1, overflow: "auto", padding: "20px" }}>
          {view === "dashboard" && (
            <div style={{ textAlign: "center", marginTop: "50px" }}>
              <div style={{ display: "flex", gap: "20px", justifyContent: "center", marginTop: "30px" }}>
                <div style={cardStyle}><h3>📍 İstasyonlar</h3><p style={{ fontSize: "2.5rem" }}>{istasyonlar.length}</p></div>
                <div style={cardStyle}><h3>🚛 Araçlar</h3><p style={{ fontSize: "2.5rem" }}>4</p><small>3 Sabit + 1 Kiralık</small></div>
                <div style={cardStyle}><h3>📦 Senaryolar</h3><p style={{ fontSize: "2.5rem" }}>4</p></div>
              </div>
            </div>
          )}
          {view === "harita" && <AnaSayfa userRole={role} />}
          {view === "istasyon_yonetimi" && <IstasyonEkleme />}
          {view === "senaryo" && <SenaryoGirisi />}
        </main>
      </div>
    </div>
  );
}

const cardStyle = { background: "#1e1e1e", padding: "20px", borderRadius: "12px", width: "200px", border: "1px solid #333" };
const navbarStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px", height: "60px", background: "#1a1a1a", borderBottom: "1px solid #333" };
const menuBtnStyle = { background: "none", border: "none", color: "white", fontSize: "24px", cursor: "pointer" };
const logoutBtnStyle = { marginLeft: "15px", padding: "5px 10px", background: "#e74c3c", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" };
const navItemStyle = { padding: "12px", cursor: "pointer", borderRadius: "6px", marginBottom: "5px", transition: "0.2s", color: "#ccc" };