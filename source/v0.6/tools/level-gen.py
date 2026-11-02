import random, itertools, json
DR=[-1,0,1,0];DC=[0,1,0,-1];S='NESW'
def ek(r,c,d):
    return [(r-1,c,'S'),(r,c,'E'),(r,c,'S'),(r,c-1,'E')][d]
def step(W,s,m):
    r,c,d=s
    if m=='L':return (r,c,(d+3)%4)
    if m=='R':return (r,c,(d+1)%4)
    md=d if m=='F' else (d+2)%4
    if ek(r,c,md) in W: return None
    nr,nc=r+DR[md],c+DC[md]
    if not(0<=nr<4 and 0<=nc<4):return None
    return (nr,nc,d)
def best(W,st,ch,allowed='FLRB'):
    # BFS by length; returns minimal length and all shortest solutions (that don't pass cheese earlier)
    fr={st:[[]]};seen={st}
    for L in range(1,16):
        nf={};sols=[]
        for s,ps in fr.items():
            for m in allowed:
                t=step(W,s,m)
                if t is None:continue
                if (t[0],t[1])==ch:
                    sols+= [p+[m] for p in ps]; continue
                if t in seen and t not in nf:continue
                nf.setdefault(t,[]).extend(p+[m] for p in ps[:50])
        if sols:return L,sols
        seen|=set(nf);fr=nf
        if not fr:return 99,[]
    return 99,[]
def canon(sols):
    return min(sols,key=lambda p:(p.count('B'),''.join(p).replace('F','0').replace('L','1').replace('R','2').replace('B','3')))
ALLE=[(r,c,'E') for r in range(4) for c in range(3)]+[(r,c,'S') for r in range(3) for c in range(4)]
random.seed(7)
targets=[(3,0),(4,1),(5,2),(6,3),(7,3),(8,4),(9,5),(10,5),(11,6),(12,7)]
needR={2,4,6,7,9}; needB={8}
out=[];used=set()
for i,(tl,nw) in enumerate(targets):
    for tries in range(3000000):
        W=frozenset(random.sample(ALLE,nw));st=(random.randrange(4),random.randrange(4),random.randrange(4))
        ch=(random.randrange(4),random.randrange(4))
        if ch==st[:2]:continue
        L,sols=best(W,st,ch)
        if L!=tl:continue
        c=canon(sols);cs=''.join(c)
        if cs in used:continue
        if i in needB:
            if c.count('B')!=1 or best(W,st,ch,'FLR')[0]<=L+1:continue
        else:
            if 'B' in c:continue
        if i in needR:
            if best(W,st,ch,'FL')[0]<=L or 'R' not in c:continue
        elif 'R' in c and i<2: continue
        if nw and best(frozenset(),st,ch)[0]>=L and i>=2:continue  # walls must lengthen route
        if i==0 and cs!='FFF':continue
        if nw and sum(best(W-{w},st,ch)[0]<L for w in W)*2<nw:continue # half the walls matter
        used.add(cs);out.append(dict(start=list(st[:2]),dir=st[2],cheese=list(ch),walls=[f"{a},{b},{s}" for a,b,s in sorted(W)],sol=cs,len=L));print(i+1,cs,L,nw,tries,flush=True);break
    else: print('FAIL',i+1);break
json.dump(out,open('levels.json','w'),indent=1)
