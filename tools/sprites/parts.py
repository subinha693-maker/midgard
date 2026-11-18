"""도트 부위 정의 — 문자 격자.

한 줄은 그대로 쓴 문자열이거나, 길이 압축(RLE) 표기다.
  RLE 예: "10.12h10."  = 점 10개, h 12개, 점 10개
모든 부위 격자는 폭 32칸이며 프레임 x=8 위치에 놓인다(가운데 x=24 기준 좌우 대칭).
오른쪽 방향은 왼쪽 방향을 좌우 반전한 뒤, 비대칭 요소(클로토 앞머리 등)를 패치로 보정한다.

화풍: 사용자가 준 쯔꾸르 참고 시트(32px 칸)의 비율을 48px 칸에 1.5배로 옮김.
  키 약 41px = 머리 20px + 몸 21px (약 2등신), 작은 눈(2×3), 옆모습은 3/4 각도,
  거의 검은 외곽선, 발밑 그림자.
"""
from __future__ import annotations

import re

W = 32
X0 = 8

_tok = re.compile(r'(\d*)(\D)')


def rle(line: str) -> str:
    line = line.strip()
    if not any(ch.isdigit() for ch in line):
        if len(line) > W:
            raise ValueError(f'폭 {len(line)} > {W}: {line}')
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


def flip(g: str) -> str:
    return '\n'.join(r[::-1] for r in g.split('\n'))


def blank(rows: int) -> str:
    return '\n'.join(['.' * W] * rows)


# ───────────────────────── 공통 몸 템플릿 ─────────────────────────

# 눈 (앞): k=위 테두리, E=홍채 그림자, e=홍채 — 2×3 작은 눈
EYE_L = "kk\nEe\nEe"
EYE_R = "kk\neE\neE"
# 눈 (3/4 옆, 왼쪽을 볼 때 가까운 눈)
EYE_SIDE = "kk\nEe\nEe"

# 발밑 그림자 (z = 반투명 검정)
SHADOW = G("""
10.12z10.
9.14z9.
11.10z11.
""")

# 다리: 아래·위 방향 (p=바지/다리, b=신발)
LEGS_FRONT = {
    1: G("""
10.5p2.5p10.
10.5p2.5p10.
10.5p2.5p10.
10.5p2.5p10.
10.5p2.5p10.
10.5b2.5b10.
9.6b2.6b9.
9.6b2.6b9.
"""),
    0: G("""
10.5p2.5p10.
10.5p2.5p10.
10.5p2.5p10.
10.5p2.5p10.
10.5p2.5b10.
10.5b2.6b9.
9.6b2.6b9.
9.6b17.
"""),
}
LEGS_FRONT[2] = flip(LEGS_FRONT[0])

# 다리: 3/4 옆 (왼쪽을 볼 때). 먼 쪽 다리는 그림자 톤
LEGS_SIDE = {
    1: G("""
10.5p1.5P11.
10.5p1.5P11.
10.5p1.5P11.
10.5p1.5P11.
10.5p1.5P11.
9.6b1.5B11.
8.7b1.6B10.
8.7b1.6B10.
"""),
    0: G("""
10.11p11.
9.5p2.5P11.
8.5p4.5P10.
7.5p6.5P9.
7.5p6.5P9.
6.6b6.5B9.
5.7b6.5B9.
5.7b7.4B9.
"""),
    2: G("""
10.11P11.
9.5P2.5p11.
8.5P4.5p10.
7.5P6.5p9.
7.5P6.5p9.
6.6B6.5b9.
5.7B6.5b9.
5.7B7.4b9.
"""),
}

