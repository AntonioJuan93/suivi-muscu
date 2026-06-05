import { useState, useEffect, useMemo, useRef } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { MUSCLE_GROUPS, INITIAL_PROGRAMS, THEMES, formatDate, calcVolume, estimate1RM, startOfWeek, makeStyles } from "./theme";
import { loadData, saveData } from "./storage";
import { supabase } from "./supabase";
import { loadCloud, saveCloud, clearCloudCache } from "./cloud";
import Auth from "./Auth";
import RestTimer from "./RestTimer";

function Tag({ children, T }) {
  return <span style={{ fontSize:11, background:T.accentDim, color:T.accent, padding:"2px 8px", borderRadius:99 }}>{children}</span>;
}

function StarRating({ value, onChange, T, emoji }) {
  const icons = emoji ? ["😞","😐","🙂","😊","🔥"] : ["1","2","3","4","5"];
  return (
    <div style={{ display:"flex", gap:4 }}>
      {[1,2,3,4,5].map(n => (
        <button key={n} onClick={() => onChange(value===n?null:n)} style={{
          width:32, height:32, borderRadius:"50%", border:`1px solid ${n<=value?T.accent:T.border}`,
          cursor:"pointer", fontSize:emoji?14:12, fontWeight:600,
          background:n<=value?T.accentDim:"transparent", color:n<=value?T.accent:T.muted,
          transition:"all 0.15s"
        }}>{icons[n-1]}</button>
      ))}
    </div>
  );
}

function SleepEnergyRating({ value, onChange, T }) {
  return (
    <div style={{ display:"flex", gap:3 }}>
      {[1,2,3,4,5].map(n => (
        <button key={n} onClick={() => onChange(value===n?null:n)} style={{
          width:26, height:26, borderRadius:"50%", border:`1px solid ${n<=value?T.accent:T.border}`,
          cursor:"pointer", fontSize:11, fontWeight:600,
          background:n<=value?T.accentDim:"transparent", color:n<=value?T.accent:T.muted
        }}>{n}</button>
      ))}
    </div>
  );
}

