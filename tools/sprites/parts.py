"""도트 부위 정의 — 문자 격자.

한 줄은 그대로 쓴 문자열이거나, 길이 압축(RLE) 표기다.
  RLE 예: "10.12h10."  = 점 10개, h 12개, 점 10개
모든 부위 격자는 폭 32칸이며 프레임 x=8 위치에 놓인다(가운데 x=24 기준 좌우 대칭).
오른쪽 방향은 왼쪽 방향을 좌우 반전한 뒤, 비대칭 요소(클로토 앞머리 등)를 패치로 보정한다.

비율은 쯔꾸르 MV 계열 참고: 키 46~48px, 머리 약 28px, 몸 약 19px.
"""
from __future__ import annotations

import re

W = 32
X0 = 8

_tok = re.compile(r'(\d*)(\D)')


def rle(line: str) -> str:
    line = line.strip()
    if not any(ch.isdigit() for ch in line):
        return line.ljust(W, '.')
    out = ''.join(ch * (int(n) if n else 1) for n, ch in _tok.findall(line))
    if len(out) != W:
        raise ValueError(f'폭 {len(out)} ≠ {W}: {line}')
    return out


def G(text: str) -> str:
    """여러 줄 RLE → 격자 문자열"""
    return '\n'.join(rle(l) for l in text.strip('\n').split('\n') if l.strip())


def sub(grid: str, table: dict[str, str]) -> str:
    """재질 문자 바꾸기 (같은 몸 템플릿에 옷만 바꿀 때)"""
    return ''.join(table.get(ch, ch) for ch in grid)


def stamp(grid: str, sx: int, sy: int, s: str) -> str:
    """격자 위 (sx, sy)에 작은 격자 s를 찍는다 ('.'은 건너뜀)"""
    rows = [list(r) for r in grid.split('\n')]
    for dy, line in enumerate(s.strip('\n').split('\n')):
        for dx, ch in enumerate(line):
            if ch == '.':
                continue
            y, x = sy + dy, sx + dx
            while len(rows) <= y:
                rows.append(['.'] * W)
            rows[y][x] = ch
    return '\n'.join(''.join(r) for r in rows)


def shift(grid: str, dy: int) -> str:
    """세로로 dy칸 이동 (머리를 몸에 맞출 때)"""
    rows = grid.split('\n')
    return '\n'.join(['.' * W] * dy + rows) if dy > 0 else grid


# ───────────────────────── 공통 몸 템플릿 ─────────────────────────

# 눈 (아래 방향): k=속눈썹·테두리, E=홍채 그림자, e=홍채, w=하이라이트
EYE_L = """
.kkkk
kkEEk
kwEek
.keek
..kk.
"""
EYE_R = '\n'.join(r[::-1] for r in EYE_L.strip('\n').split('\n'))
# 눈 (옆 방향, 왼쪽을 볼 때)
EYE_SIDE = """
kkk.
EEk.
wek.
eek.
kk..
"""
MOUTH = "SS"

# 다리: 아래·위 방향 (p=바지/다리, b=신발)
LEGS_FRONT_STAND = G("""
10.12p10.
10.5p2P5p10.
10.5p2.5p10.
10.5p2.5p10.
10.5p2.5p10.
10.5b2.5b10.
9.6b2.6b9.
""")
LEGS_FRONT_STEP_A = G("""
10.12p10.
10.5p2P5p10.
10.5p2.5p10.
10.5p2.5p10.
10.5p2.5b10.
10.5b2.6b9.
9.6b17.
""")
LEGS_FRONT_STEP_B = '\n'.join(r[::-1] for r in LEGS_FRONT_STEP_A.split('\n'))

# 다리: 옆 방향 (왼쪽을 볼 때)
LEGS_SIDE_STAND = G("""
11.9p12.
12.7p13.
12.7p13.
12.7p13.
12.7p13.
11.8b13.
10.9b13.
""")
# 걸음: 앞발(왼쪽)·뒷발(오른쪽). A는 먼 쪽(오른쪽) 다리를 어둡게, B는 반대
LEGS_SIDE_STEP_A = G("""
11.9p12.
10.5p1.4P12.
10.4p2.4P12.
9.4p4.4P11.
9.4p5.4P10.
8.5b5.4B10.
7.6b6.4B9.
""")
LEGS_SIDE_STEP_B = G("""
11.9p12.
10.5P1.4p12.
10.4P2.4p12.
9.4P4.4p11.
9.4P5.4p10.
8.5B5.4b10.
7.6B6.4b9.
""")

