import { useState, useEffect, useMemo, useRef } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { MUSCLE_GROUPS, INITIAL_PROGRAMS, T, makeStyles, formatDate, calcVolume, estimate1RM, startOfWeek } from "./theme";
import { loadData, saveData } from "./storage";
import { supabase } from "./supabase";
import { loadCloud, saveCloud, clearCloudCache, searchUserByEmail } from "./cloud";
import Auth from "./Auth";

const EQUIPMENT = [
  {v:"",l:"Équipement..."},
  {v:"barre",l:"Barre"},
  {v:"alteres",l:"Altères"},
  {v:"poulie",l:"Poulie"},
  {v:"machine",l:"Machine guidée"},
  {v:"smith",l:"Smith"},
];
function equipLabel(v){ return EQUIPMENT.find(e=>e.v===v)?.l||""; }
function exKey(name,equip){ return name+(equip?":::"+equip:""); }

// ── Design primitives ─────────────────────────────────────────────────────────
function Tag({ children }) {
  return <span style={{ fontSize:10, fontFamily:"var(--sm-font-mono)", letterSpacing:"0.09em", background:"var(--sm-accent-soft)", color:"var(--sm-accent)", padding:"3px 9px", borderRadius:"var(--sm-r-pill)", textTransform:"uppercase", whiteSpace:"nowrap" }}>{children}</span>;
}

function Hero({ value, unit, size=48 }) {
  return (
    <div style={{display:"flex", alignItems:"baseline", gap:5}}>
      <span style={{fontFamily:"var(--sm-font-disp)", fontSize:size, lineHeight:.95, letterSpacing:"-.01em", color:"var(--sm-ink)"}}>{value}</span>
      {unit && <span style={{fontFamily:"var(--sm-font-mono)", fontSize:10, letterSpacing:".14em", color:"var(--sm-sub)", textTransform:"uppercase"}}>{unit}</span>}
    </div>
  );
}

function Ring({ value, max }) {
  const r=42, circ=2*Math.PI*r, pct=Math.min(1,value/Math.max(1,max));
  return (
    <svg width="108" height="108" style={{display:"block"}}>
      <circle cx="54" cy="54" r={r} fill="none" stroke="var(--sm-line)" strokeWidth="8"/>
      <circle cx="54" cy="54" r={r} fill="none" stroke="var(--sm-accent)" strokeWidth="8"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ*(1-pct)}
        transform="rotate(-90 54 54)" style={{transition:"stroke-dashoffset .8s ease"}}/>
    </svg>
  );
}

function MonoLabel({ children }) {
  return <div style={{fontFamily:"var(--sm-font-mono)", fontSize:10, letterSpacing:".14em", color:"var(--sm-sub)", textTransform:"uppercase", marginBottom:4}}>{children}</div>;
}

