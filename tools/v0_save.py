import json, sys, os
d = json.load(sys.stdin); out = sys.argv[1]
if 'error' in d: print('ERROR', d['error']); sys.exit(1)
cid = d.get('id'); lv = d.get('latestVersion') or {}
print('id:', cid); print('web:', d.get('webUrl')); print('demo:', (lv.get('demoUrl') or d.get('demo') or '')); print('screenshot:', lv.get('screenshotUrl'))
files = lv.get('files') or d.get('files') or []
dd = os.path.join(out, cid or 'unknown'); os.makedirs(dd, exist_ok=True)
for f in files:
    name = f.get('name') or 'file.txt'
    p = os.path.join(dd, name.replace('/', '__')); open(p, 'w').write(f.get('content') or '')
    print('saved', p)
if not files: print('no files; keys:', list(d.keys()))
