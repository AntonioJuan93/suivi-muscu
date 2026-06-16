export const MUSCLE_GROUPS = [
  "Pectoraux supérieurs",
  "Pectoraux",
  "Pectoraux inférieurs",
  "Grand dorsaux",
  "Trapèzes",
  "Lombaires",
  "Épaules antérieures",
  "Épaules latérales",
  "Épaules postérieures",
  "Biceps",
  "Triceps",
  "Quadriceps",
  "Ischio-jambiers",
  "Mollets",
  "Abdos",
  "Fessiers",
];

export const INITIAL_PROGRAMS = [
  { id:1, name:"Push (Poussée)", muscles:["Pectoraux","Pectoraux supérieurs","Épaules antérieures","Épaules latérales","Triceps"], exercises:["Développé couché","Développé militaire","Écarté poulie","Triceps poulie"] },
  { id:2, name:"Pull (Tirage)", muscles:["Grand dorsaux","Trapèzes","Biceps"], exercises:["Tractions","Rowing barre","Curl barre","Tirage poulie haute"] },
  { id:3, name:"Legs (Jambes)", muscles:["Quadriceps","Ischio-jambiers","Mollets","Fessiers"], exercises:["Squat","Presse à cuisses","Fentes","Leg curl","Hip thrust","Mollets debout"] },
];

/* T — toutes les valeurs pointent vers les CSS variables PULSE.
   Changer une couleur = éditer index.css :root ou [data-theme="dark"]. */
export const T = {
  bg:        "var(--sm-bg)",
  bgCard:    "var(--sm-card)",
  bgInput:   "var(--sm-card2)",
  bgModal:   "var(--sm-card)",
  text:      "var(--sm-ink)",
  muted:     "var(--sm-sub)",
  border:    "var(--sm-line)",
  faint:     "var(--sm-faint)",
  accent:    "var(--sm-accent)",
  accentDim: "var(--sm-accent-soft)",
  onAccent:  "var(--sm-accent-ink)",
  up:        "var(--sm-up)",
  danger:    "#e05555",
  shadow:    "var(--sm-shadow)",
  chart2:    "var(--sm-up)",
  fontUI:    "var(--sm-font-ui)",
  fontDisp:  "var(--sm-font-disp)",
  fontSerif: "var(--sm-font-serif)",
  fontMono:  "var(--sm-font-mono)",
};

export function makeStyles() {
  return {
    inp:  { background:"var(--sm-card2)", border:"1px solid var(--sm-line)", borderRadius:12, padding:"10px 14px", fontSize:14, color:"var(--sm-ink)", outline:"none", width:"100%", boxSizing:"border-box" },
    card: { background:"var(--sm-card)", border:"1px solid var(--sm-line)", borderRadius:24, padding:"18px 20px", marginBottom:14, boxShadow:"var(--sm-shadow)" },
    btnP: { background:"var(--sm-accent)", color:"var(--sm-accent-ink)", border:"none", borderRadius:16, padding:"12px 24px", cursor:"pointer", fontSize:14, fontWeight:600, letterSpacing:"0.01em" },
    btnS: { background:"transparent", color:"var(--sm-sub)", border:"1px solid var(--sm-line)", borderRadius:16, padding:"8px 16px", cursor:"pointer", fontSize:13 },
    btnD: { background:"transparent", color:"#e05555", border:"1px solid #e05555", borderRadius:16, padding:"8px 16px", cursor:"pointer", fontSize:13 },
  };
}

export function formatDate(d) { return new Date(d).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"2-digit"}); }
export function calcVolume(sets) { return sets.reduce((acc,s)=>acc+(parseFloat(s.weight)||0)*(parseInt(s.reps)||0),0); }
export function estimate1RM(weight,reps) {
  const w=parseFloat(weight)||0,r=parseInt(reps)||0;
  if(!w||!r||r>20)return 0;
  if(r===1)return Math.round(w);
  if(r<=10) return Math.round(w/(1.0278-0.0278*r));
  return Math.round(w*(1+r/30));
}
export function startOfWeek(d) { const x=new Date(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return x; }
