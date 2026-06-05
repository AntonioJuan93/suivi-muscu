export const MUSCLE_GROUPS = ["Pectoraux","Dos","Épaules","Biceps","Triceps","Quadriceps","Ischio-jambiers","Mollets","Abdos","Fessiers"];

export const INITIAL_PROGRAMS = [
  { id:1, name:"Push (Poussée)", muscles:["Pectoraux","Épaules","Triceps"], exercises:["Développé couché","Développé militaire","Écarté poulie","Triceps poulie"] },
  { id:2, name:"Pull (Tirage)", muscles:["Dos","Biceps"], exercises:["Tractions","Rowing barre","Curl barre","Tirage poulie haute"] },
  { id:3, name:"Legs (Jambes)", muscles:["Quadriceps","Ischio-jambiers","Mollets","Fessiers"], exercises:["Squat","Presse à cuisses","Fentes","Leg curl","Hip thrust","Mollets debout"] },
];

export const THEMES = {
  clair: {
    label:"☀️ Clair",
    bg:"#f8f9fa",       bgCard:"#ffffff",   bgInput:"#f1f3f4",
    bgModal:"#ffffff",  border:"#dadce0",   text:"#202124",
    muted:"#5f6368",    accent:"#1a73e8",   accentDim:"#e8f0fe",
    danger:"#d93025",   onAccent:"#ffffff", chart2:"#34a853",
    shadow:"0 1px 2px rgba(60,64,67,0.08), 0 4px 16px rgba(60,64,67,0.10)",
  },
  sombre: {
    label:"🌙 Sombre",
    bg:"#202124",       bgCard:"#292a2d",   bgInput:"#3c4043",
    bgModal:"#292a2d",  border:"#5f6368",   text:"#e8eaed",
    muted:"#9aa0a6",    accent:"#8ab4f8",   accentDim:"#1e3a5f",
    danger:"#f28b82",   onAccent:"#202124", chart2:"#81c995",
    shadow:"0 1px 2px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.4)",
  },
};

export function formatDate(d) { return new Date(d).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"2-digit"}); }
export function calcVolume(sets) { return sets.reduce((acc,s)=>acc+(parseFloat(s.weight)||0)*(parseInt(s.reps)||0),0); }
export function estimate1RM(weight,reps) { const w=parseFloat(weight)||0,r=parseInt(reps)||0; if(!w||!r)return 0; return Math.round(w*(1+r/30)); }
export function startOfWeek(d) { const x=new Date(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return x; }

export function makeStyles(T) {
  return {
    inp:  { background:T.bgInput, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 14px", fontSize:14, color:T.text, outline:"none", width:"100%", boxSizing:"border-box" },
    card: { background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:14, padding:"16px 18px", marginBottom:12, boxShadow:T.shadow },
    btnP: { background:T.accent, color:T.onAccent, border:"none", borderRadius:10, padding:"11px 22px", cursor:"pointer", fontSize:14, fontWeight:600, letterSpacing:"0.01em" },
    btnS: { background:"transparent", color:T.muted, border:`1px solid ${T.border}`, borderRadius:8, padding:"7px 14px", cursor:"pointer", fontSize:13 },
    btnD: { background:"transparent", color:T.danger, border:`1px solid ${T.danger}`, borderRadius:8, padding:"7px 14px", cursor:"pointer", fontSize:13 },
  };
}
