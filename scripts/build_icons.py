"""App icon from Golob: Android launcher icons (legacy, round and adaptive foreground) and the web icons.
Source: public/golob.png (the side-view pigeon on a transparent background). Background: the app's green.

Usage: python scripts/build_icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

BG = (47, 85, 68, 255)  # #2F5544, the widget's green
SRC = Image.open('public/golob.png').convert('RGBA')
RES = Path('android/app/src/main/res')
DENSITY = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}


def pigeon(h: int) -> Image.Image:
    w = round(SRC.width * h / SRC.height)
    return SRC.resize((w, h), Image.LANCZOS)


def compose(size: int, scale: float, bg: bool, mask: str | None) -> Image.Image:
    """The pigeon `scale` of the canvas height, centred; optional background with a rounded-square or circle mask."""
    im = Image.new('RGBA', (size, size), BG if bg else (0, 0, 0, 0))
    p = pigeon(round(size * scale))
    im.alpha_composite(p, ((size - p.width) // 2, round(size * (1 - scale) / 2)))
    if mask:
        m = Image.new('L', (size, size), 0)
        d = ImageDraw.Draw(m)
        if mask == 'round':
            d.ellipse((0, 0, size - 1, size - 1), fill=255)
        else:
            d.rounded_rectangle((0, 0, size - 1, size - 1), radius=round(size * 0.22), fill=255)
        im.putalpha(m)
    return im


for name, k in DENSITY.items():
    folder = RES / f'mipmap-{name}'
    folder.mkdir(exist_ok=True)
    legacy = round(48 * k)
    compose(legacy, 0.8, True, 'square').save(folder / 'ic_launcher.png', optimize=True)
    compose(legacy, 0.8, True, 'round').save(folder / 'ic_launcher_round.png', optimize=True)
    # adaptive foreground: 108 dp canvas, the safe zone is the central 66 dp, so the pigeon takes ~54 %
    compose(round(108 * k), 0.54, False, None).save(folder / 'ic_launcher_foreground.png', optimize=True)

Path('public').mkdir(exist_ok=True)
compose(512, 0.8, True, 'square').save('public/icon-512.png', optimize=True)
compose(192, 0.8, True, 'square').save('public/icon-192.png', optimize=True)
compose(180, 0.8, True, None).save('public/apple-touch-icon.png', optimize=True)
compose(64, 0.8, True, 'square').save('public/favicon.png', optimize=True)
print('ok')