# 옆 방향 팔 (x=옷 재질 자리, 나중에 sub로 바꿈)
ARM_SIDE = {
    1: G("""
14.4x14.
14.3x1X14.
14.3x1X14.
14.3x1X14.
14.3x1X14.
14.3x1X14.
14.3x1X14.
14.3x1X14.
14.3s15.
14.3s15.
"""),
    0: G("""
14.4x14.
14.3x1X14.
13.3x1X15.
13.3x1X15.
12.3x1X16.
12.3x1X16.
11.3x1X17.
11.3s18.
10.3s19.
"""),
    2: G("""
14.4x14.
14.3x1X14.
15.3x1X13.
15.3x1X13.
16.3x1X12.
16.3x1X12.
17.3x1X11.
18.3s11.
19.3s10.
"""),
}

# 니트·스웨터 몸통 (x=옷, X=옷 그림자, p=바지)
SWEATER_DOWN = G("""
13.6s13.
8.4x8X4x8.
7.18x7.
6.20x6.
5.3x1X14x1X3x5.
5.3x1X14x1X3x5.
5.3x1X14x1X3x5.
5.3x1X14x1X3x5.
5.3x1X14x1X3x5.
5.3s1X14x1X3s5.
5.3s16X3s5.
9.14p9.
9.14p9.
""")
SWEATER_UP = G("""
13.6S13.
8.16x8.
7.18x7.
6.20x6.
5.3x1X14x1X3x5.
5.3x1X14x1X3x5.
5.3x1X14x1X3x5.
5.3x1X14x1X3x5.
5.3x1X14x1X3x5.
5.3s1X14x1X3s5.
5.3s16X3s5.
9.14p9.
9.14p9.
""")
SWEATER_SIDE = G("""
14.5s13.
11.10x11.
10.11x1X10.
10.11x1X10.
10.11x1X10.
10.11x1X10.
10.11x1X10.
10.11x1X10.
10.11x1X10.
10.11x1X10.
10.12X10.
11.10p11.
11.10p11.
""")

# ───────────────────────── 클로토 ─────────────────────────
# 짧은 단발, 앞머리는 그녀의 오른쪽(화면 왼쪽)으로 넘겨 오른쪽 눈 위를 덮음 (CG 1000023027 기준)

KLOTHO_HEAD_DOWN = G("""
11.10h11.
8.16h8.
6.20h6.
5.6h4i12h5.
4.5h8i11h4.
3.26h3.
2.28h2.
2.28h2.
1.30h1.
1.30h1.
1.20h1s9h1.
1.18h4s8h1.
1.16h7s7h1.
1.14h10s6h1.
1.12h13s5h1.
1.10h16s4h1.
1.8h18s4h1.
1.6h20s4h1.
1.5h21s4h1.
1.4h22s4h1.
1.4h22s4h1.
1.4h22s4h1.
1.4h22s4h1.
2.3h22s3h2.
2.3h1.20s1.3h2.
3.2h2.18s2.2h3.
9.14s9.
11.10s11.
""")
# 앞머리 결 (그림자 줄)
KLOTHO_HEAD_DOWN = stamp(KLOTHO_HEAD_DOWN, 0, 9, """
...................H
.................HH
...............HH
.............HH
..........HHH
........HH
......HH
""")
KLOTHO_HEAD_DOWN = stamp(KLOTHO_HEAD_DOWN, 8, 17, EYE_L)
KLOTHO_HEAD_DOWN = stamp(KLOTHO_HEAD_DOWN, 19, 17, EYE_R)
KLOTHO_HEAD_DOWN = stamp(KLOTHO_HEAD_DOWN, 15, 24, MOUTH)
# 앞머리 한 가닥이 오른쪽 눈(화면 왼쪽) 위로 살짝 걸침
KLOTHO_HEAD_DOWN = stamp(KLOTHO_HEAD_DOWN, 8, 16, "hhH\n.h")

