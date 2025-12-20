import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const signIn = async () => {
    setErr("");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onLogin?.(data.session);
  };

  const signUp = async () => {
    setErr("");
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    // Email confirmation kapalıysa direkt session gelir; açıksa kullanıcıya mail gider.
    onLogin?.(data.session);
  };

  return (
    <div style={{ padding: 24, maxWidth: 420, margin: "0 auto" }}>
      <h2>Giriş</h2>

      <div style={{ display: "grid", gap: 10 }}>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 10 }}
        />
        <input
          placeholder="Şifre"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 10 }}
        />

        {err && <div style={{ color: "tomato" }}>{err}</div>}

        <button onClick={signIn} disabled={loading} style={{ padding: 10 }}>
          {loading ? "..." : "Giriş Yap"}
        </button>

        <button onClick={signUp} disabled={loading} style={{ padding: 10 }}>
          {loading ? "..." : "Kayıt Ol"}
        </button>
      </div>
    </div>
  );
}