function ProgramEditor({ program, onSave, onCancel, T, S }) {
  const [name, setName] = useState(program?.name||"");
  const [muscles, setMuscles] = useState(program?.muscles||[]);
  const [exercises, setExercises] = useState(
    (program?.exercises||[]).map(ex =>
      typeof ex === "string" ? { name:ex, targetSets:"", targetReps:"", muscle:"" } : { muscle:"", ...ex }
    )
  );
  const [newEx, setNewEx] = useState("");
  const [newExMuscle, setNewExMuscle] = useState("");

  function toggleMuscle(m) { setMuscles(ms=>ms.includes(m)?ms.filter(x=>x!==m):[...ms,m]); }
  function addEx() {
    if(!newEx.trim())return;
    setExercises(ex=>[...ex,{name:newEx.trim(),targetSets:"",targetReps:"",muscle:newExMuscle}]);
    setNewEx(""); setNewExMuscle("");
  }
  function removeEx(i) { setExercises(ex=>ex.filter((_,j)=>j!==i)); }
  function moveEx(i,dir) { setExercises(ex=>{ const a=[...ex],j=i+dir; if(j<0||j>=a.length)return a; [a[i],a[j]]=[a[j],a[i]]; return a; }); }
  function updateExField(i,field,val) { setExercises(ex=>ex.map((e,j)=>j===i?{...e,[field]:val}:e)); }

  const allMuscleOpts = ["", ...MUSCLE_GROUPS];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:12 }}>
      <div style={{ background:T.bgModal, border:`1px solid ${T.border}`, borderRadius:16, padding:24, width:"min(560px,95vw)", maxHeight:"88vh", overflowY:"auto", boxSizing:"border-box" }}>
        <h3 style={{ margin:"0 0 16px", fontSize:16, fontWeight:600, color:T.text }}>{program?"Modifier le programme":"Nouveau programme"}</h3>

        <label style={{ fontSize:12, color:T.muted, display:"block", marginBottom:4 }}>Nom du programme</label>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: Push A" style={{ ...S.inp, marginBottom:16 }} />

        <label style={{ fontSize:12, color:T.muted, display:"block", marginBottom:6 }}>Groupes musculaires principaux</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:16 }}>
          {MUSCLE_GROUPS.map(m=><button key={m} onClick={()=>toggleMuscle(m)} style={{ ...S.btnS, ...(muscles.includes(m)?{background:T.accentDim,color:T.accent,borderColor:T.accent}:{}) }}>{m}</button>)}
        </div>

        <label style={{ fontSize:12, color:T.muted, display:"block", marginBottom:6 }}>Exercices <span style={{fontWeight:400}}>(séries × reps cible optionnels)</span></label>
        {exercises.length===0 && <p style={{ fontSize:12, color:T.muted, marginBottom:8 }}>Aucun exercice.</p>}

        {exercises.map((ex,i)=>(
          <div key={i} style={{ marginBottom:8, background:T.bgInput, borderRadius:10, padding:"10px 12px", border:`1px solid ${T.border}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
              <div style={{ display:"flex", flexDirection:"column", gap:1 }}>
                <button onClick={()=>moveEx(i,-1)} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, fontSize:10, padding:"1px 3px", lineHeight:1 }}>▲</button>
                <button onClick={()=>moveEx(i,1)} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, fontSize:10, padding:"1px 3px", lineHeight:1 }}>▼</button>
              </div>
              <span style={{ flex:1, fontSize:13, color:T.text, fontWeight:500 }}>{ex.name}</span>
              <button onClick={()=>removeEx(i)} style={{ background:"none", border:"none", cursor:"pointer", color:T.danger, fontSize:16, lineHeight:1 }}>✕</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 52px 6px 1fr", gap:6, alignItems:"center" }}>
              <select value={ex.muscle||""} onChange={e=>updateExField(i,"muscle",e.target.value)} style={{ ...S.inp, fontSize:12, padding:"6px 8px" }}>
                {allMuscleOpts.map(m=><option key={m} value={m}>{m||"Muscle..."}</option>)}
              </select>
              <input type="number" value={ex.targetSets||""} onChange={e=>updateExField(i,"targetSets",e.target.value)} placeholder="Sér." min="1" style={{ ...S.inp, fontSize:12, padding:"6px 6px", textAlign:"center" }} title="Nombre de séries" />
              <span style={{ fontSize:11, color:T.muted, textAlign:"center" }}>×</span>
              <input value={ex.targetReps||""} onChange={e=>updateExField(i,"targetReps",e.target.value)} placeholder="Reps (6-8, 5, 10-12)" style={{ ...S.inp, fontSize:12, padding:"6px 8px" }} title="Fourchette de répétitions" />
            </div>
          </div>
        ))}

        <div style={{ display:"flex", gap:6, marginBottom:20, marginTop:8, flexWrap:"wrap" }}>
          <input value={newEx} onChange={e=>setNewEx(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addEx()} placeholder="Nom de l'exercice" style={{ ...S.inp, flex:2, minWidth:120 }} />
          <select value={newExMuscle} onChange={e=>setNewExMuscle(e.target.value)} style={{ ...S.inp, flex:1, minWidth:110 }}>
            {allMuscleOpts.map(m=><option key={m} value={m}>{m||"Muscle..."}</option>)}
          </select>
          <button onClick={addEx} style={{ ...S.btnP, whiteSpace:"nowrap" }}>+ Ajouter</button>
        </div>

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onCancel} style={S.btnS}>Annuler</button>
          <button onClick={()=>name.trim()&&onSave({name:name.trim(),muscles,exercises})} style={S.btnP}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Stat mini-card ──────────────────────────────────────────────────────────
function StatCard({ label, value, sub, T, accent }) {
  return (
    <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:10, padding:14, textAlign:"center" }}>
      <div style={{ fontSize:11, color:T.muted, marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:17, fontWeight:700, color:accent||T.accent }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:T.muted, marginTop:2 }}>{sub}</div>}
    </div>
  );
}

export default function App() {
  // ── Navigation ────────────────────────────────────────────────────────────
  const [tab, setTab] = useState("log");
  const [editingProgram, setEditingProgram] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("");
  const [progressEx, setProgressEx] = useState("");
  const [showTimer, setShowTimer] = useState(false);
  const [timerTrigger, setTimerTrigger] = useState(0);
  const [liveNow, setLiveNow] = useState(Date.now());

  // ── Data ──────────────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState([]);
  const [programs, setPrograms] = useState(INITIAL_PROGRAMS);
  const [themeKey, setThemeKey] = useState("clair");

  // ── Session draft ─────────────────────────────────────────────────────────
  const [mode, setMode] = useState("free");
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [sessionDuration, setSessionDuration] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [sessionBodyweight, setSessionBodyweight] = useState("");
  const [sessionRating, setSessionRating] = useState(null);
  const [sessionSleep, setSessionSleep] = useState(null);
  const [sessionEnergy, setSessionEnergy] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [newExName, setNewExName] = useState("");
  const [newExMuscle, setNewExMuscle] = useState(MUSCLE_GROUPS[0]);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const T = THEMES[themeKey] || THEMES.clair;
  const S = useMemo(()=>makeStyles(T),[themeKey]);
  const saveTimer = useRef(null);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function wVolume(sets) { return calcVolume((sets||[]).filter(s=>!s.isWarmup)); }

  function formatRest(ms) {
    if (!ms || ms < 5000) return null;
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60); const rs = s % 60;
    return rs > 0 ? `${m}m${String(rs).padStart(2,"0")}` : `${m}m`;
  }

  function parseRepRange(str) {
    if (!str) return [null, null];
    const parts = String(str).split("-").map(x => parseInt(x.trim())).filter(x => !isNaN(x));
    if (parts.length === 2) return [parts[0], parts[1]];
    if (parts.length === 1) return [parts[0], parts[0]];
    return [null, null];
  }

  function getWellnessMultiplier() {
    const sleep = sessionSleep || 3, energy = sessionEnergy || 3;
    const avg = (sleep + energy) / 2;
    if (avg < 2) return 0.90;
    if (avg < 2.5) return 0.94;
    if (avg < 3.5) return 0.97;
    return 1.0;
  }

  function getLastForExercise(name) {
    const sorted = [...sessions].sort((a,b)=>b.date.localeCompare(a.date));
    const lastS = sorted.find(s=>s.exercises.some(e=>e.name===name));
    if (!lastS) return null;
    const ex = lastS.exercises.find(e=>e.name===name);
    const working = (ex.sets||[]).filter(s=>!s.isWarmup && (s.weight||s.reps));
    const daysAgo = Math.round((Date.now()-new Date(lastS.date))/86400000);
    const maxW = Math.max(0,...working.map(s=>parseFloat(s.weight)||0));
    const repsPerSet = working.map(s=>parseInt(s.reps)||0);
    return { daysAgo, date:lastS.date, sets:working, maxWeight:maxW, repsPerSet };
  }

  function getSuggestion(name, targetReps) {
    const last = getLastForExercise(name);
    if (!last || !last.maxWeight) return null;

    const [minR, maxR] = parseRepRange(targetReps);
    const working = last.sets.filter(s => s.reps);
    if (!working.length) return null;

    const mult = getWellnessMultiplier();
    const wellnessReduced = mult < 1;
    let type, weight, reps, reason;

    if (maxR) {
      // Double progression : 6-8 → si toutes les séries ≥ maxR, augmente le poids ; sinon augmente les reps
      const allAtMax = working.every(s => (parseInt(s.reps)||0) >= maxR);
      const avgReps = Math.round(working.reduce((a,s)=>a+(parseInt(s.reps)||0),0)/working.length);
      if (allAtMax) {
        const inc = last.maxWeight >= 100 ? 2.5 : last.maxWeight >= 60 ? 2.5 : 2.5;
        weight = last.maxWeight + inc;
        reps = minR || maxR;
        reason = `Toutes les séries à ${maxR} reps ✓ → poids +${inc}kg`;
        type = "weight";
      } else {
        weight = last.maxWeight;
        reps = Math.min(maxR, avgReps + 1);
        reason = `Vise ${reps} reps (max ${maxR}) avant d'augmenter le poids`;
        type = "reps";
      }
    } else {
      // Pas de fourchette → utilise le RPE
      const withRPE = last.sets.filter(s=>s.rpe);
      const avgRPE = withRPE.length ? withRPE.reduce((a,s)=>a+(parseFloat(s.rpe)||0),0)/withRPE.length : null;
      if (!avgRPE || avgRPE < 7) { weight = last.maxWeight+5; type="weight"; reason="RPE faible → progression +5kg"; }
      else if (avgRPE <= 8.5) { weight = last.maxWeight+2.5; type="weight"; reason="Bonne séance → progression +2.5kg"; }
      else { weight = last.maxWeight; type="hold"; reason="RPE élevé → consolide le poids actuel"; }
      reps = null;
    }

    // Ajustement forme
    if (wellnessReduced && type === "weight") {
      const adj = Math.round(weight * mult * 2) / 2;
      return { type, weight:adj, reps, reason, wellnessNote:`Forme réduite (sommeil/énergie) → ${adj}kg` };
    }
    return { type, weight, reps, reason };
  }

  // ── Persistence ───────────────────────────────────────────────────────────
  function fullData() {
    return { sessions, programs, theme:themeKey,
      draft:{ exercises, sessionDate, sessionDuration, sessionNotes,
              sessionBodyweight, sessionRating, sessionSleep, sessionEnergy, mode, selectedProgram } };
  }
  function applyData(d, withDraft) {
    if(!d) return;
    if(d.sessions) setSessions(d.sessions);
    if(d.programs) setPrograms(d.programs);
    if(d.theme&&THEMES[d.theme]) setThemeKey(d.theme);
    if(withDraft&&d.draft) {
      const dr=d.draft;
      if(Array.isArray(dr.exercises)) setExercises(dr.exercises);
      if(dr.sessionDate) setSessionDate(dr.sessionDate);
      setSessionDuration(dr.sessionDuration||""); setSessionNotes(dr.sessionNotes||"");
      setSessionBodyweight(dr.sessionBodyweight||"");
      setSessionRating(dr.sessionRating||null); setSessionSleep(dr.sessionSleep||null);
      setSessionEnergy(dr.sessionEnergy||null);
      if(dr.mode) setMode(dr.mode);
      if(dr.selectedProgram!==undefined) setSelectedProgram(dr.selectedProgram);
    }
  }
  function resetDraft() {
    setExercises([]); setSessionDuration(""); setSessionNotes("");
    setSessionBodyweight(""); setSessionRating(null); setSessionSleep(null); setSessionEnergy(null);
    setSelectedProgram(null); setSessionDate(new Date().toISOString().split("T")[0]);
  }

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(()=>{ const d=loadData(); if(d) applyData(d,true); setReady(true); setLoading(false); },[]);

  useEffect(()=>{
    if(!ready)return;
    if(saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{ const d=fullData(); saveData(d); if(user&&cloudLoaded) saveCloud(d); },400);
    return ()=>{ if(saveTimer.current) clearTimeout(saveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sessions,programs,themeKey,exercises,sessionDate,sessionDuration,sessionNotes,
     sessionBodyweight,sessionRating,sessionSleep,sessionEnergy,mode,selectedProgram,ready,user,cloudLoaded]);

  useEffect(()=>{
    const h=(e)=>{ if(e.key==="suivi_muscu_data"){ const d=loadData(); if(d) applyData(d,false); } };
    window.addEventListener("storage",h); return ()=>window.removeEventListener("storage",h);
  },[]);

  useEffect(()=>{
    const {data:{subscription}}=supabase.auth.onAuthStateChange(async(event,session)=>{
      const u=session?.user??null; setUser(u);
      if(event==="INITIAL_SESSION"){ setAuthReady(true); if(u) loadCloud().then(d=>{ if(d) applyData(d,false); setCloudLoaded(true); }); }
      if(event==="SIGNED_IN") loadCloud().then(d=>{ if(d) applyData(d,false); setCloudLoaded(true); });
      if(event==="SIGNED_OUT"){
        clearCloudCache(); setCloudLoaded(false);
        setSessions([]); setPrograms(INITIAL_PROGRAMS); setThemeKey("clair");
        resetDraft(); setMode("free"); saveData(null);
      }
    });
    return ()=>subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Live rest timer — updates every second while on log tab
  useEffect(()=>{
    if(tab!=="log") return;
    const id=setInterval(()=>setLiveNow(Date.now()),1000);
    return ()=>clearInterval(id);
  },[tab]);

  // ── Actions ───────────────────────────────────────────────────────────────
  function saveProgram(data){
    if(editingProgram==="new") setPrograms(ps=>[...ps,{...data,id:Date.now()}]);
    else setPrograms(ps=>ps.map(p=>p.id===editingProgram.id?{...p,...data}:p));
    setEditingProgram(null);
  }
  function deleteProgram(id){ setPrograms(ps=>ps.filter(p=>p.id!==id)); setConfirmDelete(null); }
  function deleteSession(id){ setSessions(ps=>ps.filter(s=>s.id!==id)); setConfirmDelete(null); }

  function loadProgram(p) {
    setSelectedProgram(p);
    const now = Date.now();
    setExercises(p.exercises.map((ex,i)=>{
      const name = typeof ex==="string"?ex:ex.name;
      const exMuscle = typeof ex==="object"&&ex.muscle ? ex.muscle : null;
      const muscle = exMuscle || p.muscles[Math.min(i,p.muscles.length-1)] || MUSCLE_GROUPS[0];
      const targetSets = typeof ex==="object"&&ex.targetSets ? parseInt(ex.targetSets)||1 : 1;
      const targetReps = typeof ex==="object"&&ex.targetReps ? ex.targetReps : "";
      const sugg = getSuggestion(name, targetReps);
      const defaultWeight = sugg ? String(sugg.weight) : "";
      const defaultReps = targetReps ? targetReps.split("-")[0] : "";
      const sets = Array.from({length:targetSets},()=>({weight:defaultWeight,reps:defaultReps,rpe:"",isWarmup:false,addedAt:now}));
      return {id:now+i, name, muscle, notes:"", sets, target:{sets:targetSets,reps:targetReps}};
    }));
  }

  function repeatSession(s) {
    setMode("free"); setSelectedProgram({name:s.programName});
    setSessionDate(new Date().toISOString().split("T")[0]);
    setSessionDuration(s.duration?String(s.duration):""); setSessionNotes("");
    setSessionBodyweight(""); setSessionRating(null); setSessionSleep(null); setSessionEnergy(null);
    const now = Date.now();
    setExercises(s.exercises.map((e,i)=>({
      id:now+i, name:e.name, muscle:e.muscle, notes:"",
      sets:(e.sets||[]).map(st=>({weight:st.weight,reps:st.reps,rpe:"",isWarmup:st.isWarmup||false,addedAt:null}))
    })));
    setTab("log");
  }

  function addSet(id) {
    const now = Date.now();
    setExercises(ex=>ex.map(e=>e.id===id?{...e,sets:[...e.sets,{weight:"",reps:"",rpe:"",isWarmup:false,addedAt:now}]}:e));
    setTimerTrigger(k=>k+1);
  }
  function removeSet(id,si){ setExercises(ex=>ex.map(e=>e.id===id?{...e,sets:e.sets.filter((_,i)=>i!==si)}:e)); }
  function updateSet(id,si,f,v){ setExercises(ex=>ex.map(e=>e.id===id?{...e,sets:e.sets.map((st,i)=>i===si?{...st,[f]:v}:st)}:e)); }
  function removeExercise(id){ setExercises(ex=>ex.filter(e=>e.id!==id)); }
  function updateExNotes(id,v){ setExercises(ex=>ex.map(e=>e.id===id?{...e,notes:v}:e)); }

  function addExercise(nameOverride) {
    const name=(nameOverride||newExName).trim(); if(!name)return;
    let muscle=newExMuscle;
    for(const s of sessions){ const f=s.exercises.find(e=>e.name===name); if(f){muscle=f.muscle;break;} }
    setExercises(ex=>[...ex,{id:Date.now(),name,muscle,notes:"",sets:[{weight:"",reps:"",rpe:"",isWarmup:false,addedAt:Date.now()}]}]);
    setNewExName("");
  }

  function saveSession() {
    if(!exercises.length)return;
    const clean=exercises.map(e=>({...e,sets:e.sets.filter(s=>s.weight||s.reps)})).filter(e=>e.sets.length);
    if(!clean.length)return;
    setSessions(s=>[{id:Date.now(),date:sessionDate,duration:parseInt(sessionDuration)||null,
      notes:sessionNotes.trim()||null,programName:selectedProgram?.name||"Séance libre",exercises:clean,
      bodyweight:parseFloat(sessionBodyweight)||null,rating:sessionRating,sleep:sessionSleep,energy:sessionEnergy},...s]);
    resetDraft(); setMode("free"); setTab("history");
  }

  function exportJSON(){const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([JSON.stringify({sessions,programs,theme:themeKey},null,2)],{type:"application/json"})); a.download="suivi_muscu.json"; a.click();}
  function exportCSV(){
    const rows=[["Date","Programme","Exercice","Muscle","Série","Échauffement","Poids","Reps","RPE","Volume","1RM","Repos (s)"]];
    sessions.forEach(s=>s.exercises.forEach(e=>e.sets.forEach((st,si)=>{
      const prev=si>0?e.sets[si-1]:null;
      const rest=prev&&st.addedAt&&prev.addedAt?Math.round((st.addedAt-prev.addedAt)/1000):"";
      rows.push([s.date,s.programName,e.name,e.muscle,si+1,st.isWarmup?"oui":"non",st.weight||0,st.reps||0,st.rpe||"",(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),estimate1RM(st.weight,st.reps),rest]);
    })));
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([rows.map(r=>r.map(v=>`"${v}"`).join(",")).join("\n")],{type:"text/csv"})); a.download="suivi_muscu.csv"; a.click();
  }
  function importJSON(e){
    setImportError(null); setImportSuccess(false);
    const file=e.target.files?.[0]; if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{try{const d=JSON.parse(ev.target.result); if(!d.sessions||!d.programs)throw new Error(); applyData(d,false); setImportSuccess(true); setTimeout(()=>setImportSuccess(false),3000);}catch{setImportError("Fichier invalide.");}};
    reader.readAsText(file); e.target.value="";
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  const allExNames=[...new Set(sessions.flatMap(s=>s.exercises.map(e=>e.name)))].sort();
  const now=new Date(), weekStart=startOfWeek(now);

  const prSet=useMemo(()=>{
    const best={},prs=new Set();
    [...sessions].sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id).forEach(s=>
      s.exercises.forEach(e=>{
        const mw=Math.max(0,...(e.sets||[]).filter(st=>!st.isWarmup).map(st=>parseFloat(st.weight)||0));
        if(mw>0&&mw>(best[e.name]||0)){best[e.name]=mw; prs.add(s.id+":"+e.name);}
      })
    );
    return prs;
  },[sessions]);

  const progressData=useMemo(()=>
    sessions.flatMap(s=>s.exercises.filter(e=>e.name===progressEx).map(e=>{
      const working=(e.sets||[]).filter(st=>!st.isWarmup);
      const withRPE=working.filter(st=>st.rpe);
      const avgRPE=withRPE.length?Math.round(withRPE.reduce((a,st)=>a+(parseFloat(st.rpe)||0),0)/withRPE.length*10)/10:null;
      return {date:s.date,label:formatDate(s.date),
        maxWeight:Math.max(0,...working.map(st=>parseFloat(st.weight)||0)),
        volume:wVolume(e.sets),
        orm:Math.max(0,...working.map(st=>estimate1RM(st.weight,st.reps))),
        rating:s.rating, sleep:s.sleep, energy:s.energy, avgRPE};
    })).sort((a,b)=>a.date.localeCompare(b.date))
  ,[sessions, progressEx]);

  const bwData=useMemo(()=>
    [...sessions].filter(s=>s.bodyweight).map(s=>({date:s.date,label:formatDate(s.date),weight:parseFloat(s.bodyweight)||0}))
    .sort((a,b)=>a.date.localeCompare(b.date))
  ,[sessions]);

  const totalVolume=Math.round(sessions.reduce((acc,s)=>acc+s.exercises.reduce((a,e)=>a+wVolume(e.sets),0),0));
  const muscleCount=sessions.reduce((acc,s)=>{s.exercises.forEach(e=>{acc[e.muscle]=(acc[e.muscle]||0)+1;}); return acc;},{});
  const topMuscle=Object.entries(muscleCount).sort((a,b)=>b[1]-a[1])[0];
  const thisWeek=sessions.filter(s=>new Date(s.date)>=weekStart).length;
  const thisMonth=sessions.filter(s=>{const d=new Date(s.date); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}).length;
  const durations=sessions.filter(s=>s.duration).map(s=>s.duration);
  const avgDuration=durations.length?Math.round(durations.reduce((a,b)=>a+b,0)/durations.length):null;

  const weeklyVolByMuscle=useMemo(()=>{
    const vol={};
    sessions.filter(s=>new Date(s.date)>=weekStart).forEach(s=>s.exercises.forEach(e=>{vol[e.muscle]=(vol[e.muscle]||0)+wVolume(e.sets);}));
    return vol;
  },[sessions]);

  const weeklyVolTrend=useMemo(()=>{
    return Array.from({length:6},(_,i)=>{
      const ws=new Date(weekStart); ws.setDate(ws.getDate()-(5-i)*7);
      const we=new Date(ws); we.setDate(we.getDate()+7);
      const vol=Math.round(sessions.filter(s=>{const d=new Date(s.date);return d>=ws&&d<we;}).reduce((a,s)=>a+s.exercises.reduce((b,e)=>b+wVolume(e.sets),0),0));
      return {label:ws.toLocaleDateString("fr-FR",{day:"2-digit",month:"short"}), vol, sessions:sessions.filter(s=>{const d=new Date(s.date);return d>=ws&&d<we;}).length};
    });
  },[sessions]);

  const sessionsByDay=useMemo(()=>{
    const days=["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
    const counts=Array(7).fill(0);
    sessions.forEach(s=>{ const d=new Date(s.date); counts[(d.getDay()+6)%7]++; });
    return days.map((label,i)=>({label,count:counts[i]}));
  },[sessions]);

  const wellnessStats=useMemo(()=>{
    const w=sessions.filter(s=>s.rating||s.sleep||s.energy).slice(0,30);
    if(!w.length) return null;
    const avg=f=>{ const v=w.filter(s=>s[f]).map(s=>s[f]); return v.length?(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1):"—"; };
    return {rating:avg("rating"),sleep:avg("sleep"),energy:avg("energy"),count:w.length};
  },[sessions]);

  const trainingStreak=useMemo(()=>{
    const weekSet=new Set(sessions.map(s=>startOfWeek(new Date(s.date)).toISOString().split("T")[0]));
    let streak=0, check=new Date(weekStart);
    if(!weekSet.has(check.toISOString().split("T")[0])) check.setDate(check.getDate()-7);
    while(weekSet.has(check.toISOString().split("T")[0])){ streak++; check.setDate(check.getDate()-7); }
    return streak;
  },[sessions]);

  const muscleRecovery=useMemo(()=>{
    const result={};
    MUSCLE_GROUPS.forEach(muscle=>{
      const lastS=[...sessions].sort((a,b)=>b.date.localeCompare(a.date)).find(s=>s.exercises.some(e=>e.muscle===muscle));
      if(!lastS){result[muscle]={status:"fresh",hours:null};return;}
      const hours=Math.round((Date.now()-new Date(lastS.date))/3600000);
      result[muscle]={status:hours<24?"tired":hours<48?"recovering":"fresh",hours};
    });
    return result;
  },[sessions]);

  const filteredSessions=historyFilter?sessions.filter(s=>s.exercises.some(e=>e.muscle===historyFilter)):sessions;
  const usedMuscles=[...new Set(sessions.flatMap(s=>s.exercises.map(e=>e.muscle)))];
  const tabStyle=t=>({padding:"8px 10px",border:"none",cursor:"pointer",fontSize:13,whiteSpace:"nowrap",borderBottom:tab===t?`2px solid ${T.accent}`:"2px solid transparent",color:tab===t?T.accent:T.muted,background:"transparent",fontWeight:tab===t?600:400});
  const recoveryColor={tired:T.danger,recovering:"#f59e0b",fresh:T.accent};
  const recoveryLabel={tired:"Fatigué",recovering:"Récupération",fresh:"Prêt"};
  const ratingColors=["#ef4444","#f97316","#eab308","#22c55e","#6366f1"];
  const ratingEmojis=["😞","😐","🙂","😊","🔥"];

  // ── Auth screens ──────────────────────────────────────────────────────────
  if(loading||!authReady) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"3rem",color:T.muted,fontSize:14,background:T.bg,minHeight:"100vh"}}>Chargement...</div>;

  if(!user) return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:"32px 16px",boxSizing:"border-box"}}>
      <div style={{width:"min(440px,100%)"}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:72,height:72,borderRadius:22,background:T.accentDim,fontSize:36,marginBottom:20,boxShadow:T.shadow}}>🏋️</div>
          <h1 style={{fontSize:28,fontWeight:800,color:T.text,margin:"0 0 10px",letterSpacing:"-0.8px"}}>Suivi Muscu</h1>
          <p style={{fontSize:14,color:T.muted,margin:0,lineHeight:1.7}}>Enregistre tes séances · Suis ta progression<br/>Synchronisé sur tous tes appareils</p>
        </div>
        <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:20,padding:"28px 32px",boxShadow:T.shadow}}><Auth T={T} S={S}/></div>
        <p style={{textAlign:"center",fontSize:11,color:T.muted,marginTop:20,opacity:0.6}}>Données chiffrées · Synchronisation sécurisée</p>
      </div>
    </div>
  );

  // ── Main app ──────────────────────────────────────────────────────────────
  return (
    <div style={{fontFamily:"var(--font-sans)",paddingBottom:48,background:T.bg,minHeight:"100vh",color:T.text}}>
      {editingProgram!==null && <ProgramEditor program={editingProgram==="new"?null:editingProgram} onSave={saveProgram} onCancel={()=>setEditingProgram(null)} T={T} S={S}/>}
      {confirmDelete && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:12}}>
          <div style={{background:T.bgModal,border:`1px solid ${T.border}`,borderRadius:14,padding:24,width:"min(360px,90vw)",textAlign:"center"}}>
            <p style={{fontSize:14,marginBottom:20,color:T.text}}>Supprimer <strong>{confirmDelete.name||formatDate(confirmDelete.date)}</strong> ?</p>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button onClick={()=>setConfirmDelete(null)} style={S.btnS}>Annuler</button>
              <button onClick={()=>confirmDelete.exercises?deleteSession(confirmDelete.id):deleteProgram(confirmDelete.id)} style={S.btnD}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {tab==="log" && <RestTimer T={T} visible={showTimer} triggerKey={timerTrigger}/>}

      {/* Header */}
      <div style={{borderBottom:`1px solid ${T.border}`,background:T.bgCard,boxShadow:`0 1px 0 ${T.border}`}}>
        <div style={{maxWidth:680,margin:"0 auto",padding:"0 16px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0 0"}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:38,height:38,borderRadius:12,background:T.accentDim,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🏋️</div>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:T.text,letterSpacing:"-0.3px"}}>Suivi Muscu</div>
                <div style={{fontSize:11,color:T.muted}}>Séances · Progression · Performances</div>
              </div>
            </div>
            <button onClick={()=>setTab("settings")} title={user.email} style={{width:36,height:36,borderRadius:"50%",background:tab==="settings"?T.accent:T.accentDim,color:tab==="settings"?T.onAccent:T.accent,border:"none",cursor:"pointer",fontSize:14,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {user.email[0].toUpperCase()}
            </button>
          </div>
          <div style={{display:"flex",overflowX:"auto",gap:0,marginTop:2}}>
            {[["log","Séance"],["history","Historique"],["progress","Progression"],["programs","Programmes"],["stats","Stats"]].map(([k,l])=>(
              <button key={k} style={tabStyle(k)} onClick={()=>setTab(k)}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:680,margin:"0 auto",padding:"20px 16px 0"}}>

        {/* ══════════════════════════ LOG ══════════════════════════════════ */}
        {tab==="log" && (
          <div>
            <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"flex-end"}}>
              <div><label style={{fontSize:12,color:T.muted,display:"block",marginBottom:4}}>Date</label><input type="date" value={sessionDate} onChange={e=>setSessionDate(e.target.value)} style={{...S.inp,width:140}}/></div>
              <div><label style={{fontSize:12,color:T.muted,display:"block",marginBottom:4}}>Durée (min)</label><input type="number" placeholder="60" value={sessionDuration} onChange={e=>setSessionDuration(e.target.value)} style={{...S.inp,width:80}}/></div>
              <div><label style={{fontSize:12,color:T.muted,display:"block",marginBottom:4}}>Mode</label>
                <div style={{display:"flex",gap:8}}>
                  <button style={{...S.btnS,...(mode==="free"?{background:T.accentDim,color:T.accent,borderColor:T.accent}:{})}} onClick={()=>{setMode("free");setSelectedProgram(null);setExercises([]);}}>Libre</button>
                  <button style={{...S.btnS,...(mode==="program"?{background:T.accentDim,color:T.accent,borderColor:T.accent}:{})}} onClick={()=>setMode("program")}>Programme</button>
                </div>
              </div>
              {exercises.length>0 && (
                <button onClick={()=>setShowTimer(t=>!t)} style={{...S.btnS,...(showTimer?{background:T.accentDim,color:T.accent,borderColor:T.accent}:{}),padding:"7px 12px",fontSize:12,marginLeft:"auto"}}>⏱ Repos</button>
              )}
            </div>

            {mode==="program"&&!selectedProgram&&(
              <div style={{marginBottom:16}}>
                <p style={{fontSize:13,color:T.muted,margin:"0 0 8px"}}>Choisissez un programme :</p>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {programs.map(p=>(
                    <button key={p.id} onClick={()=>loadProgram(p)} style={{...S.btnS,padding:"8px 14px",textAlign:"left"}}>
                      <div style={{fontWeight:600,color:T.text,fontSize:13}}>{p.name}</div>
                      <div style={{fontSize:11,color:T.muted,marginTop:2}}>{p.muscles.join(" · ")}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {exercises.map(ex=>{
              const last=getLastForExercise(ex.name);
              const sugg=getSuggestion(ex.name, ex.target?.reps);
              const lastSet=ex.sets[ex.sets.length-1];
              const liveRest=lastSet?.addedAt ? formatRest(liveNow-lastSet.addedAt) : null;
              return (
                <div key={ex.id} style={S.card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontWeight:600,fontSize:14,color:T.text}}>{ex.name}</span>
                      <Tag T={T}>{ex.muscle}</Tag>
                      {ex.target?.reps && <span style={{fontSize:11,color:T.muted,background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:99,padding:"2px 8px"}}>🎯 {ex.target.sets?`${ex.target.sets}×`:""}  {ex.target.reps}</span>}
                    </div>
                    <button onClick={()=>removeExercise(ex.id)} style={{...S.btnS,padding:"3px 8px",fontSize:11}}>✕</button>
                  </div>

                  {/* Contexte dernière séance + suggestion */}
                  <div style={{fontSize:11,marginBottom:10,padding:"8px 10px",background:T.bgInput,borderRadius:8}}>
                    {last ? (
                      <div style={{marginBottom:sugg?4:0,color:T.muted}}>
                        🕐 {last.daysAgo===0?"Aujourd'hui":last.daysAgo===1?"Hier":`Il y a ${last.daysAgo}j`} : {last.sets.length} série{last.sets.length>1?"s":""} @ {last.maxWeight}kg
                        {last.repsPerSet.length > 0 && ` (${last.repsPerSet.join(", ")} reps)`}
                      </div>
                    ) : (
                      <div style={{color:T.muted}}>Premier enregistrement pour cet exercice</div>
                    )}
                    {sugg && (
                      <div style={{marginTop:2}}>
                        {sugg.type==="weight" && <span style={{color:T.accent,fontWeight:600}}>→ Essaie {sugg.weight}kg{sugg.reps?` × ${sugg.reps} reps`:""}</span>}
                        {sugg.type==="reps" && <span style={{color:"#f59e0b",fontWeight:600}}>→ Garde {sugg.weight}kg, vise {sugg.reps} reps</span>}
                        {sugg.type==="hold" && <span style={{color:T.muted,fontWeight:600}}>→ Maintiens {sugg.weight}kg</span>}
                        <span style={{color:T.muted,marginLeft:6}}>{sugg.reason}</span>
                        {sugg.wellnessNote && <div style={{color:T.danger,marginTop:2}}>⚠️ {sugg.wellnessNote}</div>}
                      </div>
                    )}
                  </div>

                  {/* Set header */}
                  <div style={{display:"grid",gridTemplateColumns:"18px 22px 1fr 1fr 46px 50px 24px",gap:5,alignItems:"center",marginBottom:4}}>
                    <span style={{fontSize:10,color:T.muted,textAlign:"center"}}>#</span>
                    <span style={{fontSize:10,color:T.muted,textAlign:"center"}} title="Échauffement (W)">W</span>
                    <span style={{fontSize:10,color:T.muted}}>kg</span>
                    <span style={{fontSize:10,color:T.muted}}>Reps</span>
                    <span style={{fontSize:10,color:T.muted,textAlign:"center"}}>RPE</span>
                    <span style={{fontSize:10,color:T.muted,textAlign:"right"}}>1RM</span>
                    <span></span>
                  </div>

                  {/* Sets with inline rest */}
                  {ex.sets.map((s,si)=>{
                    const restMs = si>0 && s.addedAt && ex.sets[si-1].addedAt ? s.addedAt-ex.sets[si-1].addedAt : null;
                    const restStr = formatRest(restMs);
                    return (
                      <div key={si}>
                        {restStr && (
                          <div style={{display:"flex",alignItems:"center",gap:6,margin:"3px 0",opacity:0.6}}>
                            <div style={{flex:1,height:1,background:T.border}}/>
                            <span style={{fontSize:10,color:T.muted,whiteSpace:"nowrap"}}>⏱ {restStr}</span>
                            <div style={{flex:1,height:1,background:T.border}}/>
                          </div>
                        )}
                        <div style={{display:"grid",gridTemplateColumns:"18px 22px 1fr 1fr 46px 50px 24px",gap:5,alignItems:"center",marginBottom:3,opacity:s.isWarmup?0.6:1}}>
                          <span style={{fontSize:11,color:T.muted,textAlign:"center"}}>{si+1}</span>
                          <button onClick={()=>updateSet(ex.id,si,"isWarmup",!s.isWarmup)} title="Série d'échauffement" style={{fontSize:9,fontWeight:700,border:`1px solid ${s.isWarmup?T.accent:T.border}`,borderRadius:4,padding:"2px 0",cursor:"pointer",background:s.isWarmup?T.accentDim:"transparent",color:s.isWarmup?T.accent:T.muted,lineHeight:1,width:"100%"}}>W</button>
                          <input type="number" placeholder="0" value={s.weight} onChange={e=>updateSet(ex.id,si,"weight",e.target.value)} style={{...S.inp,textAlign:"center",padding:"7px 4px"}}/>
                          <input type="number" placeholder="0" value={s.reps} onChange={e=>updateSet(ex.id,si,"reps",e.target.value)} style={{...S.inp,textAlign:"center",padding:"7px 4px"}}/>
                          <input type="number" placeholder="—" min="1" max="10" step="0.5" value={s.rpe||""} onChange={e=>updateSet(ex.id,si,"rpe",e.target.value)} style={{...S.inp,textAlign:"center",padding:"7px 4px",fontSize:12}} title="Effort perçu (1=facile, 10=max)"/>
                          <span style={{fontSize:11,color:T.muted,textAlign:"right"}}>{estimate1RM(s.weight,s.reps)||"—"}</span>
                          <button onClick={()=>removeSet(ex.id,si)} style={{background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:13}}>✕</button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Live rest timer on last set */}
                  {liveRest && (
                    <div style={{display:"flex",alignItems:"center",gap:6,margin:"4px 0 2px",opacity:0.85}}>
                      <div style={{flex:1,height:1,background:T.accent,opacity:0.3}}/>
                      <span style={{fontSize:11,color:T.accent,fontWeight:600,whiteSpace:"nowrap"}}>⏱ En cours : {liveRest}</span>
                      <div style={{flex:1,height:1,background:T.accent,opacity:0.3}}/>
                    </div>
                  )}

                  <button onClick={()=>addSet(ex.id)} style={{...S.btnS,marginTop:6,fontSize:11}}>+ Série</button>
                  <input value={ex.notes||""} onChange={e=>updateExNotes(ex.id,e.target.value)} placeholder="Note technique (forme, sensation...)" style={{...S.inp,marginTop:8,fontSize:12,padding:"7px 12px"}}/>
                </div>
              );
            })}

            {/* Add exercise */}
            <div style={{...S.card,borderStyle:"dashed"}}>
              <p style={{margin:"0 0 10px",fontSize:13,fontWeight:600,color:T.text}}>Ajouter un exercice</p>
              {allExNames.length>0&&(
                <><p style={{fontSize:11,color:T.muted,margin:"0 0 6px"}}>Exercices récents</p>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
                  {allExNames.filter(n=>!exercises.find(e=>e.name===n)).map(n=><button key={n} onClick={()=>addExercise(n)} style={{...S.btnS,fontSize:12,padding:"4px 12px"}}>{n}</button>)}
                </div></>
              )}
              <p style={{fontSize:11,color:T.muted,margin:"0 0 6px"}}>Nouvel exercice</p>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <input value={newExName} onChange={e=>setNewExName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addExercise()} placeholder="Nom de l'exercice" style={{...S.inp,flex:1,minWidth:150}}/>
                <select value={newExMuscle} onChange={e=>setNewExMuscle(e.target.value)} style={{...S.inp,minWidth:130,width:"auto"}}>{MUSCLE_GROUPS.map(m=><option key={m}>{m}</option>)}</select>
                <button onClick={()=>addExercise()} style={S.btnP}>Ajouter</button>
              </div>
            </div>

            {/* Save card */}
            {exercises.length>0&&(
              <div style={S.card}>
                <p style={{margin:"0 0 12px",fontSize:13,fontWeight:600,color:T.text}}>Bilan de séance</p>
                <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:14}}>
                  <div>
                    <label style={{fontSize:11,color:T.muted,display:"block",marginBottom:6}}>⚖️ Poids de corps (kg)</label>
                    <input type="number" placeholder="75" value={sessionBodyweight} onChange={e=>setSessionBodyweight(e.target.value)} style={{...S.inp,width:90,padding:"7px 10px"}}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:T.muted,display:"block",marginBottom:6}}>Ressenti général</label>
                    <StarRating value={sessionRating} onChange={setSessionRating} T={T} emoji={true}/>
                  </div>
                </div>
                <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:14}}>
                  <div><label style={{fontSize:11,color:T.muted,display:"block",marginBottom:6}}>💤 Sommeil</label><SleepEnergyRating value={sessionSleep} onChange={setSessionSleep} T={T}/></div>
                  <div><label style={{fontSize:11,color:T.muted,display:"block",marginBottom:6}}>⚡ Énergie</label><SleepEnergyRating value={sessionEnergy} onChange={setSessionEnergy} T={T}/></div>
                </div>
                <label style={{fontSize:12,color:T.muted,display:"block",marginBottom:4}}>Notes</label>
                <textarea value={sessionNotes} onChange={e=>setSessionNotes(e.target.value)} placeholder="Sensations, fatigue..." rows={2} style={{...S.inp,resize:"vertical",marginBottom:12}}/>
                <button onClick={saveSession} style={{...S.btnP,width:"100%",padding:12,fontSize:14}}>💾 Enregistrer la séance</button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════ HISTORY ══════════════════════════════ */}
        {tab==="history" && (
          <div>
            {usedMuscles.length>0&&(
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
                <button onClick={()=>setHistoryFilter("")} style={{...S.btnS,...(historyFilter===""?{background:T.accentDim,color:T.accent,borderColor:T.accent}:{}),fontSize:12}}>Tout</button>
                {usedMuscles.map(m=><button key={m} onClick={()=>setHistoryFilter(m)} style={{...S.btnS,...(historyFilter===m?{background:T.accentDim,color:T.accent,borderColor:T.accent}:{}),fontSize:12}}>{m}</button>)}
              </div>
            )}
            {filteredSessions.length===0&&<p style={{color:T.muted,textAlign:"center",padding:"2rem 0",fontSize:14}}>Aucune séance.</p>}
            {filteredSessions.map(s=>{
              const vol=Math.round(s.exercises.reduce((a,e)=>a+wVolume(e.sets),0));
              const muscles=[...new Set(s.exercises.map(e=>e.muscle))];
              return (
                <div key={s.id} style={S.card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div>
                      <div style={{fontWeight:600,fontSize:14,color:T.text}}>{s.programName}</div>
                      <div style={{fontSize:12,color:T.muted,marginTop:3,display:"flex",gap:8,flexWrap:"wrap"}}>
                        <span>{formatDate(s.date)}{s.duration?` · ${s.duration} min`:""}</span>
                        {s.bodyweight&&<span>⚖️ {s.bodyweight}kg</span>}
                        {s.rating&&<span>{ratingEmojis[s.rating-1]} {["Difficile","Moyen","Bien","Super","Excellent"][s.rating-1]}</span>}
                        {s.sleep&&<span>💤 {s.sleep}/5</span>}
                        {s.energy&&<span>⚡ {s.energy}/5</span>}
                      </div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>repeatSession(s)} style={{...S.btnS,padding:"3px 8px",fontSize:11}}>🔁</button>
                        <button onClick={()=>setConfirmDelete(s)} style={{...S.btnD,padding:"3px 8px",fontSize:11}}>🗑️</button>
                      </div>
                      <div style={{textAlign:"right"}}><div style={{fontSize:15,fontWeight:600,color:T.accent}}>{vol.toLocaleString()} kg</div><div style={{fontSize:11,color:T.muted}}>volume</div></div>
                    </div>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>{muscles.map(m=><Tag key={m} T={T}>{m}</Tag>)}</div>
                  <div style={{borderTop:`1px solid ${T.border}`,paddingTop:8}}>
                    {s.exercises.map((e,i)=>{
                      const working=(e.sets||[]).filter(st=>!st.isWarmup&&(st.weight||st.reps));
                      const warmup=(e.sets||[]).filter(st=>st.isWarmup).length;
                      const maxW=Math.max(0,...working.map(st=>parseFloat(st.weight)||0));
                      return <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                        <span style={{color:T.text}}>{e.name}{prSet.has(s.id+":"+e.name)&&" 🏆"}</span>
                        <span style={{color:T.muted}}>{working.length}×{warmup?` (+${warmup}W)`:""} @ {maxW}kg</span>
                      </div>;
                    })}
                  </div>
                  {(s.notes||s.exercises.some(e=>e.notes))&&(
                    <div style={{marginTop:8,borderTop:`1px solid ${T.border}`,paddingTop:8}}>
                      {s.notes&&<p style={{margin:"0 0 4px",fontSize:12,color:T.muted,fontStyle:"italic"}}>📝 {s.notes}</p>}
                      {s.exercises.filter(e=>e.notes).map((e,i)=><p key={i} style={{margin:"0 0 2px",fontSize:11,color:T.muted}}>💬 <strong>{e.name}</strong> : {e.notes}</p>)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ══════════════════════════ PROGRESS ══════════════════════════════ */}
        {tab==="progress" && (
          <div>
            {/* Bodyweight chart */}
            {bwData.length>=2&&(
              <div style={S.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>⚖️ Poids de corps</p>
                  <div style={{display:"flex",gap:12,fontSize:12}}>
                    <span style={{color:T.muted}}>Min <strong style={{color:T.text}}>{Math.min(...bwData.map(d=>d.weight))}kg</strong></span>
                    <span style={{color:T.muted}}>Max <strong style={{color:T.text}}>{Math.max(...bwData.map(d=>d.weight))}kg</strong></span>
                    <span style={{color:T.accent,fontWeight:700}}>{bwData[bwData.length-1].weight}kg</span>
                  </div>
                </div>
                <div style={{width:"100%",height:160}}>
                  <ResponsiveContainer><LineChart data={bwData} margin={{top:4,right:10,left:-20,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                    <XAxis dataKey="label" tick={{fontSize:10,fill:T.muted}} stroke={T.border}/>
                    <YAxis tick={{fontSize:10,fill:T.muted}} stroke={T.border} domain={["auto","auto"]}/>
                    <Tooltip contentStyle={{background:T.bgModal,border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,color:T.text}}/>
                    <Line type="monotone" dataKey="weight" name="Poids (kg)" stroke={T.accent} strokeWidth={2.5} dot={{r:4,fill:T.accent}}/>
                  </LineChart></ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Exercise selector */}
            <div style={{marginBottom:16}}>
              <label style={{fontSize:12,color:T.muted,display:"block",marginBottom:6}}>Exercice à analyser</label>
              <select value={progressEx} onChange={e=>setProgressEx(e.target.value)} style={S.inp}>
                <option value="">-- Choisir un exercice --</option>
                {allExNames.map(n=><option key={n}>{n}</option>)}
              </select>
            </div>

            {progressEx&&progressData.length>0&&(()=>{
              const best=progressData.reduce((b,d)=>d.orm>b.orm?d:b,progressData[0]);
              const last=progressData[progressData.length-1];
              const prev=progressData.length>=2?progressData[progressData.length-2]:null;
              const diff=prev?(last.maxWeight-prev.maxWeight):null;
              return (
                <>
                  {/* Hero stats */}
                  <div style={{...S.card,padding:"14px 16px",marginBottom:12}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:0}}>
                      {[
                        {label:"🏆 Record",value:`${Math.max(...progressData.map(d=>d.maxWeight))} kg`,sub:formatDate(best.date)},
                        {label:"💡 1RM estimé",value:`${Math.max(...progressData.map(d=>d.orm))} kg`,sub:"Brzycki"},
                        {label:"📈 vs dernière",value:diff===null?"—":diff>=0?`+${diff} kg`:`${diff} kg`,sub:prev?formatDate(prev.date):"",accent:diff===null?T.muted:diff>0?T.accent:diff<0?T.danger:T.muted},
                      ].map(({label,value,sub,accent},i)=>(
                        <div key={i} style={{textAlign:"center",padding:"4px 0",borderRight:i<2?`1px solid ${T.border}`:"none"}}>
                          <div style={{fontSize:11,color:T.muted,marginBottom:3}}>{label}</div>
                          <div style={{fontSize:18,fontWeight:800,color:accent||T.accent,letterSpacing:"-0.5px"}}>{value}</div>
                          {sub&&<div style={{fontSize:10,color:T.muted,marginTop:1}}>{sub}</div>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Main chart — poids + 1RM + dots colorés par ressenti */}
                  <div style={S.card}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <p style={{margin:0,fontSize:13,fontWeight:600,color:T.text}}>Évolution du poids</p>
                      <div style={{display:"flex",gap:10,fontSize:10,color:T.muted}}>
                        <span>● Poids max</span>
                        <span style={{opacity:0.6}}>- - 1RM</span>
                        <span>● couleur = ressenti</span>
                      </div>
                    </div>
                    <div style={{width:"100%",height:230}}>
                      <ResponsiveContainer><LineChart data={progressData} margin={{top:5,right:10,left:-10,bottom:0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                        <XAxis dataKey="label" tick={{fontSize:10,fill:T.muted}} stroke={T.border}/>
                        <YAxis tick={{fontSize:11,fill:T.muted}} stroke={T.border}/>
                        <Tooltip contentStyle={{background:T.bgModal,border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,color:T.text}} labelStyle={{color:T.text}}
                          formatter={(val,name,{payload})=>{
                            const extra=name==="Poids max"&&payload.avgRPE?` (RPE ${payload.avgRPE})`:"";
                            const emoji=name==="Poids max"&&payload.rating?` ${ratingEmojis[payload.rating-1]}`:"";
                            return [`${val} kg${extra}${emoji}`,name];
                          }}
                        />
                        <Line type="monotone" dataKey="maxWeight" name="Poids max" stroke={T.accent} strokeWidth={2.5}
                          dot={(props)=>{ const {cx,cy,payload}=props; const r=payload.rating; const fill=r?ratingColors[r-1]:T.accent; return <circle key={`d${props.index}`} cx={cx} cy={cy} r={5} fill={fill} stroke={T.bgCard} strokeWidth={2}/>; }}/>
                        <Line type="monotone" dataKey="orm" name="1RM estimé" stroke={T.chart2} strokeWidth={1.5} strokeDasharray="5 3" dot={{r:2,fill:T.chart2}}/>
                      </LineChart></ResponsiveContainer>
                    </div>
                    <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
                      {[1,2,3,4,5].map(n=><span key={n} style={{fontSize:10,color:T.muted,display:"flex",alignItems:"center",gap:3}}><span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:ratingColors[n-1]}}></span>{ratingEmojis[n-1]}</span>)}
                    </div>
                  </div>

                  {/* Volume chart */}
                  <div style={S.card}>
                    <p style={{margin:"0 0 12px",fontSize:13,fontWeight:600,color:T.text}}>Volume par séance</p>
                    <div style={{width:"100%",height:160}}>
                      <ResponsiveContainer><BarChart data={progressData} margin={{top:4,right:10,left:-20,bottom:0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
                        <XAxis dataKey="label" tick={{fontSize:10,fill:T.muted}} stroke={T.border}/>
                        <YAxis tick={{fontSize:10,fill:T.muted}} stroke={T.border}/>
                        <Tooltip contentStyle={{background:T.bgModal,border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,color:T.text}} formatter={v=>[`${Math.round(v)} kg`,"Volume"]}/>
                        <Bar dataKey="volume" name="Volume" radius={[4,4,0,0]}>
                          {progressData.map((d,i)=><Cell key={i} fill={d.rating?ratingColors[d.rating-1]:T.accent} opacity={0.8}/>)}
                        </Bar>
                      </BarChart></ResponsiveContainer>
                    </div>
                  </div>

                  {/* History table */}
                  <div style={S.card}>
                    <p style={{margin:"0 0 12px",fontSize:13,fontWeight:600,color:T.text}}>Historique détaillé</p>
                    <div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",fontSize:12,borderCollapse:"collapse",minWidth:360}}>
                        <thead><tr style={{borderBottom:`1px solid ${T.border}`}}>
                          {["Date","Poids","Volume","1RM","RPE","Forme"].map(h=><th key={h} style={{textAlign:"left",padding:"4px 8px",color:T.muted,fontWeight:400,whiteSpace:"nowrap"}}>{h}</th>)}
                        </tr></thead>
                        <tbody>{[...progressData].reverse().map((d,i)=>(
                          <tr key={i} style={{borderBottom:`1px solid ${T.border}`}}>
                            <td style={{padding:"6px 8px",color:T.text}}>{formatDate(d.date)}</td>
                            <td style={{padding:"6px 8px",fontWeight:700,color:T.accent}}>{d.maxWeight} kg</td>
                            <td style={{padding:"6px 8px",color:T.muted}}>{Math.round(d.volume)} kg</td>
                            <td style={{padding:"6px 8px",color:T.muted}}>{d.orm} kg</td>
                            <td style={{padding:"6px 8px",color:T.muted}}>{d.avgRPE||"—"}</td>
                            <td style={{padding:"6px 8px"}}>{d.rating?<span style={{color:ratingColors[d.rating-1]}}>{ratingEmojis[d.rating-1]}</span>:"—"}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                </>
              );
            })()}
            {!progressEx&&bwData.length<2&&<p style={{color:T.muted,textAlign:"center",padding:"2rem 0",fontSize:14}}>Sélectionnez un exercice ou enregistrez votre poids lors de vos séances.</p>}
            {progressEx&&progressData.length===0&&<p style={{color:T.muted,textAlign:"center",padding:"2rem 0",fontSize:14}}>Aucune donnée pour cet exercice.</p>}
          </div>
        )}

        {/* ══════════════════════════ PROGRAMS ══════════════════════════════ */}
        {tab==="programs" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <p style={{margin:0,fontSize:13,color:T.muted}}>{programs.length} programme{programs.length>1?"s":""}</p>
              <button onClick={()=>setEditingProgram("new")} style={S.btnP}>+ Nouveau</button>
            </div>
            {programs.map(p=>(
              <div key={p.id} style={S.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:14,color:T.text}}>{p.name}</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>{p.muscles.map(m=><Tag key={m} T={T}>{m}</Tag>)}</div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>setEditingProgram(p)} style={{...S.btnS,padding:"5px 10px"}}>✏️</button>
                    <button onClick={()=>setConfirmDelete(p)} style={{...S.btnD,padding:"5px 10px"}}>🗑️</button>
                  </div>
                </div>
                <div style={{borderTop:`1px solid ${T.border}`,paddingTop:8}}>
                  <p style={{margin:"0 0 6px",fontSize:11,color:T.muted}}>Exercices ({p.exercises.length})</p>
                  {p.exercises.map((ex,i)=>{
                    const name=typeof ex==="string"?ex:ex.name;
                    const muscle=typeof ex==="object"&&ex.muscle?ex.muscle:"";
                    const sets=typeof ex==="object"&&ex.targetSets?ex.targetSets:"";
                    const reps=typeof ex==="object"&&ex.targetReps?ex.targetReps:"";
                    return (
                      <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:12,marginBottom:4,padding:"4px 0",borderBottom:i<p.exercises.length-1?`1px solid ${T.border}`:"none"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{color:T.text}}>{name}</span>
                          {muscle&&<span style={{fontSize:10,color:T.muted,background:T.bgInput,padding:"1px 6px",borderRadius:99,border:`1px solid ${T.border}`}}>{muscle}</span>}
                        </div>
                        {(sets||reps)&&<span style={{color:T.muted,fontSize:11}}>{sets?`${sets}×`:""}  {reps}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══════════════════════════ STATS ════════════════════════════════ */}
        {tab==="stats" && (
          <div>
            {/* Key metrics */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
              <StatCard label="Séances" value={sessions.length} T={T}/>
              <StatCard label="Cette semaine" value={thisWeek} T={T}/>
              <StatCard label="Ce mois" value={thisMonth} T={T}/>
              <StatCard label="Volume total" value={totalVolume>=1000?(totalVolume/1000).toFixed(1)+" t":totalVolume+" kg"} T={T}/>
              <StatCard label="Durée moy." value={avgDuration?avgDuration+" min":"—"} T={T}/>
              <StatCard label={`🔥 Streak`} value={trainingStreak} sub={trainingStreak>1?"semaines consécutives":"semaine"} T={T}/>
            </div>

            {/* Weekly volume trend */}
            {weeklyVolTrend.some(w=>w.vol>0)&&(
              <div style={S.card}>
                <p style={{margin:"0 0 12px",fontSize:13,fontWeight:600,color:T.text}}>Volume par semaine (6 dernières)</p>
                <div style={{width:"100%",height:160}}>
                  <ResponsiveContainer><BarChart data={weeklyVolTrend} margin={{top:4,right:10,left:-20,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
                    <XAxis dataKey="label" tick={{fontSize:10,fill:T.muted}} stroke={T.border}/>
                    <YAxis tick={{fontSize:10,fill:T.muted}} stroke={T.border}/>
                    <Tooltip contentStyle={{background:T.bgModal,border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,color:T.text}}
                      formatter={(v,_,{payload})=>[`${(v/1000).toFixed(1)} t · ${payload.sessions} séance${payload.sessions>1?"s":""}`,""]}/>
                    <Bar dataKey="vol" radius={[5,5,0,0]} fill={T.accent} opacity={0.85}/>
                  </BarChart></ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Sessions par jour de la semaine */}
            {sessions.length>=5&&(
              <div style={S.card}>
                <p style={{margin:"0 0 4px",fontSize:13,fontWeight:600,color:T.text}}>Jours d'entraînement préférés</p>
                <p style={{margin:"0 0 12px",fontSize:11,color:T.muted}}>Distribution de tes séances sur la semaine</p>
                <div style={{display:"flex",gap:6,alignItems:"flex-end",height:80}}>
                  {sessionsByDay.map((d,i)=>{
                    const max=Math.max(...sessionsByDay.map(x=>x.count),1);
                    const pct=d.count/max;
                    const isTop=d.count===Math.max(...sessionsByDay.map(x=>x.count))&&d.count>0;
                    return (
                      <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                        <span style={{fontSize:10,color:T.muted,fontWeight:isTop?700:400}}>{d.count||""}</span>
                        <div style={{width:"100%",height:Math.max(4,pct*56),background:isTop?T.accent:T.border,borderRadius:"4px 4px 0 0",transition:"height 0.3s"}}/>
                        <span style={{fontSize:10,color:isTop?T.accent:T.muted,fontWeight:isTop?700:400}}>{d.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Wellness stats */}
            {wellnessStats&&(
              <div style={S.card}>
                <p style={{margin:"0 0 4px",fontSize:13,fontWeight:600,color:T.text}}>Forme & récupération moyennes</p>
                <p style={{margin:"0 0 14px",fontSize:11,color:T.muted}}>Basé sur tes {wellnessStats.count} dernières séances renseignées</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  {[{label:"😊 Ressenti",val:wellnessStats.rating,max:5},{label:"💤 Sommeil",val:wellnessStats.sleep,max:5},{label:"⚡ Énergie",val:wellnessStats.energy,max:5}].map(({label,val,max})=>(
                    <div key={label} style={{textAlign:"center",padding:10,background:T.bgInput,borderRadius:10,border:`1px solid ${T.border}`}}>
                      <div style={{fontSize:11,color:T.muted,marginBottom:6}}>{label}</div>
                      <div style={{fontSize:20,fontWeight:800,color:val==="—"?T.muted:parseFloat(val)>=4?T.accent:parseFloat(val)>=3?"#f59e0b":T.danger}}>{val}{val!=="—"?"/5":""}</div>
                      {val!=="—"&&<div style={{height:4,background:T.border,borderRadius:99,marginTop:6}}>
                        <div style={{width:`${(parseFloat(val)/max)*100}%`,height:"100%",background:parseFloat(val)>=4?T.accent:parseFloat(val)>=3?"#f59e0b":T.danger,borderRadius:99}}/>
                      </div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Volume this week by muscle */}
            {Object.keys(weeklyVolByMuscle).length>0&&(
              <div style={S.card}>
                <p style={{margin:"0 0 12px",fontSize:13,fontWeight:600,color:T.text}}>Volume cette semaine par muscle</p>
                {Object.entries(weeklyVolByMuscle).sort((a,b)=>b[1]-a[1]).map(([muscle,vol])=>{
                  const max=Math.max(...Object.values(weeklyVolByMuscle));
                  return <div key={muscle} style={{marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                      <span style={{color:T.text}}>{muscle}</span>
                      <span style={{color:T.muted}}>{vol>=1000?(vol/1000).toFixed(1)+" t":Math.round(vol)+" kg"}</span>
                    </div>
                    <div style={{background:T.bgInput,borderRadius:99,height:6}}>
                      <div style={{width:`${(vol/max)*100}%`,background:T.accent,borderRadius:99,height:6}}/>
                    </div>
                  </div>;
                })}
              </div>
            )}

            {/* Muscle recovery */}
            {sessions.length>0&&(
              <div style={S.card}>
                <p style={{margin:"0 0 4px",fontSize:13,fontWeight:600,color:T.text}}>Récupération musculaire</p>
                <p style={{margin:"0 0 12px",fontSize:11,color:T.muted}}>Estimation basée sur tes dernières séances (–24h fatigué · 24-48h récupération · +48h prêt)</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {MUSCLE_GROUPS.map(muscle=>{
                    const r=muscleRecovery[muscle];
                    const col=r.hours===null?"#888":recoveryColor[r.status];
                    const label=r.hours===null?"—":recoveryLabel[r.status];
                    const pct=r.hours===null?0:r.status==="fresh"?100:r.status==="recovering"?Math.round((r.hours/48)*100):Math.round((r.hours/24)*40);
                    return <div key={muscle} style={{padding:"8px 10px",background:T.bgInput,borderRadius:10,border:`1px solid ${T.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                        <span style={{color:T.text,fontWeight:500}}>{muscle}</span>
                        <span style={{color:col,fontWeight:600}}>{label}</span>
                      </div>
                      <div style={{background:T.border,borderRadius:99,height:4}}>
                        <div style={{width:`${pct}%`,height:"100%",background:col,borderRadius:99}}/>
                      </div>
                      {r.hours!==null&&<div style={{fontSize:10,color:T.muted,marginTop:2}}>{r.hours<1?"<1h":r.hours<24?`${r.hours}h`:r.hours<48?`${r.hours}h`:`${Math.round(r.hours/24)}j`}</div>}
                    </div>;
                  })}
                </div>
              </div>
            )}

            {/* All-time muscle breakdown */}
            {Object.keys(muscleCount).length>0&&(
              <div style={S.card}>
                <p style={{margin:"0 0 12px",fontSize:13,fontWeight:600,color:T.text}}>Groupes musculaires (total)</p>
                {Object.entries(muscleCount).sort((a,b)=>b[1]-a[1]).map(([muscle,count])=>{
                  const max=Math.max(...Object.values(muscleCount));
                  return <div key={muscle} style={{marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}><span style={{color:T.text}}>{muscle}</span><span style={{color:T.muted}}>{count} séance{count>1?"s":""}</span></div>
                    <div style={{background:T.bgInput,borderRadius:99,height:6}}><div style={{width:`${(count/max)*100}%`,background:T.accent,borderRadius:99,height:6}}/></div>
                  </div>;
                })}
              </div>
            )}

            {sessions.length===0&&<p style={{color:T.muted,textAlign:"center",padding:"2rem 0",fontSize:14}}>Commencez par enregistrer une séance !</p>}
          </div>
        )}

        {/* ══════════════════════════ SETTINGS ══════════════════════════════ */}
        {tab==="settings" && (
          <div>
            <div style={S.card}>
              <p style={{margin:"0 0 10px",fontSize:14,fontWeight:600,color:T.text}}>👤 Mon compte</p>
              <p style={{fontSize:13,color:T.muted,marginBottom:4}}>Connecté en tant que</p>
              <p style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:14}}>{user.email}</p>
              <p style={{fontSize:12,color:T.muted,marginBottom:14}}>Tes données sont synchronisées automatiquement entre tes appareils.</p>
              <button onClick={()=>supabase.auth.signOut()} style={{...S.btnS,color:T.danger,borderColor:T.danger}}>Se déconnecter</button>
            </div>
            <div style={S.card}>
              <p style={{margin:"0 0 14px",fontSize:14,fontWeight:600,color:T.text}}>Apparence</p>
              <div style={{display:"flex",background:T.bgInput,borderRadius:12,padding:4,gap:4}}>
                {Object.entries(THEMES).map(([k,th])=>(
                  <button key={k} onClick={()=>setThemeKey(k)} style={{flex:1,padding:"9px 0",borderRadius:9,border:"none",cursor:"pointer",fontSize:13,fontWeight:k===themeKey?600:400,color:k===themeKey?T.accent:T.muted,background:k===themeKey?T.bgCard:"transparent",boxShadow:k===themeKey?T.shadow:"none",transition:"all 0.15s"}}>
                    {th.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={S.card}>
              <p style={{margin:"0 0 4px",fontSize:14,fontWeight:600,color:T.text}}>Sauvegarde & données</p>
              <p style={{margin:"0 0 12px",fontSize:12,color:T.muted}}>Tes données sont enregistrées automatiquement. Exporte pour transférer ou archiver.</p>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:8}}>
                <button onClick={exportJSON} style={S.btnP}>⬇️ Export JSON</button>
                <button onClick={exportCSV} style={{...S.btnS,padding:"8px 16px"}}>⬇️ Export CSV</button>
              </div>
              <label style={{...S.btnS,padding:"8px 16px",display:"inline-block",cursor:"pointer"}}>⬆️ Importer JSON<input type="file" accept=".json" onChange={importJSON} style={{display:"none"}}/></label>
              {importSuccess&&<p style={{margin:"10px 0 0",fontSize:12,color:T.accent}}>✅ Import réussi !</p>}
              {importError&&<p style={{margin:"10px 0 0",fontSize:12,color:T.danger}}>❌ {importError}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
