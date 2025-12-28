import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { styles } from "../styles/Login.styles";

export default function Login({ onLogin }) {
  const [view, setView] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const showMsg = (text, type = "error") => setMessage({ type, text });

  const handleSignIn = async () => {
    setMessage({ type: "", text: "" });
    if (!email || !password) return showMsg("Lütfen e-posta ve şifrenizi giriniz.");

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        const errorMsg = error.message === "Invalid login credentials" ? "E-posta veya şifre hatalı" : error.message;
        throw new Error(errorMsg);
      }
      
      // Giriş başarılı, App.jsx'teki session state'ini güncelle
      if (onLogin) onLogin(data.session);
      
    } catch (err) {
      showMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setMessage({ type: "", text: "" });
    if (!firstName || !lastName || !email || !password) return showMsg("Tüm alanların doldurulması zorunludur.");
    if (password.length < 6) return showMsg("Şifre güvenliğiniz için en az 6 karakter olmalıdır.");

    setLoading(true);
    
    try {
      // 1. Adım: Supabase Auth'a Kayıt
      const { data: authData, error: authError } = await supabase.auth.signUp({ 
        email, 
        password 
      });

      if (authError) throw authError;

      // 2. Adım: public.users tablosuna profil kaydı (Backend Şeması ile Uyumlu)
      if (authData.user) {
        const { error: profileError } = await supabase
          .from("users")
          .insert([
            {
              id: authData.user.id, // Auth UUID
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              email: email.toLowerCase().trim(),
              role_id: 2 // Veritabanı şemanızdaki varsayılan 'Müşteri' rolü
            }
          ]);

        if (profileError) throw profileError;
      }

      showMsg("Hesabınız başarıyla oluşturuldu! Şimdi giriş yapabilirsiniz.", "success");
      setView("login");
      // Formu temizle
      setPassword("");
    } catch (err) {
      showMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) return showMsg("Lütfen e-posta adresinizi giriniz.");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (error) showMsg(error.message);
    else showMsg("Şifre sıfırlama bağlantısı gönderildi.", "success");
  };

  return (
    <div style={styles.container}>
      <div style={logoSection}>
        <span style={{ fontSize: "3rem" }}>🚚</span>
        <h2 style={{ color: "#fff", margin: "10px 0" }}>Kargo Operasyon</h2>
        <p style={{ color: "#666", fontSize: "0.85rem" }}>Lojistik Yönetim Sistemi v2.0</p>
      </div>

      {view !== "forgot" ? (
        <div style={styles.tabHeader}>
          <div style={styles.tab(view === "login")} onClick={() => setView("login")}>GİRİŞ YAP</div>
          <div style={styles.tab(view === "signup")} onClick={() => setView("signup")}>KAYIT OL</div>
        </div>
      ) : (
        <div style={{ textAlign: "left", marginBottom: 20 }}>
          <button onClick={() => setView("login")} style={styles.backBtn}>← Geri Dön</button>
          <h3 style={{ color: "white", marginTop: 10 }}>Şifremi Unuttum</h3>
        </div>
      )}

      <div style={{ display: "grid", gap: 15, marginTop: 10 }}>
        {view === "signup" && (
          <div style={{ display: "flex", gap: "10px" }}>
            <input placeholder="Ad" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={{...styles.input, flex: 1}} />
            <input placeholder="Soyad" value={lastName} onChange={(e) => setLastName(e.target.value)} style={{...styles.input, flex: 1}} />
          </div>
        )}
        
        <input 
          placeholder="E-posta Adresi" 
          type="email"
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          style={styles.input} 
        />
        
        {view !== "forgot" && (
          <input 
            placeholder="Şifre" 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            style={styles.input} 
          />
        )}

        {message.text && (
          <div style={styles.message(message.type)}>
            {message.type === "success" ? "✅ " : "⚠️ "}{message.text}
          </div>
        )}

        <button 
          onClick={view === "login" ? handleSignIn : (view === "signup" ? handleSignUp : handleResetPassword)} 
          disabled={loading} 
          style={{
            ...styles.button,
            background: loading ? "#222" : (message.type === "success" ? "#4caf50" : styles.button.background)
          }}
        >
          {loading ? "İşleniyor..." : (view === "login" ? "Sisteme Giriş" : (view === "signup" ? "Hesap Oluştur" : "Sıfırlama Bağlantısı Gönder"))}
        </button>

        {view === "login" && (
          <div onClick={() => setView("forgot")} style={styles.forgotText}>Şifremi Unuttum?</div>
        )}
      </div>
    </div>
  );
}

const logoSection = {
  textAlign: "center",
  marginBottom: "30px"
};