// Base d'exercices PULSE
// tension: "etirement" | "contraction" | "neutre"
// category: "compound" | "isolation"
// muscles: muscles secondaires

export const EXERCISE_DB = [

  // ── Pectoraux ────────────────────────────────────────────────────────────────
  { name:"Développé couché",          muscle:"Pectoraux",           muscles:["Épaules antérieures","Triceps"],        category:"compound",  tension:"contraction" },
  { name:"Pec fly",                   muscle:"Pectoraux",           muscles:["Épaules antérieures"],                  category:"isolation", tension:"etirement"   },
  { name:"Développé couché incliné",  muscle:"Pectoraux supérieurs",muscles:["Épaules antérieures","Triceps"],        category:"compound",  tension:"contraction" },
  { name:"Développé couché décliné",  muscle:"Pectoraux inférieurs",muscles:["Épaules antérieures","Triceps"],        category:"compound",  tension:"contraction" },
  { name:"Écarté",                    muscle:"Pectoraux",           muscles:["Épaules antérieures"],                  category:"isolation", tension:"etirement"   },
  { name:"Écarté poulie",             muscle:"Pectoraux",           muscles:["Épaules antérieures"],                  category:"isolation", tension:"contraction" },
  { name:"Pec deck",                  muscle:"Pectoraux",           muscles:["Épaules antérieures"],                  category:"isolation", tension:"contraction" },
  { name:"Dips",                      muscle:"Pectoraux inférieurs",muscles:["Triceps","Épaules antérieures"],        category:"compound",  tension:"etirement"   },
  { name:"Pompes",                    muscle:"Pectoraux",           muscles:["Triceps","Épaules antérieures"],        category:"compound",  tension:"contraction" },
  { name:"Développé couché machine",  muscle:"Pectoraux",           muscles:["Épaules antérieures","Triceps"],        category:"compound",  tension:"contraction" },

  // ── Épaules ──────────────────────────────────────────────────────────────────
  { name:"Développé militaire",       muscle:"Épaules antérieures", muscles:["Triceps","Épaules latérales"],          category:"compound",  tension:"contraction" },
  { name:"Développé épaules",         muscle:"Épaules antérieures", muscles:["Triceps","Épaules latérales"],          category:"compound",  tension:"contraction" },
  { name:"Élévations frontales",      muscle:"Épaules antérieures", muscles:[],                                       category:"isolation", tension:"neutre"      },
  { name:"Elévation latérale",        muscle:"Épaules latérales",   muscles:[],                                       category:"isolation", tension:"neutre"      },
  { name:"Overhead carry",            muscle:"Épaules latérales",   muscles:["Trapèzes","Abdos"],                     category:"compound",  tension:"neutre"      },
  { name:"Face pull",                 muscle:"Épaules postérieures",muscles:["Trapèzes"],                             category:"isolation", tension:"contraction" },
  { name:"L'oiseau",                  muscle:"Épaules postérieures",muscles:[],                                       category:"isolation", tension:"etirement"   },
  { name:"Reverse fly",               muscle:"Épaules postérieures",muscles:[],                                       category:"isolation", tension:"etirement"   },
  { name:"Rowing menton",             muscle:"Épaules latérales",   muscles:["Trapèzes","Biceps"],                    category:"compound",  tension:"contraction" },

  // ── Triceps ──────────────────────────────────────────────────────────────────
  { name:"Barre au front",            muscle:"Triceps",             muscles:[],                                       category:"isolation", tension:"etirement"   },
  { name:"Extension triceps (coude aux dessus de la tête)", muscle:"Triceps", muscles:[],                            category:"isolation", tension:"etirement"   },
  { name:"Extension triceps (coude près du corps)",         muscle:"Triceps", muscles:[],                            category:"isolation", tension:"contraction" },
  { name:"Extension triceps unilatérale (coude près du corps)", muscle:"Triceps", muscles:[],                        category:"isolation", tension:"contraction" },

  // ── Grand dorsaux ─────────────────────────────────────────────────────────────
  { name:"Traction",                  muscle:"Grand dorsaux",       muscles:["Biceps","Trapèzes"],                    category:"compound",  tension:"etirement"   },
  { name:"Tirage horizontal",         muscle:"Grand dorsaux",       muscles:["Biceps","Trapèzes","Lombaires"],        category:"compound",  tension:"contraction" },
  { name:"Tirage \"DOS\"",            muscle:"Grand dorsaux",       muscles:["Biceps","Trapèzes"],                    category:"compound",  tension:"contraction" },
  { name:"Rowing barre",              muscle:"Grand dorsaux",       muscles:["Biceps","Trapèzes","Lombaires"],        category:"compound",  tension:"contraction" },
  { name:"Rowing altère",             muscle:"Grand dorsaux",       muscles:["Biceps","Trapèzes"],                    category:"compound",  tension:"contraction" },
  { name:"Rowing machine",            muscle:"Grand dorsaux",       muscles:["Biceps","Trapèzes"],                    category:"compound",  tension:"contraction" },
  { name:"Tirage coude au corps",     muscle:"Grand dorsaux",       muscles:["Biceps"],                               category:"isolation", tension:"contraction" },
  { name:"Pull-over",                 muscle:"Grand dorsaux",       muscles:["Pectoraux","Triceps"],                  category:"isolation", tension:"etirement"   },
  { name:"Soulevé de terre",          muscle:"Grand dorsaux",       muscles:["Ischio-jambiers","Fessiers","Lombaires","Trapèzes"], category:"compound", tension:"etirement" },

  // ── Trapèzes ─────────────────────────────────────────────────────────────────
  { name:"Haussements d'épaules",     muscle:"Trapèzes",            muscles:[],                                       category:"isolation", tension:"contraction" },
  { name:"Kelso shrug",               muscle:"Trapèzes",            muscles:["Grand dorsaux"],                        category:"isolation", tension:"contraction" },

  // ── Lombaires ────────────────────────────────────────────────────────────────
  { name:"Extension lombaire",        muscle:"Lombaires",           muscles:["Fessiers","Ischio-jambiers"],           category:"isolation", tension:"etirement"   },
  { name:"Soulevé de terre roumain",  muscle:"Lombaires",           muscles:["Ischio-jambiers","Fessiers"],           category:"compound",  tension:"etirement"   },
  { name:"Good morning",             muscle:"Lombaires",           muscles:["Ischio-jambiers","Fessiers"],           category:"compound",  tension:"etirement"   },

  // ── Biceps ───────────────────────────────────────────────────────────────────
  { name:"Curl assis incliné",        muscle:"Biceps",              muscles:["Avant-bras"],                           category:"isolation", tension:"etirement"   },
  { name:"Curl marteau",              muscle:"Biceps",              muscles:["Avant-bras","Brachial"],                category:"isolation", tension:"neutre"      },
  { name:"Curl pupitre",              muscle:"Biceps",              muscles:[],                                       category:"isolation", tension:"etirement"   },
  { name:"Curl Zottman",              muscle:"Biceps",              muscles:["Avant-bras","Brachial"],                category:"isolation", tension:"contraction" },

  // ── Quadriceps ───────────────────────────────────────────────────────────────
  { name:"Presse",                    muscle:"Quadriceps",          muscles:["Fessiers","Ischio-jambiers"],           category:"compound",  tension:"etirement"   },
  { name:"Squat",                     muscle:"Quadriceps",          muscles:["Fessiers","Ischio-jambiers","Lombaires"], category:"compound", tension:"etirement"  },
  { name:"Squat avant",               muscle:"Quadriceps",          muscles:["Fessiers"],                             category:"compound",  tension:"etirement"   },
  { name:"Leg extension",             muscle:"Quadriceps",          muscles:[],                                       category:"isolation", tension:"contraction" },
  { name:"Fentes",                    muscle:"Quadriceps",          muscles:["Fessiers","Ischio-jambiers"],           category:"compound",  tension:"etirement"   },
  { name:"Fentes bulgares",           muscle:"Quadriceps",          muscles:["Fessiers","Ischio-jambiers"],           category:"compound",  tension:"etirement"   },
  { name:"Fentes marchées",           muscle:"Quadriceps",          muscles:["Fessiers"],                             category:"compound",  tension:"etirement"   },
  { name:"Hack squat",                muscle:"Quadriceps",          muscles:["Fessiers"],                             category:"compound",  tension:"etirement"   },

  // ── Ischio-jambiers ──────────────────────────────────────────────────────────
  { name:"Leg curl",                  muscle:"Ischio-jambiers",     muscles:[],                                       category:"isolation", tension:"contraction" },
  { name:"Leg curl (unilateral)",     muscle:"Ischio-jambiers",     muscles:[],                                       category:"isolation", tension:"contraction" },
  { name:"Leg curl allongé",          muscle:"Ischio-jambiers",     muscles:[],                                       category:"isolation", tension:"contraction" },
  { name:"Rdl",                       muscle:"Ischio-jambiers",     muscles:["Fessiers","Lombaires"],                 category:"compound",  tension:"etirement"   },
  { name:"SL Deadlift",               muscle:"Ischio-jambiers",     muscles:["Fessiers","Lombaires"],                 category:"compound",  tension:"etirement"   },
  { name:"Nordic curl",               muscle:"Ischio-jambiers",     muscles:[],                                       category:"isolation", tension:"etirement"   },

  // ── Fessiers ─────────────────────────────────────────────────────────────────
  { name:"Adducteur",                 muscle:"Fessiers",            muscles:["Quadriceps"],                           category:"isolation", tension:"etirement"   },
  { name:"Hip thrust",                muscle:"Fessiers",            muscles:["Ischio-jambiers","Quadriceps"],         category:"compound",  tension:"contraction" },
  { name:"Abduction",                 muscle:"Fessiers",            muscles:[],                                       category:"isolation", tension:"contraction" },
  { name:"Kickback fessier",          muscle:"Fessiers",            muscles:[],                                       category:"isolation", tension:"contraction" },
  { name:"Romanian deadlift",         muscle:"Fessiers",            muscles:["Ischio-jambiers","Lombaires"],          category:"compound",  tension:"etirement"   },
  { name:"Hip abduction debout",      muscle:"Fessiers",            muscles:[],                                       category:"isolation", tension:"contraction" },

  // ── Mollets ──────────────────────────────────────────────────────────────────
  { name:"Mollets debout",            muscle:"Mollets",             muscles:[],                                       category:"isolation", tension:"etirement"   },
  { name:"Mollets assis",             muscle:"Mollets",             muscles:[],                                       category:"isolation", tension:"etirement"   },
  { name:"Mollets presse",            muscle:"Mollets",             muscles:[],                                       category:"isolation", tension:"etirement"   },

  // ── Abdos ────────────────────────────────────────────────────────────────────
  { name:"Crunch",                    muscle:"Abdos",               muscles:[],                                       category:"isolation", tension:"contraction" },
  { name:"Relevé de jambes",          muscle:"Abdos",               muscles:["Fléchisseurs hanche"],                  category:"isolation", tension:"etirement"   },
  { name:"Planche",                   muscle:"Abdos",               muscles:["Lombaires"],                            category:"isolation", tension:"neutre"      },
  { name:"Russian twist",             muscle:"Abdos",               muscles:[],                                       category:"isolation", tension:"neutre"      },
  { name:"Ab wheel",                  muscle:"Abdos",               muscles:["Grand dorsaux","Lombaires"],            category:"isolation", tension:"etirement"   },
];
