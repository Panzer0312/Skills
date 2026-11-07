"""Cut game sprites from the supplied sheets.

Usage: python3 -I scripts/cut-sprites.py sprites skills/guitar/assets
"""
import sys
from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
MARKER = (255, 0, 255, 255)


def cut(sheet, name, box, tol=38, holes=()):
    im = Image.open(f"{src}/{sheet}").convert("RGBA").crop(box)
    w, h = im.size
    for p in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        if im.getpixel(p) != MARKER:
            ImageDraw.floodfill(im, p, MARKER, thresh=tol)
    for p in holes:
        if im.getpixel(p) != MARKER:
            ImageDraw.floodfill(im, p, MARKER, thresh=tol)
    px = im.load()
    for y in range(h):
        for x in range(w):
            if px[x, y] == MARKER:
                px[x, y] = (0, 0, 0, 0)
    bb = im.getbbox()
    im = im.crop(bb) if bb else im
    im.save(f"{out}/{name}.png")


# Seed points (relative to the box) inside ring holes, so the hole is transparent too.
RING_HOLES = {"ring-gem": ((38, 74),), "ring-fire": ((35, 74),), "ring-pink": ((37, 68),)}

ITEMS = "items_spritesheet.png"
ITEMS2 = "items2_spritesheet.webp"
FOREST = "forest_spritesheet.png"

# The boots cell of the items sheet is skipped: the watermark overlaps it.
for n, b in dict(
    sword=(62, 78, 244, 272), potion=(302, 78, 486, 272), key=(538, 78, 722, 272), ruby=(778, 78, 962, 272),
    shield=(62, 415, 244, 610), bow=(302, 415, 486, 610), scroll=(538, 415, 722, 610), gold=(778, 415, 962, 610),
    helm=(62, 762, 244, 958), mana=(302, 762, 486, 958), ring=(538, 762, 722, 958),
).items():
    cut(ITEMS, n, b)

for n, b in dict(
    chest=(425, 140, 525, 235), parchment=(910, 585, 1024, 695), firebag=(790, 470, 885, 572),
    torch=(555, 578, 630, 695), goldbag=(5, 800, 95, 908), emblem=(555, 470, 642, 570),
    # Gear for stage 5. Cells near the crayon watermark (bottom right) are not used.
    **{"shield-wood": (318, 466, 415, 574), "shield-blue": (428, 466, 525, 574), "sword-ice": (426, 348, 524, 458),
       "dagger": (655, 348, 710, 436), "dagger-gold": (543, 708, 594, 806), "staff-red": (893, 350, 952, 458),
       "ring-gem": (436, 244, 510, 346), "ring-fire": (572, 244, 642, 346), "ring-pink": (800, 352, 872, 454),
       "chest-blue": (320, 366, 412, 458)},
).items():
    cut(ITEMS2, n, b, holes=RING_HOLES.get(n, ()))

for n, b in dict(
    oak=(5, 5, 178, 195), birch=(520, 5, 612, 195), pine=(715, 5, 812, 195), pine2=(918, 5, 1018, 195),
    mushroom=(318, 835, 398, 908), log=(515, 835, 612, 912), stump=(725, 835, 812, 912),
).items():
    cut(FOREST, n, b, 30)

# Crop removes the watermark.
Image.open(f"{src}/village.webp").convert("RGB").crop((0, 0, 1130, 760)).save(f"{out}/village.png")
