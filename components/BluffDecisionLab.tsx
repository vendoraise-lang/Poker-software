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
 const folds=s.fold,called=100-folds,winWhenCalled=called*s.equity/100,loseWhenCalled=called*(100-s.equity)/100;
 const foldGains=folds*s.pot/100,calledWins=winWhenCalled*(s.pot+s.bet)/100,calledLosses=loseWhenCalled*s.bet/100;
 const pureThreshold=Math.round(s.bet/(s.pot+s.bet)*1000)/10;
 function choose(v:boolean){if(guess!==null)return;setGuess(v);setDone(x=>x+1);if(v===good)setCorrect(x=>x+1)}
 return <section className="bluff-school" aria-label="Bluff expected value training">
 <header className="bluff-heading"><span>APPLIED STRATEGY LAB · 02</span><h2>Is this bluff profitable?</h2><p>Make a decision using fold equity and equity when called. These simplified mathematical spots are not claims about how real opponents behave.</p></header>
 <div className="bluff-scenario"><div className="bluff-meta"><span>{s.street.toUpperCase()}</span><span>SCENARIO {index+1} / {spots.length}</span><span>{correct} / {done} CORRECT</span></div><div className="bluff-board">{s.texture.split(" ").map((card,i)=><span key={i}>{card}</span>)}</div><div className="bluff-figures"><div><small>POT BEFORE BET</small><strong>{s.pot}</strong></div><div><small>YOUR BLUFF SIZE</small><strong>{s.bet}</strong></div><div><small>ESTIMATED FOLD RATE</small><strong>{s.fold}%</strong></div><div><small>EQUITY IF CALLED</small><strong>{s.equity}%</strong></div></div><div className="bluff-words"><strong>Before you choose:</strong> A bluff means betting to make your opponent fold. The <b>pot</b> is the chips already in the middle. <b>Fold rate</b> means how often your opponent gives up. <b>Equity when called</b> is your estimated chance to win when they do not fold. <b>EV</b> is your average profit or loss if a situation repeats many times.</div><h3>Would this bet make chips on average, or lose chips?</h3><div className="bluff-actions"><button disabled={guess!==null} onClick={()=>choose(true)}>Yes — bluff</button><button disabled={guess!==null} onClick={()=>choose(false)}>No — give up</button></div>
 {guess!==null&&<div className="bluff-feedback" role="status">
 <strong>{guess===good?"Correct — good reasoning!":"Not quite — learn why below"}</strong>
 <h3>Let’s break this hand down, one step at a time.</h3>
 <ol className="bluff-steps">
 <li><b>What are you risking?</b> There are <b>{s.pot} chips</b> in the pot. You bet <b>{s.bet} chips</b>. If your opponent folds, you win the {s.pot} chips already in the pot. If they call and you lose, you lose your {s.bet} chip bet.</li>
 <li><b>Imagine this exact situation 100 times.</b> Your opponent folds about <b>{folds} times</b> and calls about <b>{called} times</b>. Fold means they give up and you win the existing pot.</li>
 <li><b>When they call, can you still win?</b> Your estimated winning chance is <b>{s.equity}%</b>. Out of 100 situations, roughly <b>{winWhenCalled.toFixed(1)}</b> end with a call and a win, and <b>{loseWhenCalled.toFixed(1)}</b> end with a call and a loss.</li>
 <li><b>Add your average gains and losses:</b><div className="bluff-math-line"><span>Opponent folds: +{foldGains.toFixed(1)} chips</span><span>You get called and win: +{calledWins.toFixed(1)} chips</span><span>You get called and lose: −{calledLosses.toFixed(1)} chips</span></div><b>Net average: {ev>=0?"+":""}{ev.toFixed(1)} chips per decision.</b></li>
 <li><b>So what should you do?</b> {good?"In this simplified situation, betting has a positive average return compared with giving up.":"In this simplified situation, the bluff loses chips on average. Giving up is the better option if it costs nothing more."} {s.equity===0?"Since your hand cannot win when called, your opponent would need to fold more than "+pureThreshold+"% of the time for this bluff to make money.":"Because you sometimes win even when called, both fold frequency and your chance of winning matter."}</li>
 </ol>
 <div className="bluff-example"><b>In one sentence:</b> {good?"The folds and occasional wins earn more than the losing calls cost.":"The opponent does not fold often enough to make up for your losing bets."}</div>
 <details><summary>Why might a real hand be different?</summary><p>{s.notes} Opponents have different hands and strategies; the fold rate and equity shown here are estimates, not facts. This is an educational model, not an instruction to gamble.</p></details>
 <button onClick={()=>{setIndex(x=>(x+1)%spots.length);setGuess(null)}}>I understand — next example →</button>
 </div>}</div><p className="bluff-caveat">This tool assumes a single final decision, no rake and no future wagering. For turn spots, the equity is treated as if fully realized. Real strategy also needs range analysis, blockers and opponent tendencies.</p>
 </section>
}