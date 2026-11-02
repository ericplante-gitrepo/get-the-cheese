import json,os,sys,urllib.request,re,time
model,prompt_file,out=sys.argv[1],sys.argv[2],sys.argv[3]
ctx=[open(f).read() for f in sys.argv[4:]]
sysmsg="You are an expert JavaScript game developer. Output ONLY the requested code in one ```js fenced block, nothing else. ES5-compatible style is fine; no external libs."
content=[]
if ctx:
  blk={"type":"text","text":"REFERENCE FILES:\n\n"+"\n\n-----\n\n".join(ctx)}
  if 'claude' in model: blk["cache_control"]={"type":"ephemeral"}
  content.append(blk)
content.append({"type":"text","text":open(prompt_file).read()})
body={"model":model,"max_tokens":int(os.environ.get("MAXTOK","16000")),"temperature":0.2,"messages":[{"role":"system","content":sysmsg},{"role":"user","content":content}]}
if 'claude' in model: body["reasoning_effort"]="none"
r=urllib.request.Request("https://api.venice.ai/api/v1/chat/completions",json.dumps(body).encode(),{"Authorization":"Bearer "+os.environ["VENICE_API_KEY"],"Content-Type":"application/json"})
t=time.time();d=json.load(urllib.request.urlopen(r,timeout=900))
print(model,d.get('usage'),round(time.time()-t),'s',file=sys.stderr)
c=d['choices'][0]['message']['content'];m=re.search(r"```(?:js|javascript)?\n(.*?)```",c,re.S)
open(out,'w').write(m.group(1) if m else c)
