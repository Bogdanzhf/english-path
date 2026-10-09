"""Иконки приложения (PNG) для iPhone/Android из той же эмблемы, что favicon.svg."""

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "frontend" / "public" / "icons"


def icon(size: int, radius_ratio: float = 0.0) -> Image.Image:
    s = size * 4  # рисуем крупно и уменьшаем — сглаженные края
    img = Image.new("RGB", (s, s))
    a, b = (59, 108, 240), (15, 156, 153)
    px = img.load()
    for y in range(s):
        for x in range(s):
            t = (x + y) / (2 * s)
            px[x, y] = tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
    d = ImageDraw.Draw(img)
    k = s / 64
    w = int(5.5 * k)
    pts = [(14 + (53 - 14) * t, 49 - 39 * (t ** 0.8)) for t in [i / 30 for i in range(31)]]
    d.line([(x * k, y * k) for x, y in pts], fill="white", width=w, joint="curve")
    d.line([(41 * k, 10 * k), (53 * k, 10 * k), (53 * k, 22 * k)], fill="white", width=w, joint="curve")
    r = 4.5 * k
    d.ellipse([14 * k - r, 49 * k - r, 14 * k + r, 49 * k + r], fill="white")
    img = img.resize((size, size), Image.LANCZOS)
    if radius_ratio:
        mask = Image.new("L", (size * 4, size * 4), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, size * 4, size * 4], radius=int(size * 4 * radius_ratio), fill=255)
        rgba = img.convert("RGBA")
        rgba.putalpha(mask.resize((size, size), Image.LANCZOS))
        return rgba
    return img


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    icon(180).save(OUT / "apple-touch-icon.png")
    icon(192, 0.22).save(OUT / "icon-192.png")
    icon(512, 0.22).save(OUT / "icon-512.png")
    print("ok")
