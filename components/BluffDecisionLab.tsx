"use client";
import {useState} from "react";
type Spot={street:string;texture:string;pot:number;bet:number;fold:number;equity:number;notes:string};
const spots:Spot[]=[
{street:"River",texture:"A♠ 7♦ 2♣ 9♥ K♣",pot:100,bet:75,fold:45,equity:0,notes:"A pure river bluff works only when folds cover the cost. Think about whether this sizing makes enough of the opponent's range fold."},
{street:"River",texture:"Q♣ J♣ 8♥ 4♦ 2♠",pot:100,bet:100,fold:38,equity:0,notes:"A pot-sized zero-equity bluff needs more than one-half folds to profit. Strong calling ranges make a bluff less appealing."},
{street:"Turn",texture:"T♠ 8♠ 3♦ 2♥",pot:120,bet:60,fold:22,equity:20,notes:"Semi-bluffs can profit with some showdown equity when called. Turn equity is a teaching estimate, not a solver result."},
{street:"River",texture:"5♠ 5♦ 3♣ J♥ A♠",pot:160,bet:40,fold:25,equity:0,notes:"A small bluff risks little, but still needs sufficient folds. Do not assume cheap means profitable."},
{street:"Turn",texture:"K♥ 9♦ 6♦ 2♣",pot:90,bet:70,fold:35,equity:30,notes:"Equity when called can compensate for lower fold frequency. Future decisions and equity realization are ignored here."},
{street:"River",texture:"9♣ 8♣ 7♦ 3♠ 2♥",pot:180,bet:120,fold:50,equity:0,notes:"A polarized river bet may have attractive fold equity, depending on blockers and the opponent's calling range."},
{street:"River",texture:"A♥ Q♠ 7♣ 4♣ 2♦",pot:140,bet:35,fold:10,equity:0,notes:"Low fold frequency can make even a quarter-pot bluff unattractive."},
{street:"Turn",texture:"J♠ 6♠ 4♣ 9♠",pot:200,bet:120,fold:32,equity:25,notes:"The probability of winning when called must be credible; a draw may be dominated and face river decisions."}
];
function compute(s:Spot){const f=s.fold/100,e=s.equity/100;return f*s.pot+(1-f)*(e*(s.pot+s.bet)-(1-e)*s.bet)}
export default function BluffDecisionLab(){
 const [index,setIndex]=useState(0),[guess,setGuess]=useState<boolean|null>(null),[correct,setCorrect]=useState(0),[done,setDone]=useState(0);
 const s=spots[index],ev=compute(s),good=ev>0;
 function choose(v:boolean){if(guess!==null)return;setGuess(v);setDone(x=>x+1);if(v===good)setCorrect(x=>x+1)}
 return <section className="bluff-school" aria-label="Bluff expected value training">
 <header className="bluff-heading"><span>APPLIED STRATEGY LAB · 02</span><h2>Is this bluff profitable?</h2><p>Make a decision using fold equity and equity when called. These simplified mathematical spots are not claims about how real opponents behave.</p></header>
 <div className="bluff-scenario"><div className="bluff-meta"><span>{s.street.toUpperCase()}</span><span>SCENARIO {index+1} / {spots.length}</span><span>{correct} / {done} CORRECT</span></div><div className="bluff-board">{s.texture.split(" ").map((card,i)=><span key={i}>{card}</span>)}</div><div className="bluff-figures"><div><small>POT BEFORE BET</small><strong>{s.pot}</strong></div><div><small>YOUR BLUFF SIZE</small><strong>{s.bet}</strong></div><div><small>ESTIMATED FOLD RATE</small><strong>{s.fold}%</strong></div><div><small>EQUITY IF CALLED</small><strong>{s.equity}%</strong></div></div><h3>Does betting have positive chip EV versus giving up?</h3><div className="bluff-actions"><button disabled={guess!==null} onClick={()=>choose(true)}>Yes — bluff</button><button disabled={guess!==null} onClick={()=>choose(false)}>No — give up</button></div>
 {guess!==null&&<div className="bluff-feedback" role="status"><strong>{guess===good?"Correct calculation":"Review your calculation"}</strong><p>Estimated bluff EV: <b>{ev>=0?"+":""}{ev.toFixed(1)} chips</b>. Formula: fold% × pot + (1 − fold%) × [equity when called × (pot + bet) − (1 − equity) × bet]. {s.notes}</p><button onClick={()=>{setIndex(x=>(x+1)%spots.length);setGuess(null)}}>Next strategy spot →</button></div>}</div><p className="bluff-caveat">This tool assumes a single final decision, no rake and no future wagering. For turn spots, the equity is treated as if fully realized. Real strategy also needs range analysis, blockers and opponent tendencies.</p>
 </section>
}