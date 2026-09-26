import json, os, sys, time, urllib.request
TOK=[l.strip().split("=",1)[1] for l in open(os.path.expanduser("~/.claude/skills/dya-reels/.env")) if l.startswith("APIFY_TOKEN=")][0]
def api(m,p,b=None):
    url=f"https://api.apify.com/v2{p}{'&' if '?' in p else '?'}token={TOK}"
    d=json.dumps(b).encode() if b is not None else None
    return json.loads(urllib.request.urlopen(urllib.request.Request(url,data=d,method=m,headers={"Content-Type":"application/json"}),timeout=120).read())
subs=["deaf","hardofhearing","CochlearImplants","HearingAids","asl","Deafhoh"]
searches=["what did I miss","group conversation","captions meeting zoom","live transcribe","who is talking","everyone laughed","left out conversation","exhausting lipreading","AI transcription app","otter ava app"]
rid=api("POST","/acts/practicaltools~apify-reddit-api/runs",{"startUrls":[{"url":f"https://www.reddit.com/r/{s}/top/?t=year"} for s in subs],
  "searches":searches,"sort":"top","time":"year","maxItems":100,"skipComments":True,"searchPosts":True,"fetchPostComments":False})["data"]["id"]
print("run",rid,file=sys.stderr)
t0=time.time()
while time.time()-t0<1200:
    st=api("GET",f"/actor-runs/{rid}")["data"]["status"]
    if st not in("RUNNING","READY"): break
    time.sleep(15)
print("status",st,file=sys.stderr)
items=api("GET",f"/actor-runs/{rid}/dataset/items?format=json&clean=true")
json.dump(items,open("research/reddit/raw.json","w"))
print(len(items),"items")
