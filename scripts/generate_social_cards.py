"""Generate static social preview cards for every PDT page.

Usage: python scripts/generate_social_cards.py
Requires Pillow. The checked-in PNGs are build inputs; viewers need no dependency.
"""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

BASE = Path(__file__).resolve().parents[1] / "source" / "social"
BASE.mkdir(parents=True, exist_ok=True)
S = 2
W, H = 1200, 630
NAVY = (18, 33, 53)
INK = (28, 45, 66)
GOLD = (250, 202, 145)
PAPER = (243, 238, 224)
MUTED = (182, 199, 213)
SUN = (247, 171, 112)
FONTS = Path("C:/Windows/Fonts")
FONT_REG = FONTS / "georgia.ttf"
FONT_ITAL = FONTS / "georgiai.ttf"
FONT_BOLD = FONTS / "segoeuib.ttf"
FONT_SANS = FONTS / "segoeui.ttf"

def sz(n): return round(n * S)
def pt(x, y): return (sz(x), sz(y))
def color(c, a=255): return (*c, a)
def ft(path, size): return ImageFont.truetype(str(path), sz(size))
def ell(d, bounds, fill=None, outline=None, width=1):
    d.ellipse(tuple(sz(n) for n in bounds), fill=fill, outline=outline, width=sz(width))
def line(d, xy, fill, width=1, joint="curve"):
    d.line([pt(x, y) for x, y in xy], fill=fill, width=sz(width), joint=joint)
def text(d, x, y, s, font, fill, tracking=0):
    if tracking:
        xx = x
        for ch in s:
            d.text(pt(xx, y), ch, font=font, fill=fill, stroke_width=0)
            xx += d.textlength(ch, font=font) / S + tracking
    else:
        d.text(pt(x, y), s, font=font, fill=fill)

def background():
    im = Image.new("RGBA", (sz(W), sz(H)))
    d = ImageDraw.Draw(im)
    for y in range(sz(H)):
        r = y / sz(H)
        c = tuple(int(NAVY[k] * (1-r) + INK[k]*r) for k in range(3))
        d.line((0, y, sz(W), y), fill=(*c, 255))
    # Warm haze, with very restrained contrast to keep the headline readable.
    haze = Image.new("RGBA", im.size)
    h = ImageDraw.Draw(haze)
    ell(h, (690, 170, 1260, 700), color((224, 128, 94), 36))
    im = Image.alpha_composite(im, haze.filter(ImageFilter.GaussianBlur(sz(120))))
    d = ImageDraw.Draw(im)
    rng = random.Random(600)
    for _ in range(105):
        x = rng.randrange(530, 1200)
        y = rng.randrange(60, 445)
        r = rng.choice([0.5, 0.65, 1.0, 1.2])
        ell(d, (x-r, y-r, x+r, y+r), color(PAPER, rng.choice([50, 70, 100, 135])))
    return im

def sunlight(im, cx=952, cy=374, radius=119, horizon=484):
    aura = Image.new("RGBA", im.size)
    d = ImageDraw.Draw(aura)
    ell(d, (cx-185, cy-185, cx+185, cy+185), color(SUN, 170))
    im.alpha_composite(aura.filter(ImageFilter.GaussianBlur(sz(100))))
    aura = Image.new("RGBA", im.size)
    d = ImageDraw.Draw(aura)
    ell(d, (cx-radius-12, cy-radius-12, cx+radius+12, cy+radius+12), color(SUN, 170))
    im.alpha_composite(aura.filter(ImageFilter.GaussianBlur(sz(24))))
    d = ImageDraw.Draw(im)
    ell(d, (cx-radius, cy-radius, cx+radius, cy+radius), color((251, 190, 129)))
    # Bands of dusk, in front of the sun.
    for j, a in enumerate([95, 112, 132, 157, 188]):
        y = horizon + j * 27
        d.rectangle((0, sz(y), sz(W), sz(y+26)), fill=color((31+j*2, 47+j*2, 67+j*2), a))
    line(d, [(660,horizon),(1165,horizon)], color((255,204,152),175), 1.7)
    return im