# 3/4 옆 팔 (x=옷 재질 자리). 0=앞으로, 1=서기, 2=뒤로
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
11.3x1X17.
10.3s19.
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
17.3x1X11.
18.3s11.
18.3s11.
"""),
}

# 니트·스웨터 몸통 (x=옷, X=옷 그림자, p=바지) — 14줄
SWEATER_DOWN = G("""
13.6s13.
8.4x8X4x8.
5.22x5.
4.3x1X16x1X3x4.
4.3x1X16x1X3x4.
4.3x1X16x1X3x4.
4.3x1X16x1X3x4.
4.3x1X16x1X3x4.
4.3x1X16x1X3x4.
4.3s1X16x1X3s4.
4.3s1.16X1.3s4.
8.16p8.
8.16p8.
8.7p2.7p8.
""")
SWEATER_UP = G("""
13.6S13.
8.16x8.
5.22x5.
4.3x1X16x1X3x4.
4.3x1X16x1X3x4.
4.3x1X16x1X3x4.
4.3x1X16x1X3x4.
4.3x1X16x1X3x4.
4.3x1X16x1X3x4.
4.3s1X16x1X3s4.
4.3s1.16X1.3s4.
8.16p8.
8.16p8.
8.7p2.7p8.
""")
SWEATER_SIDE = G("""
13.5s14.
9.13x10.
8.14x1X9.
8.14x1X9.
8.14x1X9.
8.14x1X9.
8.14x1X9.
8.14x1X9.
8.14x1X9.
8.14x1X9.
8.15X9.
9.14p9.
9.14p9.
9.14p9.
""")

# ───────────────────────── 클로토 ─────────────────────────
# 짧은 단발, 앞머리는 그녀의 오른쪽(화면 왼쪽)으로 넘겨 오른쪽 눈 위를 덮음 (CG 1000023027 기준)

KLOTHO_HEAD_DOWN = G("""
10.12h10.
7.18h7.
5.22h5.
4.24h4.
3.26h3.
3.26h3.
3.26h3.
3.17h4s5h3.
3.14h8s4h3.
3.11h12s3h3.
3.8h15s3h3.
3.6h17s3h3.
3.4h19s3h3.
3.3h20s3h3.
3.3h20s3h3.
3.3h20s3h3.
3.3h1.18s1.3h3.
4.2h2.16s2.2h4.
4.1h5.12s5.1h4.
12.8s12.
""")
# 머리 광택과 앞머리 결
KLOTHO_HEAD_DOWN = stamp(KLOTHO_HEAD_DOWN, 0, 1, """
...........iiii
.........ii....ii
........i
""")
KLOTHO_HEAD_DOWN = stamp(KLOTHO_HEAD_DOWN, 0, 6, """
.................H
...............HH
............HHH
.........HHH
.......HH
.....HH
""")
KLOTHO_HEAD_DOWN = stamp(KLOTHO_HEAD_DOWN, 10, 12, EYE_L)
KLOTHO_HEAD_DOWN = stamp(KLOTHO_HEAD_DOWN, 20, 12, EYE_R)
KLOTHO_HEAD_DOWN = stamp(KLOTHO_HEAD_DOWN, 15, 16, "SS")
# 앞머리 끝이 오른쪽 눈(화면 왼쪽) 위로 걸침
KLOTHO_HEAD_DOWN = stamp(KLOTHO_HEAD_DOWN, 9, 11, "hhH")

KLOTHO_HEAD_UP = G("""
10.12h10.
7.18h7.
5.22h5.
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
3.26h3.
3.26h3.
3.26h3.
3.26h3.
....hh.hhh.hhhh..hhhh.hhh.hh....
6.2h3.10S3.2h6.
11.10S11.
""")
# 정수리에서 퍼지는 결
KLOTHO_HEAD_UP = stamp(KLOTHO_HEAD_UP, 0, 1, """
...........iiii
.........ii....ii
........i.......i
""")


# 3/4 옆 (왼쪽을 봄). 보이는 쪽은 그녀의 왼쪽 → 앞머리는 얼굴 앞쪽(먼 쪽)으로 넘어감
KLOTHO_HEAD_LEFT = G("""
11.11h10.
8.17h7.
6.20h6.
5.22h5.
4.24h4.
4.24h4.
4.24h4.
4.24h4.
4.9h7s8h4.
4.7h10s7h4.
4.5h12s7h4.
4.3h14s7h4.
4.2h15s7h4.
4.1h16s7h4.
3.18s7h4.
4.17s7h4.
4.16s1.6h5.
5.14s2.5h6.
6.12s3.1h1.1h1.1h6.
8.9s15.
""")
KLOTHO_HEAD_LEFT = stamp(KLOTHO_HEAD_LEFT, 0, 1, """
............iiii
..........ii....i
.........i
""")
KLOTHO_HEAD_LEFT = stamp(KLOTHO_HEAD_LEFT, 0, 6, """
..........HH
........HH
......HH
....HH
""")
KLOTHO_HEAD_LEFT = stamp(KLOTHO_HEAD_LEFT, 10, 12, EYE_SIDE)
KLOTHO_HEAD_LEFT = stamp(KLOTHO_HEAD_LEFT, 5, 16, "S")
# 오른쪽 방향 보정: 반전 후 앞머리가 가까운 눈 위로 내려오도록 (반전 좌표 기준)
KLOTHO_RIGHT_PATCH = stamp(blank(14), 17, 8, """
....hhhhh
..hhhhhhH
.hhhhhHh
.hhhHh
""")

KLOTHO_COAT_DOWN = G("""
13.6s13.
7.6c6t6c7.
5.8c2t2b2t8c5.
4.3c1C5c2t2b2t5c1C3c4.
4.3c1C5c2t2b2t5c1C3c4.
4.3c1C5c2t2b2t5c1C3c4.
4.3c1C5c3t1b2t5c1C3c4.
4.3c1C6c4t6c1C3c4.
4.3c1C16c1C3c4.
4.3s1C16c1C3s4.
4.3s1.16c1.3s4.
8.7c2C7c8.
8.7c2.7c8.
8.7C2.7C8.
""")
KLOTHO_COAT_UP = G("""
13.6S13.
7.18c7.
5.22c5.
4.3c1C16c1C3c4.
4.3c1C16c1C3c4.
4.3c1C16c1C3c4.
4.3c1C16c1C3c4.
4.3c1C7c2C7c1C3c4.
4.3c1C7c2C7c1C3c4.
4.3s1C7c2C7c1C3s4.
4.3s1.7c2C7c1.3s4.
8.7c2C7c8.
8.7c2.7c8.
8.7C2.7C8.
""")
KLOTHO_COAT_SIDE = G("""
13.5s14.
9.2t11c10.
8.2t1b11c10.
8.2t1b12c9.
8.2t1b12c9.
8.3t12c9.
8.3t12c9.
8.2t13c9.
8.15c9.
8.15c9.
8.15c9.
8.16c8.
8.16c8.
8.16C8.
""")

# ───────────────────────── 아난 ─────────────────────────
# 녹색 장발, 가운데 가르마, 얼굴을 감싸고 어깨 앞으로 늘어진 긴 옆머리(끝이 뾰족하게 말려 올라감),
# 갈색 니트 터틀넥, 검은 펜슬 스커트 (CG 1000023025)

ANAN_HEAD_DOWN = G("""
10.12h10.
7.18h7.
5.22h5.
4.24h4.
3.26h3.
3.26h3.
3.26h3.
3.12h2s12h3.
3.10h6s10h3.
3.8h10s8h3.
3.6h14s6h3.
3.4h18s4h3.
3.3h20s3h3.
3.3h20s3h3.
3.3h20s3h3.
3.3h20s3h3.
3.3h1.18s1.3h3.
3.3h2.16s2.3h3.
3.3h4.12s4.3h3.
3.3h6.8s6.3h3.
""")
ANAN_HEAD_DOWN = stamp(ANAN_HEAD_DOWN, 0, 1, """
...........iiii
.........ii....ii
........i
""")
ANAN_HEAD_DOWN = stamp(ANAN_HEAD_DOWN, 0, 6, """
...............H
.............HH.H
...........HH....HH
.........HH........HH
.......HH............HH
""")
# 졸린 듯 반쯤 감은 눈 (CG 기본 표정)
ANAN_HEAD_DOWN = stamp(ANAN_HEAD_DOWN, 10, 12, "kk\nkk\nEe")
ANAN_HEAD_DOWN = stamp(ANAN_HEAD_DOWN, 20, 12, "kk\nkk\neE")
ANAN_HEAD_DOWN = stamp(ANAN_HEAD_DOWN, 8, 15, "r")
ANAN_HEAD_DOWN = stamp(ANAN_HEAD_DOWN, 23, 15, "r")
ANAN_HEAD_DOWN = stamp(ANAN_HEAD_DOWN, 15, 16, "SS")

# 어깨 앞으로 늘어진 옆머리 (몸통 다음에 그림) — 머리 기준 y=20부터
ANAN_LOCKS_DOWN = G("""
2.5h18.5h2.
2.5h18.5h2.
2.5h18.5h2.
2.5h18.5h2.
2.5h18.5h2.
2.5h18.5h2.
2.5h18.5h2.
3.4h18.4h3.
3.4h18.4h3.
3.3h20.3h3.
2.3h22.3h2.
1.2i26.2i1.
""")
# 몸 뒤로 늘어진 머리 (몸통보다 먼저) — y=20부터
ANAN_HAIR_BACK_DOWN = G("""
2.28h2.
2.28h2.
2.28h2.
2.28h2.
2.28h2.
2.28h2.
2.28h2.
2.28h2.
2.28h2.
2.28h2.
3.26h3.
4.24h4.
""")

ANAN_HEAD_UP = G("""
10.12h10.
7.18h7.
5.22h5.
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
3.26h3.
3.26h3.
3.26h3.
3.26h3.
3.26h3.
3.26h3.
3.26h3.
""")
# 위 방향: 허리까지 덮는 긴 머리. 세 갈래로 나뉘고 끝이 말려 올라감 — y=20부터 (머리와 같은 레이어로 합침)
ANAN_HAIR_OVER_UP = """
...hhhhhhhhhhhhhhhhhhhhhhhhhh...
...hhhhhhhhhhhhhhhhhhhhhhhhhh...
....hhhhhhh.hhhhhhhhh.hhhhhh....
....hhhhhhh.hhhhhhhhh.hhhhhh....
....hhhhhh..hhhhhhhhh..hhhhh....
....hhhhhh..hhhhhhhhh..hhhhh....
.....hhhhh..hhhhhhhhh..hhhh.....
.....hhhhh...hhhhhhh...hhhh.....
.....hhhhh...hhhhhhh...hhhh.....
......hhhh....hhhhh....hhh......
.....hh.hh....hhhhh....hh.hh....
....hh...h.....hhh.....h...hh...
....i...........h...........i...
"""
ANAN_HEAD_UP = stamp(ANAN_HEAD_UP, 0, 20, ANAN_HAIR_OVER_UP)
ANAN_HEAD_UP = stamp(ANAN_HEAD_UP, 0, 1, """
...........iiii
.........ii....ii
........i.......i
""")


ANAN_HEAD_LEFT = G("""
11.11h10.
8.17h7.
6.20h6.
5.22h5.
4.24h4.
4.24h4.
4.24h4.
4.24h4.
4.9h7s8h4.
4.7h10s7h4.
4.5h12s7h4.
4.3h14s7h4.
4.2h15s7h4.
4.2h15s7h4.
3.1h17s7h4.
4.17s7h4.
4.16s8h4.
5.14s9h4.
6.12s10h4.
8.9s11h4.
""")
ANAN_HEAD_LEFT = stamp(ANAN_HEAD_LEFT, 0, 1, """
............iiii
..........ii....i
.........i
""")
ANAN_HEAD_LEFT = stamp(ANAN_HEAD_LEFT, 0, 6, """
..........HH
........HH
......HH
....HH
""")
ANAN_HEAD_LEFT = stamp(ANAN_HEAD_LEFT, 10, 12, "kk\nkk\nEe")
ANAN_HEAD_LEFT = stamp(ANAN_HEAD_LEFT, 12, 15, "r")
ANAN_HEAD_LEFT = stamp(ANAN_HEAD_LEFT, 5, 16, "S")
# 3/4 옆: 등 뒤로 늘어진 머리 — y=20부터
ANAN_HAIR_BACK_SIDE = G("""
16.12h4.
16.12h4.
16.12h4.
16.12h4.
16.11h5.
16.11h5.
16.11h5.
16.11h5.
16.10h6.
17.9h6.
17.8h7.
18.6h8.
""")

ANAN_TORSO_DOWN = G("""
12.8n12.
12.8N12.
5.22n5.
4.3n1N16n1N3n4.
4.3n1N16n1N3n4.
4.3n1N16n1N3n4.
4.3n1N16n1N3n4.
4.3n1N16b1N3n4.
4.3n1N16b1N3n4.
4.3s1N16b1N3s4.
4.3s1.16b1.3s4.
8.16b8.
9.14b9.
9.14B9.
""")
ANAN_TORSO_UP = G("""
12.8n12.
12.8n12.
5.22n5.
4.3n1N16n1N3n4.
4.3n1N16n1N3n4.
4.3n1N16n1N3n4.
4.3n1N16n1N3n4.
4.3n1N16b1N3n4.
4.3n1N16b1N3n4.
4.3s1N16b1N3s4.
4.3s1.16b1.3s4.
8.16b8.
9.14b9.
9.14B9.
""")
ANAN_TORSO_SIDE = G("""
12.6n14.
12.6N14.
9.13n10.
8.14n1N9.
8.14n1N9.
8.14n1N9.
8.14n1N9.
8.15b9.
8.15b9.
8.15b9.
8.15b9.
9.14b9.
9.14b9.
9.14B9.
""")

# ───────────────────────── 한스 ─────────────────────────
# [확정] 반백 머리, 둥근 루페 안경, 목 뒤 아가미(옆·뒤), 지느러미 귀(청록빛 막)
# 옷: 임시 CG(1000023029)의 남색 니트

HANS_HEAD_DOWN = G("""
10.12h10.
7.18h7.
5.22h5.
4.24h4.
4.24h4.
4.24h4.
4.5h14s5h4.
4.3h18s3h4.
4.2h20s2h4.
4.2h20s2h4.
2.2f2h20s2h2f2.
1.3f2h20s2h3f1.
2.4f20s4f2.
1.5f20s5f1.
3.3f20s3f3.
4.2f20s2f4.
6.20s6.
7.18s7.
9.14s9.
11.10s11.
""")
# 반백: 짙은 회색 바탕에 흰 가닥
HANS_HEAD_DOWN = stamp(HANS_HEAD_DOWN, 0, 1, """
...........ii
........i.....ii
......i...ii.....i
.....i...i....ii...i
.......i....i....i
""")
HANS_HEAD_DOWN = stamp(HANS_HEAD_DOWN, 2, 11, "F\nFF\n.F")
HANS_HEAD_DOWN = stamp(HANS_HEAD_DOWN, 28, 11, ".F\nFF\nF.")
HANS_HEAD_DOWN = stamp(HANS_HEAD_DOWN, 8, 11, """
.GGGG......GGGG.
G....GGGGGG....G
G...gG....G...gG
G....G....G....G
.GGGG......GGGG.
""")
HANS_HEAD_DOWN = stamp(HANS_HEAD_DOWN, 10, 12, "kk\nEe")
HANS_HEAD_DOWN = stamp(HANS_HEAD_DOWN, 20, 12, "kk\neE")
HANS_HEAD_DOWN = stamp(HANS_HEAD_DOWN, 14, 16, "mSSm")

HANS_HEAD_UP = G("""
10.12h10.
7.18h7.
5.22h5.
4.24h4.
4.24h4.
4.24h4.
4.24h4.
4.24h4.
4.24h4.
4.24h4.
2.2f24h2f2.
1.3f24h3f1.
2.4f20h4f2.
1.5f20h5f1.
3.3f2h16S2h3f3.
4.2f20S2f4.
6.20S6.
7.18S7.
9.14S9.
11.10S11.
""")
HANS_HEAD_UP = stamp(HANS_HEAD_UP, 0, 1, """
...........ii
........i.....ii
......i...ii.....i
.....i...i....ii...i
....i......i.....i
.......i.......i....i
.....i....i.......i
........i.....i
""")
HANS_HEAD_UP = stamp(HANS_HEAD_UP, 2, 11, "F\nFF\n.F")
HANS_HEAD_UP = stamp(HANS_HEAD_UP, 28, 11, ".F\nFF\nF.")
# 아가미 (목 뒤 양쪽 짧은 선 3개)
HANS_HEAD_UP = stamp(HANS_HEAD_UP, 7, 15, "mm..............mm\n..................\n.mm............mm.\n..................\n..mm..........mm..")

HANS_HEAD_LEFT = G("""
11.11h10.
8.17h7.
6.20h6.
5.22h5.
4.24h4.
4.24h4.
4.3h10s11h4.
4.2h13s9h4.
4.1h15s8h4.
4.16s8h4.
4.14s4f6h4.
3.15s6f4h4.
4.14s7f3h4.
4.14s6f4h4.
4.15s4f5h4.
4.16s2f6h4.
5.17s5h5.
6.17s9.
7.15s10.
9.12s11.
""")
HANS_HEAD_LEFT = stamp(HANS_HEAD_LEFT, 0, 1, """
............ii
..........i....ii
........i...ii....i
.......i...i....i...i
..............i.....i
""")
# 지느러미 막의 살(줄)
HANS_HEAD_LEFT = stamp(HANS_HEAD_LEFT, 18, 10, """
.F..F
F..F..
..F..F
.F..F.
F..F
""")
# 둥근 안경 + 귀로 이어지는 다리
HANS_HEAD_LEFT = stamp(HANS_HEAD_LEFT, 6, 10, """
.GGGG.
G....GGGGGGG
G...gG
G....G
.GGGG.
""")
HANS_HEAD_LEFT = stamp(HANS_HEAD_LEFT, 8, 12, "kk\nEe")
HANS_HEAD_LEFT = stamp(HANS_HEAD_LEFT, 5, 16, "mS")
# 아가미 (목 뒤 짧은 선 3개)
HANS_HEAD_LEFT = stamp(HANS_HEAD_LEFT, 18, 16, "mm\n...\n.mm")

# ───────────────────────── 사양 ─────────────────────────

SPECS = {
    'klotho_coat': {
        'name': 'klotho_coat', 'palette': 'klotho_coat', 'cg': 'assets/user/1000023024.png', 'tall': True,
        'down': {'head': KLOTHO_HEAD_DOWN, 'torso': KLOTHO_COAT_DOWN},
        'up': {'head': KLOTHO_HEAD_UP, 'torso': KLOTHO_COAT_UP},
        'left': {'head': KLOTHO_HEAD_LEFT, 'torso': KLOTHO_COAT_SIDE, 'arm': {'x': 'c', 'X': 'C'}},
        'right_patch': KLOTHO_RIGHT_PATCH,
    },
    'klotho_home': {
        'name': 'klotho_home', 'palette': 'klotho_home', 'cg': 'assets/user/1000023027.png', 'tall': True,
        'down': {'head': KLOTHO_HEAD_DOWN, 'torso': sub(SWEATER_DOWN, {'x': 'n', 'X': 'N'})},
        'up': {'head': KLOTHO_HEAD_UP, 'torso': sub(SWEATER_UP, {'x': 'n', 'X': 'N'})},
        'left': {'head': KLOTHO_HEAD_LEFT, 'torso': sub(SWEATER_SIDE, {'x': 'n', 'X': 'N'}), 'arm': {'x': 'n', 'X': 'N'}},
        'right_patch': KLOTHO_RIGHT_PATCH,
    },
    'anan': {
        'name': 'anan', 'palette': 'anan', 'cg': 'assets/user/1000023025.png', 'tall': False,
        'down': {'head': ANAN_HEAD_DOWN, 'torso': ANAN_TORSO_DOWN, 'hair_back': ANAN_HAIR_BACK_DOWN,
                 'locks': ANAN_LOCKS_DOWN},
        'up': {'head': ANAN_HEAD_UP, 'torso': ANAN_TORSO_UP},
        'left': {'head': ANAN_HEAD_LEFT, 'torso': ANAN_TORSO_SIDE, 'arm': {'x': 'n', 'X': 'N'},
                 'hair_back': ANAN_HAIR_BACK_SIDE},
    },
    'hans': {
        'name': 'hans', 'palette': 'hans', 'cg': 'assets/user/1000023029.png', 'tall': False,
        'down': {'head': HANS_HEAD_DOWN, 'torso': sub(SWEATER_DOWN, {'x': 'v', 'X': 'V'})},
        'up': {'head': HANS_HEAD_UP, 'torso': sub(SWEATER_UP, {'x': 'v', 'X': 'V'})},
        'left': {'head': HANS_HEAD_LEFT, 'torso': sub(SWEATER_SIDE, {'x': 'v', 'X': 'V'}), 'arm': {'x': 'v', 'X': 'V'}},
    },
}


def _longer(legs: str, at: int) -> str:
    """다리를 한 줄 길게 (클로토는 일반 NPC보다 1px 크게 [확정])"""
    rows = legs.split('\n')
    return '\n'.join(rows[:at] + [rows[at]] + rows[at:])


def layers_for(spec, direction, step):
    """그리는 순서대로 레이어 목록. 각 레이어 = {grid, x, y}"""
    tall = spec['tall']
    head_y = 4 if tall else 5
    torso_y = head_y + 20
    legs_y = torso_y + 13
    layers = [{'grid': SHADOW, 'x': X0, 'y': 44}]
    if direction in ('down', 'up'):
        d = spec[direction]
        legs = LEGS_FRONT[step]
        if direction == 'up':
            legs = flip(legs)  # 뒤에서 보면 좌우가 반대
        if tall:
            legs = _longer(legs, 2)
        if d.get('hair_back'):
            layers.append({'grid': d['hair_back'], 'x': X0, 'y': head_y + 20})
        layers.append({'grid': legs, 'x': X0, 'y': legs_y})
        layers.append({'grid': d['torso'], 'x': X0, 'y': torso_y})
        if d.get('locks'):
            layers.append({'grid': d['locks'], 'x': X0, 'y': head_y + 20})
        layers.append({'grid': d['head'], 'x': X0, 'y': head_y})
        return layers

    d = spec['left']
    legs = LEGS_SIDE[step]
    if tall:
        legs = _longer(legs, 1)
    arm = sub(ARM_SIDE[step], d['arm'])
    group = []
    if d.get('hair_back'):
        group.append(('hair_back', d['hair_back'], head_y + 20))
    group.append(('legs', legs, legs_y))
    group.append(('torso', d['torso'], torso_y))
    group.append(('arm', arm, torso_y + 1))
    group.append(('head', d['head'], head_y))
    for name, g, y in group:
        if direction == 'right':
            g = flip(g)
            if name == 'head' and spec.get('right_patch'):
                g = stamp(g, 0, 0, spec['right_patch'])
        layers.append({'grid': g, 'x': X0, 'y': y})
    return layers
