"use client";

import {useEffect,useState,type ReactNode} from "react";

type ChamberKey="foundations"|"dictionary"|"preflop"|"mathematics"|"decisions"|"strategy"|"reflection";
type Visit={date:string;chamber:ChamberKey};
type Chamber={key:ChamberKey;number:string;name:string;subtitle:string;description:string;duration:string;icon:string;topic:string;anchor:string};
const chambers:Chamber[]=[
 {key:"foundations",number:"01",name:"The Foundation Hall",subtitle:"START HERE",description:"Learn the rules behind strong decisions, hand rankings, and position. No strategy vocabulary required.",duration:"15–25 min",icon:"♧",topic:"Understand the basics",anchor:"core-lessons"},
 {key:"dictionary",number:"02",name:"The Language Vault",subtitle:"WORDS & MEANINGS",description:"Understand UTG, CO, BTN, equity, EV and other poker terms in everyday language.",duration:"10–15 min",icon:"◇",topic:"Speak the language",anchor:"dictionary"},
 {key:"preflop",number:"03",name:"The Preflop Observatory",subtitle:"BEFORE THE FLOP",description:"Learn which starting hands to consider from different positions, with a guided hand chart.",duration:"15–20 min",icon:"♠",topic:"Understand starting hands",anchor:"range-lab"},
 {key:"mathematics",number:"04",name:"The Numbers Workshop",subtitle:"SIMPLE POKER MATH",description:"Learn pot odds, drawing chances and bluffs with small numbers and worked examples.",duration:"15–25 min",icon:"%",topic:"Make sense of the numbers",anchor:"math-lab"},
 {key:"decisions",number:"05",name:"The Decision Arena",subtitle:"PRACTICE HANDS",description:"Face different poker hands, make a choice, and understand why the answer works.",duration:"15–20 min",icon:"◆",topic:"Apply what you learned",anchor:"transfer-training"},
 {key:"strategy",number:"06",name:"The Strategy Tower",subtitle:"DEEPER THINKING",description:"Explore fourteen guided modules only after you understand the underlying concepts.",duration:"20–30 min",icon:"♜",topic:"Build more advanced judgment",anchor:"advanced-school"},
 {key:"reflection",number:"07",name:"The Reflection Room",subtitle:"REVIEW & PLAN",description:"Record one difficult decision, recognize a repeated mistake, and choose your next focus.",duration:"10–15 min",icon:"✎",topic:"Remember what you learned",anchor:"study-plan"}
];
const storageKey="pokerlab-chamber-visits-v1";
const anchorMap:Record<string,ChamberKey>={
 "core-lessons":"foundations","dictionary":"dictionary","range-lab":"preflop",
 "math-lab":"mathematics","bluff-lab":"mathematics","transfer-training":"decisions",
 "advanced-school":"strategy","strategy-current-lesson":"strategy","study-plan":"reflection"
};
const isChamber=(s:string):s is ChamberKey=>chambers.some(c=>c.key===s);
function currentDate(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");}

export default function AcademyChambers({foundations,dictionary,preflop,mathematics,decisions,strategy,reflection}:{foundations:ReactNode;dictionary:ReactNode;preflop:ReactNode;mathematics:ReactNode;decisions:ReactNode;strategy:ReactNode;reflection:ReactNode}){
 const [active,setActive]=useState<ChamberKey|null>(null);
 const [visits,setVisits]=useState<Visit[]>([]);
 const [ready,setReady]=useState(false);
 const [today,setToday]=useState("");
 useEffect(()=>{
  const timer=window.setTimeout(()=>{
   let loaded:Visit[]=[];
   try{const raw=localStorage.getItem(storageKey);if(raw){const parsed:unknown=JSON.parse(raw);if(Array.isArray(parsed)){loaded=parsed.filter((v):v is Visit=>!!v&&typeof v==="object"&&"date" in v&&typeof v.date==="string"&&/^\\d{4}-\\d{2}-\\d{2}$/.test(v.date)&&"chamber" in v&&typeof v.chamber==="string"&&isChamber(v.chamber)).slice(-180);}}}catch{}
   setVisits(loaded);setToday(currentDate());setReady(true);
   const hash=decodeURIComponent(window.location.hash.slice(1));
   const target=anchorMap[hash];
   if(target){setActive(target);window.requestAnimationFrame(()=>window.setTimeout(()=>document.getElementById(hash)?.scrollIntoView({block:"start"}),60));}
  },0);
  return()=>window.clearTimeout(timer);
 },[]);
 useEffect(()=>{if(ready){try{localStorage.setItem(storageKey,JSON.stringify(visits))}catch{}}},[visits,ready]);
 useEffect(()=>{
  function navigateHash(){
   const hash=decodeURIComponent(window.location.hash.slice(1));
   const target=anchorMap[hash];
   if(target){setActive(target);window.requestAnimationFrame(()=>window.setTimeout(()=>document.getElementById(hash)?.scrollIntoView({behavior:"smooth",block:"start"}),60));}
  }
  window.addEventListener("hashchange",navigateHash);
  return()=>window.removeEventListener("hashchange",navigateHash);
 },[]);
 const todayVisit=visits.find(v=>v.date===today);
 const recommendation=chambers[visits.length%chambers.length];
 const selected=chambers.find(c=>c.key===active);
 const history=new Set(visits.map(v=>v.chamber));
 const completedThisCycle=new Set(visits.slice(-7).map(v=>v.chamber)).size;
 function open(key:ChamberKey){
  setActive(key);
  window.history.replaceState(null,"",`#${chambers.find(c=>c.key===key)?.anchor??"chambers"}`);
  window.scrollTo({top:0,behavior:"smooth"});
 }
 function goHome(){setActive(null);window.history.replaceState(null,"","#chambers");window.scrollTo({top:0,behavior:"smooth"});}
 function completeDay(){if(!active||!today||todayVisit)return;setVisits(prev=>[...prev,{date:today,chamber:active}].slice(-180));}
 const chamberContent:Record<ChamberKey,ReactNode>={foundations,dictionary,preflop,mathematics,decisions,strategy,reflection};

 return <div className="chambers-app" id="chambers">
  <header className="chambers-hero">
   <div className="chambers-hero-top"><span className="chambers-brand">♧ POKERLAB <i/> THE LEARNING CHAMBERS</span><span className="chambers-mode">PLAY-CHIP EDUCATION</span></div>
   {active===null?<><span className="chambers-eyebrow">YOUR OWN POKER LEARNING WORLD</span><h1>One chamber. One skill. Every day.</h1><p>Leave the confusing walls of information behind. Enter one learning room, understand its ideas, practice, and return tomorrow for another. Everything else stays out of your way.</p></>:<><span className="chambers-eyebrow">CHAMBER {selected?.number} OF 07</span><h1>{selected?.name}</h1><p>{selected?.description}</p></>}
  </header>
  {active===null?<main className="chambers-hub">
   <div className="chambers-overview">
    <div className="chambers-overview-copy"><span>YOUR DAILY JOURNEY</span><h2>{todayVisit?"Today's session recorded":"Your next recommended chamber"}</h2><p>{todayVisit?"You have recorded a chamber visit today. You can explore any chamber without losing your progress.":`${recommendation.name} — ${recommendation.topic}. Each visit is a small learning session, not a test you must pass.`}</p><button className="chambers-primary" type="button" onClick={()=>open(todayVisit?chambers[(chambers.findIndex(c=>c.key===todayVisit.chamber)+1)%chambers.length].key:recommendation.key)}>{todayVisit?"Explore another chamber":"Enter today's chamber"} <span aria-hidden="true">→</span></button></div>
    <div className="chambers-overview-stats"><div><strong>{visits.length}</strong><span>Recorded study days</span></div><div><strong>{history.size} / 7</strong><span>Chambers visited</span></div><div><strong>{completedThisCycle} / 7</strong><span>Different rooms in recent visits</span></div></div>
   </div>
   <div className="chambers-section-heading"><div><span>EXPLORE THE ACADEMY</span><h2>The seven learning chambers</h2></div><p>Choose any room. Recommended order is a guide, not a requirement.</p></div>
   <div className="chambers-grid">{chambers.map((c,i)=><button className="chambers-tile" data-chamber={c.key} key={c.key} type="button" onClick={()=>open(c.key)}><div className="chambers-tile-top"><span>CHAMBER {c.number}</span><span>{history.has(c.key)?"VISITED":i===visits.length%7&&!todayVisit?"SUGGESTED":"OPEN"}</span></div><span className="chambers-tile-symbol" aria-hidden="true">{c.icon}</span><span className="chambers-tile-tag">{c.subtitle}</span><strong>{c.name}</strong><span className="chambers-tile-description">{c.description}</span><span className="chambers-tile-bottom"><span>{c.duration} · {c.topic}</span><span className="chambers-tile-arrow" aria-hidden="true">↗</span></span></button>)}</div>
   <p className="chambers-footnote">Recorded visits measure consistency, not poker ability. You can use the chambers without marking a day complete.</p>
  </main>:<main className="chambers-active">
   <nav className="chambers-internal-nav" aria-label="Learning chamber navigation"><button type="button" onClick={goHome}>← All chambers</button><span>CHAMBER {selected?.number} / 07</span><button type="button" onClick={()=>open(chambers[(chambers.findIndex(c=>c.key===active)+1)%chambers.length].key)}>Next chamber →</button></nav>
   <div className="chambers-focus-header"><div><span>{selected?.subtitle}</span><h2>{selected?.topic}</h2><p>Take your time. The goal is to understand one new idea, not rush through a score.</p></div><span className="chambers-session-time">{selected?.duration} suggested</span></div>
   <div className="chambers-stage">{chamberContent[active]}</div>
   <div className="chambers-end"><div><span>END OF TODAY'S VISIT</span><h2>What did you learn?</h2><p>After practicing, write down one useful takeaway. You can record today's visit here and continue with a different chamber another day.</p></div><div className="chambers-end-actions"><button type="button" className="chambers-primary" disabled={!ready||!!todayVisit} onClick={completeDay}>{todayVisit?"Today's visit recorded ✓":"Record today's chamber visit"}</button><button type="button" onClick={goHome}>Back to the chambers</button></div></div>
  </main>}
 </div>;
}