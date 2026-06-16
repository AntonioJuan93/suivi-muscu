// Base d'exercices — {name, muscle, equipment, unilateral, category}
// category: "compound" | "isolation"

export const EXERCISE_DB = [
  // ── Pectoraux ────────────────────────────────────────────────────────────────
  { name:"Développé couché",            muscle:"Pectoraux",           equipment:"barre",    category:"compound" },
  { name:"Développé couché incliné",    muscle:"Pectoraux supérieurs",equipment:"barre",    category:"compound" },
  { name:"Développé couché décliné",    muscle:"Pectoraux inférieurs",equipment:"barre",    category:"compound" },
  { name:"Développé couché",            muscle:"Pectoraux",           equipment:"alteres",  category:"compound" },
  { name:"Développé couché incliné",    muscle:"Pectoraux supérieurs",equipment:"alteres",  category:"compound" },
  { name:"Écarté",                      muscle:"Pectoraux",           equipment:"alteres",  category:"isolation" },
  { name:"Écarté poulie",               muscle:"Pectoraux",           equipment:"poulie",   category:"isolation" },
  { name:"Dips",                        muscle:"Pectoraux inférieurs",equipment:"",         category:"compound" },
  { name:"Pompes",                      muscle:"Pectoraux",           equipment:"",         category:"compound" },
  { name:"Développé couché",            muscle:"Pectoraux",           equipment:"machine",  category:"compound" },
  { name:"Pec deck",                    muscle:"Pectoraux",           equipment:"machine",  category:"isolation" },

  // ── Épaules ──────────────────────────────────────────────────────────────────
  { name:"Développé militaire",         muscle:"Épaules antérieures", equipment:"barre",    category:"compound" },
  { name:"Développé épaules",           muscle:"Épaules antérieures", equipment:"alteres",  category:"compound" },
  { name:"Développé épaules",           muscle:"Épaules antérieures", equipment:"machine",  category:"compound" },
  { name:"Élévations latérales",        muscle:"Épaules latérales",   equipment:"alteres",  category:"isolation", unilateral:true },
  { name:"Élévations latérales",        muscle:"Épaules latérales",   equipment:"poulie",   category:"isolation", unilateral:true },
  { name:"Élévations frontales",        muscle:"Épaules antérieures", equipment:"alteres",  category:"isolation", unilateral:true },
  { name:"Face pull",                   muscle:"Épaules postérieures",equipment:"poulie",   category:"isolation" },
  { name:"Oiseau",                      muscle:"Épaules postérieures",equipment:"alteres",  category:"isolation" },
  { name:"Rowing menton",               muscle:"Épaules latérales",   equipment:"barre",    category:"compound" },

  // ── Triceps ──────────────────────────────────────────────────────────────────
  { name:"Triceps poulie haute",        muscle:"Triceps",             equipment:"poulie",   category:"isolation" },
  { name:"Triceps corde",               muscle:"Triceps",             equipment:"poulie",   category:"isolation" },
  { name:"Barre au front",              muscle:"Triceps",             equipment:"barre",    category:"isolation" },
  { name:"Extension triceps",           muscle:"Triceps",             equipment:"alteres",  category:"isolation", unilateral:true },
  { name:"Extension triceps",           muscle:"Triceps",             equipment:"poulie",   category:"isolation", unilateral:true },
  { name:"Kickback triceps",            muscle:"Triceps",             equipment:"alteres",  category:"isolation", unilateral:true },
  { name:"Dips (triceps)",              muscle:"Triceps",             equipment:"",         category:"compound" },

  // ── Grand dorsaux / Dos ──────────────────────────────────────────────────────
  { name:"Tractions",                   muscle:"Grand dorsaux",       equipment:"",         category:"compound" },
  { name:"Tirage poulie haute",         muscle:"Grand dorsaux",       equipment:"poulie",   category:"compound" },
  { name:"Tirage horizontal",           muscle:"Grand dorsaux",       equipment:"poulie",   category:"compound" },
  { name:"Rowing barre",                muscle:"Grand dorsaux",       equipment:"barre",    category:"compound" },
  { name:"Rowing altère",               muscle:"Grand dorsaux",       equipment:"alteres",  category:"compound", unilateral:true },
  { name:"Rowing machine",              muscle:"Grand dorsaux",       equipment:"machine",  category:"compound" },
  { name:"Tirage coude au corps",       muscle:"Grand dorsaux",       equipment:"poulie",   category:"isolation", unilateral:true },
  { name:"Pull-over",                   muscle:"Grand dorsaux",       equipment:"alteres",  category:"isolation" },
  { name:"Soulevé de terre",            muscle:"Grand dorsaux",       equipment:"barre",    category:"compound" },

  // ── Trapèzes ─────────────────────────────────────────────────────────────────
  { name:"Haussements d'épaules",       muscle:"Trapèzes",            equipment:"barre",    category:"isolation" },
  { name:"Haussements d'épaules",       muscle:"Trapèzes",            equipment:"alteres",  category:"isolation" },

  // ── Lombaires ────────────────────────────────────────────────────────────────
  { name:"Soulevé de terre roumain",    muscle:"Lombaires",           equipment:"barre",    category:"compound" },
  { name:"Hyperextensions",             muscle:"Lombaires",           equipment:"",         category:"isolation" },
  { name:"Good morning",               muscle:"Lombaires",           equipment:"barre",    category:"compound" },

  // ── Biceps ───────────────────────────────────────────────────────────────────
  { name:"Curl barre",                  muscle:"Biceps",              equipment:"barre",    category:"isolation" },
  { name:"Curl altères",                muscle:"Biceps",              equipment:"alteres",  category:"isolation", unilateral:true },
  { name:"Curl marteau",                muscle:"Biceps",              equipment:"alteres",  category:"isolation", unilateral:true },
  { name:"Curl pupitre",                muscle:"Biceps",              equipment:"barre",    category:"isolation" },
  { name:"Curl poulie basse",           muscle:"Biceps",              equipment:"poulie",   category:"isolation", unilateral:true },

  // ── Quadriceps ───────────────────────────────────────────────────────────────
  { name:"Squat",                       muscle:"Quadriceps",          equipment:"barre",    category:"compound" },
  { name:"Squat avant",                 muscle:"Quadriceps",          equipment:"barre",    category:"compound" },
  { name:"Presse à cuisses",            muscle:"Quadriceps",          equipment:"machine",  category:"compound" },
  { name:"Leg extension",               muscle:"Quadriceps",          equipment:"machine",  category:"isolation", unilateral:true },
  { name:"Fentes",                      muscle:"Quadriceps",          equipment:"barre",    category:"compound", unilateral:true },
  { name:"Fentes altères",              muscle:"Quadriceps",          equipment:"alteres",  category:"compound", unilateral:true },
  { name:"Fentes bulgares",             muscle:"Quadriceps",          equipment:"alteres",  category:"compound", unilateral:true },
  { name:"Hack squat",                  muscle:"Quadriceps",          equipment:"machine",  category:"compound" },
  { name:"Squat",                       muscle:"Quadriceps",          equipment:"smith",    category:"compound" },

  // ── Ischio-jambiers ──────────────────────────────────────────────────────────
  { name:"Leg curl allongé",            muscle:"Ischio-jambiers",     equipment:"machine",  category:"isolation", unilateral:true },
  { name:"Leg curl assis",              muscle:"Ischio-jambiers",     equipment:"machine",  category:"isolation" },
  { name:"SL Deadlift",                 muscle:"Ischio-jambiers",     equipment:"barre",    category:"compound" },

  // ── Fessiers ─────────────────────────────────────────────────────────────────
  { name:"Hip thrust",                  muscle:"Fessiers",            equipment:"barre",    category:"compound" },
  { name:"Hip thrust",                  muscle:"Fessiers",            equipment:"machine",  category:"compound" },
  { name:"Abduction",                   muscle:"Fessiers",            equipment:"machine",  category:"isolation" },
  { name:"Kickback fessier",            muscle:"Fessiers",            equipment:"poulie",   category:"isolation", unilateral:true },
  { name:"Romanian deadlift",           muscle:"Fessiers",            equipment:"barre",    category:"compound" },
  { name:"Fentes marchées",             muscle:"Fessiers",            equipment:"alteres",  category:"compound", unilateral:true },

  // ── Mollets ──────────────────────────────────────────────────────────────────
  { name:"Mollets debout",              muscle:"Mollets",             equipment:"machine",  category:"isolation" },
  { name:"Mollets assis",               muscle:"Mollets",             equipment:"machine",  category:"isolation" },
  { name:"Mollets presse",              muscle:"Mollets",             equipment:"machine",  category:"isolation" },
  { name:"Mollets debout",              muscle:"Mollets",             equipment:"alteres",  category:"isolation", unilateral:true },

  // ── Abdos ────────────────────────────────────────────────────────────────────
  { name:"Crunch",                      muscle:"Abdos",               equipment:"",         category:"isolation" },
  { name:"Crunch câble",                muscle:"Abdos",               equipment:"poulie",   category:"isolation" },
  { name:"Relevé de jambes",            muscle:"Abdos",               equipment:"",         category:"isolation" },
  { name:"Planche",                     muscle:"Abdos",               equipment:"",         category:"isolation" },
  { name:"Russian twist",               muscle:"Abdos",               equipment:"",         category:"isolation" },
  { name:"Ab wheel",                    muscle:"Abdos",               equipment:"",         category:"isolation" },
];
