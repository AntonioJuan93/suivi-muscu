export const MUSCLE_GROUPS = ["Pectoraux","Dos","Épaules","Biceps","Triceps","Quadriceps","Ischio-jambiers","Mollets","Abdos","Fessiers"];

export const INITIAL_PROGRAMS = [
  { id:1, name:"Push (Poussée)", muscles:["Pectoraux","Épaules","Triceps"], exercises:["Développé couché","Développé militaire","Écarté poulie","Triceps poulie"] },
  { id:2, name:"Pull (Tirage)", muscles:["Dos","Biceps"], exercises:["Tractions","Rowing barre","Curl barre","Tirage poulie haute"] },
  { id:3, name:"Legs (Jambes)", muscles:["Quadriceps","Ischio-jambiers","Mollets","Fessiers"], exercises:["Squat","Presse à cuisses","Fentes","Leg curl","Hip thrust","Mollets debout"] },
];

export const THEMES = {
  forest:    { label:"🌿 Forest",     bg:"#eef4ee", bgCard:"#ffffff", bgInput:"#f7fbf7", bgModal:"#ffffff", border:"#d0e4d0", text:"#1a2e1c", muted:"#6a8f6a", accent:"#3a7d44", accentDim:"#d4ebd6", danger:"#c0392b", onAccent:"#fff", chart2:"#8fbf6a", shadow:"0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)" },
  carbon:    { label:"⚡ Carbon",      bg:"#0d0d0d", bgCard:"#1a1a1a", bgInput:"#222222", bgModal:"#161616", border:"#2a2a2a", text:"#f0f0f0", muted:"#666666", accent:"#f5e642", accentDim:"#2a2600", danger:"#ff4d4d", onAccent:"#111", chart2:"#888", shadow:"0 1px 3px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.5)" },
  cappuccino:{ label:"☕ Cappuccino",  bg:"#f5ede0", bgCard:"#ffffff", bgInput:"#fdf6ee", bgModal:"#ffffff", border:"#e0c9b0", text:"#3b2a1a", muted:"#9a7a5a", accent:"#8b5e3c", accentDim:"#f0deca", danger:"#c0392b", onAccent:"#fff", chart2:"#c8a06a", shadow:"0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.09)" },
  nordic:    { label:"🏔️ Nordic",     bg:"#1a2030", bgCard:"#222b3a", bgInput:"#2a3448", bgModal:"#1a2030", border:"#364255", text:"#e4eaf5", muted:"#7a8fa8", accent:"#5bc4e8", accentDim:"#162f3e", danger:"#f07878", onAccent:"#0d1a24", chart2:"#4a6fa5", shadow:"0 1px 3px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.4)" },
  anthracite:{ label:"🌑 Anthracite",  bg:"#161616", bgCard:"#202020", bgInput:"#2a2a2a", bgModal:"#1c1c1c", border:"#333333", text:"#f0f0f0", muted:"#888888", accent:"#7F77DD", accentDim:"#28264a", danger:"#f87171", onAccent:"#fff", chart2:"#a06fd8", shadow:"0 1px 3px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.45)" },
  ocean:     { label:"🌊 Ocean",       bg:"#0b1825", bgCard:"#112233", bgInput:"#162d44", bgModal:"#0b1825", border:"#244060", text:"#e0f0ff", muted:"#6a90b0", accent:"#2dd4bf", accentDim:"#0a2e2b", danger:"#f07878", onAccent:"#06201d", chart2:"#3b82f6", shadow:"0 1px 3px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.4)" },
};

export function formatDate(d) { return new Date(d).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"2-digit"}); }
export function calcVolume(sets) { return sets.reduce((acc,s)=>acc+(parseFloat(s.weight)||0)*(parseInt(s.reps)||0),0); }
export function estimate1RM(weight,reps) { const w=parseFloat(weight)||0,r=parseInt(reps)||0; if(!w||!r)return 0; return Math.round(w*(1+r/30)); }
export function startOfWeek(d) { const x=new Date(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return x; }

export function makeStyles(T) {
  return {
    inp:{ background:T.bgInput, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 14px", fontSize:14, color:T.text, outline:"none", width:"100%", boxSizing:"border-box" },
    card:{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:14, padding:"16px 18px", marginBottom:12, boxShadow:T.shadow },
    btnP:{ background:T.accent, color:T.onAccent, border:"none", borderRadius:10, padding:"11px 22px", cursor:"pointer", fontSize:14, fontWeight:600, letterSpacing:"0.01em" },
    btnS:{ background:"transparent", color:T.muted, border:`1px solid ${T.border}`, borderRadius:8, padding:"7px 14px", cursor:"pointer", fontSize:13 },
    btnD:{ background:"transparent", color:T.danger, border:`1px solid ${T.danger}`, borderRadius:8, padding:"7px 14px", cursor:"pointer", fontSize:13 },
  };
}