def shape(im, kind):
    d = ImageDraw.Draw(im)
    center = (950, 342)
    # Astronomical circles: same motif across the set.
    for rad, alpha in [(154,40), (205,24), (258,14)]:
        ell(d,(center[0]-rad,center[1]-rad,center[0]+rad,center[1]+rad),
            outline=color(GOLD,alpha),width=1)
    if kind == "home":
        im = sunlight(im)
        d = ImageDraw.Draw(im)
        text(d, 922, 499, "06:00", ft(FONT_REG,36), color(GOLD))
    elif kind == "math":
        # Swept celestial hour angle with a subtle meridian.
        line(d, [(950,123),(950,535)],color(PAPER,85),1.4)
        line(d, [(736,370),(1152,370)],color(PAPER,85),1.4)
        ell(d,(840,233,1060,453),outline=color(GOLD,155),width=2)
        for a in range(-125,130,25):
            t=math.radians(a)
            p=(950+110*math.sin(t),343-110*math.cos(t))
            line(d, [(950,343),p],color(SUN, 70),1)
        ell(d,(1037,249,1067,279),fill=color(SUN))
        text(d, 824, 483, "φ   ·   λ   ·   δ", ft(FONT_REG,30),color(GOLD))
    elif kind == "eot":
        pts=[]
        for j in range(401):
            phase=j/400*2*math.pi
            x=955+105*math.sin(phase)
            y=340-146*math.sin(2*phase)*.75
            pts.append((x,y))
        for width,alpha in [(16,15),(7,65),(3,235)]:
            line(d,pts,color(GOLD,alpha),width)
        ell(d,(939,324,971,356),fill=color((255,205,152),240))
        text(d, 864, 518, "± 16 MIN",ft(FONT_BOLD,20),color(GOLD),tracking=2)
    elif kind == "jumps":
        baseline=353
        line(d,[(735,baseline),(1160,baseline)],color(PAPER,115),1.2)
        pts=[]
        for j in range(430):
            x=735+j
            phase=j/429*2*math.pi
            y=baseline-102*math.sin(phase)-22*math.sin(2*phase+1)
            pts.append((x,y))
        for width,alpha in [(14,15),(6,70),(3,230)]:
            line(d,pts,color(GOLD,alpha),width)
        for k in range(7):
            x=770+k*57
            phase=(x-735)/429*2*math.pi
            y=baseline-102*math.sin(phase)-22*math.sin(2*phase+1)
            ell(d,(x-4,y-4,x+4,y+4),fill=color(SUN))
        text(d, 832, 510, "365 DAWNS", ft(FONT_BOLD,20), color(GOLD),tracking=2)
    else: # converter
        ell(d,(829,221,1067,459),outline=color(GOLD,180),width=2)
        for dx in [-68,-35,0,35,68]:
            rad=math.sqrt(max(0,119*119-dx*dx))
            line(d,[(948+dx,340-rad),(948+dx,340+rad)],color(GOLD,60),1)
        for offset in [-75,-38,0,38,75]:
            rad=math.sqrt(max(0,119*119-offset*offset))
            line(d,[(948-rad,340+offset),(948+rad,340+offset)],color(GOLD,60),1)
        ell(d,(872,292,892,312),fill=color(SUN))
        ell(d,(998,373,1018,393),fill=color((147,205,226)))
        line(d,[(881,302),(1008,383)],color(PAPER,185),2)
        text(d, 825, 514, "TWO SUNRISES",ft(FONT_BOLD,19),color(GOLD),tracking=1.6)
    return im

CARDS = {
    "home": ("Every dawn,", "six o’clock.", ("A clock that starts at 06:00", "whenever the Sun rises."), "home"),
    "how-it-works": ("Time, from", "first light.", ("A new definition of local time,", "written in the geometry of sunrise."), "math"),
    "equation-of-time": ("The Sun is a", "bad clock.", ("Why solar noon wanders", "through the year."), "eot"),
    "adjustments": ("One little jump", "every dawn.", ("365 mornings. One beautifully", "uneven rhythm."), "jumps"),
    "converter": ("Same moment.", "Different dawns.", ("Compare the clocks of any", "two places on Earth."), "converter"),
}

