"use client";
import {useEffect,useState} from "react";
import Link from "next/link";

type Entry={date:string;minutes:number;focus:string;decision:string;takeaway:string};
const key="pokerlab-study-journal-v1";
const topics=["Preflop ranges","Pot odds & EV","Postflop board textures","Value bets & bluffs","Hand review","Opponent ranges"];
const route:Record<string,string>={
 "Preflop ranges":"#range-lab",
 "Pot odds & EV":"#math-lab",
 "Postflop board textures":"#advanced-school",
 "Value bets & bluffs":"#bluff-lab",
 "Hand review":"/review",
 "Opponent ranges":"#advanced-school"
};
export default function StudyPlanner(){
 const [entries,setEntries]=useState<Entry[]>([]);
 const [ready,setReady]=useState(false);
 const [focus,setFocus]=useState(topics[0]);
 const [minutes,setMinutes]=useState(30);
 const [decision,setDecision]=useState("");
 const [takeaway,setTakeaway]=useState("");
 const [error,setError]=useState("");
 useEffect(()=>{const id=window.setTimeout(()=>{try{
 const raw=localStorage.getItem(key),parsed:unknown=raw?JSON.parse(raw):[];
 if(Array.isArray(parsed))setEntries(parsed.filter((e):e is Entry=>e&&typeof e==="object"&&typeof e.date==="string"&&typeof e.minutes==="number"&&typeof e.focus==="string"&&typeof e.decision==="string"&&typeof e.takeaway==="string").slice(0,90));
 }catch{}setReady(true)},0);return()=>clearTimeout(id)},[]);
 useEffect(()=>{if(ready)try{localStorage.setItem(key,JSON.stringify(entries))}catch{}},[entries,ready]);
 const total=entries.reduce((sum,e)=>sum+e.minutes,0),sessions=entries.length;
 const counts=topics.map(t=>({topic:t,count:entries.filter(e=>e.focus===t).length})).sort((a,b)=>a.count-b.count);
 const recommended=counts[0]?.topic??topics[0];
 function add(){
  if(!decision.trim()||!takeaway.trim()){setError("Write one decision and one takeaway to log a useful session.");return}
  const entry:Entry={date:new Date().toISOString(),minutes,focus,decision:decision.trim().slice(0,500),takeaway:takeaway.trim().slice(0,500)};
  setEntries(old=>[entry,...old].slice(0,90));setDecision("");setTakeaway("");setError("");
 }
 return <section className="sp-shell" aria-label="Poker study planner">
  <header className="sp-header"><span>PERSONAL STUDY SYSTEM</span><h2>Make every practice session count.</h2><p>Study deliberately, reflect on a real decision, and return to weak or neglected areas. This journal stays in this browser; it does not measure poker profitability.</p></header>
  <div className="sp-grid">
   <article className="sp-panel"><span className="sp-caption">YOUR TRAINING RECORD</span><div className="sp-metrics"><div><strong>{sessions}</strong><small>Logged sessions</small></div><div><strong>{total}</strong><small>Study minutes</small></div></div><h3>Suggested next focus</h3><p><b>{recommended}</b> is among your least practiced subjects. Balance it with whatever errors you notice in your own hand reviews.</p><Link href={route[recommended]}>Practice this topic →</Link><div className="sp-routine"><h3>Suggested 45-minute routine</h3><p>10 min: one lesson · 20 min: focused drills or play-money hands · 15 min: review and write what you learned.</p></div></article>
   <article className="sp-panel"><span className="sp-caption">LOG A MEANINGFUL SESSION</span><label>Skill focus<select value={focus} onChange={e=>setFocus(e.target.value)}>{topics.map(t=><option key={t}>{t}</option>)}</select></label><label>Minutes practiced<select value={minutes} onChange={e=>setMinutes(Number(e.target.value))}>{[10,20,30,45,60,90].map(t=><option key={t} value={t}>{t} min</option>)}</select></label><label>One decision you struggled with<textarea rows={2} value={decision} maxLength={500} onChange={e=>setDecision(e.target.value)} placeholder="e.g., faced a large river bet with second pair"/></label><label>What will you do differently?<textarea rows={2} value={takeaway} maxLength={500} onChange={e=>setTakeaway(e.target.value)} placeholder="e.g., count likely value hands and bluffs before calling"/></label><button disabled={!ready} onClick={add}>Save study session</button>{error&&<p role="alert">{error}</p>}</article>
  </div>
  {entries.length>0&&<details className="sp-history"><summary>My study history ({entries.length})</summary>{entries.slice(0,15).map((e,i)=><article key={e.date+i}><strong>{new Date(e.date).toLocaleDateString()} · {e.focus} · {e.minutes} min</strong><p>Decision: {e.decision}</p><p>Takeaway: {e.takeaway}</p></article>)}</details>}
 </section>;
}
