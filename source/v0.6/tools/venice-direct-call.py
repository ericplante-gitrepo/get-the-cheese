import json,os,sys,urllib.request,re
sysmsg="You are an expert three.js game developer. Output ONLY the complete JavaScript file in one ```js fenced block, nothing else."
user=open('render3d-task.md').read()+"\n\n---\nSTYLE GUIDE (reference):\n"+open('style-v2.md').read()+("\n\n---\n"+open(sys.argv[2]).read() if len(sys.argv)>2 else "")
body={"model":"claude-haiku-5-5","reasoning_effort":"none","max_tokens":32000,"messages":[{"role":"system","content":sysmsg},{"role":"user","content":user}]}
r=urllib.request.Request("https://api.venice.ai/api/v1/chat/completions",json.dumps(body).encode(),{"Authorization":"Bearer "+os.environ["VENICE_API_KEY"],"Content-Type":"application/json"})
d=json.load(urllib.request.urlopen(r,timeout=700))
print(d['usage'],file=sys.stderr)
c=d['choices'][0]['message']['content'];m=re.search(r"```(?:js|javascript)?\n(.*?)```",c,re.S)
open(sys.argv[1],'w').write(m.group(1) if m else c)
