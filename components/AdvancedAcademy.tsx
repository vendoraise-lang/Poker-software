"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {advancedUnits} from "@/lib/academy/advanced";
import {beginnerGuides} from "@/lib/academy/beginner";
export default function AdvancedAcademy(){
 const [unit,setUnit]=useState(0),[answers,setAnswers]=useState<Record<string,number>>({}),[ready,setReady]=useState(false);
 useEffect(()=>{
  const task=window.setTimeout(()=>{
   try {
    const raw=localStorage.getItem("pokerlab-advanced-v1");
    if(raw){
     const obj:unknown=JSON.parse(raw);
     if(obj&&typeof obj==="object"&&!Array.isArray(obj)){
      const clean:Record<string,number>={};
      for(const [k,v] of Object.entries(obj)){
       if(/^\d+-\d+$/.test(k)&&typeof v==="number"&&Number.isInteger(v)&&v>=0&&v<3)clean[k]=v;
      }
      setAnswers(clean);
     }
    }
   }catch{}
   setReady(true);
  },0);
  return ()=>window.clearTimeout(task);
 },[]);
 useEffect(()=>{if(ready)try{localStorage.setItem("pokerlab-advanced-v1",JSON.stringify(answers))}catch{}},[answers,ready]);
 const guide=beginnerGuides[unit];
 const current=advancedUnits[unit], count=Object.keys(answers).length, total=advancedUnits.reduce((n,u)=>n+u.drills.length,0);
 const right=advancedUnits.reduce((n,u,i)=>n+u.drills.filter((d,j)=>answers[`${i}-${j}`]===d.correct).length,0);
 const mistakes=advancedUnits.flatMap((u,i)=>u.drills.map((d,j)=>({key:`${i}-${j}`,i,j,d}))).filter(q=>answers[q.key]!==undefined&&answers[q.key]!==q.d.correct);
 const completed=advancedUnits.map((u,i)=>u.drills.every((_,j)=>answers[`${i}-${j}`]!==undefined));
 const recommended=completed.findIndex(done=>!done);
 const progressPercent=Math.round(count/Math.max(1,total)*100);
 function retryMissed(){if(!mistakes.length)return;setUnit(mistakes[0].i);setAnswers(prev=>Object.fromEntries(Object.entries(prev).filter(([k])=>!mistakes.some(q=>q.key===k))))}

 return <section className="advanced-school">
 <header className="advanced-intro"><div><span>POKERLAB · ADVANCED STRATEGY SCHOOL</span><h2>Train your poker decisions</h2><p>Advanced strategy modules, practice decisions, and accuracy feedback. Revisit the skills that need work.</p></div><div className="advanced-stats"><b>{count}/{total}</b><small>Questions attempted</small><b>{right}</b><small>Correct answers</small></div></header>
 <div className="advanced-study-dashboard">
<div className="advanced-study-goal"><small>PERSONAL STUDY PATH</small><h3>{completed.filter(Boolean).length} / {advancedUnits.length} modules complete</h3><p>{count} / {total} decisions practiced · {count?Math.round(right/count*100):0}% accuracy</p><div className="advanced-progress-rail"><i style={{width:`${progressPercent}%`}}/></div><button onClick={()=>setUnit(recommended<0?0:recommended)} disabled={!ready}>Continue my course →</button></div>
<div className="advanced-review-goal"><small>WEAKNESS REVIEW</small><h3>{mistakes.length} missed decisions</h3><p>Repeat your mistakes after reading the feedback. Use the review to understand the reason, not memorize the option.</p><button disabled={!mistakes.length} onClick={retryMissed}>Retry missed questions →</button></div>
</div><div className="advanced-track">{advancedUnits.map((m,i)=><button type="button" key={m.title} className={unit===i?"chosen":""} onClick={()=>setUnit(i)}><small>MODULE {String(i+1).padStart(2,"0")}</small><strong>{m.title}</strong><span>{m.drills.filter((_,j)=>answers[`${i}-${j}`]!==undefined).length}/{m.drills.length} practiced</span></button>)}</div>
 <div className="advanced-content"><section className="beginner-guide"><span>START HERE · NO POKER MATH REQUIRED</span><h3>Understand this topic first</h3><p><b>What it means:</b> {guide.meaning}</p><div className="beginner-worked"><b>Real example</b><p>{guide.example}</p></div><h4>How to think, one step at a time</h4><ol>{guide.steps.map((step,i)=><li key={i}>{step}</li>)}</ol><p className="beginner-remember"><b>Remember:</b> {guide.remember}</p></section><header><span>MODULE {unit+1} OF {advancedUnits.length}</span><h3>{current.title}</h3><p>{current.focus}</p></header>
 {current.drills.map((d,j)=>{const key=`${unit}-${j}`,chosen=answers[key],shift=(unit*3+j*2+1)%d.options.length,ordered=d.options.map((_,k)=>(k+shift)%d.options.length);return <article className="advanced-question" key={key}><small>DECISION {j+1}</small><h4>{d.question}</h4><div className="advanced-answers">{ordered.map((k)=><button type="button" key={k} disabled={chosen!==undefined} onClick={()=>setAnswers(old=>({...old,[key]:k}))} className={chosen!==undefined&&k===d.correct?"right":chosen===k?"wrong":""}>{d.options[k]}</button>)}</div>{chosen!==undefined&&<div className="advanced-explainer"><strong>{chosen===d.correct?"Correct decision":"Review this idea"}</strong><p><b>Why this answer?</b> {d.explain}</p><p><b>What to remember:</b> {guide.remember}</p></div>}</article>})}
 <div className="advanced-mastery"><strong>Module accuracy: {current.drills.filter((_,j)=>answers[`${unit}-${j}`]===undefined).length===current.drills.length?"Not started":`${Math.round(current.drills.filter((d,j)=>answers[`${unit}-${j}`]===d.correct).length/Math.max(1,current.drills.filter((_,j)=>answers[`${unit}-${j}`]!==undefined).length)*100)}%`}</strong><button type="button" onClick={()=>setAnswers(previous=>Object.fromEntries(Object.entries(previous).filter(([key])=>!key.startsWith(`${unit}-`))))}>Retry module</button></div>
 <div className="advanced-next"><button disabled={unit===0} onClick={()=>setUnit(unit-1)}>← Previous module</button><button disabled={unit===advancedUnits.length-1} onClick={()=>setUnit(unit+1)}>Next module →</button></div></div>
 <div className="advanced-resources"><Link href="/bootcamp">30-minute starter →</Link><Link href="/?workspace=Train">Decision training →</Link><Link href="/review">Hand review →</Link></div>
 <p className="advanced-disclaimer">Training with play chips. These scenarios teach reasoning, not universal solver-approved actions. An individual professional outcome is never guaranteed.</p></section>;
}