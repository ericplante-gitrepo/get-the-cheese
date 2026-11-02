const fs=require('fs');const html=fs.readFileSync(__dirname+'/../../src/game.html','utf8');
const code=html.match(/<script id="logic">([\s\S]*?)<\/script>/)[1];const mod={exports:{}};new Function('module',code)(mod);
const M=mod.exports;
// compact grid: rows of tokens. . =h0, # =h1, ^>v< ramp (up dir N E S W), X crate, ~ water, = bridge EW over water, | bridge NS over water, + bridge EW over ground, ! bridge NS over ground
function grid(rows){const cells={};const D={'^':'N','>':'E','v':'S','<':'W'};rows.forEach((row,r)=>row.split(' ').forEach((t,c)=>{let o=null;
 if(t==='#')o={h:1};else if(D[t])o={h:0,kind:'ramp',rampDir:D[t]};else if(t==='X')o={h:0,kind:'crate'};else if(t==='~')o={h:0,kind:'water'};
 else if(t==='=')o={h:1,kind:'bridge',axis:'EW',water:true};else if(t==='|')o={h:1,kind:'bridge',axis:'NS',water:true};
 else if(t==='+')o={h:1,kind:'bridge',axis:'EW'};else if(t==='!')o={h:1,kind:'bridge',axis:'NS'};
 if(o)cells[r+','+c]=o;}));return {size:rows.length,cells};}
module.exports={M,grid};
if(require.main===module){const L=require('./levels-draft.js');let prev=0;L.forEach((l,i)=>{const s=M.solve(l,20);const noB=M.solve({...l},20);
 // B-free length
 const sb=(()=>{const st=M.step;return null})();
 console.log(i+11,l.name,s?s.length:null,s&&s.join(''));});}
function bfs(level,moves='FLRB',max=24){const k=s=>s.r+','+s.c+','+s.d+','+(s.layer||'');let fr=[{s:{r:level.start[0],c:level.start[1],d:level.dir},m:''}];const seen=new Set([k(fr[0].s)]);
 for(let d=0;d<max;d++){const nx=[];for(const n of fr)for(const mv of moves){const r=M.step(level,n.s,mv);if(r.type!=='move'&&r.type!=='turn')continue;if(M.isWin(level,r.state))return n.m+mv;const kk=k(r.state);if(seen.has(kk))continue;seen.add(kk);nx.push({s:r.state,m:n.m+mv});}fr=nx;}return null;}
module.exports.bfs=bfs;
