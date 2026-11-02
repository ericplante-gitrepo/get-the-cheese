const {M,bfs}=require('./lv.js');delete require.cache[require.resolve('./levels-draft.js')];const L=require('./levels-draft.js');
L.forEach((l,i)=>{const s=M.solve(l,24);const nb=bfs(l,'FLR');const nr=bfs(l,'FLB');console.log(i+11,l.name.padEnd(18),s?s.length:'-',s&&s.join(''),'noB',nb&&nb.length,'noR',nr&&nr.length);
 if(s){const t=M.runProgram(l,s.split?s.split(''):s).trace;console.log('    ',t.map(x=>x.r+''+x.c+(x.layer?x.layer[0]:'')).join(' '));}});
