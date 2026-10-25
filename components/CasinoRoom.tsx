"use client";
import { useState } from "react";
import Link from "next/link";
import Card from "./Card";
import {compare,evaluate,legal,position,ranks,type Card as PokerCard,type Game,type Action} from "@/lib/poker";

function bestFive(cards: PokerCard[]) {
  if(cards.length<5)return [] as number[];
  let best:number[]=[];let score:number[]=[];
  for(let a=0;a<cards.length-4;a++)for(let b=a+1;b<cards.length-3;b++)
  for(let c=b+1;c<cards.length-2;c++)for(let d=c+1;d<cards.length-1;d++)
  for(let e=d+1;e<cards.length;e++){
    const ids=[a,b,c,d,e], v=evaluate(ids.map(i=>cards[i]));
    if(!best.length || compare(v,score)>0){best=ids;score=v}
  }
  return best;
}
const fmt=(n:number)=>n.toLocaleString();
export default function CasinoRoom({game,loaded,restoreError,takeAction,nextHand}:{
  game:Game;loaded:boolean;restoreError:string;
  takeAction:(action:Action,amount?:number)=>void;nextHand:()=>void;
}){
  const [amount,setAmount]=useState(60),[error,setError]=useState("");
  const complete=game.street==="Showdown", hero=game.players[0], isTurn=loaded&&!restoreError&&!complete&&game.actor===0;
  const l=legal(game),pot=game.players.reduce((sum,p)=>sum+p.total,0);
  const low=Math.min(l.min,l.max), size=Math.max(low,Math.min(l.max,amount));
  const ready=isTurn&&l.canRaise;
  const selected=complete&&game.board.length===5&&!hero.folded?bestFive([...hero.cards,...game.board]):[];
  const made=hero.cards.length===2&&game.board.length>=3&&!hero.folded?ranks[evaluate([...hero.cards,...game.board])[0]]:null;
  const awards=game.awards.map((chips,i)=>({chips,name:game.players[i].name})).filter(p=>p.chips>0);
  const recent=game.log.slice(-4).reverse();
  function submit(action:Action){
    try{takeAction(action,(action==="bet"||action==="raise")?size:undefined);setError("")}
    catch(e){setError(e instanceof Error?e.message:"Action failed")}
  }
  const presets=game.currentBet?[
    {name:"2×",n:game.currentBet*2},{name:"2.5×",n:Math.round(game.currentBet*2.5)},{name:"3×",n:game.currentBet*3}
  ]:[
    {name:"⅓ pot",n:Math.ceil(pot/3)},{name:"½ pot",n:Math.ceil(pot/2)},{name:"¾ pot",n:Math.ceil(pot*.75)},{name:"Pot",n:pot}
  ];
  const active=game.players[game.actor]?.name??"Table";
  return <div className="pc-room">
    <header className="pc-head">
      <div><span className="pc-kicker">POKERLAB / CASH GAME SIMULATION</span><h2>No-Limit Hold’em <span>6-max strategy · 4 seated</span></h2></div>
      <div className="pc-head-stats"><span>BLINDS <b>10 / 20</b></span><span>HAND <b>#{game.hand}</b></span><span className="pc-fake-chip">PLAY MONEY</span></div>
    </header>
    <section className="pc-game">
      <div className="pc-felt"><div className="pc-rim"/><div className="pc-felt-logo">POKERLAB <small>TRAINING TABLE</small></div></div>
      {game.players.map((p,i)=>{
        const pos=position(game,i),hidden=i!==0&&!(complete&&!p.folded&&game.players.filter(x=>!x.folded).length>1);
        const won=complete&&game.awards[i]>0;
        const last=[...game.log].reverse().find(x=>x.startsWith(p.name+" ")&&/ (fold|check|call|bet|raise)( |$)/.test(x));
        return <div key={i} className={`pc-seat pc-seat-${i} ${p.folded?"pc-folded":""} ${won?"pc-winner":""} ${game.actor===i&&!complete?"pc-acting":""}`}>
          <div className="pc-seat-cards">
            {p.cards.length===2&&!(complete&&p.folded)?p.cards.map((c,j)=><span key={j} className={selected.length&&i===0?(selected.includes(j)?"pc-card-best":"pc-card-dim"):""}><Card card={c} small={i!==0} hidden={hidden}/></span>):<div className="pc-mucked">{p.folded?"FOLDED":"OUT"}</div>}
          </div>
          <div className="pc-nameplate"><div className="pc-initial">{i===0?"★":p.name.slice(0,1)}</div><div className="pc-seat-name"><strong>{i===0?"YOU":p.name}</strong><span>{fmt(p.chips)} <small>chips</small></span></div><b className="pc-position">{pos==="BTN"?"D":pos}</b></div>
          {!complete&&p.bet>0&&<div className="pc-placed-bet"><i/>{fmt(p.bet)}</div>}
          {won&&<div className="pc-seat-payout">+{fmt(game.awards[i])}</div>}
          {!complete&&game.actor===i&&<div className="pc-seat-turn">● TO ACT</div>}
          {!complete&&game.actor!==i&&last&&!p.folded&&<div className="pc-seat-last">{last.slice(p.name.length+1)}</div>}
        </div>
      })}
      <div className="pc-center">
        <div className="pc-pot"><span>◉</span><div><small>{complete?"FINAL POT":"TOTAL POT"}</small><strong>{fmt(pot)}</strong></div></div>
        <div className="pc-board">{Array.from({length:5},(_,i)=><div key={`${game.hand}-${i}-${game.board[i]?"dealt":"empty"}`} className={selected.length?(selected.includes(i+2)?"pc-card-best":"pc-card-dim"):""}><Card card={game.board[i]}/></div>)}</div>
        <div className="pc-street">{complete?"SHOWDOWN":game.street.toUpperCase()}{made&&!complete&&<span> • {made}</span>}</div>
      </div>
    </section>
    <div className="pc-controls">
      {complete?<div className="pc-result">
        <div className="pc-result-top"><div><span className="pc-kicker">HAND COMPLETE</span><h3>{game.awards[0]>0?"You collected chips":"Showdown results"}</h3>{made&&<p>Your hand: <b>{made}</b> — strongest five cards highlighted</p>}</div><div className="pc-awards">{awards.map(p=><div key={p.name}><strong>{p.name}</strong><span>+{fmt(p.chips)}</span></div>)}</div></div>
        <button className="pc-next" onClick={()=>{nextHand();setError("")}}>Deal next hand <span>→</span></button>
        <details className="pc-review"><summary>Review the hand and learn</summary><p>A winning result does not necessarily mean the decision was optimal. Review your ranges, position, and bet sizing.</p><Link href="/review">Open hand review →</Link></details>
      </div>:<>
        <div className="pc-turn-row"><div className="pc-turn-message"><span className={isTurn?"pc-green-dot":"pc-grey-dot"}/><b>{isTurn?"YOUR TURN":`${active.toUpperCase()} IS ACTING`}</b></div><span>{isTurn?(l.call?`${fmt(l.call)} TO CALL`:"CHECK AVAILABLE"):"WATCH THE ACTION"}</span></div>
        <div className="pc-sizing">
          <div className="pc-size-heading"><span>{game.currentBet?"RAISE TO":"BET AMOUNT"} <strong>{ready?fmt(size):"—"}</strong></span><small>{ready?`Min ${fmt(low)} · Max ${fmt(l.max)}`:"Your turn to adjust"}</small></div>
          <div className="pc-slider"><button disabled={!ready||size<=low} onClick={()=>setAmount(Math.max(low,size-20))} aria-label="Decrease bet">−</button><input type="range" min={low} max={Math.max(low,l.max)} value={size} disabled={!ready} onChange={e=>setAmount(Number(e.target.value))} aria-label="Bet amount"/><button disabled={!ready||size>=l.max} onClick={()=>setAmount(Math.min(l.max,size+20))} aria-label="Increase bet">+</button></div>
          <div className="pc-presets">{presets.map(p=><button key={p.name} disabled={!ready} onClick={()=>setAmount(Math.min(l.max,Math.max(low,p.n)))}>{p.name}</button>)}<button disabled={!ready} onClick={()=>setAmount(l.max)}>All-in</button></div>
        </div>
        <div className="pc-actions">
          <button className="pc-fold" disabled={!isTurn||!l.actions.includes("fold")} onClick={()=>submit("fold")}>FOLD</button>
          <button className="pc-call" disabled={!isTurn} onClick={()=>submit(l.call?"call":"check")}>{l.call?`CALL ${fmt(l.call)}`:"CHECK"}</button>
          <button className="pc-raise" disabled={!ready} onClick={()=>submit(game.currentBet?"raise":"bet")}>{game.currentBet?"RAISE":"BET"} {ready?fmt(size):""}</button>
        </div>
      </>}
      {error&&<p className="pc-error" role="alert">{error}</p>}
    </div>
    <div className="pc-lower"><div className="pc-log"><div className="pc-section-title">LATEST ACTIONS <span>{game.log.length} events</span></div>{recent.map((entry,i)=><div key={i}><span>●</span>{entry}</div>)}</div><div className="pc-learn"><span className="pc-kicker">IMPROVE EVERY SESSION</span><h3>Train smarter, not just longer.</h3><p>Practice starting ranges, pot odds and decisions with short interactive challenges.</p><Link href="/bootcamp">Start 30-minute training →</Link><Link href="/academy">Explore Academy →</Link></div></div>
  </div>;
}