KLOTHO_HEAD_UP = G("""
11.10h11.
8.16h8.
6.20h6.
5.6h4i12h5.
4.5h8i11h4.
3.26h3.
2.28h2.
2.28h2.
1.30h1.
1.30h1.
1.30h1.
1.30h1.
1.30h1.
1.30h1.
1.30h1.
1.30h1.
1.30h1.
1.30h1.
1.30h1.
1.30h1.
2.28h2.
2.28h2.
2.28h2.
3.26h3.
3.6h1.12h1.6h3.
4.4h2.3S6h3S2.4h4.
10.12S10.
11.10S11.
""")
KLOTHO_HEAD_UP = stamp(KLOTHO_HEAD_UP, 0, 12, """
..........H..........H
.........H............H
.........H............H
........H..............H
""")

KLOTHO_HEAD_LEFT = G("""
11.10h11.
8.16h8.
6.20h6.
5.5h5i12h5.
4.24h4.
3.26h3.
3.26h3.
2.28h2.
2.28h2.
2.28h2.
2.28h2.
2.28h2.
2.3h2s23h2.
2.2h4s22h2.
2.2h6s20h2.
2.1h8s19h2.
2.12s16h2.
1.14s15h2.
1.14s15h2.
1.14s15h2.
2.13s15h2.
2.13s15h2.
2.13s15h2.
3.12s15h2.
3.12s15h2.
4.11s14h3.
6.9s2.12h3.
8.7s4.10h3.
""")
KLOTHO_HEAD_LEFT = stamp(KLOTHO_HEAD_LEFT, 3, 17, EYE_SIDE)
KLOTHO_HEAD_LEFT = stamp(KLOTHO_HEAD_LEFT, 4, 24, "S")
# 옆머리 결
KLOTHO_HEAD_LEFT = stamp(KLOTHO_HEAD_LEFT, 14, 10, """
........H
.......H
......H
.....H
....H
""")
# 오른쪽 방향 보정: 반전 후 앞머리가 눈 위로 내려오도록 (반전된 좌표계 기준)
KLOTHO_RIGHT_PATCH = (0, stamp('\n'.join(['.' * W] * 19), 20, 10, """
..........
........hh
......hhhh
....hhhhhh
...hhhhhhh
..hhhhhhhH
...hhhhhHh
.....hhHhh
.......Hh
"""))

KLOTHO_COAT_DOWN = G("""
13.6s13.
8.5c6t5c8.
7.6c2t2b2t6c7.
6.7c2t2b2t7c6.
5.3c1C4c2t2b2t4c1C3c5.
5.3c1C4c2t2b2t4c1C3c5.
5.3c1C4c2t2b2t4c1C3c5.
5.3c1C4c3t1b2t4c1C3c5.
5.3c1C5c4t5c1C3c5.
5.3s1C14c1C3s5.
5.3s16c3s5.
8.7c2C7c8.
8.7C2.7C8.
""")
KLOTHO_COAT_UP = G("""
13.6S13.
8.16c8.
7.18c7.
6.20c6.
5.3c1C14c1C3c5.
5.3c1C14c1C3c5.
5.3c1C7c1C6c1C3c5.
5.3c1C7c1C6c1C3c5.
5.3c1C7c1C6c1C3c5.
5.3s1C7c1C6c1C3s5.
5.3s7c1C8c3s5.
8.7c2C7c8.
8.7C2.7C8.
""")
KLOTHO_COAT_SIDE = G("""
14.5s13.
11.2t8c11.
10.1t1b9c11.
10.1t1b10c10.
10.2t10c10.
10.2t10c10.
10.2t10c10.
10.1t11c10.
10.12c10.
10.12c10.
10.13c9.
10.13c9.
10.13C9.
""")

# ───────────────────────── 아난 ─────────────────────────
# 녹색 장발, 앞머리를 가운데서 갈라 얼굴을 감싸는 긴 옆머리, 갈색 니트 터틀넥, 검은 펜슬 스커트 (CG 1000023025)

