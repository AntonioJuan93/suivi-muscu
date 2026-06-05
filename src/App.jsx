import { useState, useEffect, useMemo, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
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
      typeof ex === "string" ? { name:ex, targetSets:"", targetReps:"" } : ex
    )
  );
  const [newEx, setNewEx] = useState("");

  function toggleMuscle(m) { setMuscles(ms=>ms.includes(m)?ms.filter(x=>x!==m):[...ms,m]); }
  function addEx() { if(!newEx.trim())return; setExercises(ex=>[...ex,{name:newEx.trim(),targetSets:"",targetReps:""}]); setNewEx(""); }
  function removeEx(i) { setExercises(ex=>ex.filter((_,j)=>j!==i)); }
  function moveEx(i,dir) { setExercises(ex=>{ const a=[...ex],j=i+dir; if(j<0||j>=a.length)return a; [a[i],a[j]]=[a[j],a[i]]; return a; }); }
  function updateExField(i,field,val) { setExercises(ex=>ex.map((e,j)=>j===i?{...e,[field]:val}:e)); }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:12 }}>
      <div style={{ background:T.bgModal, border:`1px solid ${T.border}`, borderRadius:16, padding:24, width:"min(540px,95vw)", maxHeight:"88vh", overflowY:"auto", boxSizing:"border-box" }}>
        <h3 style={{ margin:"0 0 16px", fontSize:16, fontWeight:600, color:T.text }}>{program?"Modifier le programme":"Nouveau programme"}</h3>
        <label style={{ fontSize:12, color:T.muted, display:"block", marginBottom:4 }}>Nom</label>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: Full body" style={{ ...S.inp, marginBottom:16 }} />
        <label style={{ fontSize:12, color:T.muted, display:"block", marginBottom:6 }}>Groupes musculaires</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:16 }}>
          {MUSCLE_GROUPS.map(m=><button key={m} onClick={()=>toggleMuscle(m)} style={{ ...S.btnS, ...(muscles.includes(m)?{background:T.accentDim,color:T.accent,borderColor:T.accent}:{}) }}>{m}</button>)}
        </div>
        <label style={{ fontSize:12, color:T.muted, display:"block", marginBottom:6 }}>Exercices <span style={{fontSize:11,fontWeight:400}}>(objectifs optionnels)</span></label>
        {exercises.length===0 && <p style={{ fontSize:12, color:T.muted, marginBottom:8 }}>Aucun exercice.</p>}
        {exercises.map((ex,i)=>(
          <div key={i} style={{ marginBottom:8, background:T.bgInput, borderRadius:10, padding:"8px 10px", border:`1px solid ${T.border}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
              <div style={{ display:"flex", flexDirection:"column", gap:1 }}>
                <button onClick={()=>moveEx(i,-1)} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, fontSize:10, padding:"1px 3px", lineHeight:1 }}>▲</button>
                <button onClick={()=>moveEx(i,1)} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, fontSize:10, padding:"1px 3px", lineHeight:1 }}>▼</button>
              </div>
              <span style={{ flex:1, fontSize:13, color:T.text, fontWeight:500 }}>{ex.name}</span>
              <button onClick={()=>removeEx(i)} style={{ background:"none", border:"none", cursor:"pointer", color:T.danger, fontSize:16, lineHeight:1 }}>✕</button>
            </div>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <input type="number" value={ex.targetSets||""} onChange={e=>updateExField(i,"targetSets",e.target.value)} placeholder="Séries" min="1" max="20" style={{ ...S.inp, width:70, fontSize:12, padding:"6px 8px" }} />
              <span style={{ fontSize:11, color:T.muted }}>×</span>
              <input value={ex.targetReps||""} onChange={e=>updateExField(i,"targetReps",e.target.value)} placeholder="Reps (ex: 5, 8-12)" style={{ ...S.inp, flex:1, fontSize:12, padding:"6px 8px" }} />
            </div>
          </div>
        ))}
        <div style={{ display:"flex", gap:8, marginBottom:20, marginTop:8 }}>
          <input value={newEx} onChange={e=>setNewEx(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addEx()} placeholder="Ajouter un exercice..." style={S.inp} />
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

export default function App() {
  // ── Navigation & UI state ──────────────────────────────────────────────────
  const [tab, setTab] = useState("log");
  const [editingProgram, setEditingProgram] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("");
  const [progressEx, setProgressEx] = useState("");
  const [showTimer, setShowTimer] = useState(false);
  const [timerTrigger, setTimerTrigger] = useState(0);

  // ── App data ───────────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState([]);
  const [programs, setPrograms] = useState(INITIAL_PROGRAMS);
  const [themeKey, setThemeKey] = useState("clair");

  // ── Current session (draft) ────────────────────────────────────────────────
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

  // ── Auth & sync ────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const T = THEMES[themeKey] || THEMES.clair;
  const S = useMemo(()=>makeStyles(T),[themeKey]);
  const saveTimer = useRef(null);

  // ── Working volume (excludes warmup sets) ─────────────────────────────────
  function wVolume(sets) { return calcVolume((sets||[]).filter(s=>!s.isWarmup)); }

  // ── Last session + progression helpers ────────────────────────────────────
  function getLastForExercise(name) {
    const sorted=[...sessions].sort((a,b)=>b.date.localeCompare(a.date));
    const lastS=sorted.find(s=>s.exercises.some(e=>e.name===name));
    if(!lastS) return null;
    const ex=lastS.exercises.find(e=>e.name===name);
    const working=(ex.sets||[]).filter(s=>!s.isWarmup&&(s.weight||s.reps));
    const daysAgo=Math.round((Date.now()-new Date(lastS.date))/86400000);
    const maxW=Math.max(0,...working.map(s=>parseFloat(s.weight)||0));
    const avgReps=working.length?Math.round(working.reduce((a,s)=>a+(parseInt(s.reps)||0),0)/working.length):0;
    return {daysAgo,date:lastS.date,sets:working,maxWeight:maxW,avgReps};
  }

  function getSuggestion(name) {
    const last=getLastForExercise(name);
    if(!last||!last.maxWeight) return null;
    const withRPE=last.sets.filter(s=>s.rpe);
    if(!withRPE.length) return last.maxWeight+2.5;
    const avg=withRPE.reduce((a,s)=>a+(parseFloat(s.rpe)||0),0)/withRPE.length;
    if(avg<7) return last.maxWeight+5;
    if(avg<=8.5) return last.maxWeight+2.5;
    return last.maxWeight;
  }

  // ── Persistence ────────────────────────────────────────────────────────────
  function fullData() {
    return {
      sessions, programs, theme:themeKey,
      draft:{ exercises, sessionDate, sessionDuration, sessionNotes,
              sessionBodyweight, sessionRating, sessionSleep, sessionEnergy,
              mode, selectedProgram }
    };
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
      setSessionDuration(dr.sessionDuration||"");
      setSessionNotes(dr.sessionNotes||"");
      setSessionBodyweight(dr.sessionBodyweight||"");
      setSessionRating(dr.sessionRating||null);
      setSessionSleep(dr.sessionSleep||null);
      setSessionEnergy(dr.sessionEnergy||null);
      if(dr.mode) setMode(dr.mode);
      if(dr.selectedProgram!==undefined) setSelectedProgram(dr.selectedProgram);
    }
  }

  function resetSessionDraft() {
    setExercises([]); setSessionDuration(""); setSessionNotes("");
    setSessionBodyweight(""); setSessionRating(null); setSessionSleep(null);
    setSessionEnergy(null); setSelectedProgram(null);
    setSessionDate(new Date().toISOString().split("T")[0]);
  }

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(()=>{ const d=loadData(); if(d) applyData(d,true); setReady(true); setLoading(false); },[]);

  useEffect(()=>{
    if(!ready) return;
    if(saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{
      const d=fullData(); saveData(d); if(user&&cloudLoaded) saveCloud(d);
    },400);
    return ()=>{ if(saveTimer.current) clearTimeout(saveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sessions,programs,themeKey,exercises,sessionDate,sessionDuration,sessionNotes,
     sessionBodyweight,sessionRating,sessionSleep,sessionEnergy,mode,selectedProgram,ready,user,cloudLoaded]);

  useEffect(()=>{
    const onStorage=(e)=>{ if(e.key==="suivi_muscu_data"){ const d=loadData(); if(d) applyData(d,false); } };
    window.addEventListener("storage",onStorage);
    return ()=>window.removeEventListener("storage",onStorage);
  },[]);

  useEffect(()=>{
    const {data:{subscription}}=supabase.auth.onAuthStateChange(async(event,session)=>{
      const u=session?.user??null;
      setUser(u);
      if(event==="INITIAL_SESSION"){
        setAuthReady(true);
        if(u){ loadCloud().then(d=>{ if(d) applyData(d,false); setCloudLoaded(true); }); }
      }
      if(event==="SIGNED_IN"){
        loadCloud().then(d=>{ if(d) applyData(d,false); setCloudLoaded(true); });
      }
      if(event==="SIGNED_OUT"){
        clearCloudCache(); setCloudLoaded(false);
        setSessions([]); setPrograms(INITIAL_PROGRAMS); setThemeKey("clair");
        resetSessionDraft(); setMode("free");
        saveData(null);
      }
    });
    return ()=>subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // ── Program actions ────────────────────────────────────────────────────────
  function saveProgram(data){
    if(editingProgram==="new") setPrograms(ps=>[...ps,{...data,id:Date.now()}]);
    else setPrograms(ps=>ps.map(p=>p.id===editingProgram.id?{...p,...data}:p));
    setEditingProgram(null);
  }
  function deleteProgram(id){ setPrograms(ps=>ps.filter(p=>p.id!==id)); setConfirmDelete(null); }
  function deleteSession(id){ setSessions(ps=>ps.filter(s=>s.id!==id)); setConfirmDelete(null); }

  function loadProgram(p) {
    setSelectedProgram(p);
    setExercises(p.exercises.map((ex,i)=>{
      const name=typeof ex==="string"?ex:ex.name;
      const muscle=p.muscles[Math.min(i,p.muscles.length-1)]||MUSCLE_GROUPS[0];
      const targetSets=typeof ex==="object"&&ex.targetSets?parseInt(ex.targetSets)||1:1;
      const targetReps=typeof ex==="object"&&ex.targetReps?ex.targetReps:"";
      const sugg=getSuggestion(name);
      const defaultWeight=sugg?String(sugg):"";
      const defaultReps=targetReps?targetReps.split("-")[0]:"";
      const sets=Array.from({length:targetSets},()=>({
        weight:defaultWeight, reps:defaultReps, rpe:"", isWarmup:false
      }));
      return {id:Date.now()+i, name, muscle, notes:"", sets, target:{sets:targetSets,reps:targetReps}};
    }));
  }

  function repeatSession(s) {
    setMode("free"); setSelectedProgram({name:s.programName});
    setSessionDate(new Date().toISOString().split("T")[0]);
    setSessionDuration(s.duration?String(s.duration):""); setSessionNotes("");
    setSessionBodyweight(""); setSessionRating(null); setSessionSleep(null); setSessionEnergy(null);
    setExercises(s.exercises.map((e,i)=>({
      id:Date.now()+i, name:e.name, muscle:e.muscle, notes:"",
      sets:(e.sets||[]).map(st=>({weight:st.weight,reps:st.reps,rpe:"",isWarmup:st.isWarmup||false}))
    })));
    setTab("log");
  }

  // ── Set / Exercise actions ─────────────────────────────────────────────────
  function addSet(id) {
    setExercises(ex=>ex.map(e=>e.id===id?{...e,sets:[...e.sets,{weight:"",reps:"",rpe:"",isWarmup:false}]}:e));
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
    setExercises(ex=>[...ex,{id:Date.now(),name,muscle,notes:"",sets:[{weight:"",reps:"",rpe:"",isWarmup:false}]}]);
    setNewExName("");
  }

  function saveSession() {
    if(!exercises.length)return;
    const clean=exercises.map(e=>({...e,sets:e.sets.filter(s=>s.weight||s.reps)})).filter(e=>e.sets.length);
    if(!clean.length)return;
    const session={
      id:Date.now(), date:sessionDate,
      duration:parseInt(sessionDuration)||null,
      notes:sessionNotes.trim()||null,
      programName:selectedProgram?.name||"Séance libre",
      exercises:clean,
      bodyweight:parseFloat(sessionBodyweight)||null,
      rating:sessionRating, sleep:sessionSleep, energy:sessionEnergy
    };
    setSessions(s=>[session,...s]);
    resetSessionDraft(); setMode("free"); setTab("history");
  }

  // ── Export / Import ────────────────────────────────────────────────────────
  function exportJSON(){const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([JSON.stringify({sessions,programs,theme:themeKey},null,2)],{type:"application/json"})); a.download="suivi_muscu.json"; a.click();}
  function exportCSV(){
    const rows=[["Date","Programme","Exercice","Muscle","Série","Échauffement","Poids (kg)","Répétitions","RPE","Volume","1RM estimé"]];
    sessions.forEach(s=>s.exercises.forEach(e=>e.sets.forEach((st,si)=>{rows.push([s.date,s.programName,e.name,e.muscle,si+1,st.isWarmup?"oui":"non",st.weight||0,st.reps||0,st.rpe||"—",(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),estimate1RM(st.weight,st.reps)]);})));
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([rows.map(r=>r.map(v=>`"${v}"`).join(",")).join("\n")],{type:"text/csv"})); a.download="suivi_muscu.csv"; a.click();
  }
  function importJSON(e){
    setImportError(null); setImportSuccess(false);
    const file=e.target.files?.[0]; if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{try{const d=JSON.parse(ev.target.result); if(!d.sessions||!d.programs)throw new Error(); applyData(d,false); setImportSuccess(true); setTimeout(()=>setImportSuccess(false),3000);}catch{setImportError("Fichier invalide.");}};
    reader.readAsText(file); e.target.value="";
  }

  // ── Computed values ────────────────────────────────────────────────────────
  const allExNames=[...new Set(sessions.flatMap(s=>s.exercises.map(e=>e.name)))].sort();
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

  const progressData=sessions.flatMap(s=>s.exercises.filter(e=>e.name===progressEx).map(e=>{
    const working=(e.sets||[]).filter(s=>!s.isWarmup);
    return {date:s.date,label:formatDate(s.date),maxWeight:Math.max(0,...working.map(st=>parseFloat(st.weight)||0)),volume:wVolume(e.sets),orm:Math.max(0,...working.map(st=>estimate1RM(st.weight,st.reps)))};
  })).sort((a,b)=>a.date.localeCompare(b.date));

  const bwData=useMemo(()=>
    [...sessions].filter(s=>s.bodyweight).map(s=>({date:s.date,label:formatDate(s.date),weight:parseFloat(s.bodyweight)||0}))
    .sort((a,b)=>a.date.localeCompare(b.date))
  ,[sessions]);

  const totalVolume=Math.round(sessions.reduce((acc,s)=>acc+s.exercises.reduce((a,e)=>a+wVolume(e.sets),0),0));
  const muscleCount=sessions.reduce((acc,s)=>{s.exercises.forEach(e=>{acc[e.muscle]=(acc[e.muscle]||0)+1;}); return acc;},{});
  const topMuscle=Object.entries(muscleCount).sort((a,b)=>b[1]-a[1])[0];
  const now=new Date(), weekStart=startOfWeek(now);
  const thisWeek=sessions.filter(s=>new Date(s.date)>=weekStart).length;
  const thisMonth=sessions.filter(s=>{const d=new Date(s.date); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}).length;
  const durations=sessions.filter(s=>s.duration).map(s=>s.duration);
  const avgDuration=durations.length?Math.round(durations.reduce((a,b)=>a+b,0)/durations.length):null;

  const weeklyVolByMuscle=useMemo(()=>{
    const vol={};
    sessions.filter(s=>new Date(s.date)>=weekStart).forEach(s=>
      s.exercises.forEach(e=>{ vol[e.muscle]=(vol[e.muscle]||0)+wVolume(e.sets); })
    );
    return vol;
  },[sessions]);

  const muscleRecovery=useMemo(()=>{
    const result={};
    MUSCLE_GROUPS.forEach(muscle=>{
      const lastS=[...sessions].sort((a,b)=>b.date.localeCompare(a.date))
        .find(s=>s.exercises.some(e=>e.muscle===muscle));
      if(!lastS){result[muscle]={status:"fresh",hours:null};return;}
      const hours=Math.round((Date.now()-new Date(lastS.date))/3600000);
      result[muscle]={status:hours<24?"tired":hours<48?"recovering":"fresh",hours,date:lastS.date};
    });
    return result;
  },[sessions]);

  const filteredSessions=historyFilter?sessions.filter(s=>s.exercises.some(e=>e.muscle===historyFilter)):sessions;
  const usedMuscles=[...new Set(sessions.flatMap(s=>s.exercises.map(e=>e.muscle)))];
  const tabStyle=t=>({padding:"8px 10px",border:"none",cursor:"pointer",fontSize:13,whiteSpace:"nowrap",borderBottom:tab===t?`2px solid ${T.accent}`:"2px solid transparent",color:tab===t?T.accent:T.muted,background:"transparent",fontWeight:tab===t?600:400});

  const recoveryColor={tired:T.danger,recovering:"#f59e0b",fresh:T.accent};
  const recoveryLabel={tired:"Fatigué",recovering:"Récupération",fresh:"Prêt"};

  // ── Loading / auth screens ─────────────────────────────────────────────────
  if(loading||!authReady) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"3rem",color:T.muted,fontSize:14,background:T.bg,minHeight:"100vh"}}>
      Chargement...
    </div>
  );

  if(!user) return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:"32px 16px",boxSizing:"border-box"}}>
      <div style={{width:"min(440px,100%)"}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:72,height:72,borderRadius:22,background:T.accentDim,fontSize:36,marginBottom:20,boxShadow:T.shadow}}>🏋️</div>
          <h1 style={{fontSize:28,fontWeight:800,color:T.text,margin:"0 0 10px",letterSpacing:"-0.8px",lineHeight:1.1}}>Suivi Muscu</h1>
          <p style={{fontSize:14,color:T.muted,margin:0,lineHeight:1.7}}>
            Enregistre tes séances · Suis ta progression<br/>
            Synchronisé sur tous tes appareils
          </p>
        </div>
        <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:20,padding:"28px 32px",boxShadow:T.shadow}}>
          <Auth T={T} S={S}/>
        </div>
        <p style={{textAlign:"center",fontSize:11,color:T.muted,marginTop:20,opacity:0.6,letterSpacing:"0.02em"}}>
          Données chiffrées · Synchronisation sécurisée
        </p>
      </div>
    </div>
  );

  // ── Main app ───────────────────────────────────────────────────────────────
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

      {/* Rest Timer (flottant sur log) */}
      {tab==="log" && <RestTimer T={T} visible={showTimer} triggerKey={timerTrigger}/>}

      {/* Header */}
      <div style={{borderBottom:`1px solid ${T.border}`,background:T.bgCard,boxShadow:`0 1px 0 ${T.border}`}}>
        <div style={{maxWidth:680,margin:"0 auto",padding:"0 16px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0 0"}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:38,height:38,borderRadius:12,background:T.accentDim,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🏋️</div>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:T.text,letterSpacing:"-0.3px",lineHeight:1.2}}>Suivi Muscu</div>
                <div style={{fontSize:11,color:T.muted,lineHeight:1}}>Séances · Progression · Performances</div>
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

        {/* ═══════════════════════════ LOG ═══════════════════════════════════ */}
        {tab==="log" && (
          <div>
            {/* Session header */}
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
                <button onClick={()=>setShowTimer(t=>!t)} style={{...S.btnS,...(showTimer?{background:T.accentDim,color:T.accent,borderColor:T.accent}:{}),padding:"7px 12px",fontSize:12,marginLeft:"auto"}}>
                  ⏱ Repos
                </button>
              )}
            </div>

            {/* Program selector */}
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

            {/* Exercise cards */}
            {exercises.map(ex=>{
              const last=getLastForExercise(ex.name);
              const sugg=getSuggestion(ex.name);
              const showSugg=sugg&&(!last||sugg!==last.maxWeight);
              const hasTarget=ex.target&&(ex.target.sets||ex.target.reps);
              return (
                <div key={ex.id} style={S.card}>
                  {/* Exercise header */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontWeight:600,fontSize:14,color:T.text}}>{ex.name}</span>
                      <Tag T={T}>{ex.muscle}</Tag>
                      {hasTarget && (
                        <span style={{fontSize:11,color:T.muted,background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:99,padding:"2px 8px"}}>
                          Objectif: {ex.target.sets?`${ex.target.sets}×`:""}{ex.target.reps||""}
                        </span>
                      )}
                    </div>
                    <button onClick={()=>removeExercise(ex.id)} style={{...S.btnS,padding:"3px 8px",fontSize:11}}>✕</button>
                  </div>

                  {/* Last session info */}
                  {last && (
                    <div style={{fontSize:11,color:T.muted,marginBottom:8,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",padding:"6px 10px",background:T.bgInput,borderRadius:8}}>
                      <span>🕐 {last.daysAgo===0?"Aujourd'hui":last.daysAgo===1?"Hier":`Il y a ${last.daysAgo}j`} : {last.sets.length} série{last.sets.length>1?"s":""} @ {last.maxWeight}kg</span>
                      {showSugg && <span style={{color:T.accent,fontWeight:600}}>→ Essaie {sugg}kg</span>}
                    </div>
                  )}
                  {!last && (
                    <div style={{fontSize:11,color:T.muted,marginBottom:8,padding:"6px 10px",background:T.bgInput,borderRadius:8}}>
                      Premier enregistrement pour cet exercice
                    </div>
                  )}

                  {/* Set header */}
                  <div style={{display:"grid",gridTemplateColumns:"18px 22px 1fr 1fr 46px 50px 24px",gap:5,alignItems:"center",marginBottom:4}}>
                    <span style={{fontSize:10,color:T.muted,textAlign:"center"}}>#</span>
                    <span style={{fontSize:10,color:T.muted,textAlign:"center"}} title="Échauffement">W</span>
                    <span style={{fontSize:10,color:T.muted}}>kg</span>
                    <span style={{fontSize:10,color:T.muted}}>Reps</span>
                    <span style={{fontSize:10,color:T.muted,textAlign:"center"}}>RPE</span>
                    <span style={{fontSize:10,color:T.muted,textAlign:"right"}}>1RM</span>
                    <span></span>
                  </div>

                  {/* Sets */}
                  {ex.sets.map((s,si)=>(
                    <div key={si} style={{display:"grid",gridTemplateColumns:"18px 22px 1fr 1fr 46px 50px 24px",gap:5,alignItems:"center",marginBottom:4,opacity:s.isWarmup?0.65:1}}>
                      <span style={{fontSize:11,color:T.muted,textAlign:"center"}}>{si+1}</span>
                      <button
                        onClick={()=>updateSet(ex.id,si,"isWarmup",!s.isWarmup)}
                        title="Série d'échauffement"
                        style={{fontSize:9,fontWeight:700,border:`1px solid ${s.isWarmup?T.accent:T.border}`,borderRadius:4,padding:"2px 0",cursor:"pointer",background:s.isWarmup?T.accentDim:"transparent",color:s.isWarmup?T.accent:T.muted,lineHeight:1,width:"100%"}}>
                        W
                      </button>
                      <input type="number" placeholder="0" value={s.weight} onChange={e=>updateSet(ex.id,si,"weight",e.target.value)} style={{...S.inp,textAlign:"center",padding:"7px 4px"}}/>
                      <input type="number" placeholder="0" value={s.reps} onChange={e=>updateSet(ex.id,si,"reps",e.target.value)} style={{...S.inp,textAlign:"center",padding:"7px 4px"}}/>
                      <input type="number" placeholder="—" min="1" max="10" step="0.5" value={s.rpe||""} onChange={e=>updateSet(ex.id,si,"rpe",e.target.value)} style={{...S.inp,textAlign:"center",padding:"7px 4px",fontSize:12}} title="RPE (effort perçu 1-10)"/>
                      <span style={{fontSize:11,color:T.muted,textAlign:"right"}}>{estimate1RM(s.weight,s.reps)||"—"}</span>
                      <button onClick={()=>removeSet(ex.id,si)} style={{background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:13}}>✕</button>
                    </div>
                  ))}

                  {/* Add set + notes */}
                  <button onClick={()=>addSet(ex.id)} style={{...S.btnS,marginTop:4,fontSize:11}}>+ Série</button>
                  <input
                    value={ex.notes||""}
                    onChange={e=>updateExNotes(ex.id,e.target.value)}
                    placeholder="Note technique (forme, sensation...)"
                    style={{...S.inp,marginTop:8,fontSize:12,padding:"7px 12px"}}
                  />
                </div>
              );
            })}

            {/* Add exercise card */}
            <div style={{...S.card,borderStyle:"dashed"}}>
              <p style={{margin:"0 0 10px",fontSize:13,fontWeight:600,color:T.text}}>Ajouter un exercice</p>
              {allExNames.length>0&&(
                <>
                  <p style={{fontSize:11,color:T.muted,margin:"0 0 6px"}}>Exercices récents</p>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
                    {allExNames.filter(n=>!exercises.find(e=>e.name===n)).map(n=><button key={n} onClick={()=>addExercise(n)} style={{...S.btnS,fontSize:12,padding:"4px 12px"}}>{n}</button>)}
                  </div>
                </>
              )}
              <p style={{fontSize:11,color:T.muted,margin:"0 0 6px"}}>Nouvel exercice</p>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <input value={newExName} onChange={e=>setNewExName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addExercise()} placeholder="Nom de l'exercice" style={{...S.inp,flex:1,minWidth:150}}/>
                <select value={newExMuscle} onChange={e=>setNewExMuscle(e.target.value)} style={{...S.inp,minWidth:130,width:"auto"}}>{MUSCLE_GROUPS.map(m=><option key={m}>{m}</option>)}</select>
                <button onClick={()=>addExercise()} style={S.btnP}>Ajouter</button>
              </div>
            </div>

            {/* Session save section */}
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
                  <div>
                    <label style={{fontSize:11,color:T.muted,display:"block",marginBottom:6}}>💤 Sommeil</label>
                    <SleepEnergyRating value={sessionSleep} onChange={setSessionSleep} T={T}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:T.muted,display:"block",marginBottom:6}}>⚡ Énergie</label>
                    <SleepEnergyRating value={sessionEnergy} onChange={setSessionEnergy} T={T}/>
                  </div>
                </div>
                <label style={{fontSize:12,color:T.muted,display:"block",marginBottom:4}}>Notes (optionnel)</label>
                <textarea value={sessionNotes} onChange={e=>setSessionNotes(e.target.value)} placeholder="Sensations, fatigue, observations..." rows={2} style={{...S.inp,resize:"vertical",marginBottom:12}}/>
                <button onClick={saveSession} style={{...S.btnP,width:"100%",padding:12,fontSize:14}}>💾 Enregistrer la séance</button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════ HISTORY ═══════════════════════════════ */}
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
              const ratingEmojis=["😞","😐","🙂","😊","🔥"];
              return (
                <div key={s.id} style={S.card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div>
                      <div style={{fontWeight:600,fontSize:14,color:T.text}}>{s.programName}</div>
                      <div style={{fontSize:12,color:T.muted,marginTop:2,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                        <span>{formatDate(s.date)}{s.duration?` · ${s.duration} min`:""}</span>
                        {s.bodyweight&&<span>⚖️ {s.bodyweight}kg</span>}
                        {s.rating&&<span title="Ressenti">{ratingEmojis[s.rating-1]} {["Difficile","Moyen","Bien","Super","Excellent"][s.rating-1]}</span>}
                        {s.sleep&&<span title="Sommeil">💤{s.sleep}/5</span>}
                        {s.energy&&<span title="Énergie">⚡{s.energy}/5</span>}
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
                      return (
                        <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                          <span style={{color:T.text}}>{e.name}{prSet.has(s.id+":"+e.name)&&" 🏆"}</span>
                          <span style={{color:T.muted}}>
                            {working.length}×{warmup>0?` (+${warmup}W)`:""} @ {maxW}kg
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {(s.notes||(s.exercises.some(e=>e.notes)))&&(
                    <div style={{marginTop:8,borderTop:`1px solid ${T.border}`,paddingTop:8}}>
                      {s.notes&&<p style={{margin:"0 0 4px",fontSize:12,color:T.muted,fontStyle:"italic"}}>📝 {s.notes}</p>}
                      {s.exercises.filter(e=>e.notes).map((e,i)=>(
                        <p key={i} style={{margin:"0 0 2px",fontSize:11,color:T.muted}}>💬 <strong>{e.name}</strong> : {e.notes}</p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ═══════════════════════════ PROGRESS ═════════════════════════════ */}
        {tab==="progress" && (
          <div>
            {/* Bodyweight chart */}
            {bwData.length>=2&&(
              <div style={S.card}>
                <p style={{margin:"0 0 4px",fontSize:13,fontWeight:600,color:T.text}}>⚖️ Évolution du poids de corps</p>
                <div style={{display:"flex",gap:16,marginBottom:12}}>
                  <div style={{textAlign:"center"}}><div style={{fontSize:10,color:T.muted}}>Actuel</div><div style={{fontSize:16,fontWeight:700,color:T.accent}}>{bwData[bwData.length-1].weight} kg</div></div>
                  <div style={{textAlign:"center"}}><div style={{fontSize:10,color:T.muted}}>Min</div><div style={{fontSize:16,fontWeight:700,color:T.text}}>{Math.min(...bwData.map(d=>d.weight))} kg</div></div>
                  <div style={{textAlign:"center"}}><div style={{fontSize:10,color:T.muted}}>Max</div><div style={{fontSize:16,fontWeight:700,color:T.text}}>{Math.max(...bwData.map(d=>d.weight))} kg</div></div>
                </div>
                <div style={{width:"100%",height:180}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={bwData} margin={{top:5,right:10,left:-10,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                      <XAxis dataKey="label" tick={{fontSize:10,fill:T.muted}} stroke={T.border}/>
                      <YAxis tick={{fontSize:10,fill:T.muted}} stroke={T.border} domain={["auto","auto"]}/>
                      <Tooltip contentStyle={{background:T.bgModal,border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,color:T.text}}/>
                      <Line type="monotone" dataKey="weight" name="Poids (kg)" stroke={T.accent} strokeWidth={2.5} dot={{r:4,fill:T.accent}}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Exercise progress */}
            <div style={{marginBottom:16}}>
              <label style={{fontSize:12,color:T.muted,display:"block",marginBottom:6}}>Exercice à analyser</label>
              <select value={progressEx} onChange={e=>setProgressEx(e.target.value)} style={S.inp}>
                <option value="">-- Choisir un exercice --</option>
                {allExNames.map(n=><option key={n}>{n}</option>)}
              </select>
            </div>
            {progressEx&&progressData.length>0&&(
              <>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
                  {[{label:"Séances",val:progressData.length},{label:"Record",val:Math.max(...progressData.map(d=>d.maxWeight))+" kg"},{label:"1RM estimé",val:Math.max(...progressData.map(d=>d.orm))+" kg"}].map(({label,val})=>(
                    <div key={label} style={{background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:8,padding:12,textAlign:"center"}}>
                      <div style={{fontSize:11,color:T.muted,marginBottom:4}}>{label}</div>
                      <div style={{fontSize:18,fontWeight:700,color:T.accent}}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={S.card}>
                  <p style={{margin:"0 0 12px",fontSize:13,fontWeight:600,color:T.text}}>Évolution</p>
                  <div style={{width:"100%",height:220}}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={progressData} margin={{top:5,right:10,left:-10,bottom:0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                        <XAxis dataKey="label" tick={{fontSize:11,fill:T.muted}} stroke={T.border}/>
                        <YAxis tick={{fontSize:11,fill:T.muted}} stroke={T.border}/>
                        <Tooltip contentStyle={{background:T.bgModal,border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,color:T.text}} labelStyle={{color:T.text}}/>
                        <Line type="monotone" dataKey="maxWeight" name="Poids max" stroke={T.accent} strokeWidth={2.5} dot={{r:4,fill:T.accent}}/>
                        <Line type="monotone" dataKey="orm" name="1RM estimé" stroke={T.chart2} strokeWidth={2} strokeDasharray="5 4" dot={{r:3,fill:T.chart2}}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div style={S.card}>
                  <p style={{margin:"0 0 12px",fontSize:13,fontWeight:600,color:T.text}}>Historique</p>
                  <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
                    <thead><tr style={{borderBottom:`1px solid ${T.border}`}}><th style={{textAlign:"left",padding:"4px 8px",color:T.muted,fontWeight:400}}>Date</th><th style={{textAlign:"right",padding:"4px 8px",color:T.muted,fontWeight:400}}>Poids max</th><th style={{textAlign:"right",padding:"4px 8px",color:T.muted,fontWeight:400}}>Volume</th></tr></thead>
                    <tbody>{[...progressData].reverse().map((d,i)=><tr key={i} style={{borderBottom:`1px solid ${T.border}`}}><td style={{padding:"6px 8px",color:T.text}}>{formatDate(d.date)}</td><td style={{padding:"6px 8px",textAlign:"right",fontWeight:600,color:T.accent}}>{d.maxWeight} kg</td><td style={{padding:"6px 8px",textAlign:"right",color:T.muted}}>{Math.round(d.volume)} kg</td></tr>)}</tbody>
                  </table>
                </div>
              </>
            )}
            {!progressEx&&bwData.length<2&&<p style={{color:T.muted,textAlign:"center",padding:"2rem 0",fontSize:14}}>Sélectionnez un exercice ou enregistrez votre poids lors de vos séances.</p>}
            {progressEx&&progressData.length===0&&<p style={{color:T.muted,textAlign:"center",padding:"2rem 0",fontSize:14}}>Aucune donnée pour cet exercice.</p>}
          </div>
        )}

        {/* ═══════════════════════════ PROGRAMS ═════════════════════════════ */}
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
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {p.exercises.map((ex,i)=>{
                      const name=typeof ex==="string"?ex:ex.name;
                      const sets=typeof ex==="object"&&ex.targetSets?ex.targetSets:"";
                      const reps=typeof ex==="object"&&ex.targetReps?ex.targetReps:"";
                      return (
                        <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:12}}>
                          <span style={{color:T.text}}>{name}</span>
                          {(sets||reps)&&<span style={{color:T.muted,fontSize:11}}>{sets?`${sets}×`:""}{reps}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════════════════ STATS ════════════════════════════════ */}
        {tab==="stats" && (
          <div>
            {/* Key metrics */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
              {[
                {label:"Séances",val:sessions.length},
                {label:"Cette semaine",val:thisWeek},
                {label:"Ce mois",val:thisMonth},
                {label:"Volume total",val:totalVolume>=1000?(totalVolume/1000).toFixed(1)+" t":totalVolume+" kg"},
                {label:"Durée moy.",val:avgDuration?avgDuration+" min":"—"},
                {label:"Muscle favori",val:topMuscle?topMuscle[0]:"—"}
              ].map(({label,val})=>(
                <div key={label} style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:10,padding:14,textAlign:"center"}}>
                  <div style={{fontSize:11,color:T.muted,marginBottom:6}}>{label}</div>
                  <div style={{fontSize:17,fontWeight:700,color:T.accent}}>{val}</div>
                </div>
              ))}
            </div>

            {/* Weekly volume by muscle */}
            {Object.keys(weeklyVolByMuscle).length>0&&(
              <div style={S.card}>
                <p style={{margin:"0 0 12px",fontSize:13,fontWeight:600,color:T.text}}>Volume cette semaine par muscle</p>
                {Object.entries(weeklyVolByMuscle).sort((a,b)=>b[1]-a[1]).map(([muscle,vol])=>{
                  const max=Math.max(...Object.values(weeklyVolByMuscle));
                  return (
                    <div key={muscle} style={{marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                        <span style={{color:T.text}}>{muscle}</span>
                        <span style={{color:T.muted}}>{vol>=1000?(vol/1000).toFixed(1)+" t":Math.round(vol)+" kg"}</span>
                      </div>
                      <div style={{background:T.bgInput,borderRadius:99,height:6}}>
                        <div style={{width:`${(vol/max)*100}%`,background:T.accent,borderRadius:99,height:6}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Muscle recovery */}
            {sessions.length>0&&(
              <div style={S.card}>
                <p style={{margin:"0 0 4px",fontSize:13,fontWeight:600,color:T.text}}>Récupération musculaire</p>
                <p style={{margin:"0 0 12px",fontSize:11,color:T.muted}}>Estimation basée sur tes dernières séances</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {MUSCLE_GROUPS.map(muscle=>{
                    const r=muscleRecovery[muscle];
                    const col=r.hours===null?"#888":recoveryColor[r.status];
                    const label=r.hours===null?"—":recoveryLabel[r.status];
                    const pct=r.hours===null?0:r.status==="fresh"?100:r.status==="recovering"?Math.round((r.hours/48)*100):Math.round((r.hours/24)*100);
                    return (
                      <div key={muscle} style={{padding:"8px 10px",background:T.bgInput,borderRadius:10,border:`1px solid ${T.border}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                          <span style={{color:T.text,fontWeight:500}}>{muscle}</span>
                          <span style={{color:col,fontWeight:600}}>{label}</span>
                        </div>
                        <div style={{background:T.border,borderRadius:99,height:4}}>
                          <div style={{width:`${pct}%`,height:"100%",background:col,borderRadius:99,transition:"width 0.4s"}}/>
                        </div>
                        {r.hours!==null&&<div style={{fontSize:10,color:T.muted,marginTop:2}}>{r.hours<1?"<1h":r.hours<24?`${r.hours}h`:r.hours<48?`${r.hours}h`:`${Math.round(r.hours/24)}j`}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* All-time volume by muscle */}
            {Object.keys(muscleCount).length>0&&(
              <div style={S.card}>
                <p style={{margin:"0 0 12px",fontSize:13,fontWeight:600,color:T.text}}>Groupes musculaires (total)</p>
                {Object.entries(muscleCount).sort((a,b)=>b[1]-a[1]).map(([muscle,count])=>{
                  const max=Math.max(...Object.values(muscleCount));
                  return (
                    <div key={muscle} style={{marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}><span style={{color:T.text}}>{muscle}</span><span style={{color:T.muted}}>{count} fois</span></div>
                      <div style={{background:T.bgInput,borderRadius:99,height:6}}><div style={{width:`${(count/max)*100}%`,background:T.accent,borderRadius:99,height:6}}/></div>
                    </div>
                  );
                })}
              </div>
            )}

            {sessions.length===0&&<p style={{color:T.muted,textAlign:"center",padding:"2rem 0",fontSize:14}}>Commencez par enregistrer une séance !</p>}
          </div>
        )}

        {/* ═══════════════════════════ SETTINGS ═════════════════════════════ */}
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
