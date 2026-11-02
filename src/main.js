import "./style.css";
import {T,factions,symbols,styles,places,verbs,rumors} from "./config/tunables.js";
import {renderer,inspect} from "./render/app.js";
import {world,peaceful,move,shuffle} from "./sim/world.js";
import {targets} from "./sim/orders.js";
import {Game,blank} from "./game.js";
import {room,code5} from "./net/rooms.js";
import {toggle,mix,cue} from "./audio.js";
const $=s=>document.querySelector(s),panel=$("#panel"),status=$("#status"),seed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
const text=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const btn=(id,label,primary=false)=>`<button id="${id}" class="${primary?"primary":""}">${label}</button>`;
const options=(list,current)=>list.map((v,i)=>`<option value="${text(v)}" ${v===current?"selected":""}>${text(v)}</option>`).join("");
function click(id,fn){const e=document.getElementById(id);if(e)e.onclick=fn}
const badges=c=>factions.map((f,i)=>`<span class="badge">${symbols[i]} ${f} · ${c[i]}</span>`).join("");
let demo=world(seed()),view,game,net,mode="home",page="home",localSeat=0,humans=[0],remote=new Set(),ready=new Set(),code="",role="",selected=-1,board,lastKey="",notice="",draft=blank(),guess=[],handoff=false,passed=new Set(),phaseKey="",lastEvent="",replay=null,filmCache=null,publishClock=0;
let personalities=shuffle(demo.r,[...styles]).slice(0,4);
function msg(s){notice=s;let el=$("#note");if(el)el.textContent=s}
const note=()=>`<p id="note" class="error" role="status">${text(notice)}</p>`;
function reset(){net?.close();net=null;game=null;view=null;role="";code="";remote.clear();ready.clear();mode="home";page="home";humans=[0];localSeat=0;notice="";lastKey="";replay=null;phaseKey="";filmCache=null;selected=-1;home()}
function home(){
 page="home";status.innerHTML=badges([12,12,12,12,12]);panel.innerHTML=`<div class="eyebrow">THE SOCIAL STRATEGY GAME</div><h2>Pull the strings.</h2><p>Give secret orders. Watch sixty little lives collide. Guess which god started it.</p><div class="btns">${btn("solo","✦ &nbsp; Play vs bots",true)}${btn("hot","Pass & play")}${btn("create","Create a room")}${btn("join","Join a room")}${btn("how","How to play")}</div>${note()}`;
 click("solo",()=>lobby("solo"));click("hot",()=>lobby("hotseat"));click("create",()=>connect(true));click("join",()=>{panel.innerHTML=`<small>FRIENDS ONLY</small><h2>Join a room</h2><label>Five-letter room code<input id="code" maxlength="5" autocomplete="off"></label>${btn("enter","Connect",true)} ${btn("back","Back")}${note()}`;click("enter",()=>connect(false,$("#code").value.trim().toUpperCase()));click("back",reset)});
 click("how",()=>{panel.innerHTML=`<small>FIELD GUIDE</small><h2>How to play</h2><p>Lead one faction. Spend influence on up to two secret orders and one rumor each turn. Stronger orders cost more.</p><p>Your faction obeys. Neutrals listen according to trust. Rumors can reach rival villagers.</p><p>Watch the town act, replay the headlines, then guess who caused each incident. Correct guesses earn influence and a tiebreak point.</p><p>Survive with the last living faction. On turn nine, population, health and points decide. Eliminated gods can whisper and vote.</p>${btn("back","Back to town")}`;click("back",reset)})
}
function lobby(m){if(m==="hotseat"&&humans.length<2)humans=[0,1];mode=m;page="lobby";drawLobby()}
function drawLobby(){
 status.innerHTML=badges([12,12,12,12,12]);const guest=role==="guest";
 panel.innerHTML=`<small>THE COUNCIL</small><h2>${mode==="online"?"Friend room":mode==="hotseat"?"Pass & play":"Solo council"}</h2>${code?`<p>Room code <b>${text(code)}</b></p>`:""}${mode==="hotseat"?`<label>Local players<select id="players">${options([2,3,4],humans.length)}</select></label>`:""}
 ${mode==="solo"?`<label>Your faction<select id="seat">${options(factions.slice(0,4),factions[localSeat])}</select></label>`:""}
 ${factions.slice(0,4).map((f,i)=>`<div class="row"><strong>${symbols[i]} ${f}</strong>${humans.includes(i)||remote.has(i)?`<span>${i===localSeat?"You":remote.has(i)?"Friend":"Local player"}${ready.has(i)?" ✓":""}</span>`:`<select aria-label="${f} bot" data-bot="${i}" ${guest?"disabled":""}>${options(styles,personalities[i])}</select>`}</div>`).join("")}
 <div class="btns">${guest?btn("ready","Ready",true):btn("start","Start match",true)}${btn("back","Leave lobby")}</div>${note()}`;
 document.querySelectorAll("[data-bot]").forEach(el=>el.onchange=()=>{personalities[Number(el.dataset.bot)]=el.value;broadcastLobby()});
 if($("#players"))$("#players").onchange=e=>{humans=Array.from({length:+e.target.value},(_,i)=>i);drawLobby()};
 if($("#seat"))$("#seat").onchange=e=>{localSeat=factions.indexOf(e.target.value);humans=[localSeat];drawLobby()};
 click("start",()=>{if(role==="host"&&[...remote].some(i=>!ready.has(i)))return msg("Waiting for your friends to mark ready.");start()});click("back",reset);click("ready",()=>net.send("ready",true));
}
function broadcastLobby(){if(role==="host")net?.publish(i=>({lobby:true,seat:i,humans,remote:[...remote],ready:[...ready],personalities}))}
function connect(host,id){
 if(!host&&!/^[A-Z]{5}$/.test(id))return msg("Enter the five letters shown in the host’s lobby.");
 code=host?code5():id;role=host?"host":"guest";mode="online";page="connecting";panel.innerHTML=`<small>FRIEND ROOM</small><h2>Connecting…</h2><p>Contacting the room service.</p>${btn("back","Back")}${note()}`;click("back",reset);
 net=room(host,code,{open(){if(host)lobby("online")},join(){if(game||page!=="lobby")return null;return [1,2,3].find(i=>!remote.has(i))},input(i,type,data){
 if(type==="joined"){remote.add(i);drawLobby();broadcastLobby()}else if(type==="ready"&&page==="lobby"){ready.add(i);drawLobby();broadcastLobby()}else game?.input(i,type,data)
 },leave(i){remote.delete(i);ready.delete(i);if(game)game.disconnect(i);else if(page==="lobby"){drawLobby();broadcastLobby()}},state(s){
 if(s.lobby){localSeat=s.seat;humans=s.humans;remote=new Set(s.remote);ready=new Set(s.ready);personalities=s.personalities;lobby("online");return}
 page="game";localSeat=s.seat;if(s.clips)filmCache=s.clips;view=s;sync();
 },error(s){msg(s+" Use Back to return to the town.");if(page==="game"&&!$("#leave")){panel.insertAdjacentHTML("beforeend",btn("leave","Leave room"));click("leave",reset)}}});
}
function start(){page="game";notice="";phaseKey="";lastKey="";selected=-1;filmCache=null;replay=null;game=new Game(seed(),[...humans,...remote],personalities);view=game.view(localSeat);sync()}
function refresh(){if(game)view=game.view(localSeat);sync()}
function sync(){
 const k=view.turn+"-"+view.phase;if(k!==phaseKey){phaseKey=k;draft=blank();guess=[];passed.clear();notice="";replay=null;if(view.phase!=="Recap")filmCache=null;if(mode==="hotseat"&&["Command","Guess"].includes(view.phase)){localSeat=humans[0];view=game.view(localSeat);handoff=true}else handoff=false;if(view.phase==="Recap")cue("news")}
 const key=[view.rev,view.seat,view.phase,handoff,view.submitted,view.guessed].join(".");
 if(key!==lastKey){lastKey=key;drawGame()}
 status.innerHTML=`<b>TURN ${view.turn}/${T.lastTurn} · ${view.phase.toUpperCase()}</b><span>${Math.max(0,Math.ceil(view.left))}s &nbsp; Tension <meter min="0" max="100" value="${view.tension}"></meter> ${view.tension}%</span>`;
 if(view.phase==="Simulation"){const events=view.events,latest=events.at(-1),id=view.turn+"-"+latest?.id;if(latest&&id!==lastEvent){lastEvent=id;if(latest.score>=5)board?.focus(latest);cue(latest.type)}const feed=$("#feed");if(feed)feed.textContent=view.kills.slice(-4).map(e=>e.text).join(" • ")||latest?.text||"The borough is quiet."}mix(view.tension);
}
function send(type,data){
 if(game){if(!game.input(localSeat,type,data))return msg("That submission is no longer available.");if(mode==="hotseat"&&["orders","guess"].includes(type)){passed.add(localSeat);const next=humans.find(i=>!passed.has(i));if(next!=null){localSeat=next;handoff=true;draft=blank();guess=[]}}refresh()}else{net.send(type,data);msg("Sent to host…")}
}
function drawGame(){
 const s=view;const heading=`<div class="eyebrow">${symbols[s.seat]} ${factions[s.seat]} &nbsp; / &nbsp; ${s.counts[s.seat]?"COUNCIL":"GHOST"}</div>`;
 if(handoff){panel.innerHTML=heading+`<h2>Pass the screen</h2><p>Hand the device to the ${factions[s.seat]} player.</p>${btn("unlock","I’m ready",true)}`;click("unlock",()=>{handoff=false;lastKey="";sync()});return}
 if(s.phase==="Command"){
 if(s.submitted){panel.innerHTML=heading+"<h2>Sealed.</h2><p>Your orders are private. Waiting for the other gods.</p>";return}
 editor(heading);return}
 if(s.phase==="Simulation"){panel.innerHTML=heading+`<h2>Town in motion</h2><p>${s.turn>=T.suddenTurn?"Tension rising. Every remaining faction is on edge.":"Watch the villagers. Select one to inspect it."}</p>${badges(s.counts)}${game?`<h3>Playback</h3><div class="row">${T.speedSteps.map(n=>btn("s"+n,n+"×",game.speed===n)).join("")}</div>`:""}<div class="feed"><small>INCIDENT WIRE</small><p id="feed"></p></div>`;for(const n of T.speedSteps)click("s"+n,()=>{game.speed=n;drawGame()});return}
 if(s.phase==="Recap"){if(s.clips)filmCache=s.clips;panel.innerHTML=heading+`<h2>The evening edition</h2><p>Turn ${s.turn} · ${s.kills.length} villagers lost</p><div class="cards">${s.highlights.map((e,i)=>btn("hl"+i,"▷ "+text(e.text))).join("")}</div>${!s.counts[s.seat]?`<h3>Ghost vote</h3>${s.highlights.map((e,i)=>btn("v"+i,(s.vote===e.id?"✓ ":"")+"#"+(i+1))).join(" ")}`:""}<p>${s.votes} ghost votes</p>${game?btn("next","Open guesses",true):""}<details><summary>Kill list</summary>${s.kills.map(e=>text(e.text)).join("<br>")||"No deaths."}</details>`;
 s.highlights.forEach((e,i)=>{click("hl"+i,()=>{replay={start:performance.now(),frames:filmCache?.[i]||[],e};board.focus(e)});click("v"+i,()=>send("vote",e.id))});click("next",()=>game.left=0);return}
 if(s.phase==="Guess"){panel.innerHTML=heading+`<h2>Whose doing?</h2><p>One correct guess earns one point and extra influence next turn.</p>${s.guessed?"<b>Guesses sealed.</b>":s.questions.map((e,i)=>`<p>${text(e.text)}</p><select aria-label="Suspect" data-answer="${i}"><option value="-1">Choose a god</option>${factions.slice(0,4).map((f,i)=>`<option value="${i}">${f}</option>`).join("")}</select>`).join("")+btn("seal","Seal guesses",true)}`;click("seal",()=>send("guess",[...document.querySelectorAll("[data-answer]")].map(el=>+el.value)));return}
 const end=s.end,story=[`Sixty villagers woke up in Littleborough.`,end.rounds[0].headline,`By the final edition, ${end.rounds.reduce((a,b)=>a+b.kills,0)} villagers had fallen.`,`The town believed ${end.beliefs} whispers.`,`${factions[end.win]} prevailed on turn ${s.turn}.`];
 panel.innerHTML=heading+`<h2>${factions[end.win]} prevail.</h2><h3>Town story</h3>${story.map(t=>`<div>${text(t)}</div>`).join("")}<p>Guess points · ${end.points.map((p,i)=>symbols[i]+" "+p).join(" / ")}</p><details><summary>The Truth · all secret orders</summary>${end.history.map(p=>`<p><b>T${p.turn} · ${factions[p.seat]}</b><br>${[...p.orders,...(p.rumor?[p.rumor]:[])].map(a=>text(a.verb+" "+(a.target==="none"?"":a.target)+" ×"+a.s)).join(", ")||"Passed"}</p>`).join("")}</details><div class="btns">${game?btn("rematch","Rematch",true):""}${btn("copy","Copy town story")}${btn("back","Leave town")}</div>${note()}`;
 click("rematch",start);click("back",reset);click("copy",async()=>{try{await navigator.clipboard.writeText(story.join("\n"));msg("Story copied.")}catch{msg(story.join(" "))}});
}
function editor(heading){
 const s=view,ghost=!s.counts[s.seat],spent=draft.orders.reduce((a,b)=>a+b.s,0)+(draft.rumor?.s||0);
 panel.innerHTML=heading+`<h2>${ghost?"Ghost whisper":"Secret orders"}</h2><p>${ghost?"Send one free rumor.":`<b>${s.budget-spent} influence</b> left · ${draft.orders.length}/2 orders`}</p><div class="row">${ghost?"":btn("orderTab","Orders")}${btn("rumorTab","Rumor")}</div><div id="form"></div><div id="queue"></div><div class="btns">${btn("seal","Seal & watch",true)}</div>${note()}`;
 function form(isRumor){const choices=isRumor?rumors:verbs;$("#form").innerHTML=`<label>Action<select id="verb">${options(choices)}</select></label><div class="row"><label>Target<select id="target"></select></label><label>Strength<select id="strength">${options(isRumor?[1,2]:[1,2,3])}</select></label></div>${btn("add",isRumor?"Add whisper":"Add order")}`;
 const update=()=>$("#target").innerHTML=options(targets($("#verb").value));$("#verb").onchange=update;update();click("add",()=>{const a={verb:$("#verb").value,target:$("#target").value,s:+$("#strength").value};
 if(!isRumor&&draft.orders.length>=2)return msg("Two orders already queued.");if(isRumor&&draft.rumor)return msg("Remove the queued rumor to replace it.");if(!ghost&&spent+a.s>s.budget)return msg("Choose a lower strength to fit your influence.");if(isRumor)draft.rumor=a;else draft.orders.push(a);notice="";editor(heading)})}
 form(ghost);click("orderTab",()=>form(false));click("rumorTab",()=>form(true));$("#queue").innerHTML=[...draft.orders,...(draft.rumor?[draft.rumor]:[])].map((a,i)=>btn("del"+i,text(a.verb+" "+(a.target==="none"?"":a.target)+" ×"+a.s+"  ✕"))).join("");
 [...draft.orders,...(draft.rumor?[draft.rumor]:[])].forEach((a,i)=>click("del"+i,()=>{if(i<draft.orders.length)draft.orders.splice(i,1);else draft.rumor=null;editor(heading)}));click("seal",()=>send("orders",structuredClone(draft)));
}
click("sound",()=>$("#sound").textContent=toggle()?"Sound on":"Sound off");
function describe(v){$("#inspect").textContent=inspect(v)+(v?.op?" · Feelings "+v.op.map((n,i)=>({n,i})).sort((a,b)=>Math.abs(b.n)-Math.abs(a.n)).slice(0,2).map(a=>factions[a.i]+" "+Math.round(a.n)).join(", "):"")}
home();renderer(id=>{selected=id;describe((view?.people||demo.villagers)[id])}).then(r=>{board=r}).catch(e=>msg("Town renderer could not start: "+e.message));
let last=performance.now(),demoClock=0,uiClock=0,filmSent="";
let lastHost=performance.now();
setInterval(()=>{const now=performance.now(),dt=Math.min((now-lastHost)/1000,3);lastHost=now; if(game){game.advance(dt);publishClock+=dt;uiClock+=dt;if(uiClock>=.1){uiClock=0;refresh()}
 if(role==="host"&&publishClock>=1/T.snapshotHz){publishClock=0;const key=game.w.seed+"-"+game.w.turn+"-"+game.phase;net.publish(i=>game.view(i,key!==filmSent));filmSent=key}}
},50);
function frame(now){
 const dt=Math.min((now-last)/1000,.25);last=now;
 let people=view?.people;if(!people){demoClock+=dt;const think=demoClock>.5;if(think)demoClock=0;for(const v of demo.villagers){if(think)peaceful(demo,v);move(v,dt)}people=demo.villagers}
 if(replay){const index=Math.floor((now-replay.start)/240),f=replay.frames[index];if(f){people=people.map((v,i)=>({...v,x:f.people[i][0],y:f.people[i][1],hp:f.people[i][2],state:f.people[i][3],thought:f.people[i][4]}))}else replay=null}
 board?.draw(people,dt);if(selected>=0)describe(people[selected]);requestAnimationFrame(frame)
}requestAnimationFrame(frame);