def draw_card(key, heading, accent, subtitle, motif):
    im=shape(background(),motif)
    d=ImageDraw.Draw(im)
    # Brand lockup and top rule.
    ell(d,(76,53,102,79),outline=color(GOLD),width=2)
    line(d,[(89,46),(89,86)],color(GOLD,200),1)
    line(d,[(68,66),(110,66)],color(GOLD,200),1)
    text(d,124,49,"PERFECT DAWN TIME",ft(FONT_BOLD,19),color(PAPER),tracking=3)
    line(d,[(76,112),(1123,112)],color(PAPER,45),1)
    text(d,76,171,heading,ft(FONT_REG,76),color(PAPER))
    accent_size=76 if len(accent)<17 else 66
    text(d,76,269,accent,ft(FONT_ITAL,accent_size),color(GOLD))
    for i,t in enumerate(subtitle):
        text(d,80,383+i*35,t,ft(FONT_SANS,23),color(MUTED))
    # Anchored footer bar, independent of all image decorations.
    d.rectangle((0,sz(565),sz(W),sz(H)),fill=color((13,26,44),238))
    line(d,[(76,565),(1123,565)],color(PAPER,55),1)
    text(d,77,581,"AN IDEA BY EMLYN O’REGAN",ft(FONT_BOLD,14),color(MUTED),tracking=1.2)
    text(d,790,581,"FOR WAYNE RADINSKY",ft(FONT_BOLD,14),color(GOLD),tracking=1)
    rgb=im.convert("RGB").resize((W,H),Image.Resampling.LANCZOS)
    target=BASE/f"{key}.png"
    rgb.save(target,optimize=True,compress_level=9)
    print(f"{target.relative_to(BASE.parent)}: {W}x{H}, {target.stat().st_size:,} bytes")

if __name__ == "__main__":
    for key, (heading,accent,subtitle,motif) in CARDS.items():
        draw_card(key,heading,accent,subtitle,motif)


def draw_app_icons():
    """Raster fallbacks for crawlers, browser tabs, and iOS home screens."""
    dim=512
    im=Image.new("RGB",(dim,dim),(20,34,55))
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((0,0,dim-1,dim-1),radius=114,fill=(20,34,55))
    for width in (12,):
        for x0,y0,x1,y1 in [(256,67,256,132),(83,255,145,255),(367,255,429,255),
                            (122,120,165,163),(390,120,347,163)]:
            d.line((x0,y0,x1,y1),fill=(255,210,152),width=width)
    d.ellipse((125,164,387,426),fill=(248,180,123))
    d.rectangle((0,285,dim,dim),fill=(20,34,55))
    d.line((85,285,427,285),fill=(255,210,152),width=11)
    d.line((165,351,347,351),fill=(232,152,102),width=5)
    d.line((203,394,309,394),fill=(232,152,102),width=5)
    for width,filename in [(512,"icon-512.png"),(180,"apple-touch-icon.png"),(32,"favicon-32.png")]:
        target=BASE.parent/filename
        im.resize((width,width),Image.Resampling.LANCZOS).save(target,optimize=True)
        print(f"{target.name}: {width}x{width}, {target.stat().st_size:,} bytes")

if __name__ == "__main__":
    draw_app_icons()


def draw_svg_icon():
    """A vector favicon for browsers that support SVG; write as UTF-8 text."""
    svg = """<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <title>Perfect Dawn Time — sunrise</title>
  <rect width="64" height="64" rx="15" fill="#142237"/>
  <g stroke="#ffd28a" stroke-width="2.5" stroke-linecap="round" opacity=".92">
    <path d="M32 8v7M11 31h6M47 31h6M16 16l5 5M48 16l-5 5"/>
  </g>
  <circle cx="32" cy="36" r="17" fill="#efb27b"/>
  <path fill="#142237" d="M0 36h64v28H0z"/>
  <path d="M10 36h44" stroke="#ffd28a" stroke-width="2" stroke-linecap="round"/>
  <path d="M18 43h28M23 49h18" stroke="#f8b77b" stroke-width="1.7" stroke-linecap="round" opacity=".45"/>
</svg>
"""
    path = BASE.parent / "icon.svg"
    path.write_text(svg, encoding="utf-8")
    print(f"{path.name}: {path.stat().st_size:,} bytes SVG")

if __name__ == "__main__":
    draw_svg_icon()
