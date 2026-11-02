const {M,bfs}=require('./lv.js');const fs=require('fs');
const pick={11:'g11-1',12:'g12-1',13:'h13-4',14:'h14-4',15:'h15-5',16:'h16-5',17:null,18:'g18-2',19:'g19-1',20:'h20-6'};
const L=[];for(let i=11;i<=20;i++){let l;if(pick[i])l=JSON.parse(fs.readFileSync(pick[i]+'.json')).level;L.push(l);}
const {grid}=require('./lv.js');
L[6]=Object.assign({name:'Over and Under',start:[3,0],dir:0,cheese:[2,2],walls:['2,0,S'],cheeseLayer:'under'},grid(['. . . . .','. > # . .','. . ! X .','. > # . .','. . . . .']));
L[9]=Object.assign({name:'Big Climb',start:[4,1],dir:2,cheese:[3,2],walls:[]},grid(['. . . . .','. # + < .','. # . ~ .','~ ^ . ~ .','. . ~ ~ .']));
const ov=JSON.parse(process.env.OV||'{}');for(const k in ov)Object.assign(L[k-11],ov[k]);
L.forEach((l,i)=>{const s=M.solve(l,24);const nb=bfs(l,'FLR');const fl=bfs(l,'FL');const tr=s&&M.runProgram(l,s).trace;
console.log(i+11,l.name.padEnd(18),s&&s.length,s&&s.join(''),'needB',!nb||nb.length>s.length,'needR',!fl||fl.length>s.length);console.log('   ',tr&&tr.map(x=>x.r+''+x.c+(x.layer?x.layer[0]:'')).join(' '));});
fs.writeFileSync('levels-final.json',JSON.stringify(L));
