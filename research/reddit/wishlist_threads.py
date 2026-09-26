import json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
TOK=[l.strip().split("=",1)[1] for l in open(os.path.expanduser("~/.claude/skills/dya-reels/.env")) if l.startswith("APIFY_TOKEN=")][0]
def api(m,p,b=None):
    url=f"https://api.apify.com/v2{p}{'&' if '?' in p else '?'}token={TOK}"
    d=json.dumps(b).encode() if b is not None else None
    return json.loads(urllib.request.urlopen(urllib.request.Request(url,data=d,method=m,headers={"Content-Type":"application/json"}),timeout=120).read())
P=["hardofhearing/comments/1qmgrz9/","deaf/comments/1p9z1e1/","deafgamers/comments/1mu1ljh/","hardofhearing/comments/1sdeuaz/","deaf/comments/xcxkz3/","deaf/comments/13rkeo7/","deaf/comments/160nu2l/","hardofhearing/comments/1lc7seg/","deaf/comments/1og9m9x/","deaf/comments/1rs0jq5/","deaf/comments/4y41b9/","deaf/comments/17p9gfp/","hardofhearing/comments/16tfgqi/","deaf/comments/1ajq0m6/"]
def run(p):
    u="https://www.reddit.com/r/"+p
    try:
        rid=api("POST","/acts/practicaltools~apify-reddit-api/runs",{"startUrls":[{"url":u}],"maxItems":100,"skipComments":False,"fetchPostComments":True})["data"]["id"]
        t0=time.time()
        while time.time()-t0<600:
            st=api("GET",f"/actor-runs/{rid}")["data"]["status"]
            if st not in("RUNNING","READY"): break
            time.sleep(10)
        items=api("GET",f"/actor-runs/{rid}/dataset/items?format=json&clean=true")
        print(p,st,len(items),file=sys.stderr); return {"url":u,"items":items}
    except Exception as e:
        print(p,"ERR",e,file=sys.stderr); return {"url":u,"items":[],"error":str(e)}
with ThreadPoolExecutor(7) as ex: res=list(ex.map(run,P))
json.dump(res,open("/Users/bera/Documents/GitHub/bainsahack/research/reddit/wishlist_threads.json","w"))
