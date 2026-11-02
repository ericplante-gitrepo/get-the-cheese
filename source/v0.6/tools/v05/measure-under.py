# visible fraction of the mouse under the deck: per mouse pixel, alpha of the magenta mask through the deck (P = a*M + (1-a)*D), averaged
import numpy as np; from PIL import Image
L=lambda n,t: np.asarray(Image.open(f'/tmp/vis-{n}-{t}.png').convert('RGB')).astype(float)
for t in ['1024x768','768x1024']:
  nd,dk,bg=L('nodeck',t),L('deck',t),L('nomouse',t); M=np.array([255,0,255.])
  mask=(nd[...,0]>200)&(nd[...,2]>200)&(nd[...,1]<80)
  den=((M-bg)**2).sum(-1); a=np.clip(((dk-bg)*(M-bg)).sum(-1)/np.maximum(den,1),0,1)
  vis=a[mask].mean(); full=(a[mask]>0.95).mean()
  print(t,'mouse px',int(mask.sum()),'visible fraction %.0f%%'%(100*vis),'(fully unoccluded px %.0f%%)'%(100*full))