ANAN_HEAD_DOWN = G("""
11.10h11.
8.16h8.
6.20h6.
5.6h4i12h5.
4.5h8i11h4.
3.26h3.
2.28h2.
2.28h2.
1.30h1.
1.16h1s13h1.
1.13h6s11h1.
1.11h10s9h1.
1.9h14s7h1.
1.7h17s6h1.
1.6h19s5h1.
1.5h21s4h1.
1.4h22s4h1.
1.4h22s4h1.
1.4h22s4h1.
1.4h22s4h1.
1.4h22s4h1.
1.4h22s4h1.
1.4h22s4h1.
1.4h22s4h1.
1.4h1.20s1.4h1.
1.4h2.18s2.4h1.
1.4h4.14s4.4h1.
1.4h6.10s6.4h1.
""")
ANAN_HEAD_DOWN = stamp(ANAN_HEAD_DOWN, 0, 9, """
................H
..............HH.H
............HH....H
..........HH.......H
........HH..........H
""")
# 졸린 듯 반쯤 감은 눈 (CG 기본 표정)
EYE_SLEEPY_L = """
.kkkk
kkkkk
kwEek
.keek
..kk.
"""
EYE_SLEEPY_R = '\n'.join(r[::-1] for r in EYE_SLEEPY_L.strip('\n').split('\n'))
ANAN_HEAD_DOWN = stamp(ANAN_HEAD_DOWN, 8, 17, EYE_SLEEPY_L)
ANAN_HEAD_DOWN = stamp(ANAN_HEAD_DOWN, 19, 17, EYE_SLEEPY_R)
ANAN_HEAD_DOWN = stamp(ANAN_HEAD_DOWN, 6, 22, "rr")
ANAN_HEAD_DOWN = stamp(ANAN_HEAD_DOWN, 24, 22, "rr")
ANAN_HEAD_DOWN = stamp(ANAN_HEAD_DOWN, 15, 24, MOUTH)

# 몸 뒤로 늘어진 긴 머리 (아래 방향, 몸통보다 먼저 그림) — y=24부터
ANAN_HAIR_BACK_DOWN = G("""
1.5h20.5h1.
1.5h20.5h1.
1.5h20.5h1.
1.5h20.5h1.
1.5h20.5h1.
1.5h20.5h1.
1.5h20.5h1.
1.5h20.5h1.
1.5h20.5h1.
1.5h20.5h1.
1.5h20.5h1.
1.5h20.5h1.
2.4h20.4h2.
2.4h20.4h2.
2.4h20.4h2.
3.3h20.3h3.
3.3h20.3h3.
2.4h20.4h2.
2.2h1.1h20.1h1.2h2.
1.2h26.2h1.
""")
# 끝이 뾰족하게 말려 올라간 옆머리 [확정]
ANAN_HAIR_BACK_DOWN = stamp(ANAN_HAIR_BACK_DOWN, 0, 17, "i\n.")

ANAN_HEAD_UP = sub(KLOTHO_HEAD_UP, {'S': 'h'})
# 위 방향: 몸통 위로 덮는 긴 머리 — y=24부터
ANAN_HAIR_OVER_UP = G("""
3.26h3.
3.26h3.
4.24h4.
4.24h4.
5.22h5.
5.22h5.
5.10h1H11h5.
6.20h6.
6.20h6.
6.20h6.
6.9h1H10h6.
7.18h7.
7.18h7.
7.18h7.
8.16h8.
8.7h2.7h8.
9.5h4.5h9.
10.3h6.3h10.
""")

