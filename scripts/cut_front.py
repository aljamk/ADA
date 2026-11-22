"""The frontal pigeon with both wings open (Figma node 102:97) -> three layers on one 620x746 canvas:
public/golob2-telo.png (body), golob2-telo-oci.png (body with empty eyes), golob2-krilo-l.png, golob2-krilo-d.png.

Source: the raw image exported from Figma, cropped to the bird (scratchpad/ptic/raw1.png, bbox 626,48,1246,794).
The white background becomes transparent (flood from the borders), the red pupils become black.
The wings sit BEHIND the body. Each wing layer reaches 12 px into the body along the join and the body is cut
at the outline, so a wing can turn up to 4 degrees around the middle of the join (the ends drift ~12 px)
without a gap and without anything of the body poking out.

Usage: python scripts/cut_front.py SOURCE.png
"""
import sys
from collections import deque
from PIL import Image, ImageDraw

src = sys.argv[1] if len(sys.argv) > 1 else 'raw1.png'
im = Image.open(src).convert('RGBA').crop((626, 48, 1246, 794))
W, H = im.size
px = im.load()

# white background -> transparent, flood from the borders (keeps the white of the eyes)
seen = [[False] * H for _ in range(W)]
q = deque()
for x in range(W):
    q.append((x, 0)); q.append((x, H - 1))
for y in range(H):
    q.append((0, y)); q.append((W - 1, y))
while q:
    x, y = q.popleft()
    if x < 0 or y < 0 or x >= W or y >= H or seen[x][y]:
        continue
    seen[x][y] = True
    r, g, b, a = px[x, y]
    if a == 0 or (r > 228 and g > 228 and b > 228):
        px[x, y] = (r, g, b, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
# red pupils -> black
for y in range(H):
    for x in range(W):
        r, g, b, a = px[x, y]
        if a and r > 170 and g < 100 and b < 100:
            px[x, y] = (24, 24, 24, a)

mirror = lambda poly: [(W - x, y) for x, y in poly]
OUTER_L = [(60, 55), (40, 120), (0, 330), (0, 440), (40, 560), (90, 600), (170, 622)]
# inner edges along the body's left outline: the cut (8 px inside) and the wing's reach (30 px inside)
EDGE_L = [(250, 622), (216, 560), (204, 500), (199, 450), (201, 400), (213, 300), (242, 245)]
REACH_L = [(x + 12, y) for x, y in EDGE_L]
CUT_L = [EDGE_L[-1]] + OUTER_L + EDGE_L[:-1]
WING_L = [REACH_L[-1]] + OUTER_L + REACH_L[:-1]
CUT_R, WING_R = mirror(CUT_L), mirror(WING_L)

def masked(poly):
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    out.paste(im, (0, 0), m)
    return out

wing_l = masked(WING_L)
wing_r = masked(WING_R)
body = im.copy()
d = ImageDraw.Draw(body)
d.polygon(CUT_L, fill=(0, 0, 0, 0))
d.polygon(CUT_R, fill=(0, 0, 0, 0))

im.save('public/golob-spredaj.png', optimize=True)
body.save('public/golob2-telo.png', optimize=True)
# the body with empty eyes: the pupils (centres 279,96 and 340,97) are painted white, so the app can draw
# moving pupils over it (rolling eyes)
oci = body.copy()
ImageDraw.Draw(oci).ellipse((279 - 27, 96 - 27, 279 + 27, 96 + 27), fill=(255, 255, 255, 255))
ImageDraw.Draw(oci).ellipse((340 - 27, 97 - 27, 340 + 27, 97 + 27), fill=(255, 255, 255, 255))
oci.save('public/golob2-telo-oci.png', optimize=True)
wing_l.save('public/golob2-krilo-l.png', optimize=True)
wing_r.save('public/golob2-krilo-d.png', optimize=True)
# preview: wings turned a little, to check that nothing tears
prev = Image.new('RGBA', (W, H), (255, 255, 255, 255))
ANG = float(sys.argv[3]) if len(sys.argv) > 3 else 4
prev = Image.alpha_composite(prev, wing_l.rotate(ANG, center=(225, 430), resample=Image.BICUBIC))
prev = Image.alpha_composite(prev, wing_r.rotate(-ANG, center=(395, 430), resample=Image.BICUBIC))
prev = Image.alpha_composite(prev, body)
prev.save(sys.argv[2] if len(sys.argv) > 2 else 'front_preview.png')
print('ok', W, H)
