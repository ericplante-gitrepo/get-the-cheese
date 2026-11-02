const {M,grid,bfs}=require('./lv.js');
const seed0=+process.argv[3]||1;let seed=seed0;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
const mk=(name,start,dir,cheese,rows,extra={})=>Object.assign({name,start,dir,cheese,walls:[]},grid(rows),extra);
const K=(t)=>t.r+','+t.c;
function info(l){const s=M.solve(l,24);if(!s)return null;const tr=M.runProgram(l,s).trace;return {s:s.join(''),tr,len:s.length};}
const kind=(l,t)=>M.cellAt(l,t.r,t.c).kind;
const visits=(l,i,k)=>i.tr.some(t=>K(t)===k);
const needs=(l,i,m)=>{const b=bfs(l,'FLRB'.replace(m,''));return !b||b.length>i.len;};
const T={
11:[mk('First Ramp',[3,1],0,[0,2],['. . # #','. . . ^','. . . .','. . . .']),9,(l,i)=>true],
12:[mk('Down Again',[3,0],0,[3,3],['. . . .','# # # .','^ . ^ .','. . . .']),10,(l,i)=>visits(l,i,'2,0')&&visits(l,i,'2,2')],
13:[mk('Crate Push-Around',[0,0],1,[3,0],['. . . .','. . X .','. X . .','. . . .']),11,(l,i)=>(()=>{const b=bfs(l,'FL');return !b||b.length>i.len})()&&l.walls.length<=2],
14:[mk('The Stream',[3,0],0,[3,3],['. . ~ .','. # = #','. ^ ~ ^','. . ~ .']),12,(l,i)=>i.tr.some(t=>t.layer==='top')],
15:[mk('Two Ramps',[4,4],3,[0,4],['. . . # #','. . . # #','# # . ^ .','# # < . .','. . . . .']),12,(l,i)=>visits(l,i,'2,3')&&!visits(l,i,'3,2')],
16:[mk('Under the Bridge',[4,0],1,[2,2],['. . # . .','. . # . .','. . ! . .','. . # . .','. . v . .'],{cheeseLayer:'under'}),13,(l,i)=>true],
17:[mk('Over and Under',[4,0],0,[2,2],['. . . . .','. < # . .','. . ! . .','. > # . .','. . . . .'],{cheeseLayer:'under'}),14,(l,i)=>i.tr.some(t=>t.layer==='top')&&i.tr.some(t=>t.layer==='under')],
18:[mk('Back Up',[1,2],1,[4,4],['. . . . .','. > # # .','. . . . .','. . . . .','. . . . .']),15,(l,i)=>needs(l,i,'B')&&i.s.split('').some((m,j)=>m==='B'&&(kind(l,i.tr[j])==='ramp'||kind(l,i.tr[j+1])==='ramp'))],
19:[mk('Island',[0,3],3,[1,3],['. . . . .','. ~ # # .','v ~ # # .','# = # ~ .','. ~ ~ ~ .']),15,(l,i)=>needs(l,i,'B')&&i.s[0]!=='B'&&i.s.slice(1,-1).includes('B')&&i.s[i.len-1]!=='B'],
20:[mk('Big Climb',[4,4],0,[2,2],['. . . . .','. # + # .','. # . ^ .','. ^ ~ . .','. . ~ . .']),16,(l,i)=>needs(l,i,'B')&&i.s[0]!=='B'&&i.s[i.len-1]==='B'&&i.tr.some(t=>t.layer)&&i.tr.some(t=>kind(l,t)==='ramp')],
};
function score(l,t,pred){const i=info(l);if(!i)return [1e6,null];let s=Math.abs(i.len-t)*10+l.walls.length*0.6+Object.values(l.cells).filter(c=>c.kind==='crate').length*0.6;if(!pred(l,i))s+=100;return [s,i];}
function protectedCell(l,r,c){const k=r+','+c;return (l.start[0]===r&&l.start[1]===c)||(l.cheese[0]===r&&l.cheese[1]===c)||!!l.cells[k];}
function mutate(l,base){const n=JSON.parse(JSON.stringify(l));const N=n.size;const x=rnd();
 if(x<0.45){const r=Math.floor(rnd()*N),c=Math.floor(rnd()*N);const s=rnd()<0.5?'E':'S';if((s==='E'&&c<N-1)||(s==='S'&&r<N-1)){const w=r+','+c+','+s;if(!n.walls.includes(w))n.walls.push(w);}}
 else if(x<0.7){if(n.walls.length)n.walls.splice(Math.floor(rnd()*n.walls.length),1);}
 else {const r=Math.floor(rnd()*N),c=Math.floor(rnd()*N),k=r+','+c;if(n.cells[k]&&n.cells[k].kind==='crate'&&!base.cells[k])delete n.cells[k];else if(!protectedCell(n,r,c))n.cells[k]={h:0,kind:'crate'};}
 if(rnd()<0.08){n.dir=Math.floor(rnd()*4);} if(rnd()<0.05){const r=Math.floor(rnd()*N),c=Math.floor(rnd()*N);if(!n.cells[r+','+c]&&!(n.cheese[0]===r&&n.cheese[1]===c))n.start=[r,c];}
 return n;}
const id=+process.argv[2];const [base,t,pred]=T[id];let cur=base,[cs,ci]=score(cur,t,pred);let best=cur,bs=cs,bi=ci;
for(let it=0;it<12000;it++){const n=mutate(cur,base);const [s,i]=score(n,t,pred);const temp=Math.max(0.05,3*(1-it/12000));if(s<=cs||rnd()<Math.exp((cs-s)/temp)){cur=n;cs=s;ci=i;if(s<bs){best=n;bs=s;bi=i;}}}
console.log(JSON.stringify({id,score:bs,len:bi&&bi.len,sol:bi&&bi.s,level:best}));
