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
    muted:"#80868b",    accent:"#6d28d9",   accentDim:"#ede9fe",
    danger:"#d93025",   onAccent:"#ffffff", chart2:"#a855f7",
    shadow:"0 1px 2px rgba(60,64,67,0.08), 0 4px 16px rgba(60,64,67,0.10)",
  },
  sombre: {
    label:"🌙 Sombre",
    bg:"#0c0a14",       bgCard:"#131020",   bgInput:"#1c1830",
    bgModal:"#13102a",  border:"#2e2450",   text:"#ede8ff",
    muted:"#6b5c8a",    accent:"#c084fc",   accentDim:"#c084fc18",
    danger:"#ff4d6d",   onAccent:"#0c0a14", chart2:"#f472b6",
    shadow:"0 0 0 1px #c084fc22, 0 4px 28px rgba(192,132,252,0.18)",
  },
};

export function formatDate(d) { return new Date(d).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"2-digit"}); }
export function calcVolume(sets) { return sets.reduce((acc,s)=>acc+(parseFloat(s.weight)||0)*(parseInt(s.reps)||0),0); }
export function estimate1RM(weight,reps) {
  const w=parseFloat(weight)||0,r=parseInt(reps)||0;
  if(!w||!r||r>20)return 0;
  if(r===1)return Math.round(w);
  // Brzycki (plus précis pour 2-10 reps), Epley au-dessus
  if(r<=10) return Math.round(w/(1.0278-0.0278*r));
  return Math.round(w*(1+r/30));
}
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
