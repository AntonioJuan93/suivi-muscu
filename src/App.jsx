import { useState, useEffect, useMemo, useRef } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend } from "recharts";
import { MUSCLE_GROUPS, INITIAL_PROGRAMS, T, makeStyles, formatDate, calcVolume, estimate1RM, startOfWeek } from "./theme";
import { loadData, saveData } from "./storage";
import { supabase } from "./supabase";
import { loadCloud, saveCloud, clearCloudCache, searchUserByEmail, fetchAllUsers, createBackup, listBackups, restoreBackup } from "./cloud";
import { EXERCISE_DB } from "./exercises";
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
function gripKey(g){ if(!g)return""; return[g.orientation,g.barPos,g.width,g.barType,g.handle].filter(Boolean).join("-"); }
function exKey(name,equip,grip,unilateral){ return name+(equip?":::"+equip:"")+(gripKey(grip)?":::"+gripKey(grip):"")+(unilateral?":::unil":""); }

const GRIP_CONFIGS = {
  push:  { sections:[
    {key:"orientation",label:"Orientation",opts:[{v:"",l:"—"},{v:"pronation",l:"Pronation"},{v:"supination",l:"Supination"},{v:"neutre",l:"Neutre"}]},
    {key:"width",label:"Largeur",opts:[{v:"",l:"—"},{v:"etroit",l:"Étroite"},{v:"normal",l:"Normale"},{v:"large",l:"Large"}]},
    {key:"barType",label:"Barre",opts:[{v:"",l:"—"},{v:"droite",l:"Droite"},{v:"ez",l:"EZ"},{v:"trap",l:"Trap bar"}]},
  ]},
  pull:  { sections:[
    {key:"orientation",label:"Orientation",opts:[{v:"",l:"—"},{v:"pronation",l:"Surpaume"},{v:"supination",l:"Sous-main"},{v:"neutre",l:"Neutre (hammer)"}]},
    {key:"width",label:"Largeur",opts:[{v:"",l:"—"},{v:"etroit",l:"Étroite"},{v:"normal",l:"Normale"},{v:"large",l:"Large"}]},
    {key:"handle",label:"Poignée",opts:[{v:"",l:"—"},{v:"barre",l:"Barre"},{v:"corde",l:"Corde"},{v:"triangle",l:"Triangle"},{v:"anses",l:"Anses"}]},
  ]},
  squat: { sections:[
    {key:"barPos",label:"Position barre",opts:[{v:"",l:"—"},{v:"haute",l:"Haute (trap. sup.)"},{v:"basse",l:"Basse (trap. rétro.)"},{v:"avant",l:"Avant (front squat)"},{v:"zercher",l:"Zercher"}]},
    {key:"width",label:"Écartement pieds",opts:[{v:"",l:"—"},{v:"etroit",l:"Étroit"},{v:"normal",l:"Normal"},{v:"large",l:"Large"},{v:"sumo",l:"Sumo"}]},
  ]},
  hinge: { sections:[
    {key:"orientation",label:"Prise barre",opts:[{v:"",l:"—"},{v:"surrpaume",l:"Surrpaume"},{v:"mixte",l:"Mixte"},{v:"crochet",l:"Crochet (hook)"}]},
    {key:"width",label:"Position pieds",opts:[{v:"",l:"—"},{v:"normal",l:"Normal"},{v:"large",l:"Large"},{v:"sumo",l:"Sumo"}]},
  ]},
  curl:  { sections:[
    {key:"orientation",label:"Rotation",opts:[{v:"",l:"—"},{v:"supination",l:"Supination (bicep)"},{v:"neutre",l:"Neutre (marteau)"},{v:"pronation",l:"Pronation (reverse)"}]},
  ]},
  tri:   { sections:[
    {key:"handle",label:"Poignée",opts:[{v:"",l:"—"},{v:"corde",l:"Corde"},{v:"droite",l:"Barre droite"},{v:"ez",l:"Barre EZ"},{v:"anse",l:"Anse seule"}]},
  ]},
  legs:  { sections:[
    {key:"width",label:"Écartement",opts:[{v:"",l:"—"},{v:"etroit",l:"Étroit"},{v:"normal",l:"Normal"},{v:"large",l:"Large"},{v:"sumo",l:"Sumo"}]},
  ]},
  none:  { sections:[] },
};

const GRIP_PROFILE_LABELS = {
  push:  {label:"Poussée",     desc:"Bench, développé, OHP"},
  pull:  {label:"Tirage",      desc:"Rowing, tractions, tirage poulie"},
  squat: {label:"Squat",       desc:"Squat, fentes bulgares, hack squat"},
  hinge: {label:"Soulevé",     desc:"Deadlift, RDL, good morning"},
  curl:  {label:"Curl",        desc:"Biceps, marteau, reverse"},
  tri:   {label:"Triceps",     desc:"Extensions, barre au front, kickback"},
  legs:  {label:"Jambes / Core",desc:"Leg press, hip thrust, abdos"},
  none:  {label:"Aucune",      desc:"Pas d'options de prise"},
};

function getGripProfile(ex){
  if(ex?.gripProfile) return ex.gripProfile;     // override manuel prioritaire
  if(!ex) return "push";
  const n=(ex.name||"").toLowerCase();
  const m=(ex.muscle||"").toLowerCase();

  // ── Squat pattern
  if(n.includes("squat")||n.includes("hack squat")||n.includes("gobelet")||n.includes("bulgares")||n.includes("zercher")) return"squat";
  // ── Hinge pattern
  if(n.includes("soulevé")||n.includes("deadlift")||n.includes("sl deadlift")||n.includes("roumain")||n.includes("romanian")||n.includes("good morning")||n.includes("hyperextension")||n.includes("nordic")||n.includes("jefferson")) return"hinge";
  // ── Curl / biceps
  if(n.includes("curl")||n.includes("zottman")||n.includes("biceps poulie")||n.includes("reverse curl")) return"curl";
  // ── Triceps
  if(n.includes("dips triceps")||n.includes("extension triceps")||n.includes("barre au front")||n.includes("kickback triceps")||n.includes("skull crusher")||(n.includes("triceps")&&!n.includes("développé")&&!n.includes("dips"))) return"tri";
  // ── Lower body / core
  if(n.includes("fentes")||n.includes("presse à cuisses")||n.includes("leg extension")||n.includes("leg curl")||n.includes("abduction")||n.includes("kickback fessier")||n.includes("hip abduction")||n.includes("hip thrust")||n.includes("mollets")||n.includes("crunch")||n.includes("relevé de jambe")||n.includes("planche")||n.includes("russian twist")||n.includes("ab wheel")||n.includes("gainage")||n.includes("step-up")||n.includes("step up")) return"legs";
  // ── Pull
  if(n.includes("tractions")||n.includes("tirage")||n.includes("rowing")||n.includes("pull-over")||n.includes("pullover")||n.includes("kelso")||n.includes("face pull")||n.includes("oiseau")||n.includes("élévation")||n.includes("rowing menton")||n.includes("haussement")||n.includes("shrug")||n.includes("pulldown")) return"pull";

  // ── Fallback musculaire
  if(["biceps","avant-bras"].includes(m)) return"curl";
  if(m==="triceps") return"tri";
  if(["quadriceps","ischio-jambiers","mollets","fessiers","abdos"].includes(m)) return"legs";
  if(["grand dorsaux","trapèzes"].includes(m)) return"pull";
  if(["épaules postérieures","épaules latérales"].includes(m)) return"pull";
  if(m==="lombaires") return"hinge";

  return"push"; // pectoraux, épaules antérieures, défaut
}

function getAdaptedSections(profile, equipment) {
  const base = (GRIP_CONFIGS[profile] || GRIP_CONFIGS.push).sections;
  return base.filter(s => {
    if (s.key === "barType") return !equipment || equipment === "barre";
    if (s.key === "barPos") return !equipment || equipment === "barre" || equipment === "smith";
    if (s.key === "handle") return !equipment || equipment === "poulie";
    if (s.key === "width" && equipment === "alteres" && (profile === "pull" || profile === "curl")) return false;
    return true;
  });
}

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


