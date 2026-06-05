import { useState } from "react";
import { supabase } from "./supabase";

export default function Auth({ T, S }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setConfirmSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (confirmSent) {
    return (
      <div style={{ textAlign: "center", padding: "12px 0" }}>
        <p style={{ fontSize: 14, color: T.text, marginBottom: 12 }}>
          ✅ Vérifie ta boîte mail pour confirmer ton compte, puis connecte-toi.
        </p>
        <button onClick={() => { setConfirmSent(false); setMode("login"); }} style={S.btnS}>
          Retour à la connexion
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button
          onClick={() => setMode("login")}
          style={{ ...S.btnS, ...(mode === "login" ? { background: T.accentDim, color: T.accent, borderColor: T.accent } : {}) }}
        >Connexion</button>
        <button
          onClick={() => setMode("signup")}
          style={{ ...S.btnS, ...(mode === "signup" ? { background: T.accentDim, color: T.accent, borderColor: T.accent } : {}) }}
        >Créer un compte</button>
      </div>
      <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 4 }}>Email</label>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="toi@email.com"
        style={{ ...S.inp, marginBottom: 10 }}
      />
      <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 4 }}>Mot de passe</label>
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        onKeyDown={e => e.key === "Enter" && submit()}
        placeholder="••••••••"
        style={{ ...S.inp, marginBottom: 14 }}
      />
      {error && <p style={{ fontSize: 12, color: T.danger, marginBottom: 10 }}>{error}</p>}
      <button onClick={submit} disabled={loading} style={{ ...S.btnP, width: "100%", padding: 10 }}>
        {loading ? "..." : mode === "login" ? "Se connecter" : "S'inscrire"}
      </button>
    </div>
  );
}
