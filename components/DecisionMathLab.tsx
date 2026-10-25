"use client";
import {useState} from "react";
function pct(n:number){return (n*100).toFixed(1)+"%"}
export default function DecisionMathLab(){
 const [pot,setPot]=useState(100),[bet,setBet]=useState(50),[equity,setEquity]=useState(30),[bluff,setBluff]=useState(75),[outs,setOuts]=useState(9);
 const call=Math.max(0,bet),base=Math.max(0,pot),eq=Math.min(100,Math.max(0,equity))/100,need=call/(base+2*call||1);
 const callEV=eq*(base+call)-(1-eq)*call;
 const pureBluffFold=bluff/(base+bluff||1);
 const oneCard=Math.min(1,Math.max(0,outs)/47);
 const twoCards=1-(1-Math.min(46,Math.max(0,outs))/47)*(1-Math.min(46,Math.max(0,outs))/46);
 return <section className="dm-lab" aria-label="Poker decision mathematics">
 <header className="dm-heading"><span>POKERLAB / DECISION ENGINE</span><h2>Learn the math behind each bet</h2><p>Move the sliders and see what changes. Simplified, no-rake examples; actual decisions depend on ranges and future actions.</p></header>
 <div className="dm-cards"><article className="dm-card"><h3>Facing a bet</h3><label>Pot before opponent bets <strong>{pot}</strong><input type="range" min="20" max="500" step="10" value={pot} onChange={e=>setPot(Number(e.target.value))}/></label><label>Opponent bets / cost to call <strong>{bet}</strong><input type="range" min="10" max="500" step="10" value={bet} onChange={e=>setBet(Number(e.target.value))}/></label><label>Your estimated showdown equity <strong>{equity}%</strong><input type="range" min="0" max="100" value={equity} onChange={e=>setEquity(Number(e.target.value))}/></label><div className="dm-outcome"><small>REQUIRED EQUITY</small><strong>{pct(need)}</strong><small>ILLUSTRATIVE CALL EV</small><strong>{callEV>=0?"+":""}{callEV.toFixed(1)} chips</strong></div><p>{eq>=need?"Your entered equity clears the break-even threshold in this simplified final-street model.":"Your entered equity is below the break-even call threshold in this simplified final-street model."} Calling {call} contests a final pot of {base+2*call}.</p></article>
 <article className="dm-card"><h3>Bluff fold equity</h3><label>Bluff size <strong>{bluff}</strong><input type="range" min="10" max="500" step="5" value={bluff} onChange={e=>setBluff(Number(e.target.value))}/></label><div className="dm-outcome"><small>BREAK-EVEN FOLD FREQUENCY</small><strong>{pct(pureBluffFold)}</strong></div><p>With zero equity when called, a bluff of {bluff} into {pot} must succeed at least {pct(pureBluffFold)} of the time. Any equity when called changes the calculation.</p><h3>Drawing odds</h3><label>Estimated clean outs <strong>{outs}</strong><input type="range" min="0" max="20" value={outs} onChange={e=>setOuts(Number(e.target.value))}/></label><div className="dm-outcome"><small>NEXT CARD (FLOP → TURN)</small><strong>{pct(oneCard)}</strong><small>BY RIVER (TWO CARDS TO COME)</small><strong>{pct(twoCards)}</strong></div><p>Assumes 47 unseen cards on the flop, with stable clean outs and no folded-card information.</p></article></div>
 </section>;
}