function ExercisePicker({ onSelect, onCancel, onRename, recentVariants, allExercises, S }) {
  const [step, setStep]               = useState("list"); // "list" | "configure" | "custom"
  const [search, setSearch]           = useState("");
  const [muscleFilter, setMuscleFilter] = useState("");
  const [picked, setPicked]           = useState(null);
  const [equipment, setEquipment]     = useState("");
  const [unilateral, setUnilateral]   = useState(false);
  const [grip, setGrip]               = useState({});
  const [gripNote, setGripNote]       = useState("");
  const [renamingName, setRenamingName] = useState(null);
  const [renameVal, setRenameVal]     = useState("");
  const [customName, setCustomName]   = useState("");
  const [customMuscle, setCustomMuscle] = useState(MUSCLE_GROUPS[0]);
  const [customTension, setCustomTension] = useState("neutre");
  const [customMuscles, setCustomMuscles] = useState([]);

  const muscles = [...new Set(allExercises.map(e=>e.muscle))].sort();

  const filtered = allExercises.filter(ex=>{
    const matchSearch = !search || ex.name.toLowerCase().includes(search.toLowerCase());
    const matchMuscle = !muscleFilter || ex.muscle === muscleFilter;
    return matchSearch && matchMuscle;
  });

  function pickExercise(ex){
    setPicked(ex);
    setEquipment("");setUnilateral(false);
    setGrip({});setGripNote("");
    setStep("configure");
  }

  function confirm(){
    if(!picked)return;
    onSelect({...picked,equipment,unilateral,grip,gripNote});
  }

  function confirmCustom(){
    if(!customName.trim())return;
    const finalProfile=getGripProfile({name:customName,muscle:customMuscle});
    const ex={name:customName.trim(),muscle:customMuscle,muscles:customMuscles,category:"isolation",tension:customTension,custom:true,gripProfile:finalProfile};
    onSelect({...ex,equipment,unilateral,grip,gripNote});
  }

  const tensionLabel = t => t==="etirement"?"Étirement":t==="contraction"?"Contraction":"Neutre";
  const tensionColor = t => t==="etirement"?"var(--sm-up)":t==="contraction"?"var(--sm-accent)":"var(--sm-sub)";

  const ConfigStep = ({onConfirm, customMode=false})=>{
    const exForProfile = customMode ? {name:customName,muscle:customMuscle} : picked;
    const profile = getGripProfile(exForProfile);
    const sections = getAdaptedSections(profile, equipment);
    const displayName = customMode ? (customName||"Exercice perso") : (picked?.name||"");
    const displayMuscle = customMode ? customMuscle : (picked?.muscle||"");
    const displayMuscles = customMode ? [] : (picked?.muscles||[]);
    return(
    <div style={{padding:"16px 20px 32px",overflowY:"auto",flex:1}}>
      <div style={{fontFamily:"var(--sm-font-disp)",fontSize:22,color:"var(--sm-ink)",marginBottom:4}}>{displayName}</div>
      {displayMuscle&&<div style={{fontFamily:"var(--sm-font-mono)",fontSize:11,color:"var(--sm-sub)",marginBottom:16}}>{displayMuscle}{displayMuscles.length>0?` · ${displayMuscles.slice(0,2).join(", ")}`:""}</div>}

      <MonoLabel>Équipement</MonoLabel>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:16}}>
        {EQUIPMENT.map(eq=>(
          <button key={eq.v} onClick={()=>setEquipment(eq.v)} style={{fontFamily:"var(--sm-font-mono)",fontSize:11,padding:"6px 14px",borderRadius:20,border:`1px solid ${equipment===eq.v?"var(--sm-accent)":"var(--sm-line)"}`,background:equipment===eq.v?"var(--sm-accent-soft)":"transparent",color:equipment===eq.v?"var(--sm-accent)":"var(--sm-sub)",cursor:"pointer"}}>
            {eq.l||"Aucun"}
          </button>
        ))}
      </div>

      <MonoLabel>Unilatéral</MonoLabel>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[[false,"Non — les 2 côtés ensemble"],[true,"Oui — 1 côté à la fois"]].map(([v,l])=>(
          <button key={String(v)} onClick={()=>setUnilateral(v)} style={{flex:1,padding:"8px",borderRadius:14,border:`1px solid ${unilateral===v?"var(--sm-up)":"var(--sm-line)"}`,background:unilateral===v?"rgba(47,158,109,.12)":"transparent",color:unilateral===v?"var(--sm-up)":"var(--sm-sub)",cursor:"pointer",fontSize:11,fontFamily:"var(--sm-font-mono)"}}>
            {l}
          </button>
        ))}
      </div>

      <button onClick={onConfirm} style={{...S.btnP,width:"100%",padding:"14px",fontSize:14}}>Ajouter à la séance</button>
    </div>
    );
  };

  if(step==="configure") return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:"var(--sm-card)",borderRadius:"24px 24px 0 0",width:"100%",maxWidth:640,maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"var(--sm-shadow)"}}>
        <div style={{padding:"16px 20px 12px",borderBottom:"1px solid var(--sm-line)",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <button onClick={()=>setStep("list")} style={{background:"none",border:"none",cursor:"pointer",color:"var(--sm-sub)",fontSize:13,fontFamily:"var(--sm-font-mono)"}}>← Retour</button>
          <button onClick={onCancel} style={{background:"none",border:"none",cursor:"pointer",color:"var(--sm-sub)",fontSize:20}}>✕</button>
        </div>
        <ConfigStep onConfirm={confirm}/>
      </div>
    </div>
  );

  if(step==="custom") return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:"var(--sm-card)",borderRadius:"24px 24px 0 0",width:"100%",maxWidth:640,maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"var(--sm-shadow)"}}>
        <div style={{padding:"16px 20px 12px",borderBottom:"1px solid var(--sm-line)",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <button onClick={()=>setStep("list")} style={{background:"none",border:"none",cursor:"pointer",color:"var(--sm-sub)",fontSize:13,fontFamily:"var(--sm-font-mono)"}}>← Retour</button>
          <button onClick={onCancel} style={{background:"none",border:"none",cursor:"pointer",color:"var(--sm-sub)",fontSize:20}}>✕</button>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:"16px 20px 32px"}}>
          <MonoLabel>Nom</MonoLabel>
          <input value={customName} onChange={e=>setCustomName(e.target.value)} placeholder="Nom de l'exercice" style={{...S.inp,marginBottom:12}}/>
          <MonoLabel>Muscle principal</MonoLabel>
          <select value={customMuscle} onChange={e=>setCustomMuscle(e.target.value)} style={{...S.inp,marginBottom:12}}>
            {MUSCLE_GROUPS.map(m=><option key={m}>{m}</option>)}
          </select>
          <MonoLabel>Muscles secondaires</MonoLabel>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
            {MUSCLE_GROUPS.filter(m=>m!==customMuscle).map(m=>(
              <button key={m} onClick={()=>setCustomMuscles(ms=>ms.includes(m)?ms.filter(x=>x!==m):[...ms,m])} style={{fontSize:11,padding:"4px 12px",borderRadius:20,border:`1px solid ${customMuscles.includes(m)?"var(--sm-accent)":"var(--sm-line)"}`,background:customMuscles.includes(m)?"var(--sm-accent-soft)":"transparent",color:customMuscles.includes(m)?"var(--sm-accent)":"var(--sm-sub)",cursor:"pointer",fontFamily:"var(--sm-font-mono)"}}>
                {m}
              </button>
            ))}
          </div>
          <MonoLabel>Tension maximale</MonoLabel>
          <div style={{display:"flex",gap:8,marginBottom:20}}>
            {[["etirement","Étirement"],["contraction","Contraction"],["neutre","Neutre"]].map(([v,l])=>(
              <button key={v} onClick={()=>setCustomTension(v)} style={{flex:1,padding:"8px",borderRadius:14,border:`1px solid ${customTension===v?tensionColor(v):"var(--sm-line)"}`,background:customTension===v?`${tensionColor(v)}22`:"transparent",color:customTension===v?tensionColor(v):"var(--sm-sub)",cursor:"pointer",fontSize:11,fontFamily:"var(--sm-font-mono)"}}>
                {l}
              </button>
            ))}
          </div>

          <ConfigStep onConfirm={confirmCustom} customMode={true}/>
        </div>
      </div>
    </div>
  );

  // ── Step LIST ──────────────────────────────────────────────────────────────────
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:"var(--sm-card)",borderRadius:"24px 24px 0 0",width:"100%",maxWidth:640,maxHeight:"88vh",display:"flex",flexDirection:"column",boxShadow:"var(--sm-shadow)"}}>
        <div style={{padding:"18px 20px 12px",borderBottom:"1px solid var(--sm-line)",flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontFamily:"var(--sm-font-disp)",fontSize:22,color:"var(--sm-ink)"}}>Exercices</span>
            <button onClick={onCancel} style={{background:"none",border:"none",cursor:"pointer",color:"var(--sm-sub)",fontSize:20,lineHeight:1}}>✕</button>
          </div>
          <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher…" style={{...S.inp,marginBottom:10}}/>
          <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>
            {["",...muscles].map(m=>(
              <button key={m} onClick={()=>setMuscleFilter(m)} style={{fontFamily:"var(--sm-font-mono)",fontSize:10,letterSpacing:".06em",padding:"5px 12px",borderRadius:20,border:`1px solid ${muscleFilter===m?"var(--sm-accent)":"var(--sm-line)"}`,background:muscleFilter===m?"var(--sm-accent-soft)":"transparent",color:muscleFilter===m?"var(--sm-accent)":"var(--sm-sub)",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                {m||"Tous"}
              </button>
            ))}
          </div>
        </div>

        <div style={{overflowY:"auto",flex:1,padding:"8px 0"}}>
          <div style={{padding:"8px 20px 10px"}}>
            <button onClick={()=>{setPicked(null);setEquipment("");setUnilateral(false);setGrip({});setGripNote("");setCustomName("");setCustomMuscle(MUSCLE_GROUPS[0]);setCustomMuscles([]);setCustomTension("neutre");setStep("custom");}} style={{...S.btnS,width:"100%",padding:"10px",fontSize:13,borderStyle:"dashed",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <span style={{fontSize:16,lineHeight:1}}>+</span> Exercice personnalisé
            </button>
          </div>
          {!search&&!muscleFilter&&recentVariants?.length>0&&(
            <div style={{padding:"6px 20px 10px"}}>
              <div style={{fontFamily:"var(--sm-font-mono)",fontSize:10,letterSpacing:".1em",color:"var(--sm-sub)",textTransform:"uppercase",marginBottom:8}}>Récents</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {recentVariants.map(v=>(
                  <button key={v.key} onClick={()=>{setPicked({name:v.name,muscle:v.muscle||"",muscles:[],category:"",tension:""});setEquipment(v.equipment||"");setUnilateral(v.unilateral||false);setStep("configure");}} style={{...S.btnS,fontSize:12,padding:"5px 12px"}}>
                    {v.name}{v.equipment&&<span style={{color:"var(--sm-accent)",marginLeft:4,fontSize:10}}>{v.equipment}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {filtered.map((ex,i)=>{
            if(renamingName===ex.name) return(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 14px 9px 20px",borderBottom:"1px solid var(--sm-line)",background:"var(--sm-card2)"}}>
                <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)}
                  onKeyDown={e=>{
                    if(e.key==="Enter"){onRename&&onRename(ex.name,renameVal.trim());setRenamingName(null);}
                    if(e.key==="Escape")setRenamingName(null);
                  }}
                  style={{...S.inp,flex:1,fontSize:13,padding:"6px 10px"}}/>
                <button onClick={()=>{onRename&&onRename(ex.name,renameVal.trim());setRenamingName(null);}} style={{...S.btnP,padding:"6px 14px",fontSize:12,flexShrink:0}}>✓</button>
                <button onClick={()=>setRenamingName(null)} style={{...S.btnS,padding:"6px 10px",fontSize:12,flexShrink:0}}>✕</button>
              </div>
            );
            return(
              <div key={i} style={{display:"flex",alignItems:"center",borderBottom:"1px solid var(--sm-line)"}}>
                <button onClick={()=>pickExercise(ex)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 8px 11px 20px",background:"none",border:"none",cursor:"pointer",textAlign:"left",gap:8,minWidth:0}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                      <span style={{fontSize:14,fontWeight:600,color:"var(--sm-ink)"}}>{ex.name}</span>
                      {ex.custom&&!ex.originalName&&<span style={{fontFamily:"var(--sm-font-mono)",fontSize:9,color:"var(--sm-sub)",border:"1px solid var(--sm-line)",borderRadius:20,padding:"1px 6px"}}>custom</span>}
                      {ex.sessionDerived&&<span style={{fontFamily:"var(--sm-font-mono)",fontSize:9,color:"var(--sm-sub)",border:"1px solid var(--sm-line)",borderRadius:20,padding:"1px 6px"}}>hist.</span>}
                      {ex.category==="compound"&&<span style={{fontFamily:"var(--sm-font-mono)",fontSize:9,color:"var(--sm-sub)",letterSpacing:".04em"}}>poly</span>}
                      {ex.tension&&<span style={{fontFamily:"var(--sm-font-mono)",fontSize:9,color:tensionColor(ex.tension),letterSpacing:".04em"}}>{tensionLabel(ex.tension)}</span>}
                    </div>
                    <div style={{fontSize:11,color:"var(--sm-sub)",marginTop:2,fontFamily:"var(--sm-font-mono)"}}>{ex.muscle}{ex.muscles?.length>0?` · ${ex.muscles.slice(0,2).join(", ")}`:""}</div>
                  </div>
                  <span style={{color:"var(--sm-accent)",fontSize:16,flexShrink:0}}>›</span>
                </button>
                <button onClick={()=>{setRenamingName(ex.name);setRenameVal(ex.name);}} title="Renommer" style={{padding:"11px 14px",background:"none",border:"none",cursor:"pointer",color:"var(--sm-sub)",fontSize:14,flexShrink:0,lineHeight:1}}>✎</button>
              </div>
            );
          })}

          {filtered.length===0&&(
            <div style={{padding:"20px",textAlign:"center",color:"var(--sm-sub)",fontFamily:"var(--sm-font-serif)",fontStyle:"italic",fontSize:14}}>Aucun résultat.</div>
          )}

          <div style={{height:16}}/>
        </div>
      </div>
    </div>
  );
}

function PartnerProfile({ data, email, S }) {
  const [activeProg, setActiveProg] = useState("Tous");
  const sessions = data?.sessions || [];
  const weekStart = startOfWeek(new Date());
  const wVol = sets => calcVolume((sets||[]).filter(s=>!s.isWarmup));

  // ── Programmes disponibles ────────────────────────────────────────────────────
  const programs = ["Tous", ...[...new Set(sessions.map(s=>s.programName).filter(Boolean))]];
  const filtered = activeProg==="Tous" ? sessions : sessions.filter(s=>s.programName===activeProg);

  // ── Assiduité ────────────────────────────────────────────────────────────────
  const thisWeek = sessions.filter(s=>new Date(s.date)>=weekStart).length;
  const thisWeekVol = Math.round(sessions.filter(s=>new Date(s.date)>=weekStart).reduce((a,s)=>a+s.exercises.reduce((b,e)=>b+wVol(e.sets),0),0));
  const lastSession = filtered[0] || null;

  // Séances sur 4 semaines vs 4 semaines précédentes
  const fourWeeksAgo = new Date(weekStart); fourWeeksAgo.setDate(fourWeeksAgo.getDate()-28);
  const eightWeeksAgo = new Date(weekStart); eightWeeksAgo.setDate(eightWeeksAgo.getDate()-56);
  const recentCount = sessions.filter(s=>new Date(s.date)>=fourWeeksAgo).length;
  const prevCount   = sessions.filter(s=>{ const d=new Date(s.date); return d>=eightWeeksAgo&&d<fourWeeksAgo; }).length;
  const attendanceTrend = recentCount>prevCount?"up":recentCount<prevCount?"down":"stable";

  // ── Progression par exercice (top 5 les plus pratiqués dans le programme sélectionné) ──
  const exFreq = {};
  filtered.forEach(s=>s.exercises.forEach(e=>{
    const k=exKey(e.name,e.equipment||"",null,e.unilateral);
    exFreq[k]=(exFreq[k]||0)+1;
  }));
  const topExKeys = Object.entries(exFreq).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k])=>k);

  const exProgression = topExKeys.map(k=>{
    const [name,equip=""]=k.split(":::");
    const history = filtered
      .filter(s=>s.exercises.some(e=>e.name===name&&(e.equipment||"")===(equip)))
      .slice(0,4)
      .reverse()
      .map(s=>{
        const e=s.exercises.find(x=>x.name===name&&(x.equipment||"")===(equip));
        const working=(e.sets||[]).filter(st=>!st.isWarmup&&(st.weight||st.reps));
        const bestW = Math.max(0,...working.map(st=>parseFloat(st.weight)||0));
        const totalVol = Math.round(working.reduce((a,st)=>a+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0));
        return { date:s.date, bestWeight:bestW, totalVol, sets:working.length };
      });
    if(history.length<2) return null;
    const last=history[history.length-1], prev=history[history.length-2];
    const trend = last.totalVol>prev.totalVol*1.02?"up":last.totalVol<prev.totalVol*0.98?"down":"stable";
    return { name, equip, history, trend };
  }).filter(Boolean);

  // ── Équilibre musculaire (4 dernières semaines, programme sélectionné) ────────
  const muscleFreq = {};
  filtered.filter(s=>new Date(s.date)>=fourWeeksAgo).forEach(s=>
    s.exercises.forEach(e=>{ if(e.muscle){ muscleFreq[e.muscle]=(muscleFreq[e.muscle]||0)+1; } })
  );
  const muscleData = Object.entries(muscleFreq).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([m,n])=>({m,n}));
  const maxMuscle = muscleData[0]?.n||1;

  // ── Volume hebdo (programme sélectionné) ─────────────────────────────────────
  const weeklyTrend = Array.from({length:6},(_,i)=>{
    const ws=new Date(weekStart);ws.setDate(ws.getDate()-(5-i)*7);
    const we=new Date(ws);we.setDate(we.getDate()+7);
    const wFiltered=filtered.filter(s=>{const d=new Date(s.date);return d>=ws&&d<we;});
    return{label:ws.toLocaleDateString("fr-FR",{day:"2-digit",month:"short"}),vol:Math.round(wFiltered.reduce((a,s)=>a+s.exercises.reduce((b,e)=>b+wVol(e.sets),0),0)),count:wFiltered.length};
  });

  const displayName = email.split("@")[0];
  const trendColor = t => t==="up"?"var(--sm-up)":t==="down"?"#e05555":"var(--sm-sub)";
  const trendIcon  = t => t==="up"?"↑":t==="down"?"↓":"→";

  return (
    <div>
      {/* ── Sélecteur de programme ── */}
      {programs.length>2&&(
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
          {programs.map(p=>{
            const active=p===activeProg;
            return(
              <button key={p} onClick={()=>setActiveProg(p)} style={{fontFamily:"var(--sm-font-mono)",fontSize:11,letterSpacing:".06em",padding:"7px 16px",borderRadius:"var(--sm-r-pill)",border:`1px solid ${active?"var(--sm-accent)":"var(--sm-line)"}`,background:active?"var(--sm-accent-soft)":"transparent",color:active?"var(--sm-accent)":"var(--sm-sub)",cursor:"pointer",whiteSpace:"nowrap",transition:"all .15s"}}>
                {p}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Header assiduité ── */}
      <div style={{...S.card,display:"flex",alignItems:"center",gap:20,marginBottom:14}}>
        <div style={{position:"relative",flexShrink:0,width:108,height:108}}>
          <Ring value={thisWeek} max={4}/>
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontFamily:"var(--sm-font-disp)",fontSize:30,lineHeight:.9,color:"var(--sm-ink)"}}>{thisWeek}</span>
            <span style={{fontFamily:"var(--sm-font-mono)",fontSize:9,letterSpacing:".1em",color:"var(--sm-sub)",textTransform:"uppercase",marginTop:4}}>/ 4 sem.</span>
          </div>
        </div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"var(--sm-font-disp)",fontSize:28,lineHeight:.92,color:"var(--sm-ink)",marginBottom:4}}>{displayName}</div>
          <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:6}}>
            <span style={{fontFamily:"var(--sm-font-mono)",fontSize:10,color:trendColor(attendanceTrend),letterSpacing:".08em"}}>
              {trendIcon(attendanceTrend)} {recentCount} séances / 4 sem.
            </span>
          </div>
          <MonoLabel>Volume cette semaine</MonoLabel>
          <Hero value={thisWeekVol>=1000?(thisWeekVol/1000).toFixed(1):thisWeekVol} unit={thisWeekVol>=1000?"t":"kg"} size={28}/>
        </div>
      </div>

      {/* ── Dernière séance ── */}
      {lastSession&&(
        <div style={{...S.card,marginBottom:14}}>
          <MonoLabel>Dernière séance</MonoLabel>
          <div style={{fontFamily:"var(--sm-font-disp)",fontSize:22,lineHeight:.95,color:"var(--sm-ink)",marginBottom:4,marginTop:4}}>{lastSession.programName}</div>
          <div style={{fontFamily:"var(--sm-font-mono)",fontSize:10,color:"var(--sm-sub)",letterSpacing:".06em",marginBottom:10}}>
            {formatDate(lastSession.date)}{lastSession.duration?` · ${lastSession.duration} min`:""}
            {" · "}{lastSession.exercises.length} exercice{lastSession.exercises.length>1?"s":""}
            {" · "}{lastSession.exercises.reduce((a,e)=>(e.sets||[]).filter(s=>!s.isWarmup&&(s.weight||s.reps)).length+a,0)} séries
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{[...new Set(lastSession.exercises.map(e=>e.muscle))].filter(Boolean).map(m=><Tag key={m}>{m}</Tag>)}</div>
        </div>
      )}

      {/* ── Progression des exercices ── */}
      {exProgression.length>0&&(
        <div style={{...S.card,marginBottom:14}}>
          <MonoLabel>Surcharge progressive</MonoLabel>
          <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:12}}>
            {exProgression.map(({name,equip,history,trend})=>(
              <div key={name+equip}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                  <div>
                    <span style={{fontSize:13,fontWeight:600,color:"var(--sm-ink)"}}>{name}</span>
                    {equip&&<span style={{marginLeft:6,fontFamily:"var(--sm-font-mono)",fontSize:10,color:"var(--sm-sub)"}}>{equipLabel(equip)}</span>}
                  </div>
                  <span style={{fontFamily:"var(--sm-font-mono)",fontSize:13,fontWeight:700,color:trendColor(trend)}}>{trendIcon(trend)}</span>
                </div>
                <div style={{display:"flex",gap:5}}>
                  {history.map((h,i)=>{
                    const isLast=i===history.length-1;
                    return(
                      <div key={i} style={{flex:1,background:isLast?"var(--sm-accent-soft)":"var(--sm-card2)",borderRadius:10,padding:"7px 6px",border:`1px solid ${isLast?"var(--sm-accent)":"var(--sm-line)"}`,textAlign:"center"}}>
                        <div style={{fontFamily:"var(--sm-font-mono)",fontSize:9,color:"var(--sm-sub)",letterSpacing:".06em",marginBottom:3}}>{formatDate(h.date)}</div>
                        <div style={{fontFamily:"var(--sm-font-disp)",fontSize:16,color:isLast?"var(--sm-accent)":"var(--sm-ink)",lineHeight:1}}>{h.bestWeight||"—"}<span style={{fontSize:9,color:"var(--sm-sub)",marginLeft:2}}>kg</span></div>
                        <div style={{fontFamily:"var(--sm-font-mono)",fontSize:9,color:"var(--sm-sub)",marginTop:2}}>{h.sets} sér.</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Équilibre musculaire ── */}
      {muscleData.length>0&&(
        <div style={{...S.card,marginBottom:14}}>
          <MonoLabel>Groupes musculaires — 4 dernières semaines</MonoLabel>
          <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:7}}>
            {muscleData.map(({m,n})=>(
              <div key={m} style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:11,color:"var(--sm-ink)",width:140,flexShrink:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m}</span>
                <div style={{flex:1,height:8,background:"var(--sm-card2)",borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${(n/maxMuscle)*100}%`,background:"var(--sm-accent)",borderRadius:4,transition:"width .6s ease"}}/>
                </div>
                <span style={{fontFamily:"var(--sm-font-mono)",fontSize:10,color:"var(--sm-sub)",width:20,textAlign:"right"}}>{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Volume hebdo ── */}
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

function ProgramEditor({ program, onSave, onCancel, S, allExercisesList, onRename }) {
  const [name, setName] = useState(program?.name||"");
  const [type, setType] = useState(program?.type||"volume");
  const [muscles, setMuscles] = useState(program?.muscles||[]);
  const [exercises, setExercises] = useState(
    (program?.exercises||[]).map(ex=>typeof ex==="string"?{name:ex,targetSets:"",targetReps:"",muscle:"",equipment:""}:{muscle:"",equipment:"",...ex})
  );
  const [showPicker, setShowPicker] = useState(false);

  function toggleMuscle(m){ setMuscles(ms=>ms.includes(m)?ms.filter(x=>x!==m):[...ms,m]); }
  function addEx(picked){ setExercises(ex=>[...ex,{name:picked.name,targetSets:"",targetReps:"",muscle:picked.muscle||"",equipment:picked.equipment||"",unilateral:picked.unilateral||false}]); setShowPicker(false); }
  function removeEx(i){ setExercises(ex=>ex.filter((_,j)=>j!==i)); }
  function moveEx(i,dir){ setExercises(ex=>{ const a=[...ex],j=i+dir; if(j<0||j>=a.length)return a; [a[i],a[j]]=[a[j],a[i]]; return a; }); }
  function updateExField(i,field,val){ setExercises(ex=>ex.map((e,j)=>j===i?{...e,[field]:val}:e)); }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:12}}>
      <div style={{background:"var(--sm-card)",borderRadius:24,padding:24,width:"min(560px,95vw)",maxHeight:"88vh",overflowY:"auto",boxSizing:"border-box",boxShadow:"var(--sm-shadow)"}}>
        <h3 style={{margin:"0 0 16px",fontSize:16,fontWeight:700,color:"var(--sm-ink)"}}>{program?"Modifier":"Nouveau programme"}</h3>
        <MonoLabel>Nom</MonoLabel>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: Push A" style={{...S.inp,marginBottom:16}}/>

        <MonoLabel>Type d'entraînement</MonoLabel>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {[["force","Force","Faibles reps, charges lourdes"],["volume","Volume","Hautes reps, hypertrophie"]].map(([v,l,d])=>(
            <button key={v} onClick={()=>setType(v)} style={{flex:1,padding:"10px 8px",borderRadius:14,border:`1.5px solid ${type===v?"var(--sm-accent)":"var(--sm-line)"}`,background:type===v?"var(--sm-accent-soft)":"transparent",cursor:"pointer",textAlign:"left"}}>
              <div style={{fontSize:12,fontWeight:700,color:type===v?"var(--sm-accent)":"var(--sm-ink)",marginBottom:2}}>{l}</div>
              <div style={{fontSize:10,color:"var(--sm-sub)",fontFamily:"var(--sm-font-mono)"}}>{d}</div>
            </button>
          ))}
        </div>

        <div style={{marginBottom:16,padding:"10px 12px",background:"var(--sm-faint)",borderRadius:12,fontSize:11,color:"var(--sm-sub)",fontFamily:"var(--sm-font-mono)",letterSpacing:".04em"}}>
          Logique : si toutes les séries atteignent le MAX → ↑ Augmenter. Dans la fourchette → → Maintenir. Sous le MIN → ↓ Alléger.
        </div>
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
            <div style={{display:"grid",gridTemplateColumns:"1fr 10px 1fr",gap:6,alignItems:"center"}}>
              <div>
                <div style={{fontSize:9,color:"var(--sm-sub)",fontFamily:"var(--sm-font-mono)",letterSpacing:".08em",marginBottom:3,textTransform:"uppercase"}}>Séries cible</div>
                <input type="number" value={ex.targetSets||""} onChange={e=>updateExField(i,"targetSets",e.target.value)} placeholder="ex: 3" min="1" style={{...S.inp,fontSize:12,padding:"6px 8px",textAlign:"center"}}/>
              </div>
              <span style={{fontSize:11,color:"var(--sm-sub)",textAlign:"center",paddingTop:18}}>×</span>
              <div>
                <div style={{fontSize:9,color:"var(--sm-sub)",fontFamily:"var(--sm-font-mono)",letterSpacing:".08em",marginBottom:3,textTransform:"uppercase"}}>Reps cible</div>
                <input value={ex.targetReps||""} onChange={e=>updateExField(i,"targetReps",e.target.value)} placeholder="ex: 6-8" style={{...S.inp,fontSize:12,padding:"6px 8px"}}/>
              </div>
            </div>
          </div>
        ))}
        <button onClick={()=>setShowPicker(true)} style={{...S.btnS,width:"100%",padding:"11px",fontSize:13,borderStyle:"dashed",borderRadius:16,marginTop:8,marginBottom:20,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <span style={{fontSize:18,lineHeight:1}}>+</span> Choisir un exercice
        </button>
        {showPicker&&<ExercisePicker S={S} allExercises={allExercisesList} onSelect={addEx} onRename={onRename} onCancel={()=>setShowPicker(false)}/>}
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onCancel} style={S.btnS}>Annuler</button>
          <button onClick={()=>name.trim()&&onSave({name:name.trim(),type,muscles,exercises})} style={S.btnP}>Enregistrer</button>
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

  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [showExPicker, setShowExPicker] = useState(false);
  const [customExercises, setCustomExercises] = useState([]);
  const [partnerEmail, setPartnerEmail] = useState("");
  const [partnerData, setPartnerData] = useState(null);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [partnerError, setPartnerError] = useState("");
  const [partnerUsers, setPartnerUsers] = useState([]);
  const [backups, setBackups] = useState([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState(null);
  const [editingExId, setEditingExId] = useState(null);

  const S = useMemo(()=>makeStyles(),[]);
  const allExercisesList = useMemo(()=>{
    const overriddenDBNames = new Set(customExercises.filter(e=>e.originalName).map(e=>e.originalName));
    const filteredDB = EXERCISE_DB.filter(e=>!overriddenDBNames.has(e.name));
    const knownNames = new Set([...EXERCISE_DB.map(e=>e.name),...customExercises.map(e=>e.name)]);
    const seen = new Set();
    const sessionDerived = [];
    sessions.forEach(s=>s.exercises.forEach(e=>{
      if(e.name?.trim()&&!knownNames.has(e.name)&&!seen.has(e.name)){
        seen.add(e.name);
        sessionDerived.push({name:e.name,muscle:e.muscle||"",muscles:[],category:"",tension:"",sessionDerived:true});
      }
    }));
    return [...filteredDB,...customExercises,...sessionDerived];
  },[customExercises,sessions]);
  const saveTimer = useRef(null);

  useEffect(()=>{ document.documentElement.dataset.theme = darkMode?"dark":""; },[darkMode]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function wVolume(sets){
    return (sets||[]).filter(s=>!s.isWarmup).reduce((acc,s)=>{
      const w=parseFloat(s.weight)||0;
      const r=Math.max(parseInt(s.repsL)||0,parseInt(s.repsR)||0)||(parseInt(s.reps)||0);
      return acc+w*r;
    },0);
  }

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

  function getLastForExercise(name,equipment,grip,unilateral){
    const sorted=[...sessions].sort((a,b)=>b.date.localeCompare(a.date));
    const gk=gripKey(grip);
    const match=e=>e.name===name&&(e.equipment||"")===(equipment||"")&&(!gk||gripKey(e.grip)===gk)&&!!e.unilateral===!!unilateral;
    const lastS=sorted.find(s=>s.exercises.some(match));
    if(!lastS)return null;
    const ex=lastS.exercises.find(match);
    const working=(ex.sets||[]).filter(s=>!s.isWarmup&&(s.weight||s.reps||s.repsL||s.repsR));
    const daysAgo=Math.round((Date.now()-new Date(lastS.date))/86400000);
    const maxW=Math.max(0,...working.map(s=>parseFloat(s.weight)||0));
    const repsPerSet=working.map(s=>unilateral?Math.max(parseInt(s.repsL)||0,parseInt(s.repsR)||0):(parseInt(s.reps)||0));
    return{daysAgo,date:lastS.date,sets:working,maxWeight:maxW,repsPerSet};
  }

  function getSuggestion(name,equipment,targetReps,unilateral){
    if(!targetReps)return null;
    const last=getLastForExercise(name,equipment,undefined,unilateral);
    if(!last)return null;
    const[minR,maxR]=parseRepRange(targetReps);
    if(!minR)return null;
    const repsArr=last.repsPerSet.filter(r=>r>0);
    if(!repsArr.length)return null;
    const top=maxR||minR;
    const allAtTop=repsArr.every(r=>r>=top);
    const allInRange=repsArr.every(r=>r>=minR);
    if(allAtTop)return{direction:"up",reason:`Toutes les séries ≥ ${top} reps — augmenter le poids`};
    if(allInRange)return{direction:"hold",reason:`Dans la fourchette — vise ${top} reps sur toutes les séries`};
    return{direction:"down",reason:`Reps sous la cible (min ${minR}) — consolider le poids actuel`};
  }

  function setDirection(setReps,targetReps){
    if(!targetReps||!parseInt(setReps))return null;
    const[minR,maxR]=parseRepRange(targetReps);
    if(!minR)return null;
    const r=parseInt(setReps)||0;
    if(r>=(maxR||minR))return"up";
    if(r>=minR)return"hold";
    return"down";
  }

  // ── Persistence ───────────────────────────────────────────────────────────
  function fullData(){
    return{sessions,programs,customExercises,theme:darkMode?"dark":"",email:user?.email||"",
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
  function migrateSessions(list){
    return(list||[]).map(s=>({...s,exercises:s.exercises.map(e=>e.name==="Reverse fly (unilatérale)"?{...e,name:"Reverse fly",unilateral:true}:e)}));
  }
  function applyData(d,withDraft){
    if(!d)return;
    if(d.sessions)setSessions(prev=>{
      const migrated=migrateSessions(d.sessions);
      const cloudIds=new Set(migrated.map(s=>s.id));
      const localOnly=prev.filter(s=>!cloudIds.has(s.id));
      return[...localOnly,...migrated].sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
    });
    if(d.programs)setPrograms(d.programs);
    if(d.customExercises)setCustomExercises(d.customExercises);
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
      if(event==="INITIAL_SESSION"){setAuthReady(true);if(u){loadCloud().then(d=>{if(d)applyData(d,false);setCloudLoaded(true);});fetchAllUsers().then(setPartnerUsers);listBackups().then(bs=>{setBackups(bs);const last=bs[0];const needsBackup=!last||((Date.now()-new Date(last.created_at).getTime())>7*24*60*60*1000);if(needsBackup)loadCloud().then(d=>{if(d)createBackup(d).then(()=>listBackups().then(setBackups));});});}}
      if(event==="SIGNED_IN"){loadCloud().then(d=>{if(d)applyData(d,false);setCloudLoaded(true);});fetchAllUsers().then(setPartnerUsers);}
      if(event==="SIGNED_OUT"){clearCloudCache();setCloudLoaded(false);setSessions([]);setPrograms(INITIAL_PROGRAMS);setDarkMode(false);resetDraft();setMode("free");saveData(null);setPartnerUsers([]);}
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
      const targetReps=(typeof ex==="object"&&ex.targetReps)||"";
      const targetSets=parseInt((typeof ex==="object"&&ex.targetSets)||"3")||3;
      const last=getLastForExercise(name,equipment,undefined,false);
      const defaultWeight=last?.maxWeight?String(last.maxWeight):"";
      const sets=Array.from({length:targetSets},()=>({weight:defaultWeight,reps:"",repsL:"",repsR:"",rpe:"",isWarmup:false,restMs:null,note:"",repsExtra:""}));
      return{id:now+i,name,muscle,equipment,notes:"",sets,target:{sets:targetSets,reps:targetReps,type:p.type||"volume"}};
    }));
  }

  function repeatSession(s){
    setMode("free");setSelectedProgram({name:s.programName});
    setSessionDate(new Date().toISOString().split("T")[0]);
    setSessionDuration(s.duration?String(s.duration):"");setSessionNotes("");
    setSessionBodyweight("");setSessionRating(null);setSessionSleep(null);setSessionEnergy(null);
    const now=Date.now();
    setExercises(s.exercises.map((e,i)=>({id:now+i,name:e.name,muscle:e.muscle,equipment:e.equipment||"",unilateral:e.unilateral||false,grip:e.grip||{},gripNote:e.gripNote||"",notes:"",sets:(e.sets||[]).map(st=>({weight:st.weight,reps:st.reps,repsL:st.repsL||"",repsR:st.repsR||"",rpe:"",isWarmup:st.isWarmup||false,restMs:null,note:""}))})));
    setTab("log");
  }

  function addSet(id){
    const now=Date.now();
    setExercises(ex=>ex.map(e=>{
      if(e.id!==id)return e;
      let sets=e.sets;
      if(activeRest&&activeRest.exId===id){const elapsed=now-activeRest.startTime;sets=sets.map((st,i)=>i===activeRest.si?{...st,restMs:elapsed}:st);}
      return{...e,sets:[...sets,{weight:"",reps:"",repsL:"",repsR:"",rpe:"",isWarmup:false,restMs:null,note:"",repsExtra:""}]};
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
  function updateExGrip(id,key,val){setExercises(ex=>ex.map(e=>e.id===id?{...e,grip:{...e.grip,[key]:val}}:e));}

  function addExercise(picked){
    const{name,muscle,equipment="",unilateral=false,grip={},gripNote="",custom=false,muscles=[],tension="",category="",gripProfile}=picked;
    if(!name?.trim())return;
    if(custom){
      const already=[...EXERCISE_DB,...customExercises].some(e=>e.name===name.trim()&&e.muscle===muscle);
      if(!already) setCustomExercises(prev=>[...prev,{name:name.trim(),muscle,muscles,category,tension,gripProfile,custom:true}]);
    }
    const last=getLastForExercise(name,equipment,undefined,unilateral);
    setExercises(ex=>[...ex,{id:Date.now(),name:name.trim(),muscle,equipment,unilateral,grip,gripNote,notes:"",sets:[{weight:last?.maxWeight?String(last.maxWeight):"",reps:"",rpe:"",isWarmup:false,restMs:null,note:""}]}]);
    setShowExPicker(false);
  }

  function renameExercise(oldName, newName){
    const trimmed=(newName||"").trim();
    if(!trimmed||trimmed===oldName)return;
    const inCustom=customExercises.find(e=>e.name===oldName);
    const inDB=EXERCISE_DB.some(e=>e.name===oldName);
    if(inCustom){
      setCustomExercises(prev=>prev.map(e=>e.name===oldName?{...e,name:trimmed}:e));
    } else if(inDB){
      const dbEx=EXERCISE_DB.find(e=>e.name===oldName);
      setCustomExercises(prev=>[...prev,{...dbEx,name:trimmed,originalName:oldName,custom:true}]);
    }
    setSessions(prev=>prev.map(s=>({...s,exercises:s.exercises.map(e=>e.name===oldName?{...e,name:trimmed}:e)})));
    setPrograms(prev=>prev.map(p=>({...p,exercises:(p.exercises||[]).map(e=>typeof e==="string"?(e===oldName?trimmed:e):(e.name===oldName?{...e,name:trimmed}:e))})));
    setProgressKey(pk=>{if(!pk)return pk;const parts=pk.split(":::");if(parts[0]===oldName)return[trimmed,...parts.slice(1)].join(":::");return pk;});
  }

  function saveSession(){
    if(!exercises.length)return;
    const clean=exercises.map(e=>({...e,sets:e.sets.filter(s=>s.weight||s.reps||s.repsL||s.repsR)})).filter(e=>e.sets.length);
    if(!clean.length)return;
    const newSession={id:Date.now(),date:sessionDate,duration:parseInt(sessionDuration)||null,notes:sessionNotes.trim()||null,programName:selectedProgram?.name||"Séance libre",exercises:clean,bodyweight:parseFloat(sessionBodyweight)||null,rating:sessionRating,sleep:sessionSleep,energy:sessionEnergy};
    const newSessions=[newSession,...sessions];
    setSessions(newSessions);
    // Sauvegarde immédiate sans attendre le debounce
    const snap={sessions:newSessions,programs,customExercises,theme:darkMode?"dark":"",email:user?.email||"",draft:{}};
    saveData(snap);
    if(user&&cloudLoaded)saveCloud(snap);
    resetDraft();setMode("free");setTab("history");
  }

  function exportJSON(){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify({sessions,programs,customExercises,theme:darkMode?"dark":""},null,2)],{type:"application/json"}));a.download="suivi_muscu.json";a.click();}
  async function manualBackup(){setBackupLoading(true);await createBackup(fullData());const bs=await listBackups();setBackups(bs);setBackupLoading(false);}
  async function handleRestore(id){const d=await restoreBackup(id);if(d){applyData(d,false);await saveCloud(d);setRestoreConfirm(null);}}
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
  const progressUnilateral=!!(progressKey?.includes(":::unil"));

  const allExVariants=useMemo(()=>{
    const seen=new Set(),result=[];
    sessions.forEach(s=>s.exercises.forEach(e=>{const k=exKey(e.name,e.equipment||"",null,e.unilateral);if(!seen.has(k)){seen.add(k);result.push({name:e.name,equipment:e.equipment||"",unilateral:!!e.unilateral,key:k});}}));
    return result.sort((a,b)=>a.name.localeCompare(b.name)||a.equipment.localeCompare(b.equipment));
  },[sessions]);

  const progressVariants=useMemo(()=>{
    const seen=new Set(),result=[];
    sessions.forEach(s=>s.exercises.forEach(e=>{
      if(/unilatér|unilateral/i.test(e.name))return;
      const k=e.name+(e.unilateral?":::unil":"");
      if(!seen.has(k)){seen.add(k);result.push({name:e.name,unilateral:!!e.unilateral,key:k});}
    }));
    return result.sort((a,b)=>a.name.localeCompare(b.name)||(a.unilateral?1:-1));
  },[sessions]);

  const now=new Date(),weekStart=startOfWeek(now);

  const prSet=useMemo(()=>{
    const best={},prs=new Set();
    [...sessions].sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id).forEach(s=>s.exercises.forEach(e=>{
      const k=exKey(e.name,e.equipment||"",null,e.unilateral);
      const mw=Math.max(0,...(e.sets||[]).filter(st=>!st.isWarmup).map(st=>parseFloat(st.weight)||0));
      if(mw>0&&mw>(best[k]||0)){best[k]=mw;prs.add(s.id+":"+k);}
    }));
    return prs;
  },[sessions]);

  const progressData=useMemo(()=>
    sessions.flatMap(s=>s.exercises.filter(e=>e.name===progressEx&&!!e.unilateral===progressUnilateral&&!/unilatér|unilateral/i.test(e.name)).map(e=>{
      const working=(e.sets||[]).filter(st=>!st.isWarmup);
      const withRPE=working.filter(st=>st.rpe);
      const avgRPE=withRPE.length?Math.round(withRPE.reduce((a,st)=>a+(parseFloat(st.rpe)||0),0)/withRPE.length*10)/10:null;
      const avgRepsL=working.length?Math.round(working.reduce((a,st)=>a+(parseInt(st.repsL)||0),0)/working.length*10)/10:0;
      const avgRepsR=working.length?Math.round(working.reduce((a,st)=>a+(parseInt(st.repsR)||0),0)/working.length*10)/10:0;
      return{date:s.date,label:formatDate(s.date),maxWeight:Math.max(0,...working.map(st=>parseFloat(st.weight)||0)),volume:wVolume(e.sets),orm:Math.max(0,...working.map(st=>estimate1RM(st.weight,st.reps))),rating:s.rating,avgRPE,avgRepsL,avgRepsR};
    })).sort((a,b)=>a.date.localeCompare(b.date))
  ,[sessions,progressKey,progressEx,progressEquip,progressUnilateral]);

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
      {editingProgram!==null&&<ProgramEditor program={editingProgram==="new"?null:editingProgram} onSave={saveProgram} onCancel={()=>setEditingProgram(null)} S={S} allExercisesList={allExercisesList} onRename={renameExercise}/>}

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
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3,flexWrap:"wrap"}}>
                        <span style={{fontSize:14,fontWeight:600,color:"var(--sm-ink)"}}>{p.name}</span>
                        {p.type&&<span style={{fontFamily:"var(--sm-font-mono)",fontSize:9,letterSpacing:".08em",padding:"2px 7px",borderRadius:20,background:p.type==="force"?"rgba(245,158,11,.15)":"var(--sm-accent-soft)",color:p.type==="force"?"#f59e0b":"var(--sm-accent)",border:`1px solid ${p.type==="force"?"#f59e0b":"var(--sm-accent)"}`,textTransform:"uppercase"}}>{p.type==="force"?"Force":"Volume"}</span>}
                        {p.defaultReps&&<span style={{fontFamily:"var(--sm-font-mono)",fontSize:9,color:"var(--sm-sub)"}}>{p.defaultSets}×{p.defaultReps}</span>}
                      </div>
                      <div style={{fontFamily:"var(--sm-font-mono)",fontSize:10,color:"var(--sm-sub)",letterSpacing:".06em"}}>{p.muscles.slice(0,3).join(" · ")}</div>
                    </div>
                    <div style={{width:30,height:30,borderRadius:"50%",background:"var(--sm-accent-soft)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--sm-accent)",fontSize:14,flexShrink:0}}>→</div>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={()=>setTab("log")} style={{...S.btnP,width:"100%",padding:15,fontSize:15,letterSpacing:".03em"}}>+ Nouvelle séance libre</button>

            {partnerUsers.length>0&&(
              <div style={{...S.card,marginTop:14}}>
                <MonoLabel>Voir la progression d'un·e partenaire</MonoLabel>
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <select value={partnerEmail} onChange={e=>{setPartnerEmail(e.target.value);setPartnerError("");}}
                    style={{...S.inp,flex:1,cursor:"pointer"}}>
                    <option value="">Sélectionner un compte…</option>
                    {partnerUsers.map(em=>(
                      <option key={em} value={em}>{em}</option>
                    ))}
                  </select>
                  <button onClick={searchPartner} disabled={partnerLoading||!partnerEmail} style={{...S.btnP,flexShrink:0,padding:"10px 18px",opacity:(partnerLoading||!partnerEmail)?0.5:1}}>
                    {partnerLoading?"...":"Voir"}
                  </button>
                </div>
                {partnerError&&<div style={{marginTop:6,fontSize:12,color:"#e05555",fontFamily:"var(--sm-font-mono)"}}>{partnerError}</div>}
              </div>
            )}
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
              const last=getLastForExercise(ex.name,ex.equipment,undefined,ex.unilateral);
              const sugg=getSuggestion(ex.name,ex.equipment,ex.target?.reps,ex.unilateral);
              return(
                <div key={ex.id} style={S.card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                      <span style={{fontWeight:700,fontSize:15,color:"var(--sm-ink)"}}>{ex.name}</span>
                      <Tag>{ex.muscle}</Tag>
                      {ex.unilateral&&<span style={{fontFamily:"var(--sm-font-mono)",fontSize:9,color:"var(--sm-up)",border:"1px solid var(--sm-up)",borderRadius:20,padding:"2px 7px",letterSpacing:".06em"}}>UNIL.</span>}
                      <select value={ex.equipment||""} onChange={e=>setExercises(xs=>xs.map(x=>x.id===ex.id?{...x,equipment:e.target.value}:x))} style={{fontSize:11,color:"var(--sm-sub)",background:"var(--sm-card2)",border:"1px solid var(--sm-line)",borderRadius:20,padding:"3px 8px",cursor:"pointer",outline:"none",fontFamily:"var(--sm-font-mono)",letterSpacing:".05em"}}>
                        {EQUIPMENT.map(eq=><option key={eq.v} value={eq.v}>{eq.l}</option>)}
                      </select>
                      {ex.target?.reps&&<span style={{fontSize:10,color:"var(--sm-sub)",background:"var(--sm-card2)",border:"1px solid var(--sm-line)",borderRadius:20,padding:"3px 9px",fontFamily:"var(--sm-font-mono)",letterSpacing:".05em"}}>Cible {ex.target.sets?`${ex.target.sets}×`:""} {ex.target.reps}</span>}
                    </div>
                    <div style={{display:"flex",gap:4,flexShrink:0}}>
                      <button onClick={()=>setEditingExId(editingExId===ex.id?null:ex.id)} style={{...S.btnS,padding:"4px 10px",fontSize:11,color:editingExId===ex.id?"var(--sm-accent)":"var(--sm-sub)",borderColor:editingExId===ex.id?"var(--sm-accent)":"var(--sm-line)"}}>✎</button>
                      <button onClick={()=>removeExercise(ex.id)} style={{...S.btnS,padding:"4px 10px",fontSize:11}}>✕</button>
                    </div>
                  </div>
                  {editingExId===ex.id&&(
                    <div style={{background:"var(--sm-card2)",borderRadius:14,padding:"12px 14px",marginBottom:10,border:"1px solid var(--sm-line)"}}>
                      <div style={{marginBottom:10}}>
                        <span style={{fontFamily:"var(--sm-font-mono)",fontSize:9,color:"var(--sm-sub)",letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:4}}>Exercice</span>
                        <select value={ex.name} onChange={e=>{const found=[...EXERCISE_DB,...customExercises].find(x=>x.name===e.target.value);setExercises(xs=>xs.map(x=>x.id===ex.id?{...x,name:e.target.value,...(found?{muscle:found.muscle}:{})}:x));}} style={{...S.inp,fontSize:12}}>
                          {[...EXERCISE_DB,...customExercises].sort((a,b)=>a.name.localeCompare(b.name)).map(e=><option key={e.name} value={e.name}>{e.name}</option>)}
                        </select>
                      </div>
                      <div style={{marginBottom:10}}>
                        <span style={{fontFamily:"var(--sm-font-mono)",fontSize:9,color:"var(--sm-sub)",letterSpacing:".08em",textTransform:"uppercase",display:"block",marginBottom:4}}>Muscle principal</span>
                        <select value={ex.muscle} onChange={e=>setExercises(xs=>xs.map(x=>x.id===ex.id?{...x,muscle:e.target.value}:x))} style={{...S.inp,fontSize:12}}>
                          {MUSCLE_GROUPS.map(m=><option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <span style={{fontFamily:"var(--sm-font-mono)",fontSize:9,color:"var(--sm-sub)",letterSpacing:".08em",textTransform:"uppercase"}}>Unilatéral</span>
                        <button onClick={()=>setExercises(xs=>xs.map(x=>x.id===ex.id?{...x,unilateral:!x.unilateral}:x))} style={{fontSize:11,border:`1px solid ${ex.unilateral?"var(--sm-up)":"var(--sm-line)"}`,borderRadius:20,padding:"3px 12px",cursor:"pointer",background:ex.unilateral?"rgba(47,158,109,.12)":"transparent",color:ex.unilateral?"var(--sm-up)":"var(--sm-sub)",fontFamily:"var(--sm-font-mono)",letterSpacing:".06em"}}>
                          {ex.unilateral?"Oui":"Non"}
                        </button>
                      </div>
                    </div>
                  )}

                  {(ex.grip&&gripKey(ex.grip)||ex.gripNote)&&(
                    <div style={{fontSize:10,color:"var(--sm-sub)",fontFamily:"var(--sm-font-mono)",letterSpacing:".04em",marginBottom:6,display:"flex",gap:8,flexWrap:"wrap"}}>
                      {gripKey(ex.grip)&&<span style={{background:"var(--sm-card2)",borderRadius:20,padding:"2px 8px",border:"1px solid var(--sm-line)"}}>{[ex.grip.orientation,ex.grip.barPos,ex.grip.width,ex.grip.barType,ex.grip.handle].filter(Boolean).join(" · ")}</span>}
                      {ex.gripNote&&<span style={{fontStyle:"italic",color:"var(--sm-sub)"}}>{ex.gripNote}</span>}
                    </div>
                  )}
                  {last&&(()=>{
                    const validReps=last.repsPerSet.filter(r=>r>0);
                    const minR=validReps.length?Math.min(...validReps):0;
                    const maxR=validReps.length?Math.max(...validReps):0;
                    const repsStr=validReps.length?(minR===maxR?`${minR}`:`${minR}-${maxR}`):"";
                    const setsStr=last.sets.length&&repsStr?` · ${last.sets.length}×${repsStr}`:last.sets.length?` · ${last.sets.length} séries`:"";
                    return(
                      <div style={{fontSize:10,marginBottom:8,color:"var(--sm-sub)",fontFamily:"var(--sm-font-mono)",letterSpacing:".04em"}}>
                        {last.daysAgo===0?"Aujourd'hui":last.daysAgo===1?"Hier":`Il y a ${last.daysAgo}j`}{setsStr}
                      </div>
                    );
                  })()}

                  {(()=>{
                    const exProfile=getGripProfile(ex);
                    const exSecs=getAdaptedSections(exProfile,ex.equipment);
                    if(!exSecs.length)return null;
                    return(
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:8}}>
                        <span style={{fontFamily:"var(--sm-font-mono)",fontSize:9,color:"var(--sm-sub)",letterSpacing:".08em",textTransform:"uppercase"}}>Prise</span>
                        {exSecs.map(sec=>(
                          <select key={sec.key} value={ex.grip?.[sec.key]||""} onChange={e=>updateExGrip(ex.id,sec.key,e.target.value)} style={{fontSize:10,color:"var(--sm-sub)",background:"var(--sm-card2)",border:"1px solid var(--sm-line)",borderRadius:20,padding:"3px 8px",cursor:"pointer",outline:"none",fontFamily:"var(--sm-font-mono)"}}>
                            {sec.opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                          </select>
                        ))}
                      </div>
                    );
                  })()}

                  <div style={{display:"grid",gridTemplateColumns:"18px 22px 1fr 1fr 24px",gap:5,alignItems:"center",marginBottom:4}}>
                    {["#","W","kg",ex.unilateral?"G · D":"Reps",""].map((h,i)=><span key={i} style={{fontSize:9,color:ex.unilateral&&i===3?"var(--sm-up)":"var(--sm-sub)",textAlign:"center",fontFamily:"var(--sm-font-mono)",letterSpacing:".08em",textTransform:"uppercase"}}>{h}</span>)}
                  </div>

                  {(()=>{
                    let workingIdx=-1;
                    return ex.sets.map((s,si)=>{
                      if(!s.isWarmup) workingIdx++;
                      const wi=workingIdx;
                      const lastSet=(!s.isWarmup&&last)?last.sets[wi]:null;
                      const isLast=si===ex.sets.length-1;
                      const isTimerActive=activeRest?.exId===ex.id&&activeRest?.si===si;
                      const liveRestStr=isTimerActive?formatRest(liveNow-activeRest.startTime)||"0s":null;
                      const curW=parseFloat(s.weight)||0;
                      const curR=ex.unilateral?Math.max(parseInt(s.repsL)||0,parseInt(s.repsR)||0):(parseInt(s.reps)||0);
                      const lastW=parseFloat(lastSet?.weight)||0;
                      const lastR=ex.unilateral?Math.max(parseInt(lastSet?.repsL)||0,parseInt(lastSet?.repsR)||0):(parseInt(lastSet?.reps)||0);
                      const programType=ex.target?.type||"volume";
                      let wentUp=false,wentDown=false;
                      if(curW>0&&lastW>0){
                        if(curW>lastW)wentUp=true;
                        else if(curW<lastW)wentDown=true;
                        else if(curR>0&&lastR>0){
                          if(curR>lastR)wentUp=true;
                          else if(curR<lastR){if(programType==="force"){if(curR<lastR-2)wentDown=true;}else wentDown=true;}
                        }
                      }
                      return(
                        <div key={si} style={{marginBottom:6}}>
                          <div style={{display:"grid",gridTemplateColumns:"18px 22px 1fr 1fr 24px",gap:5,alignItems:"center",opacity:s.isWarmup?0.6:1}}>
                            <span style={{fontSize:11,color:"var(--sm-sub)",textAlign:"center",fontFamily:"var(--sm-font-mono)"}}>{si+1}</span>
                            <button onClick={()=>updateSet(ex.id,si,"isWarmup",!s.isWarmup)} style={{fontSize:9,fontWeight:700,border:`1px solid ${s.isWarmup?"var(--sm-accent)":"var(--sm-line)"}`,borderRadius:6,padding:"2px 0",cursor:"pointer",background:s.isWarmup?"var(--sm-accent-soft)":"transparent",color:s.isWarmup?"var(--sm-accent)":"var(--sm-sub)",lineHeight:1,width:"100%",fontFamily:"var(--sm-font-mono)"}}>W</button>
                            <input type="number" placeholder="0" value={s.weight} onChange={e=>updateSet(ex.id,si,"weight",e.target.value)} style={{...S.inp,textAlign:"center",padding:"8px 4px",fontFamily:"var(--sm-font-mono)",borderColor:wentUp?"var(--sm-up)":wentDown?"#e05555":"var(--sm-line)"}}/>
                            {ex.unilateral?(
                              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:3}}>
                                <input type="number" placeholder="G" value={s.repsL||""} onChange={e=>updateSet(ex.id,si,"repsL",e.target.value)} style={{...S.inp,textAlign:"center",padding:"8px 2px",fontFamily:"var(--sm-font-mono)",fontSize:12}}/>
                                <input type="number" placeholder="D" value={s.repsR||""} onChange={e=>updateSet(ex.id,si,"repsR",e.target.value)} style={{...S.inp,textAlign:"center",padding:"8px 2px",fontFamily:"var(--sm-font-mono)",fontSize:12}}/>
                              </div>
                            ):(
                              <input type="number" placeholder="0" value={s.reps} onChange={e=>updateSet(ex.id,si,"reps",e.target.value)} style={{...S.inp,textAlign:"center",padding:"8px 4px",fontFamily:"var(--sm-font-mono)"}}/>
                            )}
                            <button onClick={()=>removeSet(ex.id,si)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--sm-sub)",fontSize:13}}>✕</button>
                          </div>

                          {!s.isWarmup&&(
                            <div style={{display:"flex",alignItems:"center",gap:8,paddingLeft:24,marginTop:3,flexWrap:"wrap"}}>
                              {lastSet&&lastW>0&&(()=>{
                                const dir=setDirection(lastR,ex.target?.reps);
                                const col=dir==="up"?"var(--sm-up)":dir==="down"?"#e05555":"var(--sm-sub)";
                                const icon=dir==="up"?"↑":dir==="down"?"↓":"→";
                                const repsDisplay=ex.unilateral&&(lastSet.repsL||lastSet.repsR)?`${lastSet.repsL||"—"}/${lastSet.repsR||"—"}`:`${lastR}`;
                                const extraDisp=lastSet.repsExtra?.trim()?` +${lastSet.repsExtra.trim()}p`:"";
                                return(
                                  <span style={{fontFamily:"var(--sm-font-mono)",fontSize:10,color:col,letterSpacing:".04em"}}>
                                    {icon} {lastW}kg × {repsDisplay}{extraDisp}
                                  </span>
                                );
                              })()}
                              {!lastSet&&sugg&&wi===0&&(
                                <span style={{fontFamily:"var(--sm-font-mono)",fontSize:10,letterSpacing:".04em",fontWeight:600,color:sugg.direction==="up"?"var(--sm-up)":sugg.direction==="down"?"#e05555":"var(--sm-sub)"}}>
                                  {sugg.direction==="up"?"↑ Augmenter":sugg.direction==="hold"?"→ Maintenir":"↓ Alléger"}
                                </span>
                              )}
                              <button onClick={()=>updateSet(ex.id,si,"note",s.note===undefined?"":s.note===""?" ":"")} style={{fontSize:9,background:"none",border:"1px solid var(--sm-line)",borderRadius:8,padding:"2px 8px",cursor:"pointer",color:s.note?.trim()?"var(--sm-accent)":"var(--sm-sub)",fontFamily:"var(--sm-font-mono)",letterSpacing:".06em"}}>
                                {s.note?.trim()?"note ✓":"+ note"}
                              </button>
                              <button onClick={()=>updateSet(ex.id,si,"repsExtra",s.repsExtra?.trim()?"":s.repsExtra===""?" ":"")} style={{fontSize:9,background:"none",border:"1px solid var(--sm-line)",borderRadius:8,padding:"2px 8px",cursor:"pointer",color:s.repsExtra?.trim()?"var(--sm-up)":"var(--sm-sub)",fontFamily:"var(--sm-font-mono)",letterSpacing:".06em"}}>
                                {s.repsExtra?.trim()?`+${s.repsExtra.trim()}p`:"+ partiel"}
                              </button>
                            </div>
                          )}

                          {!s.isWarmup&&(s.note?.trim()||s.note===" ")&&(
                            <div style={{paddingLeft:24,marginTop:4}}>
                              <input value={s.note?.trim()?s.note:""} onChange={e=>updateSet(ex.id,si,"note",e.target.value)} placeholder="Note sur cette série…" style={{...S.inp,fontSize:11,padding:"6px 10px",width:"100%"}}/>
                            </div>
                          )}

                          {!s.isWarmup&&(s.repsExtra?.trim()||s.repsExtra===" ")&&(
                            <div style={{paddingLeft:24,marginTop:4}}>
                              <input type="number" value={s.repsExtra?.trim()?s.repsExtra:""} onChange={e=>updateSet(ex.id,si,"repsExtra",e.target.value)} placeholder="Reps partielles…" style={{...S.inp,fontSize:11,padding:"6px 10px",width:"100%"}}/>
                            </div>
                          )}

                          {s.restMs&&s.restMs>0?(
                            <div style={{fontSize:10,color:"var(--sm-sub)",paddingLeft:24,marginTop:3,display:"flex",alignItems:"center",gap:6,fontFamily:"var(--sm-font-mono)",letterSpacing:".06em"}}>
                              Repos : <strong style={{color:"var(--sm-ink)"}}>{formatRest(s.restMs)}</strong>
                              <button onClick={()=>updateSet(ex.id,si,"restMs",null)} style={{fontSize:9,color:"var(--sm-sub)",background:"none",border:"none",cursor:"pointer",opacity:0.5,padding:0}}>↺</button>
                            </div>
                          ):isTimerActive?(
                            <div style={{display:"flex",alignItems:"center",gap:8,paddingLeft:24,marginTop:3}}>
                              <span style={{fontSize:15,fontWeight:700,color:"var(--sm-accent)",fontFamily:"var(--sm-font-mono)",letterSpacing:".06em"}}>{liveRestStr}</span>
                              <button onClick={stopRest} style={{fontSize:11,color:"var(--sm-accent-ink)",background:"var(--sm-accent)",border:"none",borderRadius:10,padding:"4px 12px",cursor:"pointer",fontWeight:600}}>Arrêter</button>
                            </div>
                          ):isLast&&!activeRest?(
                            <div style={{paddingLeft:24,marginTop:3}}>
                              <button onClick={()=>startRest(ex.id,si)} style={{fontSize:11,color:"var(--sm-sub)",border:"1px solid var(--sm-line)",borderRadius:10,padding:"4px 12px",background:"transparent",cursor:"pointer",fontFamily:"var(--sm-font-mono)",letterSpacing:".04em"}}>Démarrer le repos</button>
                            </div>
                          ):null}
                        </div>
                      );
                    });
                  })()}

                  <button onClick={()=>addSet(ex.id)} style={{...S.btnS,marginTop:8,fontSize:11}}>+ Série</button>
                  <input value={ex.notes||""} onChange={e=>updateExNotes(ex.id,e.target.value)} placeholder="Note technique…" style={{...S.inp,marginTop:8,fontSize:12,padding:"8px 12px"}}/>
                </div>
              );
            })}

            <button onClick={()=>setShowExPicker(true)} style={{...S.btnS,width:"100%",padding:"14px",fontSize:14,borderStyle:"dashed",borderRadius:20,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <span style={{fontSize:20,lineHeight:1}}>+</span> Ajouter un exercice
            </button>

            {showExPicker&&<ExercisePicker S={S}
              allExercises={allExercisesList}
              recentVariants={allExVariants.filter(v=>!exercises.find(e=>e.name===v.name&&(e.equipment||"")===(v.equipment||"")))}
              onSelect={addExercise}
              onRename={renameExercise}
              onCancel={()=>setShowExPicker(false)}/>}

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
                      const isPR=prSet.has(s.id+":"+exKey(e.name,e.equipment||"",null,e.unilateral));
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
                              {working.map((st,j)=>{
                                const repsDisp=(st.repsL||st.repsR)?`${st.repsL||"—"}/${st.repsR||"—"}`:(st.reps||"—");
                                return(
                                  <span key={j} style={{display:"inline-block",marginRight:7,whiteSpace:"nowrap",background:"var(--sm-card2)",borderRadius:8,padding:"2px 8px",border:"1px solid var(--sm-line)"}}>
                                    <strong>{st.weight||"—"}</strong>×<strong>{repsDisp}</strong>
                                  </span>
                                );
                              })}
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
                {progressVariants.map(v=><option key={v.key} value={v.key}>{v.name}{v.unilateral?" (Unilatéral)":""}</option>)}
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

                  {progressUnilateral&&progressData.some(d=>d.avgRepsL>0||d.avgRepsR>0)&&(
                    <div style={S.card}>
                      <p style={{margin:"0 0 4px",fontSize:14,fontWeight:700,color:"var(--sm-ink)"}}>Reps Gauche vs Droite</p>
                      <p style={{margin:"0 0 12px",fontSize:11,color:"var(--sm-sub)",fontFamily:"var(--sm-font-serif)",fontStyle:"italic"}}>Moyenne de reps par série, par côté</p>
                      <div style={{width:"100%",height:180}}>
                        <ResponsiveContainer><LineChart data={progressData} margin={{top:5,right:10,left:-10,bottom:0}}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--sm-line)"/>
                          <XAxis dataKey="label" tick={{fontSize:10,fill:"var(--sm-sub)",fontFamily:"var(--sm-font-mono)"}} stroke="var(--sm-line)"/>
                          <YAxis tick={{fontSize:11,fill:"var(--sm-sub)"}} stroke="var(--sm-line)"/>
                          <Tooltip contentStyle={{background:"var(--sm-card)",border:"1px solid var(--sm-line)",borderRadius:14,fontSize:12,color:"var(--sm-ink)"}} formatter={(v,n)=>[`${v} reps`,n]}/>
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:11,fontFamily:"var(--sm-font-mono)",paddingTop:8}}/>
                          <Line type="monotone" dataKey="avgRepsL" name="Gauche" stroke="var(--sm-accent)" strokeWidth={2} dot={{r:3,fill:"var(--sm-accent)"}}/>
                          <Line type="monotone" dataKey="avgRepsR" name="Droite" stroke="var(--sm-up)" strokeWidth={2} dot={{r:3,fill:"var(--sm-up)"}}/>
                        </LineChart></ResponsiveContainer>
                      </div>
                    </div>
                  )}

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

              <div style={{marginTop:18,paddingTop:16,borderTop:"1px solid var(--sm-line)"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                  <span style={{fontFamily:"var(--sm-font-mono)",fontSize:9,color:"var(--sm-sub)",letterSpacing:".08em",textTransform:"uppercase"}}>Sauvegardes ({backups.length}/8)</span>
                  <button onClick={manualBackup} disabled={backupLoading} style={{...S.btnS,padding:"6px 14px",fontSize:11,opacity:backupLoading?0.5:1}}>
                    {backupLoading?"Sauvegarde…":"+ Créer une sauvegarde"}
                  </button>
                </div>
                {backups.length===0&&<p style={{fontSize:11,color:"var(--sm-sub)",fontStyle:"italic",fontFamily:"var(--sm-font-serif)"}}>Aucune sauvegarde pour l'instant. Une sauvegarde automatique est créée chaque semaine.</p>}
                {backups.map((b,i)=>{
                  const d=new Date(b.created_at);
                  const label=d.toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"})+" · "+d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
                  return(
                    <div key={b.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:i<backups.length-1?"1px solid var(--sm-line)":"none"}}>
                      <span style={{fontSize:12,color:"var(--sm-txt)",fontFamily:"var(--sm-font-mono)"}}>{label}{i===0&&<span style={{marginLeft:6,fontSize:9,color:"var(--sm-up)",background:"rgba(47,158,109,.12)",borderRadius:8,padding:"2px 6px"}}>récente</span>}</span>
                      {restoreConfirm===b.id
                        ?<div style={{display:"flex",gap:6}}>
                          <button onClick={()=>handleRestore(b.id)} style={{...S.btnP,padding:"5px 12px",fontSize:11}}>Confirmer</button>
                          <button onClick={()=>setRestoreConfirm(null)} style={{...S.btnS,padding:"5px 12px",fontSize:11}}>Annuler</button>
                        </div>
                        :<button onClick={()=>setRestoreConfirm(b.id)} style={{...S.btnS,padding:"5px 12px",fontSize:11}}>Restaurer</button>
                      }
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>

      <BottomNav tab={tab} setTab={setTab}/>
    </div>
  );
}
