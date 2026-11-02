import {Worker,isMainThread,parentPort,workerData} from "node:worker_threads";
import {availableParallelism} from "node:os";
import {world,living,shuffle} from "../src/sim/world.js";
import {apply,begin,bot} from "../src/sim/orders.js";
import {step,finish,winner,score} from "../src/sim/turn.js";
import {styles,T} from "../src/config/tunables.js";
function match(seed,style){
 const w=world(seed),bots=shuffle(w.r,[...styles]).slice(0,4),deaths=Array(T.lastTurn).fill(0);let win=null,first=0,firstSeat=-1,early=false,lead=0,prev=60;
 while(win===null){begin(w);for(let i=0;i<4;i++)apply(w,i,bot(w,i,style==="mixed"?bots[i]:styles.find(b=>b.toLowerCase()===style)));for(let n=0;n<T.simSeconds/T.dt;n++)step(w);finish(w);
  const c=living(w).slice(0,4),total=living(w).reduce((a,b)=>a+b);deaths[w.turn-1]=prev-total;prev=total;
  const kill=w.events.find(e=>e.type==="kill");if(kill&&!first){first=w.turn;firstSeat=kill.victimFaction}
  if(w.turn<3&&c.includes(0))early=true;lead=Math.max(lead,Math.max(...c)-Math.min(...c));
  for(let i=0;i<4;i++)score(w,i,w.questions.map(()=>Math.floor(w.r()*4)));win=winner(w);
 }return {win,turn:w.turn,first,early,lead,deaths,firstSeat};
}
if(!isMainThread){parentPort.postMessage(Array.from({length:workerData.n},(_,i)=>match(workerData.seed+i,workerData.style)))}
else{
 const arg=(k,d)=>process.argv.includes(k)?process.argv[process.argv.indexOf(k)+1]:d;
 const matches=Number(arg("--matches",1000)),seed=Number(arg("--seed",1)),style=arg("--bots","mixed");
 if(!Number.isInteger(matches)||matches<1||!["mixed",...styles.map(s=>s.toLowerCase())].includes(style))throw Error("Invalid match count or bot style");
 const threads=Math.min(matches,Math.max(1,availableParallelism()-1),8);
 const batches=await Promise.all(Array.from({length:threads},(_,i)=>new Promise((resolve,reject)=>{let start=Math.floor(i*matches/threads),end=Math.floor((i+1)*matches/threads);const t=new Worker(new URL(import.meta.url),{workerData:{n:end-start,seed:seed+start,style}});t.once("message",resolve);t.once("error",reject)})));
 const rows=batches.flat(),avg=(fn,list=rows)=>+(list.reduce((n,r)=>n+fn(r),0)/(list.length||1)).toFixed(3);
 console.log(JSON.stringify({matches,seed,style,averageTurns:avg(r=>r.turn),winPercent:[0,1,2,3].map(i=>avg(r=>100*(r.win===i))),firstKillTurn:avg(r=>r.first,rows.filter(r=>r.first)),decidedByTurn3Percent:avg(r=>100*(r.turn<=3)),earlyEliminationPercent:avg(r=>100*r.early),averageDeathsPerTurn:Array.from({length:T.lastTurn},(_,i)=>avg(r=>r.deaths[i],rows.filter(r=>r.turn>i))),firstVictimFactionWinPercent:avg(r=>100*(r.firstSeat===r.win),rows.filter(r=>r.firstSeat>=0&&r.firstSeat<4)),averageMaxLivingGap:avg(r=>r.lead)},null,2));
}