ANAN_HEAD_LEFT = G("""
12.10h10.
9.16h7.
7.20h5.
6.5h5i12h4.
5.24h3.
4.26h2.
3.27h2.
3.27h2.
2.28h2.
2.28h2.
2.28h2.
2.4s24h2.
2.6s22h2.
2.8s20h2.
2.9s19h2.
2.10s18h2.
1.12s17h2.
1.13s16h2.
1.14s15h2.
15s15h2.
1.14s15h2.
1.14s15h2.
2.13s15h2.
2.13s15h2.
3.12s15h2.
4.10s16h2.
6.8s16h2.
9.5s16h2.
""")
EYE_SLEEPY_SIDE = """
kkk.
kkk.
wek.
eek.
kk..
"""
ANAN_HEAD_LEFT = stamp(ANAN_HEAD_LEFT, 2, 17, EYE_SLEEPY_SIDE)
ANAN_HEAD_LEFT = stamp(ANAN_HEAD_LEFT, 5, 22, "rr")
ANAN_HEAD_LEFT = stamp(ANAN_HEAD_LEFT, 5, 24, "S")
ANAN_HEAD_LEFT = stamp(ANAN_HEAD_LEFT, 13, 9, """
....H
...H
..H
.H
H
""")
# 옆 방향: 등 뒤로 늘어진 머리 — y=24부터
ANAN_HAIR_BACK_SIDE = G("""
15.15h2.
15.15h2.
15.15h2.
15.14h3.
15.14h3.
15.14h3.
15.14h3.
15.13h4.
15.13h4.
15.13h4.
15.13h4.
15.12h5.
16.11h5.
16.11h5.
16.10h6.
17.9h6.
17.8h7.
18.6h8.
19.4h9.
20.2h10.
""")

ANAN_TORSO_DOWN = G("""
12.8n12.
12.8N12.
8.16n8.
6.20n6.
5.3n1N14n1N3n5.
5.3n1N14n1N3n5.
5.3n1N14n1N3n5.
5.3n1N14b1N3n5.
5.3n1N14b1N3n5.
5.3s1N14b1N3s5.
5.3s2.12b2.3s5.
10.12b10.
10.12B10.
""")
ANAN_TORSO_UP = G("""
12.8n12.
12.8n12.
8.16n8.
6.20n6.
5.3n1N14n1N3n5.
5.3n1N14n1N3n5.
5.3n1N14n1N3n5.
5.3n1N14b1N3n5.
5.3n1N14b1N3n5.
5.3s1N14b1N3s5.
5.3s2.12b2.3s5.
10.12b10.
10.12B10.
""")
ANAN_TORSO_SIDE = G("""
13.6n13.
13.6N13.
11.10n11.
10.11n1N10.
10.11n1N10.
10.11n1N10.
10.11n1N10.
10.12b10.
10.12b10.
10.12b10.
10.12b10.
11.10b11.
11.10B11.
""")

# ───────────────────────── 한스 ─────────────────────────
# [확정] 반백 머리, 둥근 루페 안경, 목 뒤 아가미(옆·뒤), 지느러미 귀(청록빛 막)
# 옷: 임시 CG(1000023029)의 남색 니트

HANS_HEAD_DOWN = G("""
11.10h11.
8.16h8.
6.20h6.
5.6h4i12h5.
4.5h8i11h4.
4.24h4.
3.26h3.
3.26h3.
3.26h3.
3.8h1H8h1H8h3.
3.6h14s6h3.
3.4h18s4h3.
3.3h20s3h3.
3.2h22s2h3.
3.2h22s2h3.
3.2h22s2h3.
3.2h22s2h3.
1.4f22s4f1.
5f22s5f
1.4f22s4f1.
2.3f22s3f2.
3.2f22s2f3.
5.22s5.
5.22s5.
6.20s6.
7.18s7.
9.14s9.
11.10s11.
""")
# 반백: 짙은 머리칼 사이로 흰 머리 (H=짙은 톤 줄무늬)
HANS_HEAD_DOWN = stamp(HANS_HEAD_DOWN, 0, 2, """
...........ii
........i.....ii
......i...ii.....i
.....i...i....ii
...........i.....i
""")
HANS_HEAD_DOWN = stamp(HANS_HEAD_DOWN, 1, 17, "F\nFF\n.F")
HANS_HEAD_DOWN = stamp(HANS_HEAD_DOWN, 29, 17, ".F\nFF\nF")
# 작고 순한 눈 + 둥근 안경
EYE_SMALL_L = """
kkk
kek
.k.
"""
HANS_HEAD_DOWN = stamp(HANS_HEAD_DOWN, 9, 18, EYE_SMALL_L)
HANS_HEAD_DOWN = stamp(HANS_HEAD_DOWN, 20, 18, EYE_SMALL_L)
HANS_HEAD_DOWN = stamp(HANS_HEAD_DOWN, 7, 16, """
.GGGG.....GGGG.
G....G...G....G
G.g..GGGGG.g..G
G....G...G....G
.GGGG.....GGGG.
""")
HANS_HEAD_DOWN = stamp(HANS_HEAD_DOWN, 14, 24, "mSSm")

