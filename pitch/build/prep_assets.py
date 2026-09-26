# Converts the black-background icons to transparent PNGs (alpha from brightness)
# and copies screenshots into pitch/build/assets for the pptx build.
import os, shutil
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(os.path.dirname(__file__), 'assets')
os.makedirs(OUT, exist_ok=True)
for n in ['mug','lamp','bell','note','popper','phone','table','hand','card','placemat','plate','chair','eraser']:
    im = Image.open(os.path.join(ROOT, 'client/public/icons', n + '.png')).convert('RGB')
    px = im.load(); w, h = im.size
    out = Image.new('RGBA', im.size)
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            m = max(r, g, b)
            a = max(0, min(255, int((m - 6) * 255 / 34)))  # 6..40 ramps to opaque
            op[x, y] = (r, g, b, a)
    out.save(os.path.join(OUT, n + '.png'))
for src in ['research/table-app.png', 'research/qa-live-desktop.png', 'research/design-app.png']:
    shutil.copy(os.path.join(ROOT, src), OUT)
print('ok')
