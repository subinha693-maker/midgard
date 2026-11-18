#!/usr/bin/env python3
"""임시 NPC 걸음 도트 — 공통 몸 템플릿에 색만 바꾼 단순한 그래픽 (교체 대상: docs/asset_todo.md)

사용법: python3 tools/sprites/npcs.py  →  assets/placeholder/npc_*.png (144×192, 3열×4행: 아래·왼쪽·오른쪽·위)
종족 특징은 대본에 나온 것만 한두 픽셀로 암시: 로테(고양이 귀·하얀 머리띠), 머렌족(지느러미 귀).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import make_sprites as MS  # noqa: E402
import parts as P  # noqa: E402
from palettes import PALETTES, BLACK  # noqa: E402

ROOT = MS.ROOT
OUT = os.path.join(ROOT, 'assets', 'placeholder')


def strip_glasses(g, keep_fins=False):
    t = {'G': 's', 'g': 's', 'm': 'S'}
    if not keep_fins:
        t.update({'f': 's', 'F': 'S'})
    return P.sub(g, t)


SHORT = {d: strip_glasses(getattr(P, f'HANS_HEAD_{d.upper()}')) for d in ('down', 'up', 'left')}
FINNED = {d: strip_glasses(getattr(P, f'HANS_HEAD_{d.upper()}'), keep_fins=True) for d in ('down', 'up', 'left')}
BOB = {'down': P.KLOTHO_HEAD_DOWN, 'up': P.KLOTHO_HEAD_UP, 'left': P.KLOTHO_HEAD_LEFT}
LONG = {'down': P.ANAN_HEAD_DOWN, 'up': P.ANAN_HEAD_UP, 'left': P.ANAN_HEAD_LEFT}

# 로테: 고양이 귀 + 하얀 머리띠 (대본 6-5)
CAT_EARS = "....hh..............hh\n...hhhh............hhhh"
BAND = "n" * 22


def rotte_head(d):
    g = BOB[d]
    g = P.stamp(g, 5, 0, CAT_EARS) if d != 'left' else P.stamp(g, 9, 0, "....hh......hh\n...hhhh....hhhh")
    g = P.stamp(g, 5, 4, BAND) if d != 'left' else P.stamp(g, 6, 4, "n" * 18)
    return g


def body(kind, mat):
    """kind: sweater | coat | skirt"""
    if kind == 'coat':
        return {'down': P.KLOTHO_COAT_DOWN, 'up': P.KLOTHO_COAT_UP, 'left': P.KLOTHO_COAT_SIDE, 'arm': {'x': 'c', 'X': 'C'}}
    if kind == 'skirt':
        t = {'n': mat, 'N': mat.upper()}
        return {'down': P.sub(P.ANAN_TORSO_DOWN, t), 'up': P.sub(P.ANAN_TORSO_UP, t), 'left': P.sub(P.ANAN_TORSO_SIDE, t), 'arm': {'x': mat, 'X': mat.upper()}}
    t = {'x': mat, 'X': mat.upper()}
    return {'down': P.sub(P.SWEATER_DOWN, t), 'up': P.sub(P.SWEATER_UP, t), 'left': P.sub(P.SWEATER_SIDE, t), 'arm': t}


def pal(hair, skin, eye, cloth, pants, extra=None):
    p = {'h': hair, 's': skin, 'e': eye, 'v': cloth, 'n': cloth, 'c': cloth, 'b': BLACK, 'p': pants,
         't': ['#7f8890', '#c9d0d6', '#f1f4f6'], 'f': ['#1f4d4a', '#3f8a84', '#6cc0b6'], 'r': ['#c98c86', '#e7a9a0', '#e7a9a0']}
    p.update(extra or {})
    return p


SKIN = ['#6b4b42', '#e2c6b6', '#f5e4d9']
SKIN_DARK = ['#4a3028', '#b88a70', '#d6a98c']
EYE = ['#1d1f1b', '#3d3a34', '#5a554e']
BROWN_H = ['#2a1a10', '#5a3a22', '#7a5232', '#9a6e48']
BLACK_H = ['#0f1014', '#22242c', '#34363f', '#4a4d58']
BLOND_H = ['#6b5520', '#c9a640', '#e3c862', '#f4e29a']
GRAY_H = ['#2a2b30', '#6a6c76', '#9a9ca6', '#c8cad2']
RED_H = ['#3a1410', '#7a2a20', '#a8442e', '#c86a4e']
PANTS = ['#221e1a', '#3b352f', '#504840']
NAVY = ['#141826', '#2d364b', '#404c69', '#58648a']

# 이름 → (머리, 몸 종류, 몸 재질 문자, 팔레트)
NPCS = {
    'npc_baker': (SHORT, 'sweater', 'v', pal(BROWN_H, SKIN, EYE, ['#7a7060', '#d8d0c0', '#efe9dc', '#fbf8f0'], PANTS)),  # 빵집 주인(레프족)
    'npc_marked': (SHORT, 'sweater', 'v', pal(GRAY_H, SKIN, EYE, ['#2a2f2a', '#4e574c', '#68745f', '#82907a'], PANTS)),  # 초록 십자가 명찰 남자
    'npc_woman': (BOB, 'skirt', 'n', pal(RED_H, SKIN, EYE, ['#3a2030', '#7a4a62', '#9a6680', '#b8889e'], BLACK)),
    'npc_clerk': (SHORT, 'coat', 'c', pal(BLACK_H, SKIN, EYE, NAVY, BLACK)),  # 지방시청 제복
    'npc_receptionist': (BOB, 'coat', 'c', pal(BROWN_H, SKIN, EYE, NAVY, BLACK)),
    'npc_examiner': (SHORT, 'sweater', 'v', pal(RED_H, SKIN_DARK, EYE, ['#1c2a1c', '#3a5a3a', '#4e7a4e', '#6a9a6a'], PANTS)),  # 시험관(베르시족)
    'npc_doctor': (SHORT, 'sweater', 'v', pal(GRAY_H, SKIN, EYE, ['#7f8890', '#c9d0d6', '#eef1f3', '#ffffff'], PANTS)),  # 검사관
    'npc_sailor': (FINNED, 'sweater', 'v', pal(BLACK_H, SKIN, EYE, ['#14264a', '#2a4a8a', '#3d64b0', '#e9e9e4'], ['#1a1d24', '#e0e0dc', '#f2f2ee'])),  # 머렌족 선원
    'npc_believer': (LONG, 'skirt', 'n', pal(BROWN_H, SKIN, EYE, ['#5a4a2a', '#a8946a', '#c8b48a', '#e0d0aa'], ['#5a4a2a', '#a8946a', '#c8b48a'])),  # 경교 신자
    'npc_boy': (SHORT, 'sweater', 'v', pal(BROWN_H, SKIN, EYE, ['#5a2a14', '#a8542e', '#c8703e', '#e08c58'], PANTS)),  # 레프족 소년
    'npc_collector': (SHORT, 'sweater', 'v', pal(BLACK_H, SKIN, EYE, ['#0a0a0c', '#16171b', '#22242a', '#30333b'], BLACK)),  # 카르타고 수금원(시아족)
    'npc_merchant': (SHORT, 'sweater', 'v', pal(GRAY_H, SKIN_DARK, EYE, ['#5a3a14', '#9a6a2e', '#b8843e', '#d4a058'], PANTS)),
    'npc_vendor': (BOB, 'sweater', 'v', pal(BLACK_H, SKIN, EYE, ['#5a1a2a', '#9a2e46', '#b8445e', '#d4627a'], PANTS)),  # 캡슐 노점
    'npc_sia_woman': (LONG, 'skirt', 'n', pal(BLACK_H, SKIN, EYE, ['#1a1a24', '#34344a', '#4a4a66', '#606084'], BLACK)),
    'npc_unmarked': (SHORT, 'sweater', 'v', pal(GRAY_H, SKIN, ['#000000', '#0a0a0a', '#141414'], ['#2a2a2a', '#4a4a4a', '#606060', '#7a7a7a'], PANTS)),  # 눈 흰자가 검은 사람
    'npc_rotte': (None, 'sweater', 'v', pal(BLOND_H, SKIN, ['#2a3a1a', '#4e6a2e', '#6a8a3e'], ['#3a2a1a', '#6a4a2a', '#8a6440', '#a8845e'], PANTS,
                                         {'n': ['#9a9a96', '#e8e8e4', '#ffffff']})),  # 로테
}


def build_all():
    os.makedirs(OUT, exist_ok=True)
    for name, (head, kind, mat, palette) in NPCS.items():
        b = body(kind, mat)
        if name == 'npc_rotte':
            heads = {d: rotte_head(d) for d in ('down', 'up', 'left')}
        else:
            heads = head
        spec = {
            'name': name, 'palette': name, 'tall': False,
            'down': {'head': heads['down'], 'torso': b['down']},
            'up': {'head': heads['up'], 'torso': b['up']},
            'left': {'head': heads['left'], 'torso': b['left'], 'arm': b['arm']},
        }
        P.SPECS[name] = spec
        PALETTES[name] = palette
    MS.OUT = OUT
    for name in NPCS:
        sheet, colors = MS.build(name)
        print(f'{name}: {len(colors)}색')
    # 한눈에 보는 미리보기
    from PIL import Image
    tiles = [Image.open(os.path.join(OUT, f'{n}.png')) for n in NPCS]
    cols = 8
    w = 144 * cols
    h = 192 * ((len(tiles) + cols - 1) // cols)
    out = Image.new('RGBA', (w, h), (110, 105, 95, 255))
    for i, t in enumerate(tiles):
        out.alpha_composite(t, ((i % cols) * 144, (i // cols) * 192))
    os.makedirs(MS.PREVIEW, exist_ok=True)
    out.resize((w * 2, h * 2), Image.NEAREST).save(os.path.join(MS.PREVIEW, 'npcs_x2.png'))


if __name__ == '__main__':
    build_all()
