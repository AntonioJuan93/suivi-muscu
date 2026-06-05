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
        style={{ ...style, paddingRight: 60 }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:12, color:style.color, opacity:0.5, padding:"2px 4px", letterSpacing:"0.02em" }}
      >
        {show ? "cacher" : "voir"}
      </button>
    </div>
  );
}

function StrengthBar({ password, T }) {
  if (!password) return null;
  const len = password.length;
  const level = len < 8 ? 0 : len < 12 ? 1 : 2;
  const labels = ["faible", "moyen", "fort"];
  const colors = [T.danger, "#f59e0b", T.accent];
  const widths = ["33%", "66%", "100%"];
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6, marginBottom:2 }}>
      <div style={{ flex:1, height:3, borderRadius:99, background:T.border }}>
        <div style={{ width:widths[level], height:"100%", borderRadius:99, background:colors[level], transition:"width 0.25s, background 0.25s" }} />
      </div>
      <span style={{ fontSize:11, color:colors[level], minWidth:34 }}>{labels[level]}</span>
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
      <div style={{ textAlign:"center", padding:"8px 0" }}>
        <div style={{ fontSize:40, marginBottom:12 }}>📬</div>
        <p style={{ fontSize:15, fontWeight:600, color:T.text, margin:"0 0 8px" }}>Vérifie ta boîte mail</p>
        <p style={{ fontSize:13, color:T.muted, marginBottom:20, lineHeight:1.6 }}>
          Un lien de confirmation t'a été envoyé. Clique dessus puis reviens ici pour te connecter.
        </p>
        <button onClick={() => { setConfirmSent(false); switchMode("login"); }} style={{ ...S.btnP, width:"100%" }}>
          Se connecter
        </button>
      </div>
    );
  }

  const tabBtn = (m, label) => ({
    padding:"12px 0",
    marginRight: m === "login" ? 28 : 0,
    border:"none",
    borderBottom: mode === m ? `2px solid ${T.accent}` : "2px solid transparent",
    marginBottom:-1,
    background:"transparent",
    cursor:"pointer",
    fontSize:14,
    fontWeight: mode === m ? 600 : 400,
    color: mode === m ? T.accent : T.muted,
    transition:"color 0.15s",
  });

  return (
    <div>
      {/* Mode switch — style tab GitHub */}
      <div style={{ display:"flex", borderBottom:`1px solid ${T.border}`, marginBottom:24 }}>
        <button onClick={() => switchMode("login")} style={tabBtn("login")}>Connexion</button>
        <button onClick={() => switchMode("signup")} style={tabBtn("signup")}>Créer un compte</button>
      </div>

      <label style={{ fontSize:13, color:T.muted, display:"block", marginBottom:6, fontWeight:500 }}>Email</label>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="toi@email.com"
        style={{ ...S.inp, marginBottom:16 }}
      />

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
        <label style={{ fontSize:13, color:T.muted, fontWeight:500 }}>
          Mot de passe {mode === "signup" && <span style={{ fontWeight:400, fontSize:12 }}>(8 min.)</span>}
        </label>
      </div>
      <PasswordInput
        value={password}
        onChange={e => setPassword(e.target.value)}
        onKeyDown={e => mode === "login" && e.key === "Enter" && submit()}
        placeholder="••••••••"
        style={S.inp}
      />
      {mode === "signup" && <StrengthBar password={password} T={T} />}

      {mode === "signup" && (
        <div style={{ marginTop:16 }}>
          <label style={{ fontSize:13, color:T.muted, display:"block", marginBottom:6, fontWeight:500 }}>Confirmer le mot de passe</label>
          <PasswordInput
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="••••••••"
            style={{
              ...S.inp,
              ...(confirm && !passwordsMatch ? { borderColor:T.danger } : {}),
              ...(confirm && passwordsMatch ? { borderColor:T.accent } : {}),
            }}
          />
          <div style={{ minHeight:20, marginTop:4 }}>
            {confirm && !passwordsMatch && <p style={{ margin:0, fontSize:12, color:T.danger }}>Les mots de passe ne correspondent pas.</p>}
            {confirm && passwordsMatch && <p style={{ margin:0, fontSize:12, color:T.accent }}>✓ Les mots de passe correspondent.</p>}
          </div>
        </div>
      )}

      {error && <p style={{ fontSize:13, color:T.danger, margin:"14px 0 0", padding:"10px 14px", background:T.danger+"18", borderRadius:8 }}>{error}</p>}

      <button
        onClick={submit}
        disabled={loading || signupInvalid}
        style={{ ...S.btnP, width:"100%", padding:13, marginTop:20, fontSize:15, opacity: signupInvalid ? 0.45 : 1, cursor: signupInvalid ? "not-allowed" : "pointer" }}
      >
        {loading ? "..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
      </button>
    </div>
  );
}
