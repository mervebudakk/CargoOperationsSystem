import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import Login from "./pages/Login";
import AnaSayfa from "./pages/AnaSayfa";
import SenaryoGirisi from "./pages/SenaryoGirisi";
import IstasyonEkleme from "./pages/IstasyonYonetimi";
import AracYonetimi from "./pages/AracYonetimi"; 
import { istasyonlariGetirService } from "./services/api";

export default function App() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [istasyonlar, setIstasyonlar] = useState([]);
  
  // İlk girişi kontrol etmek için state
  const [isInitialLogin, setIsInitialLogin] = useState(true);

  // Sayfa yenilendiğinde kalıcılık sağlayan view state'i
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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserRole(session.user.id);
        loadDashboardData();
      } else {
        setLoading(false);
        setRole(null);
        setIsInitialLogin(true); // Çıkış yapıldığında ilk giriş modunu sıfırla
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Giriş yapıldığında bir kez Dashboard'a zorla
  useEffect(() => {
    if (session && isInitialLogin) {
      setView("dashboard");
      localStorage.setItem("current_view", "dashboard");
      setIsInitialLogin(false); // Oturum boyunca tekrar zorlamasın
    }
  }, [session, isInitialLogin]);

  // View değiştikçe tercihi kaydet
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
    const { data } = await supabase
      .from("users")
      .select("roles(name)")
      .eq("id", userId)
      .single();
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
            {view === "arac_yonetimi" && "🚛 Araç Yönetimi"}
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
                <div style={{ ...navItemStyle, background: view === "arac_yonetimi" ? "#333" : "transparent" }} onClick={() => handleNavItemClick("arac_yonetimi")}>🚛 Araç Yönetimi</div>
              </>
            )}
            <div style={{ ...navItemStyle, background: view === "senaryo" ? "#333" : "transparent" }} onClick={() => handleNavItemClick("senaryo")}>📦 Kargo Girişi</div>
          </div>
        </aside>

        <main style={{ flex: 1, overflow: "auto", padding: "20px" }}>
          {view === "dashboard" && (
            <div style={{ textAlign: "center", marginTop: "30px" }}>
              <div style={{ marginBottom: "40px" }}>
                <h2 style={{ color: "#4caf50", fontSize: "2rem" }}>Hoş Geldin, {session.user.email.split("@")[0]}! 👋</h2>
                <p style={{ color: "#888" }}>
                  {role === "admin" ? "Sistem genelindeki tüm operasyonları buradan yönetebilirsin." : "Bugün planlanan kargo girişlerini ve senaryoları aşağıdan takip edebilirsin."}
                </p>
              </div>

              <div style={{ display: "flex", gap: "25px", justifyContent: "center", flexWrap: "wrap" }}>
                {role === "admin" ? (
                  <>
                    <div onClick={() => setView("istasyon_yonetimi")} style={{ ...cardStyle, cursor: "pointer" }}>
                      <h3 style={{ color: "#4caf50", fontSize: "1rem" }}>📍 Toplam İstasyon</h3>
                      <p style={{ fontSize: "2.8rem", margin: "15px 0", fontWeight: "bold" }}>{istasyonlar.length}</p>
                      <small style={{ color: "#666" }}>Ağdaki aktif noktalar</small>
                    </div>
                    <div onClick={() => setView("arac_yonetimi")} style={{ ...cardStyle, cursor: "pointer" }}>
                      <h3 style={{ color: "#2196F3", fontSize: "1rem" }}>🚛 Filo Durumu</h3>
                      <p style={{ fontSize: "2.8rem", margin: "15px 0", fontWeight: "bold" }}>4</p>
                      <small style={{ color: "#666" }}>3 Sabit + 1 Kiralık</small>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={cardStyle}>
                      <h3 style={{ color: "#00bcd4", fontSize: "1rem" }}>🚚 Aktif Araçlar</h3>
                      <p style={{ fontSize: "2.8rem", margin: "15px 0", fontWeight: "bold" }}>4</p>
                      <small style={{ color: "#666" }}>Rotalama için hazır</small>
                    </div>
                    <div style={cardStyle}>
                      <h3 style={{ color: "#e91e63", fontSize: "1rem" }}>🏢 Aktif Şube</h3>
                      <p style={{ fontSize: "2.8rem", margin: "15px 0", fontWeight: "bold" }}>1</p>
                      <small style={{ color: "#666" }}>Kocaeli Merkez</small>
                    </div>
                  </>
                )}
                <div onClick={() => setView("senaryo")} style={{ ...cardStyle, cursor: "pointer" }}>
                  <h3 style={{ color: "#ff9800", fontSize: "1rem" }}>📦 Kayıtlı Senaryolar</h3>
                  <p style={{ fontSize: "2.8rem", margin: "15px 0", fontWeight: "bold" }}>4</p>
                  <small style={{ color: "#666" }}>Geçmiş Operasyonlar</small>
                </div>
              </div>

              {role !== "admin" && (
                <div style={{ marginTop: "50px", padding: "30px", background: "#1e1e1e", borderRadius: "15px", border: "1px dashed #444" }}>
                  <h4 style={{ marginBottom: "15px" }}>Hızlı İşlem Yap</h4>
                  <button onClick={() => setView("senaryo")} style={{ padding: "12px 25px", background: "#4caf50", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>
                    ➕ Yeni Kargo Girişi Yap
                  </button>
                </div>
              )}
            </div>
          )}

          {view === "harita" && (role === "admin" ? <AnaSayfa userRole={role} /> : <div style={errorStyle}>Bu sayfaya erişim yetkiniz yok.</div>)}
          {view === "istasyon_yonetimi" && (role === "admin" ? <IstasyonEkleme /> : <div style={errorStyle}>Bu sayfaya erişim yetkiniz yok.</div>)}
          {view === "arac_yonetimi" && (role === "admin" ? <AracYonetimi /> : <div style={errorStyle}>Bu sayfaya erişim yetkiniz yok.</div>)}
          {view === "senaryo" && <SenaryoGirisi />}
        </main>
      </div>
    </div>
  );
}

const errorStyle = { textAlign: "center", marginTop: "50px", color: "#ff5252", fontWeight: "bold" };
const cardStyle = { background: "#1e1e1e", padding: "20px", borderRadius: "12px", width: "200px", border: "1px solid #333" };
const navbarStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px", height: "60px", background: "#1a1a1a", borderBottom: "1px solid #333" };
const menuBtnStyle = { background: "none", border: "none", color: "white", fontSize: "24px", cursor: "pointer" };
const logoutBtnStyle = { marginLeft: "15px", padding: "5px 10px", background: "#e74c3c", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" };
const navItemStyle = { padding: "12px", cursor: "pointer", borderRadius: "6px", marginBottom: "5px", transition: "0.2s", color: "#ccc" };