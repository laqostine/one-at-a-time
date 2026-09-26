import json,sys
sys.argv=['x']
exec(open('wishlist_threads.py').read().split('with ThreadPoolExecutor')[0])
res=json.load(open('wishlist_threads.json'))
fail=[r for r in res if not r['items']]
with ThreadPoolExecutor(2) as ex: new=list(ex.map(lambda r: run(r['url'].split('/r/')[1]), fail))
m={r['url']:r for r in new}
res=[m.get(r['url'],r) for r in res]
json.dump(res,open('/Users/bera/Documents/GitHub/bainsahack/research/reddit/wishlist_threads.json','w'))