HANS_HEAD_UP = G("""
11.10h11.
8.16h8.
6.20h6.
5.6h4i12h5.
4.5h8i11h4.
4.24h4.
3.26h3.
3.26h3.
3.26h3.
3.26h3.
3.26h3.
3.26h3.
3.26h3.
3.26h3.
3.26h3.
1.2f26h2f1.
4f24h4f
1.3f24h3f1.
2.2f24h2f2.
3.1f24h1f3.
4.24h4.
4.24h4.
5.22h5.
6.20S6.
7.18S7.
8.16S8.
9.14S9.
11.10S11.
""")
HANS_HEAD_UP = stamp(HANS_HEAD_UP, 0, 2, """
...........ii
........i.....ii
......i...ii.....i
.....i...i....ii...i
....i......i.....i
.......i.......i....i
.....i....i.......i
........i.....i
""")
# 아가미 (목 뒤 양쪽 짧은 선 3개)
HANS_HEAD_UP = stamp(HANS_HEAD_UP, 9, 23, "mm..........mm\n..............\n.mm........mm.\n..............\n..mm......mm..")

HANS_HEAD_LEFT = G("""
12.9h11.
9.15h8.
7.18h7.
6.20h6.
5.22h5.
5.23h4.
4.24h4.
4.25h3.
3.26h3.
3.26h3.
3.3s23h3.
2.6s21h3.
2.8s19h3.
2.10s17h3.
2.12s15h3.
1.14s14h3.
1.15s13h3.
1.14s6f8h3.
15s7f7h3.
1.14s7f7h3.
1.14s6f8h3.
1.15s5f8h3.
2.14s4f9h3.
2.16s2f9h3.
3.17s9h3.
4.18s10.
6.16s10.
9.13s10.
""")
HANS_HEAD_LEFT = stamp(HANS_HEAD_LEFT, 6, 2, """
.......ii
.....i....ii
...i...ii....i
......i....ii...i
.........i.....i
.....i.......i
""")
# 지느러미 막의 살(줄)
HANS_HEAD_LEFT = stamp(HANS_HEAD_LEFT, 15, 17, """
.F..F.
F..F..
..F..F
.F..F.
F..F
..F
""")
HANS_HEAD_LEFT = stamp(HANS_HEAD_LEFT, 2, 18, "kk\nek\nk.")
# 옆에서 본 둥근 안경 + 귀로 이어지는 다리
HANS_HEAD_LEFT = stamp(HANS_HEAD_LEFT, 1, 16, """
.GGG.
G...G
Gg..GGGGGGGGGG
G...G
.GGG.
""")
HANS_HEAD_LEFT = stamp(HANS_HEAD_LEFT, 4, 24, "mS")
# 아가미 (목 뒤 짧은 선 3개)
HANS_HEAD_LEFT = stamp(HANS_HEAD_LEFT, 17, 23, "mm\n..\n.mm\n...\n..mm")

# ───────────────────────── 사양 ─────────────────────────


def _side_layers(head, torso, arm_mat, hair_back=None):
    return {'head': head, 'torso': torso, 'arm': arm_mat, 'hair_back': hair_back}


