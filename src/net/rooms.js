import Peer from "peerjs";
const prefix="astra-tinygods-v1-";
export const messages=Object.freeze(["orders","guess","vote","ready"]);
export function room(host,code,{open,join,input,leave,state,error}){
 const peer=new Peer(host?prefix+code:undefined),clients=new Map();let upstream,closing=false;
 const fail=e=>{if(!closing)error(e?.message||String(e))};peer.on("error",fail);
 peer.on("open",()=>{if(host){open();return}upstream=peer.connect(prefix+code,{reliable:true});wireGuest(upstream)});
 function wireGuest(c){c.on("open",()=>open());c.on("data",p=>{if(p?.type==="view")state(p.data);else if(p?.type==="reject")fail(p.reason)});c.on("error",fail);c.on("close",()=>{if(!closing)fail("Host connection closed.")})}
 peer.on("connection",c=>{
  if(!host){c.close();return}
  c.on("open",()=>{const seat=join();if(seat==null){c.send({type:"reject",reason:"Room full or already playing."});setTimeout(()=>c.close(),300);return}clients.set(c,seat);input(seat,"joined",null)});
  c.on("data",p=>{if(clients.has(c)&&p&&messages.includes(p.type))input(clients.get(c),p.type,p.data)});
  c.on("close",()=>{const s=clients.get(c);clients.delete(c);if(s!=null)leave(s)});c.on("error",fail);
 });
 return {send:(type,data)=>upstream?.open&&upstream.send({type,data}),publish(fn){for(const [c,s] of clients)if(c.open)c.send({type:"view",data:fn(s)})},close(){closing=true;peer.destroy()}};
}
export function code5(){const bytes=crypto.getRandomValues(new Uint8Array(5));return [...bytes].map(v=>"ABCDEFGHJKLMNPQRSTUVWXYZ"[v%24]).join("")}
