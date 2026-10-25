"use client";
import {useMemo,useState} from "react";
const ranks="AKQJT98765432".split("");
type Pos="UTG"|"HJ"|"CO"|"BTN"|"SB";
const positions:Pos[]=["UTG","HJ","CO","BTN","SB"];
const thresholds:Record<Pos,{pairs:number;suited:number;offsuit:number;wheel:boolean}>={UTG:{pairs:6,suited:10,offsuit:12,wheel:false},HJ:{pairs:5,suited:9,offsuit:11,wheel:false},CO:{pairs:3,suited:7,offsuit:10,wheel:true},BTN:{pairs:2,suited:5,offsuit:8,wheel:true},SB:{pairs:3,suited:7,offsuit:10,wheel:true}};
function handAt(row:number,col:number){return row===col?ranks[row]+ranks[col]:row<col?ranks[row]+ranks[col]+"s":ranks[col]+ranks[row]+"o"}
function openable(hand:string,pos:Pos):boolean{
 const t=thresholds[pos],a=ranks.indexOf(hand[0]),b=ranks.indexOf(hand[1]);
 if(hand.length===2)return a<=ranks.indexOf(String(t.pairs)) && a>=0;
 if(hand.endsWith("s")){
  if(a===0)return b<=10 && (t.wheel||b<=8);
  if(a===1)return b<=t.suited+1;
  if(a===2)return b<=t.suited;
  if(a===3)return b<=t.suited-1;
  return a<=t.suited && b-a<=3 && a<=9;
 }
 if(a===0)return b<=Math.min(12,t.offsuit);
 if(a===1)return b<=t.offsuit-2;
 if(a===2)return b<=t.offsuit-3;
 return false;
}
export default function RangeLab(){
 const [pos,setPos]=useState<Pos>("CO"),[selected,setSelected]=useState("AKs"),[drill,setDrill]=useState(false),[round,setRound]=useState(0),[choice,setChoice]=useState<boolean|null>(null),[correct,setCorrect]=useState(0),[attempts,setAttempts]=useState(0);
 const hands=useMemo(()=>ranks.flatMap((_,i)=>ranks.map((_,j)=>handAt(i,j))),[]);
 const example=hands[(round*37+19)%hands.length];
 function respond(value:boolean){if(choice!==null)return;setChoice(value);setAttempts(x=>x+1);if(value===openable(example,pos))setCorrect(x=>x+1)}
 return <section className="rl-shell" aria-label="Preflop range training">
 <header className="rl-header"><span>INTERACTIVE STRATEGY LAB</span><h2>Preflop opening ranges</h2><p>Explore a simplified 6-max, 100 big-blind first-in opening strategy. These are teaching ranges—not solver outputs or universal prescriptions. Antes, rake, opponents and stack sizes change the correct decision.</p></header>
 <nav className="rl-pos" aria-label="Select poker position">{positions.map(p=><button key={p} className={pos===p?"active":""} onClick={()=>{setPos(p);setChoice(null)}}>{p}</button>)}</nav>
 <div className="rl-layout"><div className="rl-matrix" aria-label="13 by 13 starting hand matrix">{ranks.map((_,i)=>ranks.map((_,j)=>{const h=handAt(i,j),yes=openable(h,pos);return <button type="button" key={h} title={h} aria-label={h+" "+(yes?"example open":"example fold")} aria-pressed={selected===h} className={`rl-cell ${yes?"rl-open":"rl-fold"} ${selected===h?"rl-selected":""}`} onClick={()=>setSelected(h)}>{h}</button>}))}</div>
 <div className="rl-side"><div className="rl-key"><span><i/> Example open</span><span><i/> Example fold</span></div><small>SELECTED STARTING HAND</small><h3>{selected}</h3><b className={openable(selected,pos)?"rl-good":"rl-caution"}>{openable(selected,pos)?"Usually open-raise":"Usually fold"}</b><p>From <strong>{pos}</strong> when everyone before you folds, this illustrative chart recommends {openable(selected,pos)?"raising for value or initiative":"folding rather than entering too many pots"}. It does not cover facing an existing raise.</p><button className="rl-drill-toggle" onClick={()=>{setDrill(v=>!v);setChoice(null)}}>{drill?"Hide training drill":"Start range drill →"}</button></div></div>
 {drill&&<div className="rl-drill"><span>DECISION PRACTICE · {attempts} answered · {correct} correct</span><h3>You are {pos}. Action folds to you. Your hand is <strong>{example}</strong>. What do you do?</h3><div><button disabled={choice!==null} onClick={()=>respond(true)}>Open-raise</button><button disabled={choice!==null} onClick={()=>respond(false)}>Fold</button></div>{choice!==null&&<p role="status">{choice===openable(example,pos)?"Correct. ":"Review this spot. "}{openable(example,pos)?"This hand appears in the illustrative first-in raising range.":"This hand is outside the illustrative first-in raising range."} Study the matrix, then try another.</p>}<button className="rl-next" onClick={()=>{setRound(v=>v+1);setChoice(null)}}>Next situation →</button></div>}
 </section>;
}