SPECS = {
    'klotho_coat': {
        'name': 'klotho_coat', 'palette': 'klotho_coat', 'cg': 'assets/user/1000023024.png', 'tall': True,
        'down': {'head': KLOTHO_HEAD_DOWN, 'torso': KLOTHO_COAT_DOWN},
        'up': {'head': KLOTHO_HEAD_UP, 'torso': KLOTHO_COAT_UP},
        'left': _side_layers(KLOTHO_HEAD_LEFT, KLOTHO_COAT_SIDE, {'x': 'c', 'X': 'C'}),
        'right_patch': KLOTHO_RIGHT_PATCH,
    },
    'klotho_home': {
        'name': 'klotho_home', 'palette': 'klotho_home', 'cg': 'assets/user/1000023027.png', 'tall': True,
        'down': {'head': KLOTHO_HEAD_DOWN, 'torso': sub(SWEATER_DOWN, {'x': 'n', 'X': 'N'})},
        'up': {'head': KLOTHO_HEAD_UP, 'torso': sub(SWEATER_UP, {'x': 'n', 'X': 'N'})},
        'left': _side_layers(KLOTHO_HEAD_LEFT, sub(SWEATER_SIDE, {'x': 'n', 'X': 'N'}), {'x': 'n', 'X': 'N'}),
        'right_patch': KLOTHO_RIGHT_PATCH,
    },
    'anan': {
        'name': 'anan', 'palette': 'anan', 'cg': 'assets/user/1000023025.png', 'tall': False,
        'down': {'head': ANAN_HEAD_DOWN, 'torso': ANAN_TORSO_DOWN, 'hair_back': ANAN_HAIR_BACK_DOWN},
        'up': {'head': ANAN_HEAD_UP, 'torso': ANAN_TORSO_UP, 'hair_over': ANAN_HAIR_OVER_UP},
        'left': _side_layers(ANAN_HEAD_LEFT, ANAN_TORSO_SIDE, {'x': 'n', 'X': 'N'}, ANAN_HAIR_BACK_SIDE),
    },
    'hans': {
        'name': 'hans', 'palette': 'hans', 'cg': 'assets/user/1000023029.png', 'tall': False,
        'down': {'head': HANS_HEAD_DOWN, 'torso': sub(SWEATER_DOWN, {'x': 'v', 'X': 'V'})},
        'up': {'head': HANS_HEAD_UP, 'torso': sub(SWEATER_UP, {'x': 'v', 'X': 'V'})},
        'left': _side_layers(HANS_HEAD_LEFT, sub(SWEATER_SIDE, {'x': 'v', 'X': 'V'}), {'x': 'v', 'X': 'V'}),
    },
}


def _flip(g: str) -> str:
    return '\n'.join(r[::-1] for r in g.split('\n'))


def _merge(base: str, patch: str) -> str:
    return stamp(base, 0, 0, patch)


def layers_for(spec, direction, step):
    """그리는 순서대로 레이어 목록. 각 레이어 = {grid, x, y}"""
    tall = spec['tall']
    top = 0 if tall else 1          # 클로토는 1px 크게 [확정: 일반 NPC보다 1~2px 크게]
    head_y = top
    torso_y = top + 27
    legs_y = torso_y + 13
    if tall:
        legs_y -= 0
    layers = []
    if direction in ('down', 'up'):
        d = spec[direction]
        legs = [LEGS_FRONT_STEP_A, LEGS_FRONT_STAND, LEGS_FRONT_STEP_B][step]
        if direction == 'up':
            legs = _flip(legs)  # 뒤에서 보면 좌우가 반대
        if tall:  # 다리 한 줄 길게
            rows = legs.split('\n')
            legs = '\n'.join(rows[:2] + [rows[2]] + rows[2:])
        if d.get('hair_back'):
            layers.append({'grid': d['hair_back'], 'x': X0, 'y': head_y + 24})
        layers.append({'grid': legs, 'x': X0, 'y': legs_y - 1})
        layers.append({'grid': d['torso'], 'x': X0, 'y': torso_y})
        layers.append({'grid': d['head'], 'x': X0, 'y': head_y})
        if d.get('hair_over'):
            layers.append({'grid': d['hair_over'], 'x': X0, 'y': head_y + 24})
        return layers

    d = spec['left']
    legs = [LEGS_SIDE_STEP_A, LEGS_SIDE_STAND, LEGS_SIDE_STEP_B][step]
    if tall:
        rows = legs.split('\n')
        legs = '\n'.join(rows[:2] + [rows[1]] + rows[2:])
    arm = sub(ARM_SIDE[step], d['arm'])
    head = d['head']
    group = []
    if d.get('hair_back'):
        group.append(('hair_back', d['hair_back'], head_y + 24))
    group.append(('legs', legs, legs_y - 1))
    group.append(('torso', d['torso'], torso_y))
    group.append(('arm', arm, torso_y + 1))
    group.append(('head', head, head_y))
    for name, g, y in group:
        if direction == 'right':
            g = _flip(g)
            if name == 'head' and spec.get('right_patch'):
                g = _merge(g, spec['right_patch'][1])
        layers.append({'grid': g, 'x': X0, 'y': y})
    return layers
