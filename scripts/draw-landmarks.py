"""Draws the four map landmarks (hills, peak, tower, library) as original pixel art.

Deterministic: no randomness. Each sprite is drawn on a 44x44 grid, given a dark
outline, then scaled 4x with nearest neighbour. Run from the repo root:
    python3 -I scripts/draw-landmarks.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "skills" / "guitar" / "assets"
N, SCALE = 44, 4
LINE = (28, 18, 12, 255)
G1, G2, G3, G4 = (24, 54, 35, 255), (35, 69, 42, 255), (58, 102, 56, 255), (92, 135, 70, 255)
S1, S2, S3, S4 = (66, 68, 78, 255), (98, 100, 108, 255), (138, 140, 146, 255), (176, 178, 182, 255)
W1, W2, W3 = (74, 46, 28, 255), (112, 74, 44, 255), (150, 104, 62, 255)
R1, R2, R3 = (120, 38, 34, 255), (165, 60, 46, 255), (200, 94, 62, 255)
SNOW, SNOW2 = (244, 246, 250, 255), (186, 200, 220, 255)
GOLD, DARK = (230, 190, 70, 255), (30, 24, 28, 255)


def canvas():
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def outline(img):
    px, out = img.load(), img.copy()
    op = out.load()
    for y in range(N):
        for x in range(N):
            if px[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < N and 0 <= ny < N and px[nx, ny][3]:
                    op[x, y] = LINE
                    break
    return out


def save(img, name):
    img = outline(img).resize((N * SCALE, N * SCALE), Image.NEAREST)
    img.save(OUT / f"{name}.png")


def mound(d, cx, base, rx, ry):
    """A grassy dome lit from the upper left."""
    for y in range(base - ry, base + 1):
        t = (y - (base - ry)) / ry
        half = int(rx * (1 - (1 - t) ** 2) ** 0.5 + 0.5)
        for x in range(cx - half, cx + half + 1):
            u = (x - cx) / max(rx, 1)
            shade = G3 if u + (1 - t) * 0.6 < -0.15 else G2 if u < 0.35 else G1
            if t < 0.25 and u < 0.2:
                shade = G4
            d.point((x, y), shade)


def hills():
    img, d = canvas()
    mound(d, 29, 38, 14, 16)
    mound(d, 13, 38, 13, 12)
    mound(d, 22, 40, 14, 11)
    for x, y in ((8, 30), (18, 33), (27, 24), (33, 32), (14, 36), (26, 37)):
        d.point((x, y), G4)
        d.point((x, y - 1), G4)
    save(img, "hills")


def peak():
    img, d = canvas()
    d.polygon([(2, 40), (14, 22), (22, 10), (30, 22), (42, 40)], fill=S2)
    d.polygon([(22, 10), (30, 22), (42, 40), (26, 40), (24, 26)], fill=S1)
    d.polygon([(22, 10), (16, 20), (12, 26), (20, 30), (24, 26)], fill=S3)
    d.polygon([(10, 40), (16, 30), (22, 36), (26, 40)], fill=S3)
    d.polygon([(22, 10), (17, 19), (20, 18), (22, 22), (25, 18), (28, 19)], fill=SNOW)
    d.polygon([(22, 10), (28, 19), (25, 18), (24, 14)], fill=SNOW2)
    d.polygon([(30, 40), (35, 32), (38, 36), (42, 40)], fill=S2)
    for x, y in ((6, 36), (36, 38), (13, 38)):
        d.point((x, y), G2)
    d.rectangle([2, 38, 42, 40], fill=G2)
    d.line([(4, 38), (12, 38)], fill=G3)
    save(img, "peak")


def tower():
    img, d = canvas()
    d.rectangle([13, 14, 31, 41], fill=S2)
    d.rectangle([13, 14, 18, 41], fill=S3)
    d.rectangle([26, 14, 31, 41], fill=S1)
    for y in range(18, 41, 5):
        d.line([(13, y), (31, y)], fill=S1)
        for x in range(15 + (y // 5 % 2) * 3, 31, 6):
            d.line([(x, y + 1), (x, y + 4)], fill=S1)
    d.rectangle([11, 10, 33, 14], fill=S3)
    d.rectangle([11, 10, 33, 11], fill=S4)
    for x in (11, 17, 23, 29):
        d.rectangle([x, 6, x + 3, 10], fill=S3)
        d.line([(x, 6), (x + 3, 6)], fill=S4)
    d.rectangle([20, 20, 23, 26], fill=DARK)
    d.rectangle([20, 20, 23, 21], fill=S1)
    d.rectangle([19, 33, 25, 41], fill=W2)
    d.rectangle([19, 33, 25, 34], fill=W1)
    d.line([(22, 33), (22, 41)], fill=W1)
    d.point((24, 38), GOLD)
    d.line([(22, 6), (22, 1)], fill=W1)
    d.polygon([(23, 1), (29, 3), (23, 5)], fill=R2)
    d.rectangle([9, 41, 35, 43], fill=G2)
    d.line([(9, 41), (35, 41)], fill=G3)
    save(img, "tower")


def library():
    img, d = canvas()
    d.polygon([(3, 18), (22, 5), (41, 18)], fill=R2)
    d.polygon([(22, 5), (41, 18), (22, 18)], fill=R1)
    d.polygon([(22, 5), (3, 18), (8, 18), (22, 8)], fill=R3)
    d.rectangle([3, 18, 41, 19], fill=S4)
    d.rectangle([6, 20, 38, 38], fill=S3)
    d.rectangle([6, 20, 10, 38], fill=S4)
    d.rectangle([34, 20, 38, 38], fill=S2)
    for x in (8, 15, 26, 33):
        d.rectangle([x, 20, x + 2, 38], fill=S4)
        d.line([(x + 2, 20), (x + 2, 38)], fill=S2)
    d.rectangle([18, 26, 25, 38], fill=W2)
    d.pieslice([18, 22, 25, 30], 180, 360, fill=W2)
    d.rectangle([18, 26, 25, 27], fill=W1)
    d.line([(21, 24), (21, 38)], fill=W1)
    d.point((24, 33), GOLD)
    d.rectangle([20, 11, 24, 15], fill=GOLD)
    d.line([(22, 11), (22, 15)], fill=W1)
    d.rectangle([4, 38, 40, 40], fill=S2)
    d.rectangle([2, 40, 42, 42], fill=S3)
    d.line([(2, 42), (42, 42)], fill=S1)
    save(img, "library")


for fn in (hills, peak, tower, library):
    fn()
