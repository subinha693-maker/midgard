#!/usr/bin/env python3
"""걸음 도트 생성기 — 문자 격자(ASCII) + 팔레트 → PNG.

사용법:  python3 tools/sprites/make_sprites.py
결과:    assets/sprites/<이름>.png  (144×192, 프레임 48×48, 3열×4행: 아래·왼쪽·오른쪽·위)
미리보기: tools/sprites/preview/<이름>_x4.png, compare_<이름>.png

문자 규칙 (parts.py)
  .        투명
  소문자   그 재질의 기본 톤      (h=머리, s=피부, c=코트 …)
  대문자   그림자 톤
  i j l u y  밝은 톤 (각각 h c n v t 재질)
  k        눈동자 테두리(눈 재질의 가장 어두운 톤)
  m        입 (피부의 가장 어두운 톤)
  G        안경테 / g 렌즈 반사

외곽선: 부위(레이어)마다 투명과 닿은 칸을 그 재질의 가장 어두운 톤으로 바꾼 뒤 겹친다.
         같은 레이어 안에서는 우선순위가 높은 재질(머리>옷>피부)이 낮은 재질과 닿는 칸에 선을 긋는다.
광원은 왼쪽 위: 그림자 톤은 각 부위의 오른쪽·아래쪽에 직접 찍는다.
"""
from __future__ import annotations

import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from palettes import PALETTES  # noqa: E402
import parts as P  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'sprites')
PREVIEW = os.path.join(ROOT, 'tools', 'sprites', 'preview')
FRAME = 48

LIGHT = {'i': 'h', 'j': 'c', 'l': 'n', 'u': 'v', 'y': 't'}
PRIORITY = {'h': 9, 'g': 9, 'c': 8, 'n': 7, 'v': 7, 'f': 6, 't': 5, 'b': 4, 'p': 4, 's': 1, 'e': 0, 'r': 0}
NO_OUTLINE = {'e', 'r', 'g', 'w', 'z'}
SHADOW_RGBA = (0, 0, 0, 80)  # 발밑 그림자
OUTLINE_DARKEN = 0.55
LIGHT_T, SHADE_T, DEEP_T = 0.22, 0.58, 0.86  # 입체 음영 경계값  # 외곽선을 검정 쪽으로 섞는 비율 (참고 시트처럼 거의 검은 선)
WHITE = '#ffffff'  # 눈 하이라이트 (모든 인물 공용)


def code_to(mat_code: str):
    """문자 → (재질, 톤 번호). 톤 0=외곽선 1=그림자 2=기본 3=밝음"""
    c = mat_code
    if c in LIGHT:
        return LIGHT[c], 3
    if c == 'k':
        return 'e', 0
    if c == 'm':
        return 's', 0
    if c == 'G':
        return 'g', 1
    if c == 'g':
        return 'g', 2
    if c == 'w':
        return 'w', 2
    if c == 'z':
        return 'z', 2
    if c.isupper():
        return c.lower(), 1
    return c, 2


def parse(grid: str, flip: bool = False) -> list[list[str]]:
    rows = [r for r in grid.split('\n')]
    w = max(len(r) for r in rows)
    rows = [r.ljust(w, '.') for r in rows]
    if flip:
        rows = [r[::-1] for r in rows]
    return [list(r) for r in rows]


def layer_cells(grid, ox, oy):
    """레이어 → {(x,y): (재질, 톤)}. 외곽선 → 자동 음영 순서로 처리"""
    cells = {}
    explicit = set()
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            if ch == '.':
                continue
            cells[(ox + x, oy + y)] = code_to(ch)
            if not ch.islower() or ch in LIGHT or ch in 'kmgw':
                explicit.add((ox + x, oy + y))
    out = {}
    # 1) 외곽선: 투명과 닿거나, 우선순위 낮은 재질과 닿는 칸
    for (x, y), (m, t) in cells.items():
        tone = t
        if m not in NO_OUTLINE:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = cells.get((x + dx, y + dy))
                if n is None:
                    tone = 0
                    break
                nm = n[0]
                if nm != m and nm not in NO_OUTLINE and PRIORITY.get(m, 0) > PRIORITY.get(nm, 0):
                    tone = 0
                    break
        out[(x, y)] = (m, tone)
    # 2) 입체 음영 (광원 왼쪽 위). 같은 재질 덩어리 안에서의 위치로 톤을 정한다.
    #    u = 가로 위치(0=왼쪽 끝), v = 세로 위치(0=위 끝) → s = 0.55u + 0.45v
    #    s 작음 → 밝은 톤, 큼 → 그림자 / 짙은 그림자(톤 4). 직접 지정한 톤은 그대로 둔다.
    def span(x, y, m, dx, dy):
        a = 0
        while (x - dx * (a + 1), y - dy * (a + 1)) in cells and cells[(x - dx * (a + 1), y - dy * (a + 1))][0] == m:
            a += 1
        b = 0
        while (x + dx * (b + 1), y + dy * (b + 1)) in cells and cells[(x + dx * (b + 1), y + dy * (b + 1))][0] == m:
            b += 1
        return a, b
    shaded = dict(out)
    for (x, y), (m, t) in out.items():
        if t != 2 or (x, y) in explicit or m in NO_OUTLINE:
            continue
        l, r = span(x, y, m, 1, 0)
        tp, bt = span(x, y, m, 0, 1)
        u = l / max(1, l + r)
        v = tp / max(1, tp + bt)
        sc = 0.55 * u + 0.45 * v
        above = out.get((x, y - 1))
        if m == 's' and above and above[0] in ('h', 'f'):
            sc = max(sc, 0.7)  # 앞머리 아래 그림자
        if sc < LIGHT_T:
            tone = 3
        elif sc < SHADE_T:
            tone = 2
        elif sc < DEEP_T:
            tone = 1
        else:
            tone = 4
        shaded[(x, y)] = (m, tone)
    return shaded

