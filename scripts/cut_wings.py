"""Cut public/golob.png into three layers on the same 900x1127 canvas: body, the raised wing and the folded front wing.
The body gets a body-coloured patch where a wing was, so nothing shows through when a wing moves."""
import os
from PIL import Image, ImageDraw
os.chdir(r'c:\ADA')
im = Image.open('public/golob.png').convert('RGBA')
W, H = im.size
BODY = (114, 137, 187, 255)  # the pigeon's main blue

RAISED = [(545, 395), (640, 290), (720, 200), (795, 92), (850, 92), (895, 330), (900, 560), (897, 790), (835, 890), (745, 918), (640, 914), (600, 860), (575, 700), (555, 550)]
FRONT = [(200, 555), (300, 560), (355, 615), (378, 720), (366, 830), (330, 925), (280, 985), (220, 985), (140, 900), (20, 900), (15, 850), (60, 845), (100, 760), (140, 650)]
# body patches under the wings (rounded continuations of the body outline)
PATCH_R = [(545, 395), (575, 470), (598, 560), (612, 660), (616, 760), (608, 850), (590, 920), (560, 965), (520, 965), (505, 800), (500, 600), (510, 450)]
PATCH_F = [(200, 555), (300, 560), (355, 615), (378, 720), (366, 830), (330, 925), (280, 985), (240, 985), (225, 900), (215, 750), (205, 640)]

def layer(poly):
    mask = Image.new('L', (W, H), 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out, mask

raised, m_r = layer(RAISED)
# the folded wing on the chest is the darker oval; it lifts a little for a shoulder shrug
FRONT_BOX = (188, 553, 380, 988)
m_f = Image.new('L', (W, H), 0)
ImageDraw.Draw(m_f).ellipse(FRONT_BOX, fill=255)
front = Image.new('RGBA', (W, H), (0, 0, 0, 0))
front.paste(im, (0, 0), m_f)
body = im.copy()
# remove the wings from the body, then paint the patches (only where the pigeon had pixels, to keep the silhouette)
alpha = body.split()[3]
d = ImageDraw.Draw(body)
d.polygon(RAISED, fill=(0, 0, 0, 0))
d.ellipse(FRONT_BOX, fill=(0, 0, 0, 0))
patch = Image.new('RGBA', (W, H), (0, 0, 0, 0))
pd = ImageDraw.Draw(patch)
pd.polygon(PATCH_R, fill=BODY)
pd.ellipse(FRONT_BOX, fill=BODY)
body = Image.alpha_composite(body, patch)
body.save('public/golob-telo.png', optimize=True)
raised.save('public/golob-krilo.png', optimize=True)
front.save('public/golob-krilce.png', optimize=True)
# a preview with the raised wing rotated, to check the cut
prev = body.copy()
rw = raised.rotate(-70, center=(560, 420), resample=Image.BICUBIC)
prev = Image.alpha_composite(prev, rw)
prev.save(r'C:\Users\Alja\AppData\Local\Temp\claude\a1080d1396e4a37e\2c8f9bdd-8ba9-45b1-beea-04ae119678bb\scratchpad\wings_preview.png')
for f in ('public/golob-telo.png', 'public/golob-krilo.png', 'public/golob-krilce.png'):
    print(f, os.path.getsize(f))
