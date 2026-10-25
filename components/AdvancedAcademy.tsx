"use client";
import {useState} from "react";
import Link from "next/link";
import {advancedUnits} from "@/lib/academy/advanced";
export default function AdvancedAcademy(){
 const [unit,setUnit]=useState(0),[answers,setAnswers]=useState<Record<string,number>>({});
 const current=advancedUnits[unit], count=Object.keys(answers).length, total=advancedUnits.reduce((n,u)=>n+u.drills.length,0);
 const right=advancedUnits.reduce((n,u,i)=>n+u.drills.filter((d,j)=>answers[`${i}-${j}`]===d.correct).length,0);
 return <section className="advanced-school">
 <header className="advanced-intro"><div><span>POKERLAB · ADVANCED STRATEGY SCHOOL</span><h2>Train your poker decisions</h2><p>Eight structured strategy modules, with practice scenarios and explanations. Start with the concepts that challenge you most.</p></div><div className="advanced-stats"><b>{count}/{total}</b><small>Questions attempted</small><b>{right}</b><small>Correct answers</small></div></header>
 <div className="advanced-track">{advancedUnits.map((m,i)=><button type="button" key={m.title} className={unit===i?"chosen":""} onClick={()=>setUnit(i)}><small>MODULE {String(i+1).padStart(2,"0")}</small><strong>{m.title}</strong><span>{m.drills.filter((_,j)=>answers[`${i}-${j}`]!==undefined).length}/{m.drills.length} practiced</span></button>)}</div>
 <div className="advanced-content"><header><span>MODULE {unit+1} OF {advancedUnits.length}</span><h3>{current.title}</h3><p>{current.focus}</p></header>
 {current.drills.map((d,j)=>{const key=`${unit}-${j}`,chosen=answers[key],shift=(unit*3+j*2+1)%d.options.length,ordered=d.options.map((_,k)=>(k+shift)%d.options.length);return <article className="advanced-question" key={key}><small>DECISION {j+1}</small><h4>{d.question}</h4><div className="advanced-answers">{ordered.map((k)=><button type="button" key={k} disabled={chosen!==undefined} onClick={()=>setAnswers(old=>({...old,[key]:k}))} className={chosen!==undefined&&k===d.correct?"right":chosen===k?"wrong":""}>{d.options[k]}</button>)}</div>{chosen!==undefined&&<div className="advanced-explainer"><strong>{chosen===d.correct?"Correct decision":"Review this idea"}</strong><p>{d.explain}</p></div>}</article>})}
 <div className="advanced-next"><button disabled={unit===0} onClick={()=>setUnit(unit-1)}>← Previous module</button><button disabled={unit===advancedUnits.length-1} onClick={()=>setUnit(unit+1)}>Next module →</button></div></div>
 <div className="advanced-resources"><Link href="/bootcamp">30-minute starter →</Link><Link href="/?workspace=Train">Decision training →</Link><Link href="/review">Hand review →</Link></div>
 <p className="advanced-disclaimer">Training with play chips. These scenarios teach reasoning, not universal solver-approved actions. An individual professional outcome is never guaranteed.</p></section>;
}