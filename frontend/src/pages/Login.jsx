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
    if (!firstName || !lastName) return showMsg("Ad ve soyad zorunludur");
    if (password.length < 6) return showMsg("Şifre en az 6 karakter olmalıdır");

    setLoading(true);
    
    // 1. Adım: Supabase Auth'a Kayıt
    const { data: authData, error: authError } = await supabase.auth.signUp({ 
      email, 
      password 
    });

    if (authError) {
      setLoading(false);
      return showMsg(authError.message);
    }

    // 2. Adım: Başarılıysa public.users tablosuna profil oluşturma
    if (authData.user) {
      const { error: profileError } = await supabase
        .from("users")
        .insert([
          {
            id: authData.user.id, // Auth'tan gelen UUID
            first_name: firstName,
            last_name: lastName,
            email: email,
            role_id: 2 // Varsayılan: Müşteri
          }
        ]);

      if (profileError) {
        console.error("Profil hatası:", profileError.message);
        // Profil oluşamazsa auth kaydını geri almak zor olduğu için logluyoruz
      }
    }

    setLoading(false);
    showMsg("Kayıt başarılı! Giriş yapabilirsiniz.", "success");
    setView("login");
  };

  return (
    <div style={styles.container}>
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

      <div style={{ display: "grid", gap: 15, marginTop: 20 }}>
        {view === "signup" && (
          <>
            <input placeholder="Adınız" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={styles.input} />
            <input placeholder="Soyadınız" value={lastName} onChange={(e) => setLastName(e.target.value)} style={styles.input} />
          </>
        )}
        
        <input placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} />
        
        {view !== "forgot" && (
          <input placeholder="Şifre" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} />
        )}

        {message.text && <div style={styles.message(message.type)}>{message.text}</div>}

        <button 
          onClick={view === "login" ? handleSignIn : (view === "signup" ? handleSignUp : () => {})} 
          disabled={loading} 
          style={styles.button}
        >
          {loading ? "İşleniyor..." : (view === "login" ? "Giriş" : "Kaydol")}
        </button>

        {view === "login" && (
          <div onClick={() => setView("forgot")} style={styles.forgotText}>Şifremi Unuttum</div>
        )}
      </div>
    </div>
  );
}