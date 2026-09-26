import json, os, sys, time, urllib.request
TOK=[l.strip().split("=",1)[1] for l in open(os.path.expanduser("~/.claude/skills/dya-reels/.env")) if l.startswith("APIFY_TOKEN=")][0]
def api(m,p,b=None):
    url=f"https://api.apify.com/v2{p}{'&' if '?' in p else '?'}token={TOK}"
    d=json.dumps(b).encode() if b is not None else None
    return json.loads(urllib.request.urlopen(urllib.request.Request(url,data=d,method=m,headers={"Content-Type":"application/json"}),timeout=120).read())
Q=['site:reddit.com/r/deaf "I wish there was an app"','site:reddit.com/r/hardofhearing "someone should make"','site:reddit.com/r/deaf "is there an app that"','site:reddit.com/r/hardofhearing "is there an app"','site:reddit.com/r/deaf doorbell knock missed','site:reddit.com/r/deaf gaming voice chat callouts','site:reddit.com/r/hardofhearing gaming discord captions','site:reddit.com/r/deaf lecture classroom missed','site:reddit.com/r/deaf group chat multiple conversations','site:reddit.com/r/CochlearImplants restaurant group','site:reddit.com/r/HearingAids meeting exhausted','site:reddit.com/r/deaf sound alert app missed','site:reddit.com/r/deafgamers','site:reddit.com/r/deaf "live transcribe" problem','site:reddit.com/r/hardofhearing "ava" app review']
rid=api("POST","/acts/apify~google-search-scraper/runs",{"queries":"\n".join(Q),"countryCode":"us","languageCode":"en","resultsPerPage":10,"maxPagesPerQuery":1})["data"]["id"]
print("run",rid,file=sys.stderr)
t0=time.time()
while time.time()-t0<900:
    st=api("GET",f"/actor-runs/{rid}")["data"]["status"]
    if st not in("RUNNING","READY"): break
    time.sleep(10)
print("status",st,file=sys.stderr)
items=api("GET",f"/actor-runs/{rid}/dataset/items?format=json&clean=true")
hits=[];seen=set()
for it in items:
    q=it.get("searchQuery",{}).get("term")
    for r in it.get("organicResults",[]):
        u=r.get("url","")
        if "reddit.com/r/" in u and u not in seen:
            seen.add(u); hits.append({"query":q,"url":u,"title":r.get("title"),"description":r.get("description"),"date":r.get("date")})
json.dump(hits,open("/Users/bera/Documents/GitHub/bainsahack/research/reddit/wishlist_hits.json","w"),indent=1)
print(len(items),"pages",len(hits),"hits")
