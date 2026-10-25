"use client";
import Link from "next/link";
import { useState } from "react";
import WorkspaceLinks from "@/components/WorkspaceLinks";

const drills = [
  { title:"Position & starting hands", minutes:7, lesson:"Late position gives you more information. Raise strong hands consistently; avoid playing weak offsuit hands from early position.", question:"You are first to act with 7♣ 2♦. What is the standard choice?", options:["Fold","Raise to 3 big blinds","Call"], correct:0, why:"Seven-deuce offsuit performs poorly and is usually a clear fold from early position.", href:"/?workspace=Train"},
  { title:"Pot odds", minutes:7, lesson:"Compare the price of calling with the pot you could win. Required equity = call ÷ (pot before call + call).", question:"The pot has 80 chips. You face a 20-chip call. What equity do you need?", options:["20%","25%","50%"], correct:0, why:"20 ÷ (80 + 20) = 20%. This is a simplified break-even threshold before future betting.", href:"/?workspace=Train"},
  { title:"Board reading", minutes:7, lesson:"Recognize made hands, flush/straight possibilities, and which cards help opponents. Avoid confusing an attractive draw with a made hand.", question:"You hold A♠ Q♠ on K♠ 8♠ 2♦. What do you have?", options:["A made flush","A flush draw","One pair"], correct:1, why:"You have four spades total and need one more spade to make a flush.", href:"/?workspace=Train"},
  { title:"Play & review", minutes:9, lesson:"Play several hands and review one important decision. Winning a pot doesn't automatically mean you made the best decision.", question:"You win after making a risky call. What's the best next step?", options:["Always repeat the call","Review price, ranges, and alternatives","Ignore the hand"], correct:1, why:"Evaluate decision quality rather than short-term results. That is how systematic improvement works.", href:"/?workspace=Practice"},
];
export default function Bootcamp(){
 const [step,setStep]=useState(0); const [answers,setAnswers]=useState<Record<number,number>>({});
 const lesson=drills[step]; const selected=answers[step]; const done=Object.keys(answers).length;
 return <main className="bootcamp-screen">
   <WorkspaceLinks current="Bootcamp"/>
   <div className="bootcamp-head"><span>POKERLAB · TRAINING ROOM</span><h1>Your first 30 minutes</h1><p>Four focused rounds. Learn one idea, make a decision, then practice it at the table. Play chips only.</p><Link className="bootcamp-casino-link" href="/?workspace=Practice">♠ Enter the casino table →</Link></div>
   <div className="bootcamp-progress"><span>{done}/4 decisions completed</span><div><i style={{width:`${done*25}%`}}/></div></div>
   <div className="bootcamp-steps">{drills.map((d,i)=><button key={d.title} className={step===i?"selected":""} onClick={()=>setStep(i)}><small>{i+1} · {d.minutes} min</small><strong>{d.title}</strong></button>)}</div>
   <section className="bootcamp-lesson"><div className="bootcamp-eyebrow">ROUND {step+1} · {lesson.minutes} MINUTES</div><h2>{lesson.title}</h2><p>{lesson.lesson}</p><div className="bootcamp-question"><h3>{lesson.question}</h3>{lesson.options.map((opt,i)=><button key={opt} disabled={selected!==undefined} className={selected===i?"picked":""} onClick={()=>setAnswers(old=>({...old,[step]:i}))}>{opt}</button>)}{selected!==undefined&&<div className="bootcamp-answer" role="status"><strong>{selected===lesson.correct?"Good decision":"Review this concept"}</strong><p>{lesson.why}</p></div>}</div>
     <div className="bootcamp-next"><Link href={lesson.href}>Practice this skill →</Link><button onClick={()=>setStep((step+1)%4)}>{step===3?"Back to round 1":"Next round →"}</button></div>
   </section><p className="bootcamp-footnote">This is a short starting session, not a promise of professional-level skill. The full Academy and drills remain available.</p>
 </main>;
}