def mix(a, b, k):
    ra, ga, ba, _ = hex2rgb(a)
    rb, gb, bb, _ = hex2rgb(b)
    return '#%02x%02x%02x' % (int(ra + (rb - ra) * k), int(ga + (gb - ga) * k), int(ba + (bb - ba) * k))


def darken(h, k):
    r, g, b, _ = hex2rgb(h)
    return '#%02x%02x%02x' % (int(r * (1 - k)), int(g * (1 - k)), int(b * (1 - k)))


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def render_frame(spec, direction, step, pal):
    """한 프레임 렌더. step: 0=왼발(앞) 1=서기 2=오른발"""
    canvas = {}
    for layer in P.layers_for(spec, direction, step):
        grid = parse(layer['grid'], layer.get('flip', False))
        for k, v in layer_cells(grid, layer['x'], layer['y']).items():
            canvas[k] = v
    img = Image.new('RGBA', (FRAME, FRAME), (0, 0, 0, 0))
    used = set()
    shadow_ok = {k for k, v in canvas.items() if v[0] == 'z'}
    for (x, y), (m, t) in canvas.items():
        if not (0 <= x < FRAME and 0 <= y < FRAME):
            raise ValueError(f'{spec["name"]} {direction} 프레임 밖 픽셀 {(x, y)}')
        if m == 'z':
            if (x, y) not in shadow_ok:
                continue
            img.putpixel((x, y), SHADOW_RGBA)
            continue
        if m == 'w':
            col = WHITE
        else:
            ramp = pal[m]
            if t == 4:  # 짙은 그림자: 그림자와 외곽선의 중간
                col = mix(ramp[1], ramp[0], 0.45)
            elif t == 3 and len(ramp) < 4:
                col = ramp[2]  # 밝은 톤이 없는 재질
            else:
                col = ramp[min(t, len(ramp) - 1)]
            if t == 0:
                col = darken(col, OUTLINE_DARKEN)
        used.add(col)
        img.putpixel((x, y), hex2rgb(col))
    return img, used


def build(name: str):
    spec = P.SPECS[name]
    pal = PALETTES[spec['palette']]
    sheet = Image.new('RGBA', (FRAME * 3, FRAME * 4), (0, 0, 0, 0))
    colors = set()
    for row, d in enumerate(['down', 'left', 'right', 'up']):
        for col, step in enumerate([0, 1, 2]):
            img, used = render_frame(spec, d, step, pal)
            colors |= used
            sheet.paste(img, (col * FRAME, row * FRAME))
    os.makedirs(OUT, exist_ok=True)
    sheet.save(os.path.join(OUT, f'{name}.png'))
    return sheet, colors


def floor_tile(w, h):
    """미리보기용 임시 바닥 (석조 바닥 느낌의 체크)"""
    img = Image.new('RGBA', (w, h))
    a, b, line = (122, 116, 104, 255), (112, 106, 95, 255), (88, 83, 74, 255)
    for y in range(h):
        for x in range(w):
            tx, ty = x // 48, y // 48
            c = a if (tx + ty) % 2 == 0 else b
            if x % 48 == 0 or y % 48 == 0:
                c = line
            img.putpixel((x, y), c)
    return img


def preview(name, sheet):
    os.makedirs(PREVIEW, exist_ok=True)
    bg = floor_tile(sheet.width, sheet.height)
    bg.alpha_composite(sheet)
    big = bg.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST)
    big.save(os.path.join(PREVIEW, f'{name}_x4.png'))
    return big


def compare(name, big):
    """미리보기와 해당 CG를 나란히"""
    cg = P.SPECS[name].get('cg')
    if not cg:
        return
    src = Image.open(os.path.join(ROOT, cg)).convert('RGBA')  # 읽기만 한다
    h = big.height
    src = src.resize((int(src.width * h / src.height), h), Image.LANCZOS)
    out = Image.new('RGBA', (big.width + src.width + 16, h), (30, 30, 30, 255))
    out.paste(big, (0, 0))
    out.paste(src, (big.width + 16, 0))
    out.save(os.path.join(PREVIEW, f'compare_{name}.png'))


def main(names):
    for n in names:
        sheet, colors = build(n)
        big = preview(n, sheet)
        compare(n, big)
        print(f'{n}: {len(colors)}색 → assets/sprites/{n}.png')


if __name__ == '__main__':
    main(sys.argv[1:] or list(P.SPECS))
