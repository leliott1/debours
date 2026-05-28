#!/usr/bin/env python3
"""Génère les icônes PNG (gradient + €) sans dépendance externe."""
import struct, zlib, math

INDIGO = (79, 70, 229)
VIOLET = (124, 58, 237)
WHITE = (255, 255, 255)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def in_euro(x, y, S):
    """Retourne True si le pixel (x,y) appartient au symbole €."""
    cx, cy = S * 0.555, S * 0.5
    ro, ri = S * 0.255, S * 0.165
    dx, dy = x - cx, y - cy
    d = math.hypot(dx, dy)
    # Anneau (C) ouvert vers la droite
    if ri <= d <= ro:
        ang = math.degrees(math.atan2(dy, dx))
        if not (-48 <= ang <= 48):  # ouverture du C à droite
            return True
    # Deux barres horizontales à gauche
    bar_h = S * 0.045
    x0, x1 = S * 0.30, S * 0.60
    for by in (cy - S * 0.075, cy + S * 0.075):
        if x0 <= x <= x1 and abs(y - by) <= bar_h / 2:
            return True
    return False


def make_png(S, path):
    radius = S * 0.22  # coins arrondis
    raw = bytearray()
    for y in range(S):
        raw.append(0)  # filtre 0
        t = y / (S - 1)
        bg = lerp(INDIGO, VIOLET, t)
        for x in range(S):
            # coins arrondis : transparence en dehors du rectangle arrondi
            inside = True
            for (cx, cy) in ((radius, radius), (S - radius, radius),
                             (radius, S - radius), (S - radius, S - radius)):
                if ((x < radius and y < radius) or (x > S - radius and y < radius) or
                        (x < radius and y > S - radius) or (x > S - radius and y > S - radius)):
                    pass
            # calcul propre du coin
            inside = True
            rx = min(x, S - 1 - x)
            ry = min(y, S - 1 - y)
            if rx < radius and ry < radius:
                if math.hypot(radius - rx, radius - ry) > radius:
                    inside = False
            if not inside:
                raw += bytes((0, 0, 0, 0))
            elif in_euro(x, y, S):
                raw += bytes(WHITE + (255,))
            else:
                raw += bytes(bg + (255,))

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", S, S, 8, 6, 0, 0, 0)  # RGBA 8 bits
    idat = zlib.compress(bytes(raw), 9)
    with open(path, "wb") as f:
        f.write(sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b""))
    print("écrit", path)


if __name__ == "__main__":
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    make_png(512, os.path.join(here, "icon-512.png"))
    make_png(192, os.path.join(here, "icon-192.png"))
    make_png(180, os.path.join(here, "icon-180.png"))
