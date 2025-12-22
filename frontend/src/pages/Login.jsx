import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Login({ onLogin }) {
  const [view, setView] = useState("login");
  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const showMsg = (text, type = "error") => {
    setMessage({ type, text });
  };

  const handleSignIn = async () => {
    setMessage({ type: "", text: "" });
    if (!email || !password) return showMsg("E-posta ve şifre girilmelidir");

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      const errorMsg = error.message === "Invalid login credentials" ? "E-posta veya şifre hatalı" : error.message;
      return showMsg(errorMsg);
    }
    onLogin?.(data.session);
  };

  const handleSignUp = async () => {
    setMessage({ type: "", text: "" });
    if (email !== emailConfirm) return showMsg("E-posta adresleri eşleşmiyor");
    if (password.length < 6) return showMsg("Şifre en az 6 karakter olmalıdır");

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      const errorMsg = error.message.includes("already registered") ? "E-posta kullanımda" : error.message;
      return showMsg(errorMsg);
    }

    if (data.user && !data.session) {
      showMsg("Doğrulama linki e-postanıza gönderildi", "success");
    } else {
      onLogin?.(data.session);
    }
  };

  const handleResetPassword = async () => {
    setMessage({ type: "", text: "" });
    if (!email) return showMsg("Lütfen e-posta adresinizi girin");

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin, 
    });
    setLoading(false);

    if (error) return showMsg(error.message);
    showMsg("Şifre sıfırlama bağlantısı e-postanıza gönderildi", "success");
  };

  return (
    <div style={containerStyle}>
      {view !== "forgot" ? (
        <div style={tabHeaderStyle}>
          <div 
            style={{ ...tabStyle, borderBottom: view === "login" ? "2px solid #4caf50" : "none", color: view === "login" ? "#4caf50" : "#888" }}
            onClick={() => { setView("login"); setMessage({ type: "", text: "" }); }}
          >
            GİRİŞ YAP
          </div>
          <div 
            style={{ ...tabStyle, borderBottom: view === "signup" ? "2px solid #4caf50" : "none", color: view === "signup" ? "#4caf50" : "#888" }}
            onClick={() => { setView("signup"); setMessage({ type: "", text: "" }); }}
          >
            KAYIT OL
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "left", marginBottom: 20 }}>
          <button onClick={() => { setView("login"); setMessage({ type: "", text: "" }); }} style={backBtnStyle}>← Geri Dön</button>
          <h3 style={{ color: "white", marginTop: 10 }}>Şifremi Unuttum</h3>
        </div>
      )}

      <div style={{ display: "grid", gap: 15, marginTop: view === "forgot" ? 10 : 20 }}>
        <input
          placeholder="E-posta"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        
        {view === "signup" && (
          <input
            placeholder="E-posta Tekrar"
            value={emailConfirm}
            onChange={(e) => setEmailConfirm(e.target.value)}
            style={inputStyle}
          />
        )}

        {view !== "forgot" && (
          <input
            placeholder="Şifre"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        )}

        {message.text && (
          <div style={{ color: message.type === "error" ? "#ff5252" : "#4caf50", fontSize: "0.9rem" }}>
            {message.text}
          </div>
        )}

        <button 
          onClick={view === "login" ? handleSignIn : (view === "signup" ? handleSignUp : handleResetPassword)} 
          disabled={loading} 
          style={buttonStyle}
        >
          {loading ? "Bekleyin..." : (view === "login" ? "Giriş" : (view === "signup" ? "Kaydol" : "Sıfırlama Linki Gönder"))}
        </button>

        {view === "login" && (
          <div 
            onClick={() => { setView("forgot"); setMessage({ type: "", text: "" }); }} 
            style={{ textAlign: "center", color: "#888", fontSize: "0.85rem", cursor: "pointer", marginTop: 5 }}
          >
            Şifremi Unuttum
          </div>
        )}
      </div>
    </div>
  );
}

const containerStyle = { padding: 30, maxWidth: 400, margin: "100px auto", background: "#1e1e1e", borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,0.5)", position: "relative", zIndex: 9999 };
const tabHeaderStyle = { display: "flex", justifyContent: "space-between", marginBottom: 10 };
const tabStyle = { flex: 1, textAlign: "center", padding: "10px", cursor: "pointer", fontWeight: "bold", fontSize: "0.9rem", transition: "0.3s" };
const inputStyle = { padding: 12, background: "#2a2a2a", color: "white", border: "1px solid #444", borderRadius: 6, outline: "none" };
const buttonStyle = { padding: 12, background: "#4caf50", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold", marginTop: 10 };
const backBtnStyle = { background: "none", border: "none", color: "#4caf50", cursor: "pointer", fontSize: "0.9rem", padding: 0 };