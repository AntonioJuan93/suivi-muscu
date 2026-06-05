import { useState, useEffect, useRef } from "react";

export default function RestTimer({ T, visible, triggerKey }) {
  const [target, setTarget] = useState(120);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  // Auto-start when triggerKey changes (new set added)
  useEffect(() => {
    if (triggerKey > 0) { setElapsed(0); setRunning(true); setMinimized(false); }
  }, [triggerKey]);

  if (!visible) return null;

  const remaining = target - elapsed;
  const done = remaining <= 0;
  const pct = Math.min(100, (elapsed / target) * 100);

  function start(t) { setTarget(t); setElapsed(0); setRunning(true); setMinimized(false); }
  function reset() { setElapsed(0); setRunning(false); }
  function fmt(s) { const abs = Math.abs(s); return `${Math.floor(abs/60)}:${String(abs%60).padStart(2,"0")}`; }

  if (minimized) {
    return (
      <div onClick={() => setMinimized(false)} style={{
        position:"fixed", bottom:80, right:16, zIndex:50,
        background:T.bgCard, border:`1px solid ${done?T.accent:T.border}`,
        borderRadius:99, padding:"8px 16px", boxShadow:T.shadow,
        cursor:"pointer", display:"flex", alignItems:"center", gap:8
      }}>
        <span style={{fontSize:13,color:done?T.accent:T.text,fontWeight:700,fontVariantNumeric:"tabular-nums"}}>
          ⏱ {done ? "GO !" : fmt(remaining)}
        </span>
      </div>
    );
  }

  return (
    <div style={{
      position:"fixed", bottom:80, right:16, zIndex:50,
      background:T.bgCard, border:`2px solid ${done?T.accent:T.border}`,
      borderRadius:18, padding:"14px 16px", boxShadow:T.shadow,
      width:210, transition:"border-color 0.3s"
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <span style={{fontSize:11,color:T.muted,fontWeight:500}}>⏱ Repos</span>
        <button onClick={()=>setMinimized(true)} style={{background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:16,lineHeight:1,padding:0}}>−</button>
      </div>

      <div style={{fontSize:36,fontWeight:800,color:done?T.accent:T.text,fontVariantNumeric:"tabular-nums",textAlign:"center",marginBottom:10,letterSpacing:"-1px"}}>
        {done ? "GO !" : fmt(remaining)}
      </div>

      <div style={{height:5,background:T.border,borderRadius:99,marginBottom:10}}>
        <div style={{width:`${pct}%`,height:"100%",background:done?T.accent:T.muted,borderRadius:99,transition:"width 1s linear"}}/>
      </div>

      <div style={{display:"flex",gap:6,marginBottom:8}}>
        <button onClick={()=>setRunning(r=>!r)} style={{flex:1,padding:"7px 0",borderRadius:9,border:`1px solid ${T.border}`,background:"transparent",cursor:"pointer",fontSize:14,color:T.text}}>
          {running?"⏸":"▶"}
        </button>
        <button onClick={reset} style={{padding:"7px 12px",borderRadius:9,border:`1px solid ${T.border}`,background:"transparent",cursor:"pointer",fontSize:13,color:T.muted}}>↺</button>
      </div>

      <div style={{display:"flex",gap:3}}>
        {[[60,"1m"],[90,"1:30"],[120,"2m"],[180,"3m"],[300,"5m"]].map(([t,label])=>(
          <button key={t} onClick={()=>start(t)} style={{
            flex:1, fontSize:10, padding:"4px 0", borderRadius:6,
            border:`1px solid ${target===t&&running?T.accent:T.border}`,
            background:target===t&&running?T.accentDim:"transparent",
            color:target===t&&running?T.accent:T.muted,
            cursor:"pointer"
          }}>{label}</button>
        ))}
      </div>
    </div>
  );
}
