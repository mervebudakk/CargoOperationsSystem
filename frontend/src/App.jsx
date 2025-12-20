import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import Login from "./pages/Login";
import SenaryoGirisi from "./pages/SenaryoGirisi";

export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  if (!session) return <Login onLogin={setSession} />;

  return (
    <div>
      <div style={{ padding: 12, display: "flex", justifyContent: "space-between" }}>
        <div>{session.user.email}</div>
        <button onClick={() => supabase.auth.signOut()}>Çıkış</button>
      </div>
      <SenaryoGirisi />
    </div>
  );
}
