import { useState } from "react";
import { supabase } from "./supabase";

function PasswordInput({ value, onChange, onKeyDown, placeholder, style }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        style={{ ...style, paddingRight: 52 }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 11, color: style.color, opacity: 0.6, padding: "2px 4px" }}
      >
        {show ? "cacher" : "voir"}
      </button>
    </div>
  );
}

function StrengthBar({ password, T }) {
  if (!password) return <div style={{ marginBottom: 10 }} />;
  const len = password.length;
  const level = len < 8 ? 0 : len < 12 ? 1 : 2;
  const labels = ["faible", "bon", "fort"];
  const colors = [T.danger, "#f59e0b", T.accent];
  const widths = ["33%", "66%", "100%"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <div style={{ flex: 1, height: 4, borderRadius: 99, background: T.border }}>
        <div style={{ width: widths[level], height: "100%", borderRadius: 99, background: colors[level], transition: "width 0.25s, background 0.25s" }} />
      </div>
      <span style={{ fontSize: 11, color: colors[level], minWidth: 32 }}>{labels[level]}</span>
    </div>
  );
}

function translateError(msg) {
  if (msg.includes("Invalid login credentials")) return "Email ou mot de passe incorrect.";
  if (msg.includes("Email not confirmed")) return "Confirme ton email avant de te connecter.";
  if (msg.includes("User already registered")) return "Ce compte existe déjà, connecte-toi.";
  if (msg.includes("Password should be")) return "Le mot de passe doit contenir au moins 8 caractères.";
  return msg;
}

export default function Auth({ T, S }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  function switchMode(m) { setMode(m); setError(null); setPassword(""); setConfirm(""); }

  const passwordsMatch = confirm === password;
  const signupInvalid = mode === "signup" && (!passwordsMatch || password.length < 8);

  function validate() {
    if (!email.trim()) return "L'email est requis.";
    if (!password) return "Le mot de passe est requis.";
    if (mode === "signup") {
      if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
      if (!passwordsMatch) return "Les mots de passe ne correspondent pas.";
    }
    return null;
  }

  async function submit() {
    const err = validate();
    if (err) { setError(err); return; }
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
      setError(translateError(e.message));
    } finally {
      setLoading(false);
    }
  }

  if (confirmSent) {
    return (
      <div style={{ textAlign: "center", padding: "12px 0" }}>
        <p style={{ fontSize: 14, color: T.text, marginBottom: 6 }}>✅ Compte créé !</p>
        <p style={{ fontSize: 12, color: T.muted, marginBottom: 14 }}>
          Vérifie ta boîte mail et clique sur le lien de confirmation, puis connecte-toi.
        </p>
        <button onClick={() => { setConfirmSent(false); switchMode("login"); }} style={S.btnS}>
          Se connecter
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button onClick={() => switchMode("login")} style={{ ...S.btnS, ...(mode === "login" ? { background: T.accentDim, color: T.accent, borderColor: T.accent } : {}) }}>
          Connexion
        </button>
        <button onClick={() => switchMode("signup")} style={{ ...S.btnS, ...(mode === "signup" ? { background: T.accentDim, color: T.accent, borderColor: T.accent } : {}) }}>
          Créer un compte
        </button>
      </div>

      <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 4 }}>Email</label>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="toi@email.com"
        style={{ ...S.inp, marginBottom: 10 }}
      />

      <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 4 }}>
        Mot de passe {mode === "signup" && <span style={{ color: T.muted, fontWeight: 400 }}>(8 caractères min.)</span>}
      </label>
      <PasswordInput
        value={password}
        onChange={e => setPassword(e.target.value)}
        onKeyDown={e => mode === "login" && e.key === "Enter" && submit()}
        placeholder="••••••••"
        style={{ ...S.inp, marginBottom: mode === "signup" ? 4 : 14 }}
      />

      {mode === "signup" && <StrengthBar password={password} T={T} />}

      {mode === "signup" && (
        <>
          <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 4 }}>Confirmer le mot de passe</label>
          <PasswordInput
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="••••••••"
            style={{
              ...S.inp,
              marginBottom: 4,
              ...(confirm && !passwordsMatch ? { borderColor: T.danger } : {}),
              ...(confirm && passwordsMatch ? { borderColor: T.accent } : {}),
            }}
          />
          <div style={{ minHeight: 20, marginBottom: 10 }}>
            {confirm && !passwordsMatch && <p style={{ margin: 0, fontSize: 11, color: T.danger }}>Les mots de passe ne correspondent pas.</p>}
            {confirm && passwordsMatch && <p style={{ margin: 0, fontSize: 11, color: T.accent }}>✓ Les mots de passe correspondent.</p>}
          </div>
        </>
      )}

      {error && <p style={{ fontSize: 12, color: T.danger, marginBottom: 10 }}>{error}</p>}

      <button
        onClick={submit}
        disabled={loading || signupInvalid}
        style={{ ...S.btnP, width: "100%", padding: 10, opacity: signupInvalid ? 0.5 : 1, cursor: signupInvalid ? "not-allowed" : "pointer" }}
      >
        {loading ? "..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
      </button>
    </div>
  );
}