function PartnerProfile({ data, email, S }) {
  const sessions = data?.sessions || [];
  const weekStart = startOfWeek(new Date());
  const wVol = sets => calcVolume((sets||[]).filter(s=>!s.isWarmup));
  const thisWeek = sessions.filter(s=>new Date(s.date)>=weekStart).length;
  const thisWeekVol = Math.round(sessions.filter(s=>new Date(s.date)>=weekStart).reduce((a,s)=>a+s.exercises.reduce((b,e)=>b+wVol(e.sets),0),0));
  const lastSession = sessions[0] || null;

  const prMap = {};
  sessions.forEach(s=>s.exercises.forEach(e=>{
    const mw=Math.max(0,...(e.sets||[]).filter(st=>!st.isWarmup).map(st=>parseFloat(st.weight)||0));
    const k=exKey(e.name,e.equipment||"");
    if(mw>0&&mw>(prMap[k]?.weight||0)) prMap[k]={name:e.name,equipment:e.equipment||"",weight:mw};
  }));
  const topPRs=Object.values(prMap).sort((a,b)=>b.weight-a.weight).slice(0,5);

  const weeklyTrend=Array.from({length:6},(_,i)=>{
    const ws=new Date(weekStart);ws.setDate(ws.getDate()-(5-i)*7);
    const we=new Date(ws);we.setDate(we.getDate()+7);
    const filtered=sessions.filter(s=>{const d=new Date(s.date);return d>=ws&&d<we;});
    return{label:ws.toLocaleDateString("fr-FR",{day:"2-digit",month:"short"}),vol:Math.round(filtered.reduce((a,s)=>a+s.exercises.reduce((b,e)=>b+wVol(e.sets),0),0)),count:filtered.length};
  });

  const displayName = email.split("@")[0];

  return (
    <div>
      <div style={{...S.card,display:"flex",alignItems:"center",gap:20,marginBottom:14}}>
        <div style={{position:"relative",flexShrink:0,width:108,height:108}}>
          <Ring value={thisWeek} max={4}/>
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontFamily:"var(--sm-font-disp)",fontSize:30,lineHeight:.9,color:"var(--sm-ink)"}}>{thisWeek}</span>
            <span style={{fontFamily:"var(--sm-font-mono)",fontSize:9,letterSpacing:".1em",color:"var(--sm-sub)",textTransform:"uppercase",marginTop:4}}>/ 4 sem.</span>
          </div>
        </div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"var(--sm-font-disp)",fontSize:28,lineHeight:.92,color:"var(--sm-ink)",marginBottom:6}}>{displayName}</div>
          <MonoLabel>Volume cette semaine</MonoLabel>
          <Hero value={thisWeekVol>=1000?(thisWeekVol/1000).toFixed(1):thisWeekVol} unit={thisWeekVol>=1000?"t":"kg"} size={28}/>
        </div>
      </div>

      {lastSession&&(
        <div style={{...S.card,marginBottom:14}}>
          <MonoLabel>Dernière séance</MonoLabel>
          <div style={{fontFamily:"var(--sm-font-disp)",fontSize:22,lineHeight:.95,color:"var(--sm-ink)",marginBottom:4,marginTop:4}}>{lastSession.programName}</div>
          <div style={{fontFamily:"var(--sm-font-mono)",fontSize:10,color:"var(--sm-sub)",letterSpacing:".06em",marginBottom:10}}>{formatDate(lastSession.date)}{lastSession.duration?` · ${lastSession.duration} min`:""}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{[...new Set(lastSession.exercises.map(e=>e.muscle))].filter(Boolean).map(m=><Tag key={m}>{m}</Tag>)}</div>
        </div>
      )}

      {topPRs.length>0&&(
        <div style={{...S.card,marginBottom:14}}>
          <MonoLabel>Records personnels</MonoLabel>
          <div style={{marginTop:6}}>
            {topPRs.map(({name,equipment,weight},i)=>(
              <div key={name+equipment} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<topPRs.length-1?"1px solid var(--sm-line)":"none"}}>
                <div>
                  <span style={{fontSize:13,fontWeight:600,color:"var(--sm-ink)"}}>{name}</span>
                  {equipment&&<span style={{marginLeft:6,fontFamily:"var(--sm-font-mono)",fontSize:10,color:"var(--sm-sub)"}}>{equipLabel(equipment)}</span>}
                </div>
                <span style={{fontFamily:"var(--sm-font-disp)",fontSize:22,color:"var(--sm-accent)"}}>{weight}<span style={{fontFamily:"var(--sm-font-mono)",fontSize:10,color:"var(--sm-sub)",marginLeft:3}}>kg</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {weeklyTrend.some(w=>w.vol>0)&&(
        <div style={S.card}>
          <MonoLabel>Volume — 6 dernières semaines</MonoLabel>
          <div style={{width:"100%",height:120,marginTop:8}}>
            <ResponsiveContainer><BarChart data={weeklyTrend} margin={{top:4,right:4,left:-30,bottom:0}}>
              <XAxis dataKey="label" tick={{fontSize:9,fill:"var(--sm-sub)",fontFamily:"var(--sm-font-mono)"}} stroke="var(--sm-line)"/>
              <YAxis tick={{fontSize:9,fill:"var(--sm-sub)"}} stroke="var(--sm-line)"/>
              <Tooltip contentStyle={{background:"var(--sm-card)",border:"1px solid var(--sm-line)",borderRadius:12,fontSize:11,color:"var(--sm-ink)"}}
                formatter={(v,_,{payload})=>[`${(v/1000).toFixed(1)} t · ${payload.count} séance${payload.count>1?"s":""}`,""]}/>
              <Bar dataKey="vol" radius={[4,4,0,0]} fill="var(--sm-accent)" opacity={0.85}/>
            </BarChart></ResponsiveContainer>
          </div>
        </div>
      )}

      {sessions.length===0&&<p style={{color:"var(--sm-sub)",textAlign:"center",padding:"1rem 0",fontFamily:"var(--sm-font-serif)",fontStyle:"italic",fontSize:14}}>Aucune séance enregistrée.</p>}
    </div>
  );
}

function BottomNav({ tab, setTab }) {
  const items = [
    { k:"home",     l:"Accueil", icon:"⌂" },
    { k:"log",      l:"Séance",  icon:"+" },
    { k:"history",  l:"Histo",   icon:"≡" },
    { k:"progress", l:"Progrès", icon:"↑" },
    { k:"stats",    l:"Stats",   icon:"◈" },
  ];
  return (
    <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"var(--sm-card)",borderTop:"1px solid var(--sm-line)",display:"flex",zIndex:100,paddingBottom:"env(safe-area-inset-bottom,0px)"}}>
      {items.map(({k,l,icon})=>{
        const active=tab===k;
        return (
          <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"8px 2px 6px",border:"none",background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <div style={{width:36,height:36,borderRadius:10,background:active?"var(--sm-accent-soft)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"background .15s",fontSize:17,color:active?"var(--sm-accent)":"var(--sm-sub)"}}>
              {icon}
            </div>
            <span style={{fontSize:9,fontFamily:"var(--sm-font-mono)",letterSpacing:".08em",color:active?"var(--sm-accent)":"var(--sm-sub)",textTransform:"uppercase",fontWeight:active?600:400}}>{l}</span>
          </button>
        );
      })}
    </nav>
  );
}

function StarRating({ value, onChange }) {
  return (
    <div style={{display:"flex",gap:4}}>
      {[1,2,3,4,5].map(n=>(
        <button key={n} onClick={()=>onChange(value===n?null:n)} style={{width:32,height:32,borderRadius:"50%",border:`1px solid ${n<=value?"var(--sm-accent)":"var(--sm-line)"}`,cursor:"pointer",fontSize:12,fontWeight:600,background:n<=value?"var(--sm-accent-soft)":"transparent",color:n<=value?"var(--sm-accent)":"var(--sm-sub)",transition:"all 0.15s"}}>{n}</button>
      ))}
    </div>
  );
}

function NumRating({ value, onChange }) {
  return (
    <div style={{display:"flex",gap:3}}>
      {[1,2,3,4,5].map(n=>(
        <button key={n} onClick={()=>onChange(value===n?null:n)} style={{width:28,height:28,borderRadius:"50%",border:`1px solid ${n<=value?"var(--sm-accent)":"var(--sm-line)"}`,cursor:"pointer",fontSize:11,fontWeight:600,background:n<=value?"var(--sm-accent-soft)":"transparent",color:n<=value?"var(--sm-accent)":"var(--sm-sub)"}}>{n}</button>
      ))}
    </div>
  );
}

function ProgramEditor({ program, onSave, onCancel, S }) {
  const [name, setName] = useState(program?.name||"");
  const [muscles, setMuscles] = useState(program?.muscles||[]);
  const [exercises, setExercises] = useState(
    (program?.exercises||[]).map(ex=>typeof ex==="string"?{name:ex,targetSets:"",targetReps:"",muscle:"",equipment:""}:{muscle:"",equipment:"",...ex})
  );
  const [newEx, setNewEx] = useState("");
  const [newExMuscle, setNewExMuscle] = useState("");
  const [newExEquip, setNewExEquip] = useState("");

  function toggleMuscle(m){ setMuscles(ms=>ms.includes(m)?ms.filter(x=>x!==m):[...ms,m]); }
  function addEx(){ if(!newEx.trim())return; setExercises(ex=>[...ex,{name:newEx.trim(),targetSets:"",targetReps:"",muscle:newExMuscle,equipment:newExEquip}]); setNewEx(""); setNewExMuscle(""); setNewExEquip(""); }
  function removeEx(i){ setExercises(ex=>ex.filter((_,j)=>j!==i)); }
  function moveEx(i,dir){ setExercises(ex=>{ const a=[...ex],j=i+dir; if(j<0||j>=a.length)return a; [a[i],a[j]]=[a[j],a[i]]; return a; }); }
  function updateExField(i,field,val){ setExercises(ex=>ex.map((e,j)=>j===i?{...e,[field]:val}:e)); }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:12}}>
      <div style={{background:"var(--sm-card)",borderRadius:24,padding:24,width:"min(560px,95vw)",maxHeight:"88vh",overflowY:"auto",boxSizing:"border-box",boxShadow:"var(--sm-shadow)"}}>
        <h3 style={{margin:"0 0 16px",fontSize:16,fontWeight:700,color:"var(--sm-ink)"}}>{program?"Modifier":"Nouveau programme"}</h3>
        <MonoLabel>Nom</MonoLabel>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: Push A" style={{...S.inp,marginBottom:16}}/>
        <MonoLabel>Groupes musculaires</MonoLabel>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:16}}>
          {MUSCLE_GROUPS.map(m=>(
            <button key={m} onClick={()=>toggleMuscle(m)} style={{...S.btnS,...(muscles.includes(m)?{background:"var(--sm-accent-soft)",color:"var(--sm-accent)",borderColor:"var(--sm-accent)"}:{}),fontSize:12,padding:"5px 12px"}}>{m}</button>
          ))}
        </div>
        <MonoLabel>Exercices</MonoLabel>
        {exercises.length===0&&<p style={{fontSize:12,color:"var(--sm-sub)",marginBottom:8}}>Aucun exercice.</p>}
        {exercises.map((ex,i)=>(
          <div key={i} style={{marginBottom:8,background:"var(--sm-card2)",borderRadius:12,padding:"10px 12px",border:"1px solid var(--sm-line)"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
              <div style={{display:"flex",flexDirection:"column",gap:1}}>
                <button onClick={()=>moveEx(i,-1)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--sm-sub)",fontSize:10,padding:"1px 3px",lineHeight:1}}>▲</button>
                <button onClick={()=>moveEx(i,1)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--sm-sub)",fontSize:10,padding:"1px 3px",lineHeight:1}}>▼</button>
              </div>
              <span style={{flex:1,fontSize:13,color:"var(--sm-ink)",fontWeight:500}}>{ex.name}</span>
              <button onClick={()=>removeEx(i)} style={{background:"none",border:"none",cursor:"pointer",color:"#e05555",fontSize:16,lineHeight:1}}>✕</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
              <select value={ex.muscle||""} onChange={e=>updateExField(i,"muscle",e.target.value)} style={{...S.inp,fontSize:12,padding:"6px 8px"}}>
                {["", ...MUSCLE_GROUPS].map(m=><option key={m} value={m}>{m||"Muscle..."}</option>)}
              </select>
              <select value={ex.equipment||""} onChange={e=>updateExField(i,"equipment",e.target.value)} style={{...S.inp,fontSize:12,padding:"6px 8px"}}>
                {EQUIPMENT.map(eq=><option key={eq.v} value={eq.v}>{eq.l}</option>)}
              </select>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"52px 10px 1fr",gap:6,alignItems:"center"}}>
              <input type="number" value={ex.targetSets||""} onChange={e=>updateExField(i,"targetSets",e.target.value)} placeholder="Sér." min="1" style={{...S.inp,fontSize:12,padding:"6px 6px",textAlign:"center"}}/>
              <span style={{fontSize:11,color:"var(--sm-sub)",textAlign:"center"}}>×</span>
              <input value={ex.targetReps||""} onChange={e=>updateExField(i,"targetReps",e.target.value)} placeholder="Reps (6-8, 5…)" style={{...S.inp,fontSize:12,padding:"6px 8px"}}/>
            </div>
          </div>
        ))}
        <div style={{display:"flex",gap:6,marginBottom:8,marginTop:8,flexWrap:"wrap"}}>
          <input value={newEx} onChange={e=>setNewEx(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addEx()} placeholder="Nom de l'exercice" style={{...S.inp,flex:2,minWidth:120}}/>
          <button onClick={addEx} style={{...S.btnP,whiteSpace:"nowrap"}}>+ Ajouter</button>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
          <select value={newExMuscle} onChange={e=>setNewExMuscle(e.target.value)} style={{...S.inp,flex:1,minWidth:110}}>
            {["", ...MUSCLE_GROUPS].map(m=><option key={m} value={m}>{m||"Muscle..."}</option>)}
          </select>
          <select value={newExEquip} onChange={e=>setNewExEquip(e.target.value)} style={{...S.inp,flex:1,minWidth:110}}>
            {EQUIPMENT.map(eq=><option key={eq.v} value={eq.v}>{eq.l}</option>)}
          </select>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onCancel} style={S.btnS}>Annuler</button>
          <button onClick={()=>name.trim()&&onSave({name:name.trim(),muscles,exercises})} style={S.btnP}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("home");
  const [editingProgram, setEditingProgram] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("");
  const [progressKey, setProgressKey] = useState("");
  const [activeRest, setActiveRest] = useState(null);
  const [liveNow, setLiveNow] = useState(Date.now());
  const [darkMode, setDarkMode] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [programs, setPrograms] = useState(INITIAL_PROGRAMS);
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
  const [newExEquipment, setNewExEquipment] = useState("");

  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [partnerEmail, setPartnerEmail] = useState("");
  const [partnerData, setPartnerData] = useState(null);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [partnerError, setPartnerError] = useState("");

  const S = useMemo(()=>makeStyles(),[]);
  const saveTimer = useRef(null);

  useEffect(()=>{ document.documentElement.dataset.theme = darkMode?"dark":""; },[darkMode]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function wVolume(sets){ return calcVolume((sets||[]).filter(s=>!s.isWarmup)); }

  function formatRest(ms){
    if(!ms||ms<5000)return null;
    const s=Math.floor(ms/1000);
    if(s<60)return `${s}s`;
    const m=Math.floor(s/60),rs=s%60;
    return rs>0?`${m}m${String(rs).padStart(2,"0")}`:`${m}m`;
  }

  function parseRepRange(str){
    if(!str)return[null,null];
    const parts=String(str).split("-").map(x=>parseInt(x.trim())).filter(x=>!isNaN(x));
    if(parts.length===2)return[parts[0],parts[1]];
    if(parts.length===1)return[parts[0],parts[0]];
    return[null,null];
  }

  function getWellnessMultiplier(){
    const sleep=sessionSleep||3,energy=sessionEnergy||3,avg=(sleep+energy)/2;
    if(avg<2)return 0.90; if(avg<2.5)return 0.94; if(avg<3.5)return 0.97; return 1.0;
  }

  function getLastForExercise(name,equipment){
    const sorted=[...sessions].sort((a,b)=>b.date.localeCompare(a.date));
    const lastS=sorted.find(s=>s.exercises.some(e=>e.name===name&&(e.equipment||"")===(equipment||"")));
    if(!lastS)return null;
    const ex=lastS.exercises.find(e=>e.name===name&&(e.equipment||"")===(equipment||""));
    const working=(ex.sets||[]).filter(s=>!s.isWarmup&&(s.weight||s.reps));
    const daysAgo=Math.round((Date.now()-new Date(lastS.date))/86400000);
    const maxW=Math.max(0,...working.map(s=>parseFloat(s.weight)||0));
    return{daysAgo,date:lastS.date,sets:working,maxWeight:maxW,repsPerSet:working.map(s=>parseInt(s.reps)||0)};
  }

  function getSuggestion(name,equipment,targetReps){
    const last=getLastForExercise(name,equipment);
    if(!last||!last.maxWeight)return null;
    const[minR,maxR]=parseRepRange(targetReps);
    const working=last.sets.filter(s=>s.reps);
    if(!working.length)return null;
    const mult=getWellnessMultiplier();
    let type,weight,reps,reason;
    if(maxR){
      const allAtMax=working.every(s=>(parseInt(s.reps)||0)>=maxR);
      const avgReps=Math.round(working.reduce((a,s)=>a+(parseInt(s.reps)||0),0)/working.length);
      if(allAtMax){weight=last.maxWeight+2.5;reps=minR||maxR;reason=`Toutes les séries à ${maxR} reps → poids +2.5kg`;type="weight";}
      else{weight=last.maxWeight;reps=Math.min(maxR,avgReps+1);reason=`Vise ${reps} reps (max ${maxR}) avant d'augmenter`;type="reps";}
    } else {
      const withRPE=last.sets.filter(s=>s.rpe);
      const avgRPE=withRPE.length?withRPE.reduce((a,s)=>a+(parseFloat(s.rpe)||0),0)/withRPE.length:null;
      if(!avgRPE||avgRPE<7){weight=last.maxWeight+5;type="weight";reason="RPE faible → progression +5kg";}
      else if(avgRPE<=8.5){weight=last.maxWeight+2.5;type="weight";reason="Bonne séance → +2.5kg";}
      else{weight=last.maxWeight;type="hold";reason="RPE élevé → consolide le poids actuel";}
      reps=null;
    }
    if(mult<1&&type==="weight"){const adj=Math.round(weight*mult*2)/2;return{type,weight:adj,reps,reason,wellnessNote:`Forme réduite → ${adj}kg`};}
    return{type,weight,reps,reason};
  }

  // ── Persistence ───────────────────────────────────────────────────────────
  function fullData(){
    return{sessions,programs,theme:darkMode?"dark":"",email:user?.email||"",
      draft:{exercises,sessionDate,sessionDuration,sessionNotes,sessionBodyweight,sessionRating,sessionSleep,sessionEnergy,mode,selectedProgram}};
  }

  async function searchPartner(){
    const em=partnerEmail.trim().toLowerCase();
    if(!em){setPartnerError("Saisis un email.");return;}
    if(em===user?.email?.toLowerCase()){setPartnerError("C'est ton propre profil !");return;}
    setPartnerLoading(true);setPartnerError("");setPartnerData(null);
    const d=await searchUserByEmail(em);
    setPartnerLoading(false);
    if(!d){setPartnerError("Aucun utilisateur trouvé avec cet email.");return;}
    setPartnerData(d);setTab("partner");
  }
  function applyData(d,withDraft){
    if(!d)return;
    if(d.sessions)setSessions(d.sessions);
    if(d.programs)setPrograms(d.programs);
    if(d.theme==="dark")setDarkMode(true);
    if(withDraft&&d.draft){
      const dr=d.draft;
      if(Array.isArray(dr.exercises))setExercises(dr.exercises);
      if(dr.sessionDate)setSessionDate(dr.sessionDate);
      setSessionDuration(dr.sessionDuration||"");setSessionNotes(dr.sessionNotes||"");
      setSessionBodyweight(dr.sessionBodyweight||"");
      setSessionRating(dr.sessionRating||null);setSessionSleep(dr.sessionSleep||null);setSessionEnergy(dr.sessionEnergy||null);
      if(dr.mode)setMode(dr.mode);
      if(dr.selectedProgram!==undefined)setSelectedProgram(dr.selectedProgram);
    }
  }
  function resetDraft(){
    setExercises([]);setSessionDuration("");setSessionNotes("");
    setSessionBodyweight("");setSessionRating(null);setSessionSleep(null);setSessionEnergy(null);
    setSelectedProgram(null);setSessionDate(new Date().toISOString().split("T")[0]);
  }

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(()=>{const d=loadData();if(d)applyData(d,true);setReady(true);setLoading(false);},[]);

  useEffect(()=>{
    if(!ready)return;
    if(saveTimer.current)clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{const d=fullData();saveData(d);if(user&&cloudLoaded)saveCloud(d);},400);
    return()=>{if(saveTimer.current)clearTimeout(saveTimer.current);};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sessions,programs,darkMode,exercises,sessionDate,sessionDuration,sessionNotes,sessionBodyweight,sessionRating,sessionSleep,sessionEnergy,mode,selectedProgram,ready,user,cloudLoaded]);

  useEffect(()=>{
    const h=(e)=>{if(e.key==="suivi_muscu_data"){const d=loadData();if(d)applyData(d,false);}};
    window.addEventListener("storage",h);return()=>window.removeEventListener("storage",h);
  },[]);

  useEffect(()=>{
    const{data:{subscription}}=supabase.auth.onAuthStateChange(async(event,session)=>{
      const u=session?.user??null;setUser(u);
      if(event==="INITIAL_SESSION"){setAuthReady(true);if(u)loadCloud().then(d=>{if(d)applyData(d,false);setCloudLoaded(true);});}
      if(event==="SIGNED_IN")loadCloud().then(d=>{if(d)applyData(d,false);setCloudLoaded(true);});
      if(event==="SIGNED_OUT"){clearCloudCache();setCloudLoaded(false);setSessions([]);setPrograms(INITIAL_PROGRAMS);setDarkMode(false);resetDraft();setMode("free");saveData(null);}
    });
    return()=>subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useEffect(()=>{
    if(tab!=="log")return;
    const id=setInterval(()=>setLiveNow(Date.now()),1000);
    return()=>clearInterval(id);
  },[tab]);

  // ── Actions ───────────────────────────────────────────────────────────────
  function saveProgram(data){
    if(editingProgram==="new")setPrograms(ps=>[...ps,{...data,id:Date.now()}]);
    else setPrograms(ps=>ps.map(p=>p.id===editingProgram.id?{...p,...data}:p));
    setEditingProgram(null);
  }
  function deleteProgram(id){setPrograms(ps=>ps.filter(p=>p.id!==id));setConfirmDelete(null);}
  function deleteSession(id){setSessions(ps=>ps.filter(s=>s.id!==id));setConfirmDelete(null);}

  function loadProgram(p){
    setSelectedProgram(p);
    const now=Date.now();
    setExercises(p.exercises.map((ex,i)=>{
      const name=typeof ex==="string"?ex:ex.name;
      const equipment=typeof ex==="object"&&ex.equipment?ex.equipment:"";
      const exMuscle=typeof ex==="object"&&ex.muscle?ex.muscle:null;
      const muscle=exMuscle||p.muscles[Math.min(i,p.muscles.length-1)]||MUSCLE_GROUPS[0];
      const targetSets=typeof ex==="object"&&ex.targetSets?parseInt(ex.targetSets)||1:1;
      const targetReps=typeof ex==="object"&&ex.targetReps?ex.targetReps:"";
      const sugg=getSuggestion(name,equipment,targetReps);
      const defaultWeight=sugg?String(sugg.weight):"";
      const defaultReps=targetReps?targetReps.split("-")[0]:"";
      const sets=Array.from({length:targetSets},()=>({weight:defaultWeight,reps:defaultReps,rpe:"",isWarmup:false,restMs:null}));
      return{id:now+i,name,muscle,equipment,notes:"",sets,target:{sets:targetSets,reps:targetReps}};
    }));
  }

  function repeatSession(s){
    setMode("free");setSelectedProgram({name:s.programName});
    setSessionDate(new Date().toISOString().split("T")[0]);
    setSessionDuration(s.duration?String(s.duration):"");setSessionNotes("");
    setSessionBodyweight("");setSessionRating(null);setSessionSleep(null);setSessionEnergy(null);
    const now=Date.now();
    setExercises(s.exercises.map((e,i)=>({id:now+i,name:e.name,muscle:e.muscle,equipment:e.equipment||"",notes:"",sets:(e.sets||[]).map(st=>({weight:st.weight,reps:st.reps,rpe:"",isWarmup:st.isWarmup||false,restMs:null}))})));
    setTab("log");
  }

  function addSet(id){
    const now=Date.now();
    setExercises(ex=>ex.map(e=>{
      if(e.id!==id)return e;
      let sets=e.sets;
      if(activeRest&&activeRest.exId===id){const elapsed=now-activeRest.startTime;sets=sets.map((st,i)=>i===activeRest.si?{...st,restMs:elapsed}:st);}
      return{...e,sets:[...sets,{weight:"",reps:"",rpe:"",isWarmup:false,restMs:null}]};
    }));
    if(activeRest&&activeRest.exId===id)setActiveRest(null);
  }
  function startRest(exId,si){setActiveRest({exId,si,startTime:Date.now()});}
  function stopRest(){
    if(!activeRest)return;
    const elapsed=Date.now()-activeRest.startTime;
    updateSet(activeRest.exId,activeRest.si,"restMs",elapsed);
    setActiveRest(null);
  }
  function removeSet(id,si){setExercises(ex=>ex.map(e=>e.id===id?{...e,sets:e.sets.filter((_,i)=>i!==si)}:e));}
  function updateSet(id,si,f,v){setExercises(ex=>ex.map(e=>e.id===id?{...e,sets:e.sets.map((st,i)=>i===si?{...st,[f]:v}:st)}:e));}
  function removeExercise(id){setExercises(ex=>ex.filter(e=>e.id!==id));}
  function updateExNotes(id,v){setExercises(ex=>ex.map(e=>e.id===id?{...e,notes:v}:e));}

  function addExercise(nameOverride,equipOverride){
    const name=(nameOverride||newExName).trim();if(!name)return;
    const equipment=equipOverride!==undefined?equipOverride:newExEquipment;
    let muscle=newExMuscle;
    for(const s of sessions){const f=s.exercises.find(e=>e.name===name&&(e.equipment||"")===(equipment||""));if(f){muscle=f.muscle;break;}}
    if(muscle===newExMuscle){for(const s of sessions){const f=s.exercises.find(e=>e.name===name);if(f){muscle=f.muscle;break;}}}
    setExercises(ex=>[...ex,{id:Date.now(),name,muscle,equipment,notes:"",sets:[{weight:"",reps:"",rpe:"",isWarmup:false,restMs:null}]}]);
    setNewExName("");if(equipOverride===undefined)setNewExEquipment("");
  }

  function saveSession(){
    if(!exercises.length)return;
    const clean=exercises.map(e=>({...e,sets:e.sets.filter(s=>s.weight||s.reps)})).filter(e=>e.sets.length);
    if(!clean.length)return;
    setSessions(s=>[{id:Date.now(),date:sessionDate,duration:parseInt(sessionDuration)||null,notes:sessionNotes.trim()||null,programName:selectedProgram?.name||"Séance libre",exercises:clean,bodyweight:parseFloat(sessionBodyweight)||null,rating:sessionRating,sleep:sessionSleep,energy:sessionEnergy},...s]);
    resetDraft();setMode("free");setTab("history");
  }

  function exportJSON(){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify({sessions,programs,theme:darkMode?"dark":""},null,2)],{type:"application/json"}));a.download="suivi_muscu.json";a.click();}
  function exportCSV(){
    const rows=[["Date","Programme","Exercice","Muscle","Série","Échauffement","Poids","Reps","RPE","Volume","1RM","Repos (s)"]];
    sessions.forEach(s=>s.exercises.forEach(e=>e.sets.forEach((st,si)=>{
      rows.push([s.date,s.programName,e.name,e.muscle,si+1,st.isWarmup?"oui":"non",st.weight||0,st.reps||0,st.rpe||"",(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),estimate1RM(st.weight,st.reps),st.restMs?Math.round(st.restMs/1000):""]);
    })));
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([rows.map(r=>r.map(v=>`"${v}"`).join(",")).join("\n")],{type:"text/csv"}));a.download="suivi_muscu.csv";a.click();
  }
  function importJSON(e){
    setImportError(null);setImportSuccess(false);
    const file=e.target.files?.[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(!d.sessions||!d.programs)throw new Error();applyData(d,false);setImportSuccess(true);setTimeout(()=>setImportSuccess(false),3000);}catch{setImportError("Fichier invalide.");}};
    reader.readAsText(file);e.target.value="";
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  const progressEx=progressKey?progressKey.split(":::")[0]:"";
  const progressEquip=progressKey?(progressKey.split(":::")[1]||""):"";

  const allExVariants=useMemo(()=>{
    const seen=new Set(),result=[];
    sessions.forEach(s=>s.exercises.forEach(e=>{const k=exKey(e.name,e.equipment||"");if(!seen.has(k)){seen.add(k);result.push({name:e.name,equipment:e.equipment||"",key:k});}}));
    return result.sort((a,b)=>a.name.localeCompare(b.name)||a.equipment.localeCompare(b.equipment));
  },[sessions]);

  const now=new Date(),weekStart=startOfWeek(now);

  const prSet=useMemo(()=>{
    const best={},prs=new Set();
    [...sessions].sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id).forEach(s=>s.exercises.forEach(e=>{
      const k=exKey(e.name,e.equipment||"");
      const mw=Math.max(0,...(e.sets||[]).filter(st=>!st.isWarmup).map(st=>parseFloat(st.weight)||0));
      if(mw>0&&mw>(best[k]||0)){best[k]=mw;prs.add(s.id+":"+k);}
    }));
    return prs;
  },[sessions]);

  const progressData=useMemo(()=>
    sessions.flatMap(s=>s.exercises.filter(e=>e.name===progressEx&&(e.equipment||"")===(progressEquip||"")).map(e=>{
      const working=(e.sets||[]).filter(st=>!st.isWarmup);
      const withRPE=working.filter(st=>st.rpe);
      const avgRPE=withRPE.length?Math.round(withRPE.reduce((a,st)=>a+(parseFloat(st.rpe)||0),0)/withRPE.length*10)/10:null;
      return{date:s.date,label:formatDate(s.date),maxWeight:Math.max(0,...working.map(st=>parseFloat(st.weight)||0)),volume:wVolume(e.sets),orm:Math.max(0,...working.map(st=>estimate1RM(st.weight,st.reps))),rating:s.rating,avgRPE};
    })).sort((a,b)=>a.date.localeCompare(b.date))
  ,[sessions,progressKey]);

  const bwData=useMemo(()=>
    [...sessions].filter(s=>s.bodyweight).map(s=>({date:s.date,label:formatDate(s.date),weight:parseFloat(s.bodyweight)||0})).sort((a,b)=>a.date.localeCompare(b.date))
  ,[sessions]);

  const totalVolume=Math.round(sessions.reduce((acc,s)=>acc+s.exercises.reduce((a,e)=>a+wVolume(e.sets),0),0));
  const muscleCount=sessions.reduce((acc,s)=>{s.exercises.forEach(e=>{acc[e.muscle]=(acc[e.muscle]||0)+1;});return acc;},{});
  const thisWeek=sessions.filter(s=>new Date(s.date)>=weekStart).length;
  const thisMonth=sessions.filter(s=>{const d=new Date(s.date);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}).length;
  const thisWeekVol=Math.round(sessions.filter(s=>new Date(s.date)>=weekStart).reduce((a,s)=>a+s.exercises.reduce((b,e)=>b+wVolume(e.sets),0),0));
  const durations=sessions.filter(s=>s.duration).map(s=>s.duration);
  const avgDuration=durations.length?Math.round(durations.reduce((a,b)=>a+b,0)/durations.length):null;

  const weeklyVolByMuscle=useMemo(()=>{
    const vol={};
    sessions.filter(s=>new Date(s.date)>=weekStart).forEach(s=>s.exercises.forEach(e=>{vol[e.muscle]=(vol[e.muscle]||0)+wVolume(e.sets);}));
    return vol;
  },[sessions]);

  const weeklyVolTrend=useMemo(()=>Array.from({length:6},(_,i)=>{
    const ws=new Date(weekStart);ws.setDate(ws.getDate()-(5-i)*7);
    const we=new Date(ws);we.setDate(we.getDate()+7);
    const vol=Math.round(sessions.filter(s=>{const d=new Date(s.date);return d>=ws&&d<we;}).reduce((a,s)=>a+s.exercises.reduce((b,e)=>b+wVolume(e.sets),0),0));
    return{label:ws.toLocaleDateString("fr-FR",{day:"2-digit",month:"short"}),vol,sessions:sessions.filter(s=>{const d=new Date(s.date);return d>=ws&&d<we;}).length};
  }),[sessions]);

  const sessionsByDay=useMemo(()=>{
    const days=["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"],counts=Array(7).fill(0);
    sessions.forEach(s=>{const d=new Date(s.date);counts[(d.getDay()+6)%7]++;});
    return days.map((label,i)=>({label,count:counts[i]}));
  },[sessions]);

  const wellnessStats=useMemo(()=>{
    const w=sessions.filter(s=>s.rating||s.sleep||s.energy).slice(0,30);
    if(!w.length)return null;
    const avg=f=>{const v=w.filter(s=>s[f]).map(s=>s[f]);return v.length?(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1):"—";};
    return{rating:avg("rating"),sleep:avg("sleep"),energy:avg("energy"),count:w.length};
  },[sessions]);

  const trainingStreak=useMemo(()=>{
    const weekSet=new Set(sessions.map(s=>startOfWeek(new Date(s.date)).toISOString().split("T")[0]));
    let streak=0,check=new Date(weekStart);
    if(!weekSet.has(check.toISOString().split("T")[0]))check.setDate(check.getDate()-7);
    while(weekSet.has(check.toISOString().split("T")[0])){streak++;check.setDate(check.getDate()-7);}
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
  const ratingColors=["#ef4444","#f97316","#eab308","#22c55e","#6366f1"];
  const ratingLabels=["Difficile","Moyen","Bien","Super","Excellent"];
  const recoveryColor={tired:"#e05555",recovering:"#f59e0b",fresh:"var(--sm-up)"};
  const recoveryLabel={tired:"Fatigué",recovering:"Récupération",fresh:"Prêt"};

  const editorialLine=
    trainingStreak>=5?"La constance, c'est ton superpouvoir.":
    trainingStreak>=3?"Belle régularité. Continue sur cette lancée.":
    thisWeek>=3?"Bonne semaine — les séances s'accumulent.":
    thisWeek>=1?"Chaque séance compte. La prochaine aussi.":
    sessions.length===0?"Tout commence par une première séance.":
    "C'est le moment de reprendre le rythme.";

  // ── Auth screens ──────────────────────────────────────────────────────────
  if(loading||!authReady) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"3rem",color:"var(--sm-sub)",fontSize:14,background:"var(--sm-bg)",minHeight:"100vh",fontFamily:"var(--sm-font-mono)",letterSpacing:".1em"}}>
      CHARGEMENT...
    </div>
  );

  if(!user) return (
    <div style={{minHeight:"100vh",background:"var(--sm-bg)",display:"flex",alignItems:"center",justifyContent:"center",padding:"32px 16px",boxSizing:"border-box"}}>
      <div style={{width:"min(440px,100%)"}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:72,height:72,borderRadius:22,background:"var(--sm-accent)",marginBottom:20,boxShadow:"var(--sm-shadow)"}}>
            <span style={{fontFamily:"var(--sm-font-disp)",fontSize:28,color:"var(--sm-accent-ink)",letterSpacing:"-.5px"}}>SM</span>
          </div>
          <h1 style={{fontFamily:"var(--sm-font-disp)",fontSize:36,letterSpacing:"-.01em",color:"var(--sm-ink)",margin:"0 0 10px",lineHeight:.95}}>Suivi Muscu</h1>
          <p style={{fontFamily:"var(--sm-font-serif)",fontStyle:"italic",fontSize:15,color:"var(--sm-sub)",margin:0,lineHeight:1.7}}>Enregistre tes séances · Suis ta progression<br/>Synchronisé sur tous tes appareils</p>
        </div>
        <div style={{background:"var(--sm-card)",borderRadius:24,padding:"28px 32px",boxShadow:"var(--sm-shadow)"}}><Auth T={T} S={S}/></div>
        <p style={{textAlign:"center",fontFamily:"var(--sm-font-mono)",fontSize:10,letterSpacing:".1em",color:"var(--sm-sub)",marginTop:20,textTransform:"uppercase",opacity:0.7}}>Données chiffrées · Synchronisation sécurisée</p>
      </div>
    </div>
  );

  // ── Main app ──────────────────────────────────────────────────────────────
  return (
    <div style={{paddingBottom:72,background:"var(--sm-bg)",minHeight:"100vh",color:"var(--sm-ink)"}}>
      {editingProgram!==null&&<ProgramEditor program={editingProgram==="new"?null:editingProgram} onSave={saveProgram} onCancel={()=>setEditingProgram(null)} S={S}/>}

      {confirmDelete&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:12}}>
          <div style={{background:"var(--sm-card)",borderRadius:24,padding:28,width:"min(340px,90vw)",textAlign:"center",boxShadow:"var(--sm-shadow)"}}>
            <p style={{fontSize:15,marginBottom:6,fontWeight:700,color:"var(--sm-ink)"}}>Supprimer ?</p>
            <p style={{fontSize:13,color:"var(--sm-sub)",marginBottom:24}}>{confirmDelete.name||formatDate(confirmDelete.date)}</p>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button onClick={()=>setConfirmDelete(null)} style={S.btnS}>Annuler</button>
              <button onClick={()=>confirmDelete.date?deleteSession(confirmDelete.id):deleteProgram(confirmDelete.id)} style={S.btnD}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{background:"var(--sm-card)",borderBottom:"1px solid var(--sm-line)",position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:680,margin:"0 auto",padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:34,height:34,borderRadius:10,background:"var(--sm-accent)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <span style={{fontFamily:"var(--sm-font-disp)",fontSize:13,color:"var(--sm-accent-ink)",letterSpacing:"-.5px"}}>SM</span>
            </div>
            <div>
              <div style={{fontFamily:"var(--sm-font-disp)",fontSize:16,letterSpacing:"-.01em",color:"var(--sm-ink)",lineHeight:1}}>Suivi Muscu</div>
              <div style={{fontFamily:"var(--sm-font-mono)",fontSize:9,letterSpacing:".12em",color:"var(--sm-sub)",textTransform:"uppercase",marginTop:1}}>Séances · Progression · Performances</div>
            </div>
          </div>
          <button onClick={()=>setTab(tab==="settings"?"home":"settings")} title={user.email} style={{width:34,height:34,borderRadius:"50%",background:tab==="settings"?"var(--sm-accent)":"var(--sm-accent-soft)",color:tab==="settings"?"var(--sm-accent-ink)":"var(--sm-accent)",border:"none",cursor:"pointer",fontFamily:"var(--sm-font-disp)",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {user.email[0].toUpperCase()}
          </button>
        </div>
      </div>

      <div style={{maxWidth:680,margin:"0 auto",padding:"18px 18px 0"}}>

        {/* ══ ACCUEIL ══════════════════════════════════════════════════════ */}
        {tab==="home"&&(
          <div>
            <div style={{marginBottom:22}}>
              <MonoLabel>{now.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</MonoLabel>
              <h1 style={{fontFamily:"var(--sm-font-disp)",fontSize:42,lineHeight:.92,margin:"4px 0 10px",letterSpacing:"-.01em",color:"var(--sm-ink)"}}>Bonjour.</h1>
              <p style={{fontFamily:"var(--sm-font-serif)",fontStyle:"italic",fontSize:15,color:"var(--sm-sub)",margin:0,lineHeight:1.5}}>{editorialLine}</p>
            </div>

            <div style={{...S.card,display:"flex",alignItems:"center",gap:20,marginBottom:14}}>
              <div style={{position:"relative",flexShrink:0,width:108,height:108}}>
                <Ring value={thisWeek} max={4}/>
                <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                  <span style={{fontFamily:"var(--sm-font-disp)",fontSize:30,lineHeight:.9,color:"var(--sm-ink)"}}>{thisWeek}</span>
                  <span style={{fontFamily:"var(--sm-font-mono)",fontSize:9,letterSpacing:".1em",color:"var(--sm-sub)",textTransform:"uppercase",marginTop:4}}>/ 4 sem.</span>
                </div>
              </div>
              <div style={{flex:1}}>
                <MonoLabel>Volume cette semaine</MonoLabel>
                <Hero value={thisWeekVol>=1000?(thisWeekVol/1000).toFixed(1):thisWeekVol} unit={thisWeekVol>=1000?"t":"kg"} size={40}/>
                {trainingStreak>0&&<div style={{marginTop:10,display:"flex",alignItems:"baseline",gap:5}}>
                  <span style={{fontFamily:"var(--sm-font-disp)",fontSize:22,color:"var(--sm-accent)"}}>{trainingStreak}</span>
                  <span style={{fontFamily:"var(--sm-font-mono)",fontSize:9,letterSpacing:".1em",color:"var(--sm-sub)",textTransform:"uppercase"}}>sem. consécutives</span>
                </div>}
              </div>
            </div>

            {sessions.length>0&&(()=>{
              const last=sessions[0];
              const vol=Math.round(last.exercises.reduce((a,e)=>a+wVolume(e.sets),0));
              const totalSets=last.exercises.reduce((a,e)=>a+(e.sets||[]).filter(s=>!s.isWarmup&&(s.weight||s.reps)).length,0);
              return(
                <div style={{...S.card,marginBottom:14}}>
                  <MonoLabel>Dernière séance</MonoLabel>
                  <div style={{fontFamily:"var(--sm-font-disp)",fontSize:26,lineHeight:.95,color:"var(--sm-ink)",marginBottom:5,marginTop:4}}>{last.programName}</div>
                  <div style={{fontFamily:"var(--sm-font-mono)",fontSize:10,color:"var(--sm-sub)",letterSpacing:".06em",marginBottom:14}}>{formatDate(last.date)}{last.duration?` · ${last.duration} min`:""}</div>
                  <div style={{display:"flex",gap:10,marginBottom:14}}>
                    {[["Volume",vol>=1000?`${(vol/1000).toFixed(1)}t`:`${vol}kg`],["Exercices",last.exercises.length],["Séries",totalSets]].map(([lbl,val])=>(
                      <div key={lbl} style={{textAlign:"center",background:"var(--sm-card2)",borderRadius:14,padding:"10px 0",flex:1}}>
                        <MonoLabel>{lbl}</MonoLabel>
                        <span style={{fontFamily:"var(--sm-font-disp)",fontSize:24,color:"var(--sm-ink)"}}>{val}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={()=>repeatSession(last)} style={{...S.btnS,width:"100%",textAlign:"center",padding:"10px 0"}}>Répéter cette séance</button>
                </div>
              );
            })()}

            <div style={{...S.card,marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <MonoLabel>Mes programmes</MonoLabel>
                <button onClick={()=>setTab("programs")} style={{fontSize:11,color:"var(--sm-accent)",background:"none",border:"none",cursor:"pointer",fontFamily:"var(--sm-font-mono)",letterSpacing:".06em",padding:0}}>Gérer →</button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {programs.map(p=>(
                  <button key={p.id} onClick={()=>{loadProgram(p);setTab("log");}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"var(--sm-card2)",border:"1px solid var(--sm-line)",borderRadius:16,padding:"12px 16px",cursor:"pointer",textAlign:"left",width:"100%"}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:600,color:"var(--sm-ink)",marginBottom:3}}>{p.name}</div>
                      <div style={{fontFamily:"var(--sm-font-mono)",fontSize:10,color:"var(--sm-sub)",letterSpacing:".06em"}}>{p.muscles.slice(0,3).join(" · ")}</div>
                    </div>
                    <div style={{width:30,height:30,borderRadius:"50%",background:"var(--sm-accent-soft)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--sm-accent)",fontSize:14,flexShrink:0}}>→</div>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={()=>setTab("log")} style={{...S.btnP,width:"100%",padding:15,fontSize:15,letterSpacing:".03em"}}>+ Nouvelle séance libre</button>

            <div style={{...S.card,marginTop:14}}>
              <MonoLabel>Voir la progression d'un·e partenaire</MonoLabel>
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <input type="email" placeholder="Email du partenaire" value={partnerEmail} onChange={e=>{setPartnerEmail(e.target.value);setPartnerError("");}}
                  onKeyDown={e=>e.key==="Enter"&&searchPartner()}
                  style={{...S.inp,flex:1}}/>
                <button onClick={searchPartner} disabled={partnerLoading} style={{...S.btnP,flexShrink:0,padding:"10px 18px",opacity:partnerLoading?.6:1}}>
                  {partnerLoading?"...":"Voir"}
                </button>
              </div>
              {partnerError&&<div style={{marginTop:6,fontSize:12,color:"#e05555",fontFamily:"var(--sm-font-mono)"}}>{partnerError}</div>}
            </div>
          </div>
        )}

        {/* ══ PARTENAIRE ════════════════════════════════════════════════════ */}
        {tab==="partner"&&partnerData&&(
          <div>
            <button onClick={()=>setTab("home")} style={{...S.btnS,marginBottom:16,display:"flex",alignItems:"center",gap:6}}>← Retour</button>
            <PartnerProfile data={partnerData} email={partnerEmail} S={S}/>
          </div>
        )}

        {/* ══ SÉANCE ═══════════════════════════════════════════════════════ */}
        {tab==="log"&&(
          <div>
            <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"flex-end"}}>
              <div><MonoLabel>Date</MonoLabel><input type="date" value={sessionDate} onChange={e=>setSessionDate(e.target.value)} style={{...S.inp,width:145}}/></div>
              <div><MonoLabel>Durée (min)</MonoLabel><input type="number" placeholder="60" value={sessionDuration} onChange={e=>setSessionDuration(e.target.value)} style={{...S.inp,width:80}}/></div>
              <div><MonoLabel>Mode</MonoLabel>
                <div style={{display:"flex",gap:8}}>
                  <button style={{...S.btnS,...(mode==="free"?{background:"var(--sm-accent-soft)",color:"var(--sm-accent)",borderColor:"var(--sm-accent)"}:{})}} onClick={()=>{setMode("free");setSelectedProgram(null);setExercises([]);}}>Libre</button>
                  <button style={{...S.btnS,...(mode==="program"?{background:"var(--sm-accent-soft)",color:"var(--sm-accent)",borderColor:"var(--sm-accent)"}:{})}} onClick={()=>setMode("program")}>Programme</button>
                </div>
              </div>
            </div>

            {mode==="program"&&!selectedProgram&&(
              <div style={S.card}>
                <MonoLabel>Choisir un programme</MonoLabel>
                <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:8}}>
                  {programs.map(p=>(
                    <button key={p.id} onClick={()=>loadProgram(p)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"var(--sm-card2)",border:"1px solid var(--sm-line)",borderRadius:14,padding:"12px 16px",cursor:"pointer",textAlign:"left",width:"100%"}}>
                      <div>
                        <div style={{fontWeight:600,color:"var(--sm-ink)",fontSize:14,marginBottom:2}}>{p.name}</div>
                        <div style={{fontFamily:"var(--sm-font-mono)",fontSize:10,color:"var(--sm-sub)",letterSpacing:".06em"}}>{p.muscles.join(" · ")}</div>
                      </div>
                      <div style={{color:"var(--sm-accent)",fontSize:14}}>→</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {exercises.map(ex=>{
              const last=getLastForExercise(ex.name,ex.equipment);
              const sugg=getSuggestion(ex.name,ex.equipment,ex.target?.reps);
              return(
                <div key={ex.id} style={S.card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                      <span style={{fontWeight:700,fontSize:15,color:"var(--sm-ink)"}}>{ex.name}</span>
                      <Tag>{ex.muscle}</Tag>
                      <select value={ex.equipment||""} onChange={e=>setExercises(xs=>xs.map(x=>x.id===ex.id?{...x,equipment:e.target.value}:x))} style={{fontSize:11,color:"var(--sm-sub)",background:"var(--sm-card2)",border:"1px solid var(--sm-line)",borderRadius:20,padding:"3px 8px",cursor:"pointer",outline:"none",fontFamily:"var(--sm-font-mono)",letterSpacing:".05em"}}>
                        {EQUIPMENT.map(eq=><option key={eq.v} value={eq.v}>{eq.l}</option>)}
                      </select>
                      {ex.target?.reps&&<span style={{fontSize:10,color:"var(--sm-sub)",background:"var(--sm-card2)",border:"1px solid var(--sm-line)",borderRadius:20,padding:"3px 9px",fontFamily:"var(--sm-font-mono)",letterSpacing:".05em"}}>Cible {ex.target.sets?`${ex.target.sets}×`:""} {ex.target.reps}</span>}
                    </div>
                    <button onClick={()=>removeExercise(ex.id)} style={{...S.btnS,padding:"4px 10px",fontSize:11,flexShrink:0}}>✕</button>
                  </div>

                  {last&&(
                    <div style={{fontSize:11,marginBottom:10,padding:"8px 12px",background:"var(--sm-card2)",borderRadius:12,color:"var(--sm-sub)",fontFamily:"var(--sm-font-mono)",letterSpacing:".04em"}}>
                      {last.daysAgo===0?"Aujourd'hui":last.daysAgo===1?"Hier":`Il y a ${last.daysAgo}j`} · {last.sets.length} série{last.sets.length>1?"s":""} @ <strong style={{color:"var(--sm-ink)"}}>{last.maxWeight}kg</strong>
                      {last.repsPerSet.length>0&&` — ${last.repsPerSet.join(", ")} reps`}
                    </div>
                  )}

                  {sugg&&(
                    <div style={{marginBottom:12,padding:"11px 14px",borderRadius:14,background:sugg.type==="weight"?"var(--sm-accent-soft)":sugg.type==="reps"?"rgba(245,158,11,.12)":"var(--sm-card2)",border:`1.5px solid ${sugg.type==="weight"?"var(--sm-accent)":sugg.type==="reps"?"#f59e0b":"var(--sm-line)"}`}}>
                      {sugg.type==="weight"&&<div style={{fontWeight:700,fontSize:13,color:"var(--sm-accent)"}}>↑ Augmente le poids → {sugg.weight} kg{sugg.reps?` × ${sugg.reps} reps`:""}</div>}
                      {sugg.type==="reps"&&<div style={{fontWeight:700,fontSize:13,color:"#f59e0b"}}>↑ Augmente les reps → {sugg.reps} reps @ {sugg.weight} kg</div>}
                      {sugg.type==="hold"&&<div style={{fontWeight:700,fontSize:13,color:"var(--sm-sub)"}}>→ Maintiens {sugg.weight} kg</div>}
                      <div style={{fontSize:11,color:"var(--sm-sub)",marginTop:3,fontFamily:"var(--sm-font-mono)",letterSpacing:".04em"}}>{sugg.reason}</div>
                      {sugg.wellnessNote&&<div style={{fontSize:11,color:"#e05555",marginTop:2}}>{sugg.wellnessNote}</div>}
                    </div>
                  )}

                  <div style={{display:"grid",gridTemplateColumns:"18px 22px 1fr 1fr 24px",gap:5,alignItems:"center",marginBottom:4}}>
                    {["#","W","kg","Reps",""].map((h,i)=><span key={i} style={{fontSize:9,color:"var(--sm-sub)",textAlign:"center",fontFamily:"var(--sm-font-mono)",letterSpacing:".08em",textTransform:"uppercase"}}>{h}</span>)}
                  </div>

                  {ex.sets.map((s,si)=>{
                    const isLast=si===ex.sets.length-1;
                    const isTimerActive=activeRest?.exId===ex.id&&activeRest?.si===si;
                    const liveRestStr=isTimerActive?formatRest(liveNow-activeRest.startTime)||"0s":null;
                    return(
                      <div key={si}>
                        <div style={{display:"grid",gridTemplateColumns:"18px 22px 1fr 1fr 24px",gap:5,alignItems:"center",marginBottom:1,opacity:s.isWarmup?0.6:1}}>
                          <span style={{fontSize:11,color:"var(--sm-sub)",textAlign:"center",fontFamily:"var(--sm-font-mono)"}}>{si+1}</span>
                          <button onClick={()=>updateSet(ex.id,si,"isWarmup",!s.isWarmup)} style={{fontSize:9,fontWeight:700,border:`1px solid ${s.isWarmup?"var(--sm-accent)":"var(--sm-line)"}`,borderRadius:6,padding:"2px 0",cursor:"pointer",background:s.isWarmup?"var(--sm-accent-soft)":"transparent",color:s.isWarmup?"var(--sm-accent)":"var(--sm-sub)",lineHeight:1,width:"100%",fontFamily:"var(--sm-font-mono)"}}>W</button>
                          <input type="number" placeholder="0" value={s.weight} onChange={e=>updateSet(ex.id,si,"weight",e.target.value)} style={{...S.inp,textAlign:"center",padding:"8px 4px",fontFamily:"var(--sm-font-mono)"}}/>
                          <input type="number" placeholder="0" value={s.reps} onChange={e=>updateSet(ex.id,si,"reps",e.target.value)} style={{...S.inp,textAlign:"center",padding:"8px 4px",fontFamily:"var(--sm-font-mono)"}}/>
                          <button onClick={()=>removeSet(ex.id,si)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--sm-sub)",fontSize:13}}>✕</button>
                        </div>
                        {s.restMs&&s.restMs>0?(
                          <div style={{fontSize:10,color:"var(--sm-sub)",paddingLeft:20,paddingBottom:5,display:"flex",alignItems:"center",gap:6,fontFamily:"var(--sm-font-mono)",letterSpacing:".06em"}}>
                            Repos S{si+1} : <strong style={{color:"var(--sm-ink)"}}>{formatRest(s.restMs)}</strong>
                            <button onClick={()=>updateSet(ex.id,si,"restMs",null)} style={{fontSize:9,color:"var(--sm-sub)",background:"none",border:"none",cursor:"pointer",opacity:0.5,padding:0}}>↺</button>
                          </div>
                        ):isTimerActive?(
                          <div style={{display:"flex",alignItems:"center",gap:8,paddingLeft:20,paddingBottom:6}}>
                            <span style={{fontSize:15,fontWeight:700,color:"var(--sm-accent)",fontFamily:"var(--sm-font-mono)",letterSpacing:".06em"}}>{liveRestStr}</span>
                            <button onClick={stopRest} style={{fontSize:11,color:"var(--sm-accent-ink)",background:"var(--sm-accent)",border:"none",borderRadius:10,padding:"4px 12px",cursor:"pointer",fontWeight:600}}>Arrêter</button>
                          </div>
                        ):isLast&&!activeRest?(
                          <div style={{paddingLeft:20,paddingBottom:5}}>
                            <button onClick={()=>startRest(ex.id,si)} style={{fontSize:11,color:"var(--sm-sub)",border:"1px solid var(--sm-line)",borderRadius:10,padding:"4px 12px",background:"transparent",cursor:"pointer",fontFamily:"var(--sm-font-mono)",letterSpacing:".04em"}}>Démarrer le repos</button>
                          </div>
                        ):null}
                      </div>
                    );
                  })}

                  <button onClick={()=>addSet(ex.id)} style={{...S.btnS,marginTop:8,fontSize:11}}>+ Série</button>
                  <input value={ex.notes||""} onChange={e=>updateExNotes(ex.id,e.target.value)} placeholder="Note technique…" style={{...S.inp,marginTop:8,fontSize:12,padding:"8px 12px"}}/>
                </div>
              );
            })}

            <div style={{...S.card,borderStyle:"dashed"}}>
              <p style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:"var(--sm-ink)"}}>Ajouter un exercice</p>
              {allExVariants.length>0&&(
                <>
                  <MonoLabel>Exercices récents</MonoLabel>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
                    {allExVariants.filter(v=>!exercises.find(e=>e.name===v.name&&(e.equipment||"")===(v.equipment||""))).map(v=>(
                      <button key={v.key} onClick={()=>addExercise(v.name,v.equipment)} style={{...S.btnS,fontSize:12,padding:"5px 14px"}}>
                        {v.name}{v.equipment&&<span style={{color:"var(--sm-accent)",marginLeft:5,fontFamily:"var(--sm-font-mono)",fontSize:10}}>{equipLabel(v.equipment)}</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <MonoLabel>Nouvel exercice</MonoLabel>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
                <input value={newExName} onChange={e=>setNewExName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addExercise()} placeholder="Nom de l'exercice" style={{...S.inp,flex:2,minWidth:150}}/>
                <button onClick={()=>addExercise()} style={S.btnP}>Ajouter</button>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <select value={newExMuscle} onChange={e=>setNewExMuscle(e.target.value)} style={{...S.inp,flex:1,minWidth:120}}>{MUSCLE_GROUPS.map(m=><option key={m}>{m}</option>)}</select>
                <select value={newExEquipment} onChange={e=>setNewExEquipment(e.target.value)} style={{...S.inp,flex:1,minWidth:120}}>{EQUIPMENT.map(eq=><option key={eq.v} value={eq.v}>{eq.l}</option>)}</select>
              </div>
            </div>

            {exercises.length>0&&(
              <div style={S.card}>
                <p style={{margin:"0 0 14px",fontSize:14,fontWeight:700,color:"var(--sm-ink)"}}>Bilan de séance</p>
                <div style={{display:"flex",gap:14,flexWrap:"wrap",marginBottom:14}}>
                  <div><MonoLabel>Poids de corps (kg)</MonoLabel><input type="number" placeholder="75" value={sessionBodyweight} onChange={e=>setSessionBodyweight(e.target.value)} style={{...S.inp,width:90,padding:"8px 10px"}}/></div>
                  <div><MonoLabel>Ressenti général</MonoLabel><StarRating value={sessionRating} onChange={setSessionRating}/></div>
                </div>
                <div style={{display:"flex",gap:18,flexWrap:"wrap",marginBottom:14}}>
                  <div><MonoLabel>Sommeil</MonoLabel><NumRating value={sessionSleep} onChange={setSessionSleep}/></div>
                  <div><MonoLabel>Énergie</MonoLabel><NumRating value={sessionEnergy} onChange={setSessionEnergy}/></div>
                </div>
                <MonoLabel>Notes</MonoLabel>
                <textarea value={sessionNotes} onChange={e=>setSessionNotes(e.target.value)} placeholder="Sensations, fatigue…" rows={2} style={{...S.inp,resize:"vertical",marginBottom:14}}/>
                <button onClick={saveSession} style={{...S.btnP,width:"100%",padding:14,fontSize:14}}>Enregistrer la séance</button>
              </div>
            )}
          </div>
        )}

        {/* ══ HISTORIQUE ═══════════════════════════════════════════════════ */}
        {tab==="history"&&(
          <div>
            {usedMuscles.length>0&&(
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
                <button onClick={()=>setHistoryFilter("")} style={{...S.btnS,...(historyFilter===""?{background:"var(--sm-accent-soft)",color:"var(--sm-accent)",borderColor:"var(--sm-accent)"}:{}),fontSize:12,padding:"5px 12px"}}>Tout</button>
                {usedMuscles.map(m=><button key={m} onClick={()=>setHistoryFilter(m)} style={{...S.btnS,...(historyFilter===m?{background:"var(--sm-accent-soft)",color:"var(--sm-accent)",borderColor:"var(--sm-accent)"}:{}),fontSize:12,padding:"5px 12px"}}>{m}</button>)}
              </div>
            )}
            {filteredSessions.length===0&&<p style={{color:"var(--sm-sub)",textAlign:"center",padding:"2rem 0",fontSize:14,fontFamily:"var(--sm-font-serif)",fontStyle:"italic"}}>Aucune séance.</p>}
            {filteredSessions.map(s=>{
              const vol=Math.round(s.exercises.reduce((a,e)=>a+wVolume(e.sets),0));
              const totalWorkSets=s.exercises.reduce((a,e)=>a+(e.sets||[]).filter(st=>!st.isWarmup&&(st.weight||st.reps)).length,0);
              const muscles=[...new Set(s.exercises.map(e=>e.muscle))];
              const prevSame=[...sessions].filter(ps=>ps.id!==s.id&&ps.programName===s.programName&&ps.date<s.date).sort((a,b)=>b.date.localeCompare(a.date))[0];
              const prevVol=prevSame?Math.round(prevSame.exercises.reduce((a,e)=>a+wVolume(e.sets),0)):null;
              const volDiff=prevVol!==null?vol-prevVol:null;
              const sDate=new Date(s.date);
              return(
                <div key={s.id} style={S.card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                    <div>
                      <div style={{fontFamily:"var(--sm-font-disp)",fontSize:32,lineHeight:.92,color:"var(--sm-ink)",letterSpacing:"-.01em",marginBottom:4}}>
                        {sDate.getDate()} <span style={{fontSize:18,opacity:.7}}>{sDate.toLocaleDateString("fr-FR",{month:"short"})}</span>
                      </div>
                      <div style={{fontFamily:"var(--sm-font-mono)",fontSize:10,color:"var(--sm-sub)",letterSpacing:".06em",marginBottom:2}}>{s.programName}{s.duration?` · ${s.duration} min`:""}</div>
                      {s.bodyweight&&<div style={{fontFamily:"var(--sm-font-mono)",fontSize:10,color:"var(--sm-sub)",letterSpacing:".06em"}}>{s.bodyweight} kg</div>}
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      <button onClick={()=>repeatSession(s)} style={{...S.btnS,padding:"5px 10px",fontSize:11}}>↺</button>
                      <button onClick={()=>setConfirmDelete(s)} style={{...S.btnD,padding:"5px 10px",fontSize:11}}>✕</button>
                    </div>
                  </div>

                  {(s.rating||s.sleep||s.energy)&&(
                    <div style={{display:"flex",gap:12,marginBottom:12,padding:"8px 12px",background:"var(--sm-card2)",borderRadius:12,flexWrap:"wrap",alignItems:"center"}}>
                      {s.rating&&<span style={{fontSize:13,color:ratingColors[s.rating-1],fontWeight:700}}>{ratingLabels[s.rating-1]}</span>}
                      {s.sleep&&<span style={{fontFamily:"var(--sm-font-mono)",fontSize:11,color:"var(--sm-sub)"}}>Sommeil <strong style={{color:"var(--sm-ink)"}}>{s.sleep}/5</strong></span>}
                      {s.energy&&<span style={{fontFamily:"var(--sm-font-mono)",fontSize:11,color:"var(--sm-sub)"}}>Énergie <strong style={{color:"var(--sm-ink)"}}>{s.energy}/5</strong></span>}
                    </div>
                  )}

                  <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:80,textAlign:"center",background:"var(--sm-card2)",border:"1px solid var(--sm-line)",borderRadius:12,padding:"8px 10px"}}>
                      <MonoLabel>Volume</MonoLabel>
                      <div style={{fontFamily:"var(--sm-font-disp)",fontSize:20,color:"var(--sm-accent)"}}>{vol>=1000?`${(vol/1000).toFixed(1)}t`:`${vol}kg`}</div>
                    </div>
                    <div style={{textAlign:"center",background:"var(--sm-card2)",border:"1px solid var(--sm-line)",borderRadius:12,padding:"8px 14px"}}>
                      <MonoLabel>Séries</MonoLabel>
                      <div style={{fontFamily:"var(--sm-font-disp)",fontSize:20,color:"var(--sm-ink)"}}>{totalWorkSets}</div>
                    </div>
                    {volDiff!==null&&(
                      <div style={{flex:1,minWidth:80,textAlign:"center",background:"var(--sm-card2)",border:"1px solid var(--sm-line)",borderRadius:12,padding:"8px 10px"}}>
                        <MonoLabel>vs. {formatDate(prevSame.date)}</MonoLabel>
                        <div style={{fontFamily:"var(--sm-font-disp)",fontSize:20,color:volDiff>=0?"var(--sm-up)":"#e05555"}}>{volDiff>=0?"+":""}{volDiff>=1000?`${(volDiff/1000).toFixed(1)}t`:`${volDiff}kg`}</div>
                      </div>
                    )}
                  </div>

                  <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>{muscles.map(m=><Tag key={m}>{m}</Tag>)}</div>

                  <div style={{borderTop:"1px solid var(--sm-line)",paddingTop:12}}>
                    {s.exercises.map((e,i)=>{
                      const working=(e.sets||[]).filter(st=>!st.isWarmup&&(st.weight||st.reps));
                      const warmupSets=(e.sets||[]).filter(st=>st.isWarmup&&(st.weight||st.reps));
                      const restTimes=working.filter(st=>st.restMs&&st.restMs>5000).map(st=>formatRest(st.restMs)).filter(Boolean);
                      const isPR=prSet.has(s.id+":"+exKey(e.name,e.equipment||""));
                      return(
                        <div key={i} style={{marginBottom:12,paddingBottom:12,borderBottom:i<s.exercises.length-1?"1px solid var(--sm-line)":"none"}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap"}}>
                            <span style={{fontWeight:700,fontSize:13,color:"var(--sm-ink)"}}>{e.name}</span>
                            {e.muscle&&<Tag>{e.muscle}</Tag>}
                            {e.equipment&&<span style={{fontSize:10,color:"var(--sm-sub)",background:"var(--sm-card2)",border:"1px solid var(--sm-line)",borderRadius:20,padding:"2px 8px",fontFamily:"var(--sm-font-mono)",letterSpacing:".05em"}}>{equipLabel(e.equipment)}</span>}
                            {isPR&&<span style={{fontSize:10,color:"#f59e0b",fontWeight:700,background:"rgba(245,158,11,.15)",border:"1px solid #f59e0b",borderRadius:20,padding:"2px 7px",fontFamily:"var(--sm-font-mono)"}}>PR</span>}
                          </div>
                          {working.length>0&&(
                            <div style={{fontSize:12,color:"var(--sm-ink)",marginBottom:5,lineHeight:2,fontFamily:"var(--sm-font-mono)",letterSpacing:".02em"}}>
                              {working.map((st,j)=>(
                                <span key={j} style={{display:"inline-block",marginRight:7,whiteSpace:"nowrap",background:"var(--sm-card2)",borderRadius:8,padding:"2px 8px",border:"1px solid var(--sm-line)"}}>
                                  <strong>{st.weight||"—"}</strong>×<strong>{st.reps||"—"}</strong>
                                </span>
                              ))}
                            </div>
                          )}
                          {warmupSets.length>0&&<div style={{fontSize:11,color:"var(--sm-sub)",marginBottom:4,fontFamily:"var(--sm-font-mono)"}}>W: {warmupSets.map(st=>`${st.weight||"—"}×${st.reps||"—"}`).join(" · ")}</div>}
                          {restTimes.length>0&&<div style={{fontFamily:"var(--sm-font-mono)",fontSize:11,color:"var(--sm-sub)",letterSpacing:".04em"}}>Repos {restTimes.join(" · ")}</div>}
                          {e.notes&&<div style={{fontSize:11,color:"var(--sm-sub)",marginTop:4,fontFamily:"var(--sm-font-serif)",fontStyle:"italic"}}>{e.notes}</div>}
                        </div>
                      );
                    })}
                  </div>
                  {s.notes&&<div style={{borderTop:"1px solid var(--sm-line)",paddingTop:8,fontSize:12,color:"var(--sm-sub)",fontFamily:"var(--sm-font-serif)",fontStyle:"italic"}}>{s.notes}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* ══ PROGRESSION ══════════════════════════════════════════════════ */}
        {tab==="progress"&&(
          <div>
            {bwData.length>=2&&(
              <div style={S.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <p style={{margin:0,fontSize:14,fontWeight:700,color:"var(--sm-ink)"}}>Poids de corps</p>
                  <div style={{display:"flex",gap:10,fontFamily:"var(--sm-font-mono)",fontSize:11,color:"var(--sm-sub)"}}>
                    <span>Min <strong style={{color:"var(--sm-ink)"}}>{Math.min(...bwData.map(d=>d.weight))}kg</strong></span>
                    <span style={{color:"var(--sm-accent)",fontWeight:700}}>{bwData[bwData.length-1].weight}kg</span>
                  </div>
                </div>
                <div style={{width:"100%",height:160}}>
                  <ResponsiveContainer><LineChart data={bwData} margin={{top:4,right:10,left:-20,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--sm-line)"/>
                    <XAxis dataKey="label" tick={{fontSize:10,fill:"var(--sm-sub)",fontFamily:"var(--sm-font-mono)"}} stroke="var(--sm-line)"/>
                    <YAxis tick={{fontSize:10,fill:"var(--sm-sub)"}} stroke="var(--sm-line)" domain={["auto","auto"]}/>
                    <Tooltip contentStyle={{background:"var(--sm-card)",border:"1px solid var(--sm-line)",borderRadius:14,fontSize:12,color:"var(--sm-ink)"}}/>
                    <Line type="monotone" dataKey="weight" name="Poids (kg)" stroke="var(--sm-accent)" strokeWidth={2.5} dot={{r:4,fill:"var(--sm-accent)"}}/>
                  </LineChart></ResponsiveContainer>
                </div>
              </div>
            )}

            <div style={{marginBottom:16}}>
              <MonoLabel>Exercice à analyser</MonoLabel>
              <select value={progressKey} onChange={e=>setProgressKey(e.target.value)} style={S.inp}>
                <option value="">-- Choisir un exercice --</option>
                {allExVariants.map(v=><option key={v.key} value={v.key}>{v.name}{v.equipment?` — ${equipLabel(v.equipment)}`:""}</option>)}
              </select>
            </div>

            {progressEx&&progressData.length>0&&(()=>{
              const best=progressData.reduce((b,d)=>d.orm>b.orm?d:b,progressData[0]);
              const last=progressData[progressData.length-1];
              const prev=progressData.length>=2?progressData[progressData.length-2]:null;
              const diff=prev?(last.maxWeight-prev.maxWeight):null;
              return(
                <>
                  <div style={{...S.card,marginBottom:12}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:0}}>
                      {[
                        {label:"Record",value:`${Math.max(...progressData.map(d=>d.maxWeight))} kg`,sub:formatDate(best.date)},
                        {label:"1RM estimé",value:`${Math.max(...progressData.map(d=>d.orm))} kg`,sub:"Brzycki"},
                        {label:"vs. dernière",value:diff===null?"—":diff>=0?`+${diff} kg`:`${diff} kg`,sub:prev?formatDate(prev.date):"",accent:diff===null?"var(--sm-sub)":diff>0?"var(--sm-up)":diff<0?"#e05555":"var(--sm-sub)"},
                      ].map(({label,value,sub,accent},i)=>(
                        <div key={i} style={{textAlign:"center",padding:"8px 0",borderRight:i<2?"1px solid var(--sm-line)":"none"}}>
                          <div style={{fontFamily:"var(--sm-font-mono)",fontSize:9,color:"var(--sm-sub)",letterSpacing:".12em",textTransform:"uppercase",marginBottom:6}}>{label}</div>
                          <div style={{fontFamily:"var(--sm-font-disp)",fontSize:22,color:accent||"var(--sm-accent)",letterSpacing:"-.01em"}}>{value}</div>
                          {sub&&<div style={{fontFamily:"var(--sm-font-mono)",fontSize:9,color:"var(--sm-sub)",marginTop:2}}>{sub}</div>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={S.card}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <p style={{margin:0,fontSize:14,fontWeight:700,color:"var(--sm-ink)"}}>Évolution du poids</p>
                    </div>
                    <div style={{width:"100%",height:220}}>
                      <ResponsiveContainer><LineChart data={progressData} margin={{top:5,right:10,left:-10,bottom:0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--sm-line)"/>
                        <XAxis dataKey="label" tick={{fontSize:10,fill:"var(--sm-sub)",fontFamily:"var(--sm-font-mono)"}} stroke="var(--sm-line)"/>
                        <YAxis tick={{fontSize:11,fill:"var(--sm-sub)"}} stroke="var(--sm-line)"/>
                        <Tooltip contentStyle={{background:"var(--sm-card)",border:"1px solid var(--sm-line)",borderRadius:14,fontSize:12,color:"var(--sm-ink)"}}
                          formatter={(val,name,{payload})=>[`${val} kg${name==="Poids max"&&payload.avgRPE?` (RPE ${payload.avgRPE})`:""}`,name]}/>
                        <Line type="monotone" dataKey="maxWeight" name="Poids max" stroke="var(--sm-accent)" strokeWidth={2.5}
                          dot={(props)=>{const{cx,cy,payload}=props;const r=payload.rating;const fill=r?ratingColors[r-1]:"var(--sm-accent)";return<circle key={`d${props.index}`} cx={cx} cy={cy} r={5} fill={fill} stroke="var(--sm-card)" strokeWidth={2}/>;}}/>
                        <Line type="monotone" dataKey="orm" name="1RM estimé" stroke="var(--sm-up)" strokeWidth={1.5} strokeDasharray="5 3" dot={{r:2,fill:"var(--sm-up)"}}/>
                      </LineChart></ResponsiveContainer>
                    </div>
                    <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
                      {[1,2,3,4,5].map(n=><span key={n} style={{fontFamily:"var(--sm-font-mono)",fontSize:9,color:"var(--sm-sub)",display:"flex",alignItems:"center",gap:3,letterSpacing:".06em"}}><span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:ratingColors[n-1]}}></span>{ratingLabels[n-1]}</span>)}
                    </div>
                  </div>

                  <div style={S.card}>
                    <p style={{margin:"0 0 12px",fontSize:14,fontWeight:700,color:"var(--sm-ink)"}}>Volume par séance</p>
                    <div style={{width:"100%",height:150}}>
                      <ResponsiveContainer><BarChart data={progressData} margin={{top:4,right:10,left:-20,bottom:0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--sm-line)" vertical={false}/>
                        <XAxis dataKey="label" tick={{fontSize:10,fill:"var(--sm-sub)",fontFamily:"var(--sm-font-mono)"}} stroke="var(--sm-line)"/>
                        <YAxis tick={{fontSize:10,fill:"var(--sm-sub)"}} stroke="var(--sm-line)"/>
                        <Tooltip contentStyle={{background:"var(--sm-card)",border:"1px solid var(--sm-line)",borderRadius:14,fontSize:12,color:"var(--sm-ink)"}} formatter={v=>[`${Math.round(v)} kg`,"Volume"]}/>
                        <Bar dataKey="volume" radius={[6,6,0,0]}>
                          {progressData.map((d,i)=><Cell key={i} fill={d.rating?ratingColors[d.rating-1]:"var(--sm-accent)"} opacity={0.85}/>)}
                        </Bar>
                      </BarChart></ResponsiveContainer>
                    </div>
                  </div>

                  <div style={S.card}>
                    <p style={{margin:"0 0 12px",fontSize:14,fontWeight:700,color:"var(--sm-ink)"}}>Historique détaillé</p>
                    <div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",fontSize:12,borderCollapse:"collapse",minWidth:360}}>
                        <thead><tr style={{borderBottom:"1px solid var(--sm-line)"}}>
                          {["Date","Poids","Volume","1RM","RPE","Forme"].map(h=><th key={h} style={{textAlign:"left",padding:"4px 8px",color:"var(--sm-sub)",fontWeight:400,whiteSpace:"nowrap",fontFamily:"var(--sm-font-mono)",fontSize:10,letterSpacing:".08em",textTransform:"uppercase"}}>{h}</th>)}
                        </tr></thead>
                        <tbody>{[...progressData].reverse().map((d,i)=>(
                          <tr key={i} style={{borderBottom:"1px solid var(--sm-line)"}}>
                            <td style={{padding:"7px 8px",color:"var(--sm-ink)",fontFamily:"var(--sm-font-mono)",fontSize:11}}>{formatDate(d.date)}</td>
                            <td style={{padding:"7px 8px",fontFamily:"var(--sm-font-disp)",fontSize:16,color:"var(--sm-accent)"}}>{d.maxWeight}</td>
                            <td style={{padding:"7px 8px",color:"var(--sm-sub)",fontFamily:"var(--sm-font-mono)",fontSize:11}}>{Math.round(d.volume)}kg</td>
                            <td style={{padding:"7px 8px",color:"var(--sm-sub)",fontFamily:"var(--sm-font-mono)",fontSize:11}}>{d.orm}kg</td>
                            <td style={{padding:"7px 8px",color:"var(--sm-sub)",fontFamily:"var(--sm-font-mono)",fontSize:11}}>{d.avgRPE||"—"}</td>
                            <td style={{padding:"7px 8px"}}>{d.rating?<span style={{color:ratingColors[d.rating-1],fontWeight:600,fontSize:11}}>{ratingLabels[d.rating-1]}</span>:"—"}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                </>
              );
            })()}
            {!progressEx&&bwData.length<2&&<p style={{color:"var(--sm-sub)",textAlign:"center",padding:"2rem 0",fontFamily:"var(--sm-font-serif)",fontStyle:"italic",fontSize:14}}>Sélectionnez un exercice ou enregistrez votre poids lors de vos séances.</p>}
            {progressEx&&progressData.length===0&&<p style={{color:"var(--sm-sub)",textAlign:"center",padding:"2rem 0",fontFamily:"var(--sm-font-serif)",fontStyle:"italic",fontSize:14}}>Aucune donnée pour cet exercice.</p>}
          </div>
        )}

        {/* ══ STATS ════════════════════════════════════════════════════════ */}
        {tab==="stats"&&(
          <div>
            <div style={{...S.card,marginBottom:14}}>
              <MonoLabel>Volume total soulevé</MonoLabel>
              <Hero value={totalVolume>=1000?(totalVolume/1000).toFixed(1):totalVolume} unit={totalVolume>=1000?"tonnes":"kg"} size={52}/>
              <p style={{fontFamily:"var(--sm-font-serif)",fontStyle:"italic",fontSize:13,color:"var(--sm-sub)",margin:"8px 0 0"}}>{sessions.length} séance{sessions.length>1?"s":" enregistrée"} au total</p>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              {[
                {label:"Cette semaine",value:thisWeek},
                {label:"Ce mois",value:thisMonth},
                {label:"Streak",value:trainingStreak,sub:"semaines"},
                {label:"Durée moy.",value:avgDuration||"—",sub:avgDuration?"min":""},
              ].map(({label,value,sub})=>(
                <div key={label} style={{background:"var(--sm-card)",border:"1px solid var(--sm-line)",borderRadius:16,padding:"14px 16px",boxShadow:"var(--sm-shadow)"}}>
                  <MonoLabel>{label}</MonoLabel>
                  <div style={{fontFamily:"var(--sm-font-disp)",fontSize:28,color:"var(--sm-ink)"}}>{value}</div>
                  {sub&&<div style={{fontFamily:"var(--sm-font-mono)",fontSize:9,color:"var(--sm-sub)",letterSpacing:".08em",marginTop:2,textTransform:"uppercase"}}>{sub}</div>}
                </div>
              ))}
            </div>

            {weeklyVolTrend.some(w=>w.vol>0)&&(
              <div style={S.card}>
                <p style={{margin:"0 0 12px",fontSize:14,fontWeight:700,color:"var(--sm-ink)"}}>Volume par semaine</p>
                <div style={{width:"100%",height:150}}>
                  <ResponsiveContainer><BarChart data={weeklyVolTrend} margin={{top:4,right:10,left:-20,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--sm-line)" vertical={false}/>
                    <XAxis dataKey="label" tick={{fontSize:10,fill:"var(--sm-sub)",fontFamily:"var(--sm-font-mono)"}} stroke="var(--sm-line)"/>
                    <YAxis tick={{fontSize:10,fill:"var(--sm-sub)"}} stroke="var(--sm-line)"/>
                    <Tooltip contentStyle={{background:"var(--sm-card)",border:"1px solid var(--sm-line)",borderRadius:14,fontSize:12,color:"var(--sm-ink)"}}
                      formatter={(v,_,{payload})=>[`${(v/1000).toFixed(1)} t · ${payload.sessions} séance${payload.sessions>1?"s":""}`,""]}/>
                    <Bar dataKey="vol" radius={[6,6,0,0]} fill="var(--sm-accent)" opacity={0.85}/>
                  </BarChart></ResponsiveContainer>
                </div>
              </div>
            )}

            {sessions.length>=5&&(
              <div style={S.card}>
                <p style={{margin:"0 0 4px",fontSize:14,fontWeight:700,color:"var(--sm-ink)"}}>Jours préférés</p>
                <p style={{margin:"0 0 14px",fontFamily:"var(--sm-font-serif)",fontStyle:"italic",fontSize:12,color:"var(--sm-sub)"}}>Distribution de tes séances sur la semaine</p>
                <div style={{display:"flex",gap:6,alignItems:"flex-end",height:80}}>
                  {sessionsByDay.map((d,i)=>{
                    const max=Math.max(...sessionsByDay.map(x=>x.count),1);
                    const pct=d.count/max,isTop=d.count===Math.max(...sessionsByDay.map(x=>x.count))&&d.count>0;
                    return(
                      <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                        <span style={{fontFamily:"var(--sm-font-mono)",fontSize:10,color:"var(--sm-sub)",fontWeight:isTop?700:400}}>{d.count||""}</span>
                        <div style={{width:"100%",height:Math.max(4,pct*56),background:isTop?"var(--sm-accent)":"var(--sm-line)",borderRadius:"6px 6px 0 0",transition:"height 0.3s"}}/>
                        <span style={{fontFamily:"var(--sm-font-mono)",fontSize:9,letterSpacing:".06em",color:isTop?"var(--sm-accent)":"var(--sm-sub)",textTransform:"uppercase"}}>{d.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {wellnessStats&&(
              <div style={S.card}>
                <p style={{margin:"0 0 4px",fontSize:14,fontWeight:700,color:"var(--sm-ink)"}}>Forme & récupération</p>
                <p style={{margin:"0 0 14px",fontFamily:"var(--sm-font-serif)",fontStyle:"italic",fontSize:12,color:"var(--sm-sub)"}}>Basé sur tes {wellnessStats.count} dernières séances renseignées</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  {[{label:"Ressenti",val:wellnessStats.rating},{label:"Sommeil",val:wellnessStats.sleep},{label:"Énergie",val:wellnessStats.energy}].map(({label,val})=>(
                    <div key={label} style={{textAlign:"center",padding:12,background:"var(--sm-card2)",borderRadius:14,border:"1px solid var(--sm-line)"}}>
                      <MonoLabel>{label}</MonoLabel>
                      <div style={{fontFamily:"var(--sm-font-disp)",fontSize:26,color:val==="—"?"var(--sm-sub)":parseFloat(val)>=4?"var(--sm-up)":parseFloat(val)>=3?"#f59e0b":"#e05555"}}>{val}{val!=="—"&&<span style={{fontFamily:"var(--sm-font-mono)",fontSize:12,color:"var(--sm-sub)"}}>/5</span>}</div>
                      {val!=="—"&&<div style={{height:3,background:"var(--sm-line)",borderRadius:99,marginTop:8}}><div style={{width:`${(parseFloat(val)/5)*100}%`,height:"100%",background:parseFloat(val)>=4?"var(--sm-up)":parseFloat(val)>=3?"#f59e0b":"#e05555",borderRadius:99}}/></div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(weeklyVolByMuscle).length>0&&(
              <div style={S.card}>
                <p style={{margin:"0 0 12px",fontSize:14,fontWeight:700,color:"var(--sm-ink)"}}>Volume cette semaine par muscle</p>
                {Object.entries(weeklyVolByMuscle).sort((a,b)=>b[1]-a[1]).map(([muscle,vol])=>{
                  const max=Math.max(...Object.values(weeklyVolByMuscle));
                  return<div key={muscle} style={{marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                      <span style={{color:"var(--sm-ink)"}}>{muscle}</span>
                      <span style={{fontFamily:"var(--sm-font-mono)",fontSize:10,color:"var(--sm-sub)"}}>{vol>=1000?(vol/1000).toFixed(1)+" t":Math.round(vol)+" kg"}</span>
                    </div>
                    <div style={{background:"var(--sm-card2)",borderRadius:99,height:6}}><div style={{width:`${(vol/max)*100}%`,background:"var(--sm-accent)",borderRadius:99,height:6}}/></div>
                  </div>;
                })}
              </div>
            )}

            {sessions.length>0&&(
              <div style={S.card}>
                <p style={{margin:"0 0 4px",fontSize:14,fontWeight:700,color:"var(--sm-ink)"}}>Récupération musculaire</p>
                <p style={{margin:"0 0 12px",fontFamily:"var(--sm-font-serif)",fontStyle:"italic",fontSize:12,color:"var(--sm-sub)"}}>–24h fatigué · 24–48h récupération · +48h prêt</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {MUSCLE_GROUPS.map(muscle=>{
                    const r=muscleRecovery[muscle];
                    const col=r.hours===null?"var(--sm-sub)":recoveryColor[r.status];
                    const label=r.hours===null?"—":recoveryLabel[r.status];
                    const pct=r.hours===null?0:r.status==="fresh"?100:r.status==="recovering"?Math.round((r.hours/48)*100):Math.round((r.hours/24)*40);
                    return<div key={muscle} style={{padding:"8px 10px",background:"var(--sm-card2)",borderRadius:12,border:"1px solid var(--sm-line)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:11,color:"var(--sm-ink)",fontWeight:500}}>{muscle}</span>
                        <span style={{fontFamily:"var(--sm-font-mono)",fontSize:9,color:col,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em"}}>{label}</span>
                      </div>
                      <div style={{background:"var(--sm-line)",borderRadius:99,height:3}}><div style={{width:`${pct}%`,height:"100%",background:col,borderRadius:99}}/></div>
                      {r.hours!==null&&<div style={{fontFamily:"var(--sm-font-mono)",fontSize:9,color:"var(--sm-sub)",marginTop:2,letterSpacing:".04em"}}>{r.hours<1?"< 1h":r.hours<24?`${r.hours}h`:`${Math.round(r.hours/24)}j`}</div>}
                    </div>;
                  })}
                </div>
              </div>
            )}

            {Object.keys(muscleCount).length>0&&(
              <div style={S.card}>
                <p style={{margin:"0 0 12px",fontSize:14,fontWeight:700,color:"var(--sm-ink)"}}>Groupes musculaires (total)</p>
                {Object.entries(muscleCount).sort((a,b)=>b[1]-a[1]).map(([muscle,count])=>{
                  const max=Math.max(...Object.values(muscleCount));
                  return<div key={muscle} style={{marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                      <span style={{color:"var(--sm-ink)"}}>{muscle}</span>
                      <span style={{fontFamily:"var(--sm-font-mono)",fontSize:10,color:"var(--sm-sub)"}}>{count} séance{count>1?"s":""}</span>
                    </div>
                    <div style={{background:"var(--sm-card2)",borderRadius:99,height:6}}><div style={{width:`${(count/max)*100}%`,background:"var(--sm-accent)",borderRadius:99,height:6}}/></div>
                  </div>;
                })}
              </div>
            )}
            {sessions.length===0&&<p style={{color:"var(--sm-sub)",textAlign:"center",padding:"2rem 0",fontFamily:"var(--sm-font-serif)",fontStyle:"italic",fontSize:14}}>Commencez par enregistrer une séance !</p>}
          </div>
        )}

        {/* ══ PROGRAMMES ═══════════════════════════════════════════════════ */}
        {tab==="programs"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <p style={{margin:0,fontFamily:"var(--sm-font-mono)",fontSize:11,color:"var(--sm-sub)",letterSpacing:".08em",textTransform:"uppercase"}}>{programs.length} programme{programs.length>1?"s":""}</p>
              <button onClick={()=>setEditingProgram("new")} style={S.btnP}>+ Nouveau</button>
            </div>
            {programs.map(p=>(
              <div key={p.id} style={S.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div>
                    <div style={{fontFamily:"var(--sm-font-disp)",fontSize:22,letterSpacing:"-.01em",color:"var(--sm-ink)",lineHeight:.95,marginBottom:8}}>{p.name}</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{p.muscles.map(m=><Tag key={m}>{m}</Tag>)}</div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <button onClick={()=>setEditingProgram(p)} style={{...S.btnS,padding:"6px 12px",fontSize:12}}>Modifier</button>
                    <button onClick={()=>setConfirmDelete(p)} style={{...S.btnD,padding:"6px 12px",fontSize:12}}>Suppr.</button>
                  </div>
                </div>
                <div style={{borderTop:"1px solid var(--sm-line)",paddingTop:10}}>
                  <MonoLabel>Exercices ({p.exercises.length})</MonoLabel>
                  {p.exercises.map((ex,i)=>{
                    const name=typeof ex==="string"?ex:ex.name;
                    const muscle=typeof ex==="object"&&ex.muscle?ex.muscle:"";
                    const sets=typeof ex==="object"&&ex.targetSets?ex.targetSets:"";
                    const reps=typeof ex==="object"&&ex.targetReps?ex.targetReps:"";
                    return(
                      <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:12,marginBottom:5,padding:"5px 0",borderBottom:i<p.exercises.length-1?"1px solid var(--sm-line)":"none"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{color:"var(--sm-ink)",fontWeight:500}}>{name}</span>
                          {muscle&&<span style={{fontSize:9,color:"var(--sm-sub)",background:"var(--sm-card2)",padding:"2px 7px",borderRadius:20,border:"1px solid var(--sm-line)",fontFamily:"var(--sm-font-mono)",letterSpacing:".06em",textTransform:"uppercase"}}>{muscle}</span>}
                        </div>
                        {(sets||reps)&&<span style={{fontFamily:"var(--sm-font-mono)",fontSize:10,color:"var(--sm-sub)"}}>{sets?`${sets}× `:""}{reps}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ SETTINGS ═════════════════════════════════════════════════════ */}
        {tab==="settings"&&(
          <div>
            <div style={S.card}>
              <MonoLabel>Mon compte</MonoLabel>
              <p style={{fontSize:14,fontWeight:600,color:"var(--sm-ink)",marginBottom:4}}>{user.email}</p>
              <p style={{fontSize:12,color:"var(--sm-sub)",marginBottom:14,fontFamily:"var(--sm-font-serif)",fontStyle:"italic"}}>Tes données sont synchronisées automatiquement entre tes appareils.</p>
              <button onClick={()=>supabase.auth.signOut()} style={{...S.btnD,padding:"9px 18px"}}>Se déconnecter</button>
            </div>

            <div style={S.card}>
              <MonoLabel>Apparence</MonoLabel>
              <div style={{display:"flex",background:"var(--sm-card2)",borderRadius:16,padding:4,gap:4}}>
                {[{k:false,l:"Clair"},{k:true,l:"Sombre"}].map(({k,l})=>(
                  <button key={l} onClick={()=>setDarkMode(k)} style={{flex:1,padding:"10px 0",borderRadius:12,border:"none",cursor:"pointer",fontSize:13,fontWeight:darkMode===k?700:400,color:darkMode===k?"var(--sm-accent)":"var(--sm-sub)",background:darkMode===k?"var(--sm-card)":"transparent",boxShadow:darkMode===k?"var(--sm-shadow)":"none",transition:"all 0.15s"}}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div style={S.card}>
              <MonoLabel>Sauvegarde & données</MonoLabel>
              <p style={{fontSize:12,color:"var(--sm-sub)",marginBottom:14,fontFamily:"var(--sm-font-serif)",fontStyle:"italic"}}>Tes données sont enregistrées automatiquement. Exporte pour transférer ou archiver.</p>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:10}}>
                <button onClick={exportJSON} style={S.btnP}>Export JSON</button>
                <button onClick={exportCSV} style={{...S.btnS,padding:"10px 18px"}}>Export CSV</button>
              </div>
              <label style={{...S.btnS,padding:"10px 18px",display:"inline-block",cursor:"pointer"}}>Importer JSON<input type="file" accept=".json" onChange={importJSON} style={{display:"none"}}/></label>
              {importSuccess&&<p style={{margin:"10px 0 0",fontSize:12,color:"var(--sm-up)"}}>Import réussi !</p>}
              {importError&&<p style={{margin:"10px 0 0",fontSize:12,color:"#e05555"}}>{importError}</p>}
            </div>
          </div>
        )}

      </div>

      <BottomNav tab={tab} setTab={setTab}/>
    </div>
  );
}
