export const MUSCLE_GROUPS = ["Pectoraux","Dos","Épaules","Biceps","Triceps","Quadriceps","Ischio-jambiers","Mollets","Abdos","Fessiers"];

export const INITIAL_PROGRAMS = [
  { id:1, name:"Push (Poussée)", muscles:["Pectoraux","Épaules","Triceps"], exercises:["Développé couché","Développé militaire","Écarté poulie","Triceps poulie"] },
  { id:2, name:"Pull (Tirage)", muscles:["Dos","Biceps"], exercises:["Tractions","Rowing barre","Curl barre","Tirage poulie haute"] },
  { id:3, name:"Legs (Jambes)", muscles:["Quadriceps","Ischio-jambiers","Mollets","Fessiers"], exercises:["Squat","Presse à cuisses","Fentes","Leg curl","Hip thrust","Mollets debout"] },
];

export const THEMES = {
  forest:    { label:"🌿 Forest",     bg:"#eef4ee", bgCard:"#f7fbf7", bgInput:"#ffffff", bgModal:"#f7fbf7", border:"#c2d9c2", text:"#1f3320", muted:"#6a8f6a", accent:"#3a7d44", accentDim:"#d4ebd6", danger:"#b94040", onAccent:"#fff", chart2:"#8fbf6a" },
  carbon:    { label:"⚡ Carbon",      bg:"#111111", bgCard:"#1a1a1a", bgInput:"#222222", bgModal:"#161616", border:"#2e2e2e", text:"#f5f5f5", muted:"#777777", accent:"#f5e642", accentDim:"#2e2a00", danger:"#ff4d4d", onAccent:"#111", chart2:"#888" },
  cappuccino:{ label:"☕ Cappuccino",  bg:"#f5ede0", bgCard:"#fdf6ee", bgInput:"#ffffff", bgModal:"#fdf6ee", border:"#ddc9b0", text:"#3b2a1a", muted:"#9a7a5a", accent:"#8b5e3c", accentDim:"#f0deca", danger:"#b94040", onAccent:"#fff", chart2:"#c8a06a" },
  nordic:    { label:"🏔️ Nordic",     bg:"#1e2430", bgCard:"#252d3a", bgInput:"#2c3547", bgModal:"#1e2430", border:"#3a4559", text:"#e4eaf5", muted:"#7a8fa8", accent:"#5bc4e8", accentDim:"#1a3a4a", danger:"#f07878", onAccent:"#0d1a24", chart2:"#4a6fa5" },
  anthracite:{ label:"🌑 Anthracite",  bg:"#1a1a1a", bgCard:"#242424", bgInput:"#2e2e2e", bgModal:"#1f1f1f", border:"#3a3a3a", text:"#f0f0f0", muted:"#888888", accent:"#7F77DD", accentDim:"#2e2b4a", danger:"#f87171", onAccent:"#fff", chart2:"#a06fd8" },
  ocean:     { label:"🌊 Ocean",       bg:"#0d1b2a", bgCard:"#14283c", bgInput:"#1b3450", bgModal:"#0d1b2a", border:"#2a4a68", text:"#e0f0ff", muted:"#6a90b0", accent:"#2dd4bf", accentDim:"#0d3a38", danger:"#f07878", onAccent:"#06201d", chart2:"#3b82f6" },
};

export function formatDate(d) { return new Date(d).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"2-digit"}); }
export function calcVolume(sets) { return sets.reduce((acc,s)=>acc+(parseFloat(s.weight)||0)*(parseInt(s.reps)||0),0); }
export function estimate1RM(weight,reps) { const w=parseFloat(weight)||0,r=parseInt(reps)||0; if(!w||!r)return 0; return Math.round(w*(1+r/30)); }
export function startOfWeek(d) { const x=new Date(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return x; }

export function makeStyles(T) {
  return {
    inp:{ background:T.bgInput, border:`1px solid ${T.border}`, borderRadius:8, padding:"7px 10px", fontSize:13, color:T.text, outline:"none", width:"100%", boxSizing:"border-box" },
    card:{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:12, padding:"14px 16px", marginBottom:12 },
    btnP:{ background:T.accent, color:T.onAccent, border:"none", borderRadius:8, padding:"8px 18px", cursor:"pointer", fontSize:13, fontWeight:700 },
    btnS:{ background:"transparent", color:T.muted, border:`1px solid ${T.border}`, borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:12 },
    btnD:{ background:"transparent", color:T.danger, border:`1px solid ${T.danger}`, borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:12 },
  };
}