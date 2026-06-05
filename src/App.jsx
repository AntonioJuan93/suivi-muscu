import { useState, useEffect, useMemo, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { MUSCLE_GROUPS, INITIAL_PROGRAMS, THEMES, formatDate, calcVolume, estimate1RM, startOfWeek, makeStyles } from "./theme";
import { loadData, saveData } from "./storage";

function Tag({ children, T }) {
  return <span style={{ fontSize:11, background:T.accentDim, color:T.accent, padding:"2px 8px", borderRadius:99 }}>{children}</span>;
}

function ProgramEditor({ program, onSave, onCancel, T, S }) {
  const [name, setName] = useState(program?.name||"");
  const [muscles, setMuscles] = useState(program?.muscles||[]);
  const [exercises, setExercises] = useState(program?.exercises||[]);
  const [newEx, setNewEx] = useState("");
  function toggleMuscle(m) { setMuscles(ms=>ms.includes(m)?ms.filter(x=>x!==m):[...ms,m]); }
  function addEx() { if(!newEx.trim())return; setExercises(ex=>[...ex,newEx.trim()]); setNewEx(""); }
  function removeEx(i) { setExercises(ex=>ex.filter((_,j)=>j!==i)); }
  function moveEx(i,dir) { setExercises(ex=>{ const a=[...ex],j=i+dir; if(j<0||j>=a.length)return a; [a[i],a[j]]=[a[j],a[i]]; return a; }); }
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:12 }}>
      <div style={{ background:T.bgModal, border:`1px solid ${T.border}`, borderRadius:16, padding:24, width:"min(520px,95vw)", maxHeight:"85vh", overflowY:"auto", boxSizing:"border-box" }}>
        <h3 style={{ margin:"0 0 16px", fontSize:16, fontWeight:600, color:T.text }}>{program?"Modifier le programme":"Nouveau programme"}</h3>
        <label style={{ fontSize:12, color:T.muted, display:"block", marginBottom:4 }}>Nom</label>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: Full body" style={{ ...S.inp, marginBottom:16 }} />
        <label style={{ fontSize:12, color:T.muted, display:"block", marginBottom:6 }}>Groupes musculaires</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:16 }}>
          {MUSCLE_GROUPS.map(m=><button key={m} onClick={()=>toggleMuscle(m)} style={{ ...S.btnS, ...(muscles.includes(m)?{background:T.accentDim,color:T.accent,borderColor:T.accent}:{}) }}>{m}</button>)}
        </div>
        <label style={{ fontSize:12, color:T.muted, display:"block", marginBottom:6 }}>Exercices</label>
        {exercises.length===0 && <p style={{ fontSize:12, color:T.muted, marginBottom:8 }}>Aucun exercice.</p>}
        {exercises.map((ex,i)=>(
          <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              <button onClick={()=>moveEx(i,-1)} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, fontSize:11, padding:"0 4px", lineHeight:1 }}>▲</button>
              <button onClick={()=>moveEx(i,1)} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, fontSize:11, padding:"0 4px", lineHeight:1 }}>▼</button>
            </div>
            <span style={{ flex:1, fontSize:13, color:T.text, background:T.bgInput, border:`1px solid ${T.border}`, borderRadius:8, padding:"6px 10px" }}>{ex}</span>
            <button onClick={()=>removeEx(i)} style={{ background:"none", border:"none", cursor:"pointer", color:T.danger, fontSize:16, lineHeight:1 }}>✕</button>
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
  const [tab, setTab] = useState("log");
  const [sessions, setSessions] = useState([]);
  const [programs, setPrograms] = useState(INITIAL_PROGRAMS);
  const [themeKey, setThemeKey] = useState("forest");
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [mode, setMode] = useState("free");
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [sessionDuration, setSessionDuration] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [exercises, setExercises] = useState([]);
  const [newExName, setNewExName] = useState("");
  const [newExMuscle, setNewExMuscle] = useState(MUSCLE_GROUPS[0]);
  const [progressEx, setProgressEx] = useState("");
  const [historyFilter, setHistoryFilter] = useState("");

  const T = THEMES[themeKey] || THEMES.forest;
  const S = useMemo(()=>makeStyles(T), [themeKey]);
  const saveTimer = useRef(null);

  function fullData(){ return { sessions, programs, theme:themeKey, draft:{ exercises, sessionDate, sessionDuration, sessionNotes, mode, selectedProgram } }; }
  function applyData(d, withDraft){
    if(!d) return;
    if(d.sessions) setSessions(d.sessions);
    if(d.programs) setPrograms(d.programs);
    if(d.theme&&THEMES[d.theme]) setThemeKey(d.theme);
    if(withDraft && d.draft){ const dr=d.draft;
      if(Array.isArray(dr.exercises)) setExercises(dr.exercises);
      if(dr.sessionDate) setSessionDate(dr.sessionDate);
      setSessionDuration(dr.sessionDuration||"");
      setSessionNotes(dr.sessionNotes||"");
      if(dr.mode) setMode(dr.mode);
      if(dr.selectedProgram!==undefined) setSelectedProgram(dr.selectedProgram);
    }
  }

  useEffect(()=>{ const d=loadData(); if(d) applyData(d,true); setReady(true); setLoading(false); },[]);
  useEffect(()=>{
    if(!ready) return;
    if(saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>saveData(fullData()), 400);
    return ()=>{ if(saveTimer.current) clearTimeout(saveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sessions,programs,themeKey,exercises,sessionDate,sessionDuration,sessionNotes,mode,selectedProgram,ready]);
  useEffect(()=>{
    const onStorage=(e)=>{ if(e.key==="suivi_muscu_data"){ const d=loadData(); if(d) applyData(d,false); } };
    window.addEventListener("storage",onStorage);
    return ()=>window.removeEventListener("storage",onStorage);
  },[]);

  function saveProgram(data){
    if(editingProgram==="new") setPrograms(ps=>[...ps,{...data,id:Date.now()}]);
    else setPrograms(ps=>ps.map(p=>p.id===editingProgram.id?{...p,...data}:p));
    setEditingProgram(null);
  }
  function deleteProgram(id){ setPrograms(ps=>ps.filter(p=>p.id!==id)); setConfirmDelete(null); }
  function deleteSession(id){ setSessions(ps=>ps.filter(s=>s.id!==id)); setConfirmDelete(null); }
  function loadProgram(p){ setSelectedProgram(p); setExercises(p.exercises.map((name,i)=>({id:Date.now()+i,name,muscle:p.muscles[Math.min(i,p.muscles.length-1)]||MUSCLE_GROUPS[0],sets:[{weight:"",reps:""}]}))); }
  function repeatSession(s){ setMode("free"); setSelectedProgram({name:s.programName}); setSessionDate(new Date().toISOString().split("T")[0]); setSessionDuration(s.duration?String(s.duration):""); setSessionNotes(""); setExercises(s.exercises.map((e,i)=>({id:Date.now()+i,name:e.name,muscle:e.muscle,sets:e.sets.map(set=>({weight:set.weight,reps:set.reps}))}))); setTab("log"); }
  function addSet(id){ setExercises(ex=>ex.map(e=>e.id===id?{...e,sets:[...e.sets,{weight:"",reps:""}]}:e)); }
  function removeSet(id,si){ setExercises(ex=>ex.map(e=>e.id===id?{...e,sets:e.sets.filter((_,i)=>i!==si)}:e)); }
  function updateSet(id,si,f,v){ setExercises(ex=>ex.map(e=>e.id===id?{...e,sets:e.sets.map((st,i)=>i===si?{...st,[f]:v}:st)}:e)); }
  function removeExercise(id){ setExercises(ex=>ex.filter(e=>e.id!==id)); }
  function addExercise(nameOverride){
    const name=(nameOverride||newExName).trim(); if(!name)return;
    let muscle=newExMuscle;
    for(const s of sessions){const f=s.exercises.find(e=>e.name===name); if(f){muscle=f.muscle;break;}}
    setExercises(ex=>[...ex,{id:Date.now(),name,muscle,sets:[{weight:"",reps:""}]}]); setNewExName("");
  }
  function saveSession(){
    if(!exercises.length)return;
    const clean=exercises.map(e=>({...e,sets:e.sets.filter(s=>s.weight||s.reps)})).filter(e=>e.sets.length);
    if(!clean.length)return;
    const session={id:Date.now(),date:sessionDate,duration:parseInt(sessionDuration)||null,notes:sessionNotes.trim()||null,programName:selectedProgram?.name||"Séance libre",exercises:clean};
    setSessions(s=>[session,...s]);
    setExercises([]); setSessionDuration(""); setSessionNotes(""); setSelectedProgram(null); setTab("history");
  }
  function exportJSON(){const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([JSON.stringify({sessions,programs,theme:themeKey},null,2)],{type:"application/json"})); a.download="suivi_muscu.json"; a.click();}
  function exportCSV(){
    const rows=[["Date","Programme","Exercice","Muscle","Série","Poids (kg)","Répétitions","Volume","1RM estimé"]];
    sessions.forEach(s=>s.exercises.forEach(e=>e.sets.forEach((set,si)=>{rows.push([s.date,s.programName,e.name,e.muscle,si+1,set.weight||0,set.reps||0,(parseFloat(set.weight)||0)*(parseInt(set.reps)||0),estimate1RM(set.weight,set.reps)]);})));
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([rows.map(r=>r.map(v=>`"${v}"`).join(",")).join("\n")],{type:"text/csv"})); a.download="suivi_muscu.csv"; a.click();
  }
  function importJSON(e){
    setImportError(null); setImportSuccess(false);
    const file=e.target.files?.[0]; if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{try{const d=JSON.parse(ev.target.result); if(!d.sessions||!d.programs)throw new Error(); applyData(d,false); setImportSuccess(true); setTimeout(()=>setImportSuccess(false),3000);}catch{setImportError("Fichier invalide.");}};
    reader.readAsText(file); e.target.value="";
  }

  const allExNames=[...new Set(sessions.flatMap(s=>s.exercises.map(e=>e.name)))].sort();
  const prSet=useMemo(()=>{const best={},prs=new Set(); [...sessions].sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id).forEach(s=>s.exercises.forEach(e=>{const mw=Math.max(0,...e.sets.map(st=>parseFloat(st.weight)||0)); if(mw>0&&mw>(best[e.name]||0)){best[e.name]=mw; prs.add(s.id+":"+e.name);}})); return prs;},[sessions]);
  const progressData=sessions.flatMap(s=>s.exercises.filter(e=>e.name===progressEx).map(e=>({date:s.date,label:formatDate(s.date),maxWeight:Math.max(0,...e.sets.map(st=>parseFloat(st.weight)||0)),volume:calcVolume(e.sets),orm:Math.max(0,...e.sets.map(st=>estimate1RM(st.weight,st.reps)))}))).sort((a,b)=>a.date.localeCompare(b.date));
  const totalVolume=Math.round(sessions.reduce((acc,s)=>acc+s.exercises.reduce((a,e)=>a+calcVolume(e.sets),0),0));
  const muscleCount=sessions.reduce((acc,s)=>{s.exercises.forEach(e=>{acc[e.muscle]=(acc[e.muscle]||0)+1;}); return acc;},{});
  const topMuscle=Object.entries(muscleCount).sort((a,b)=>b[1]-a[1])[0];
  const now=new Date(), weekStart=startOfWeek(now);
  const thisWeek=sessions.filter(s=>new Date(s.date)>=weekStart).length;
  const thisMonth=sessions.filter(s=>{const d=new Date(s.date); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}).length;
  const durations=sessions.filter(s=>s.duration).map(s=>s.duration);
  const avgDuration=durations.length?Math.round(durations.reduce((a,b)=>a+b,0)/durations.length):null;
  const filteredSessions=historyFilter?sessions.filter(s=>s.exercises.some(e=>e.muscle===historyFilter)):sessions;
  const usedMuscles=[...new Set(sessions.flatMap(s=>s.exercises.map(e=>e.muscle)))];
  const tabStyle=t=>({padding:"8px 10px",border:"none",cursor:"pointer",fontSize:13,whiteSpace:"nowrap",borderBottom:tab===t?`2px solid ${T.accent}`:"2px solid transparent",color:tab===t?T.accent:T.muted,background:"transparent",fontWeight:tab===t?600:400});

  if(loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"3rem",color:T.muted,fontSize:14,background:T.bg,minHeight:"100vh"}}>Chargement...</div>;

  return (
    <div style={{fontFamily:"var(--font-sans)",margin:"0 auto",paddingTop:8,paddingBottom:40,background:T.bg,minHeight:"100vh",color:T.text}}>
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
      <div style={{maxWidth:680,margin:"0 auto",padding:"0 16px"}}>
        <h2 style={{fontSize:18,fontWeight:700,margin:"0 0 2px",color:T.text}}>🏋️ Suivi Muscu</h2>
        <p style={{margin:"0 0 16px",fontSize:13,color:T.muted}}>Séances · Progression · Performances</p>
        <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,marginBottom:20,overflowX:"auto"}}>
          {[["log","Séance"],["history","Historique"],["progress","Progression"],["programs","Programmes"],["stats","Stats"],["settings","⚙️"]].map(([k,l])=>(
            <button key={k} style={tabStyle(k)} onClick={()=>setTab(k)}>{l}</button>
          ))}
        </div>

        {tab==="log" && (
          <div>
            <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
              <div><label style={{fontSize:12,color:T.muted,display:"block",marginBottom:4}}>Date</label><input type="date" value={sessionDate} onChange={e=>setSessionDate(e.target.value)} style={{...S.inp,width:140}}/></div>
              <div><label style={{fontSize:12,color:T.muted,display:"block",marginBottom:4}}>Durée (min)</label><input type="number" placeholder="60" value={sessionDuration} onChange={e=>setSessionDuration(e.target.value)} style={{...S.inp,width:80}}/></div>
              <div><label style={{fontSize:12,color:T.muted,display:"block",marginBottom:4}}>Mode</label>
                <div style={{display:"flex",gap:8}}>
                  <button style={{...S.btnS,...(mode==="free"?{background:T.accentDim,color:T.accent,borderColor:T.accent}:{})}} onClick={()=>{setMode("free");setSelectedProgram(null);setExercises([]);}}>Libre</button>
                  <button style={{...S.btnS,...(mode==="program"?{background:T.accentDim,color:T.accent,borderColor:T.accent}:{})}} onClick={()=>setMode("program")}>Programme</button>
                </div>
              </div>
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
            {exercises.map(ex=>(
              <div key={ex.id} style={S.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontWeight:600,fontSize:14,color:T.text}}>{ex.name}</span><Tag T={T}>{ex.muscle}</Tag></div>
                  <button onClick={()=>removeExercise(ex.id)} style={{...S.btnS,padding:"3px 8px",fontSize:11}}>✕</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"24px 1fr 1fr 60px 28px",gap:6,alignItems:"center",marginBottom:6}}>
                  <span style={{fontSize:11,color:T.muted}}>#</span><span style={{fontSize:11,color:T.muted}}>Poids (kg)</span><span style={{fontSize:11,color:T.muted}}>Reps</span><span style={{fontSize:11,color:T.muted,textAlign:"right"}}>1RM</span><span></span>
                </div>
                {ex.sets.map((s,si)=>(
                  <div key={si} style={{display:"grid",gridTemplateColumns:"24px 1fr 1fr 60px 28px",gap:6,alignItems:"center",marginBottom:4}}>
                    <span style={{fontSize:12,color:T.muted,textAlign:"center"}}>{si+1}</span>
                    <input type="number" placeholder="0" value={s.weight} onChange={e=>updateSet(ex.id,si,"weight",e.target.value)} style={{...S.inp,textAlign:"center"}}/>
                    <input type="number" placeholder="0" value={s.reps} onChange={e=>updateSet(ex.id,si,"reps",e.target.value)} style={{...S.inp,textAlign:"center"}}/>
                    <span style={{fontSize:12,color:T.muted,textAlign:"right"}}>{estimate1RM(s.weight,s.reps)||"—"}</span>
                    <button onClick={()=>removeSet(ex.id,si)} style={{background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:14}}>✕</button>
                  </div>
                ))}
                <button onClick={()=>addSet(ex.id)} style={{...S.btnS,marginTop:6,fontSize:11}}>+ Série</button>
              </div>
            ))}
            <div style={{...S.card,borderStyle:"dashed"}}>
              <p style={{margin:"0 0 10px",fontSize:13,fontWeight:600,color:T.text}}>Ajouter un exercice</p>
              {allExNames.length>0&&(<><p style={{fontSize:11,color:T.muted,margin:"0 0 6px"}}>Exercices récents</p><div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>{allExNames.filter(n=>!exercises.find(e=>e.name===n)).map(n=><button key={n} onClick={()=>addExercise(n)} style={{...S.btnS,fontSize:12,padding:"4px 12px"}}>{n}</button>)}</div></>)}
              <p style={{fontSize:11,color:T.muted,margin:"0 0 6px"}}>Nouvel exercice</p>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <input value={newExName} onChange={e=>setNewExName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addExercise()} placeholder="Nom de l'exercice" style={{...S.inp,flex:1,minWidth:150}}/>
                <select value={newExMuscle} onChange={e=>setNewExMuscle(e.target.value)} style={{...S.inp,minWidth:130,width:"auto"}}>{MUSCLE_GROUPS.map(m=><option key={m}>{m}</option>)}</select>
                <button onClick={()=>addExercise()} style={S.btnP}>Ajouter</button>
              </div>
            </div>
            {exercises.length>0&&(<><label style={{fontSize:12,color:T.muted,display:"block",marginBottom:4}}>Notes (optionnel)</label><textarea value={sessionNotes} onChange={e=>setSessionNotes(e.target.value)} placeholder="Sensations, fatigue..." rows={2} style={{...S.inp,resize:"vertical",marginBottom:8}}/><button onClick={saveSession} style={{...S.btnP,width:"100%",padding:12,fontSize:14}}>💾 Enregistrer la séance</button></>)}
          </div>
        )}

        {tab==="history" && (
          <div>
            {usedMuscles.length>0&&(<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}><button onClick={()=>setHistoryFilter("")} style={{...S.btnS,...(historyFilter===""?{background:T.accentDim,color:T.accent,borderColor:T.accent}:{}),fontSize:12}}>Tout</button>{usedMuscles.map(m=><button key={m} onClick={()=>setHistoryFilter(m)} style={{...S.btnS,...(historyFilter===m?{background:T.accentDim,color:T.accent,borderColor:T.accent}:{}),fontSize:12}}>{m}</button>)}</div>)}
            {filteredSessions.length===0&&<p style={{color:T.muted,textAlign:"center",padding:"2rem 0",fontSize:14}}>Aucune séance.</p>}
            {filteredSessions.map(s=>{
              const vol=Math.round(s.exercises.reduce((a,e)=>a+calcVolume(e.sets),0));
              const muscles=[...new Set(s.exercises.map(e=>e.muscle))];
              return (
                <div key={s.id} style={S.card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div><div style={{fontWeight:600,fontSize:14,color:T.text}}>{s.programName}</div><div style={{fontSize:12,color:T.muted,marginTop:2}}>{formatDate(s.date)}{s.duration?` · ${s.duration} min`:""}</div></div>
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
                    {s.exercises.map((e,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}><span style={{color:T.text}}>{e.name}{prSet.has(s.id+":"+e.name)&&" 🏆"}</span><span style={{color:T.muted}}>{e.sets.length} série{e.sets.length>1?"s":""} · {Math.max(0,...e.sets.map(st=>parseFloat(st.weight)||0))} kg</span></div>)}
                  </div>
                  {s.notes&&<p style={{margin:"8px 0 0",fontSize:12,color:T.muted,fontStyle:"italic",borderTop:`1px solid ${T.border}`,paddingTop:8}}>📝 {s.notes}</p>}
                </div>
              );
            })}
          </div>
        )}

        {tab==="progress" && (
          <div>
            <div style={{marginBottom:16}}><label style={{fontSize:12,color:T.muted,display:"block",marginBottom:6}}>Exercice à analyser</label><select value={progressEx} onChange={e=>setProgressEx(e.target.value)} style={S.inp}><option value="">-- Choisir un exercice --</option>{allExNames.map(n=><option key={n}>{n}</option>)}</select></div>
            {progressEx&&progressData.length>0&&(<>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
                {[{label:"Séances",val:progressData.length},{label:"Record",val:Math.max(...progressData.map(d=>d.maxWeight))+" kg"},{label:"1RM estimé",val:Math.max(...progressData.map(d=>d.orm))+" kg"}].map(({label,val})=>(
                  <div key={label} style={{background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:8,padding:12,textAlign:"center"}}><div style={{fontSize:11,color:T.muted,marginBottom:4}}>{label}</div><div style={{fontSize:18,fontWeight:700,color:T.accent}}>{val}</div></div>
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
            </>)}
            {!progressEx&&<p style={{color:T.muted,textAlign:"center",padding:"2rem 0",fontSize:14}}>Sélectionnez un exercice.</p>}
            {progressEx&&progressData.length===0&&<p style={{color:T.muted,textAlign:"center",padding:"2rem 0",fontSize:14}}>Aucune donnée.</p>}
          </div>
        )}

        {tab==="programs" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <p style={{margin:0,fontSize:13,color:T.muted}}>{programs.length} programme{programs.length>1?"s":""}</p>
              <button onClick={()=>setEditingProgram("new")} style={S.btnP}>+ Nouveau</button>
            </div>
            {programs.map(p=>(
              <div key={p.id} style={S.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div><div style={{fontWeight:600,fontSize:14,color:T.text}}>{p.name}</div><div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>{p.muscles.map(m=><Tag key={m} T={T}>{m}</Tag>)}</div></div>
                  <div style={{display:"flex",gap:6}}><button onClick={()=>setEditingProgram(p)} style={{...S.btnS,padding:"5px 10px"}}>✏️</button><button onClick={()=>setConfirmDelete(p)} style={{...S.btnD,padding:"5px 10px"}}>🗑️</button></div>
                </div>
                <div style={{borderTop:`1px solid ${T.border}`,paddingTop:8}}><p style={{margin:"0 0 6px",fontSize:11,color:T.muted}}>Exercices ({p.exercises.length})</p><div style={{display:"flex",flexWrap:"wrap",gap:4}}>{p.exercises.map((ex,i)=><span key={i} style={{fontSize:12,background:T.bgInput,color:T.text,padding:"3px 10px",borderRadius:99,border:`1px solid ${T.border}`}}>{ex}</span>)}</div></div>
              </div>
            ))}
          </div>
        )}

        {tab==="stats" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
              {[{label:"Séances",val:sessions.length},{label:"Cette semaine",val:thisWeek},{label:"Ce mois",val:thisMonth},{label:"Volume total",val:totalVolume>=1000?(totalVolume/1000).toFixed(1)+" t":totalVolume+" kg"},{label:"Durée moy.",val:avgDuration?avgDuration+" min":"—"},{label:"Muscle favori",val:topMuscle?topMuscle[0]:"—"}].map(({label,val})=>(
                <div key={label} style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:10,padding:14,textAlign:"center"}}><div style={{fontSize:11,color:T.muted,marginBottom:6}}>{label}</div><div style={{fontSize:17,fontWeight:700,color:T.accent}}>{val}</div></div>
              ))}
            </div>
            {Object.keys(muscleCount).length>0&&(
              <div style={S.card}>
                <p style={{margin:"0 0 12px",fontSize:13,fontWeight:600,color:T.text}}>Groupes musculaires</p>
                {Object.entries(muscleCount).sort((a,b)=>b[1]-a[1]).map(([muscle,count])=>{
                  const max=Math.max(...Object.values(muscleCount));
                  return <div key={muscle} style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}><span style={{color:T.text}}>{muscle}</span><span style={{color:T.muted}}>{count} fois</span></div><div style={{background:T.bgInput,borderRadius:99,height:6}}><div style={{width:`${(count/max)*100}%`,background:T.accent,borderRadius:99,height:6}}/></div></div>;
                })}
              </div>
            )}
            {sessions.length===0&&<p style={{color:T.muted,textAlign:"center",padding:"2rem 0",fontSize:14}}>Commencez par enregistrer une séance !</p>}
          </div>
        )}

        {tab==="settings" && (
          <div>
            <div style={S.card}>
              <p style={{margin:"0 0 10px",fontSize:14,fontWeight:600,color:T.text}}>🎨 Thème</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {Object.entries(THEMES).map(([k,th])=>(
                  <button key={k} onClick={()=>setThemeKey(k)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,cursor:"pointer",background:k===themeKey?T.accentDim:"transparent",color:T.text,border:`1px solid ${k===themeKey?T.accent:T.border}`,fontSize:13,textAlign:"left"}}>
                    <span style={{display:"flex",gap:3}}><span style={{width:12,height:12,borderRadius:3,background:th.bg,border:`1px solid ${th.border}`}}/><span style={{width:12,height:12,borderRadius:3,background:th.accent}}/></span>
                    {th.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={S.card}>
              <p style={{margin:"0 0 4px",fontSize:14,fontWeight:600,color:T.text}}>Sauvegarde & données</p>
              <p style={{margin:"0 0 12px",fontSize:12,color:T.muted}}>Tes données sont enregistrées automatiquement sur cet appareil. Exporte un fichier pour les transférer ou les archiver.</p>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:8}}><button onClick={exportJSON} style={S.btnP}>⬇️ Export JSON</button><button onClick={exportCSV} style={{...S.btnS,padding:"8px 16px"}}>⬇️ Export CSV</button></div>
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