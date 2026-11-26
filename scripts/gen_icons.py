"""拡張機能のアイコン PNG を生成する（標準ライブラリのみ）。

座標は 128x128 の設計グリッドで定義し、各サイズへ直接スーパーサンプリングで描画する。
小さいサイズでは線を太くし、背景を全面に広げて潰れにくくしている。

    python3 scripts/gen_icons.py                      # icons/ に各サイズを出力
    python3 scripts/gen_icons.py --glyph 160 out.png  # 背景なしの白い図柄だけを出力
"""

import math
import struct
import sys
import zlib
from pathlib import Path

SIZES = [16, 32, 48, 128]
GRAD_FROM = (0x8B, 0x5C, 0xF6)
GRAD_TO = (0x4F, 0x46, 0xE5)
WHITE = (255, 255, 255)


def params(size):
    if size <= 16:
        # 16px は 1px = 8 単位。リングを外へ広げて内側にピンの余白を確保し、矢じりを大きくする
        return {
            "bg": (0, 128, 30),
            "ring_r": 44,
            "ring_w": 12,
            "arc_from": -40,
            "arc_to": 230,
            "head_half": 22,
            "head_len": 24,
            "pin_scale": 1.35,
            "needle": False,
        }
    small = size <= 32
    return {
        "bg": (0, 128, 30) if small else (8, 120, 28),
        "ring_r": 36 if small else 33,
        "ring_w": 13 if small else 9,
        "arc_from": -45,
        "arc_to": 235,
        "head_half": 18 if small else 14,
        "head_len": 20 if small else 16,
        "pin_scale": 1.2 if small else 1.0,
        "needle": not small,
    }


def in_round_rect(x, y, x0, y0, x1, y1, r):
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def in_convex(x, y, pts):
    sign = 0
    for i in range(len(pts)):
        ax, ay = pts[i]
        bx, by = pts[(i + 1) % len(pts)]
        cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax)
        if cross != 0:
            s = 1 if cross > 0 else -1
            if sign == 0:
                sign = s
            elif s != sign:
                return False
    return True


def build_shapes(p):
    c = 64
    R, w = p["ring_r"], p["ring_w"]
    a0, a1 = p["arc_from"], p["arc_to"]

    # 矢じりは arc_from 側の端に置き、角度が減る向き（画面上で反時計回り）を指す
    t = math.radians(a0)
    px, py = c + R * math.cos(t), c + R * math.sin(t)
    dx, dy = math.sin(t), -math.cos(t)
    nx, ny = math.cos(t), math.sin(t)
    back = 3
    hh, hl = p["head_half"], p["head_len"]
    head = [
        (px + dx * hl, py + dy * hl),
        (px - dx * back + nx * hh, py - dy * back + ny * hh),
        (px - dx * back - nx * hh, py - dy * back - ny * hh),
    ]
    t1 = math.radians(a1)
    cap = (c + R * math.cos(t1), c + R * math.sin(t1))

    k = p["pin_scale"]

    def pin_pt(x, y):
        return (c + (x - 64) * k, c + (y - 64) * k)

    pin_head = (*pin_pt(54, 46), *pin_pt(74, 52), 3 * k)
    pin_body = [pin_pt(57.5, 51), pin_pt(70.5, 51), pin_pt(72, 64), pin_pt(56, 64)]
    pin_base = (*pin_pt(50, 62), *pin_pt(78, 68), 3 * k)
    pin_needle = (*pin_pt(62.5, 66), *pin_pt(65.5, 82), 1.5 * k)

    def white(x, y):
        r = math.hypot(x - c, y - c)
        if abs(r - R) <= w / 2:
            ang = math.degrees(math.atan2(y - c, x - c))
            while ang < a0:
                ang += 360
            while ang >= a0 + 360:
                ang -= 360
            if ang <= a1:
                return True
        if (x - cap[0]) ** 2 + (y - cap[1]) ** 2 <= (w / 2) ** 2:
            return True
        if in_convex(x, y, head):
            return True
        if in_round_rect(x, y, *pin_head) or in_round_rect(x, y, *pin_base):
            return True
        if in_convex(x, y, pin_body):
            return True
        if p["needle"] and in_round_rect(x, y, *pin_needle):
            return True
        return False

    return white


def render_glyph(size):
    """背景なしで白い図柄だけを描く（プロモーション画像用）。"""
    white = build_shapes(params(128))
    ss = 4
    scale = 128 / size
    rows = []
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            cov = sum(
                white((px + (sx + 0.5) / ss) * scale, (py + (sy + 0.5) / ss) * scale)
                for sy in range(ss)
                for sx in range(ss)
            )
            row += bytes((255, 255, 255, round(255 * cov / (ss * ss))))
        rows.append(bytes(row))
    return b"".join(rows)


def render(size):
    p = params(size)
    white = build_shapes(p)
    b0, b1, br = p["bg"]
    ss = 8 if size <= 48 else 4
    scale = 128 / size
    rows = []
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            acc = [0.0, 0.0, 0.0]
            cov = 0
            for sy in range(ss):
                for sx in range(ss):
                    x = (px + (sx + 0.5) / ss) * scale
                    y = (py + (sy + 0.5) / ss) * scale
                    if not in_round_rect(x, y, b0, b0, b1, b1, br):
                        continue
                    cov += 1
                    if white(x, y):
                        col = WHITE
                    else:
                        g = min(max((x + y) / 256, 0), 1)
                        col = tuple(a + (b - a) * g for a, b in zip(GRAD_FROM, GRAD_TO))
                    for i in range(3):
                        acc[i] += col[i]
            if cov:
                row += bytes(round(v / cov) for v in acc)
                row.append(round(255 * cov / (ss * ss)))
            else:
                row += b"\x00\x00\x00\x00"
        rows.append(bytes(row))
    return b"".join(rows)


def write_png(path, size, raw):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def main():
    if len(sys.argv) == 4 and sys.argv[1] == "--glyph":
        size = int(sys.argv[2])
        write_png(Path(sys.argv[3]), size, render_glyph(size))
        return
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "icons"
    out.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        write_png(out / f"icon{size}.png", size, render(size))
        print(f"wrote {out / f'icon{size}.png'}")


if __name__ == "__main__":
    main()
