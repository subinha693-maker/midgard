#!/usr/bin/env python3
"""챕터 1 프롤로그 맵 생성기 → data/maps/*.json

사용법: python3 tools/maps/build_maps.py
맵은 사각형·방·소품을 코드로 배치해 ASCII 격자 JSON 으로 내보낸다.
결과 JSON 을 직접 고쳐도 되지만, 이 스크립트를 다시 돌리면 덮어쓴다.
이벤트(NPC·조사·이야기)는 P5 에서 원고와 함께 붙인다. 여기서는 맵 이동 연결만.
"""
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'data', 'maps')

# 문자 → 타일. 문자열이면 통행 가능, (타일, 'block') 이면 통행 불가, (타일, 'above') 면 캐릭터 위에 그림
LEG = {
    # 공통
    '#': ('void', 'block'),
    ',': 'grass',
    '"': 'dirt',
    '=': 'stone_road',
    'c': 'cobble',
    '~': ('water', 'block'),
    'W': ('water_deep', 'block'),
    # 실내 바닥 (Modern Interiors Room Builder)
    '.': 'rb:12,13',  # 나무 바닥(헤링본)
    ':': 'rb:12,7',  # 노란 체크 타일 (빵집)
    ';': 'rb:15,11',  # 회색 바닥 (시청·선실)
    '_': 'rb:12,9',  # 민트 타일 (의무실)
    'r': 'rb:12,5',  # 붉은 벽돌 바닥 (공방)
    # 실내 벽 (위 줄 / 아래 줄)
    'A': ('rb:1,13', 'block'), 'a': ('rb:1,14', 'block'),  # 짙은 나무
    'B': ('rb:1,19', 'block'), 'b': ('rb:1,20', 'block'),  # 베이지 (시청)
    'E': ('rb:1,7', 'block'), 'e': ('rb:1,8', 'block'),  # 노랑 (빵집)
    'M': ('rb:1,9', 'block'), 'm': ('rb:1,10', 'block'),  # 민트 (의무실)
    'D': ('rb:1,17', 'block'), 'd': ('rb:1,18', 'block'),  # 회청 (배)
    # 에리시아 바깥
    'S': ('facade', 'block'),
    'F': ('facade_window', 'block'),
    'n': 'facade_door',  # 문 (밟으면 이동)
    'Q': ('facade_shop', 'block'),
    'R': ('roof_red', 'block'),
    'L': ('roof_slate', 'block'),
    'P': ('poster', 'block'),  # 물체 레이어에서 벽 위에
    'G': ('speaker_post', 'block'),
    'f': ('iron_fence', 'block'),
    'u': ('bench', 'block'),
    'w': ('flowerbed', 'block'),
    't': ('tree', 'block'),
    'Y': ('lamp', 'block'),
    'q': 'stairs',
    's': ('sign', 'block'),
    'x': ('crate', 'block'),
    'v': ('barrel', 'block'),
    # 시험장
    'J': ('hurdle', 'block'),
    '|': 'start_line',
    'g': ('cage', 'block'),
    # 미르
    'o': 'concrete',
    'O': 'rubble',
    'C': ('concrete_wall', 'block'),
    'K': ('patched_wall', 'block'),
    'H': ('barred_window', 'block'),
    'X': ('sea_wall', 'block'),
    'z': ('siren', 'above'),
    'j': ('laundry', 'above'),
    'T': ('tent_red', 'block'),
    'U': ('tent_blue', 'block'),
    'Z': ('stall', 'block'),
    '%': ('bus_stop', 'block'),
    'I': 'iron_plate',
    # 배·바다
    'k': 'deck',
    'h': ('hull', 'block'),
    'l': ('rail', 'block'),
    'y': ('buoy', 'block'),
    'p': ('mast', 'block'),
    'V': 'boat',
    '>': 'gangway',
    'N': 'dock_wood',
}


class M:
    def __init__(self, mid, name, w, h, fill, indoor=False):
        self.id, self.name, self.w, self.h, self.indoor = mid, name, w, h, indoor
        self.g = [[fill] * w for _ in range(h)]
        self.o = [[' '] * w for _ in range(h)]
        self.events = []
        self.props = []
        self.hospital = None

    def rect(self, x, y, w, h, ch, layer='g'):
        grid = self.g if layer == 'g' else self.o
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if 0 <= yy < self.h and 0 <= xx < self.w:
                    grid[yy][xx] = ch
        return self

    def put(self, x, y, ch, layer='o'):
        return self.rect(x, y, 1, 1, ch, layer)

    def room(self, x, y, w, h, wall='A', wall2='a', floor='.'):
        """윗벽 2줄 + 바닥"""
        self.rect(x, y, w, 1, wall)
        self.rect(x, y + 1, w, 1, wall2)
        self.rect(x, y + 2, w, h - 2, floor)
        return self

    def prop(self, name, x, y):
        self.props.append({'prop': name, 'x': x, 'y': y})
        return self

    def go(self, x, y, to, tx, ty, d=None, show=None):
        """밟으면 다른 맵으로 (show: 이 조건일 때만)"""
        t = {'map': to, 'x': tx, 'y': ty}
        if d:
            t['dir'] = d
        e = {'id': f'to_{to}_{x}_{y}', 'x': x, 'y': y, 'transfer': t}
        if show:
            e['show'] = show
        self.events.append(e)
        return self

    def ev(self, eid, x, y, label=None, pages=None, sprite=None, d='down', trigger='talk', show=None, route=None, block=None):
        """이야기 이벤트: NPC·조사 지점·자동 실행"""
        e = {'id': eid, 'x': x, 'y': y, 'trigger': trigger}
        if sprite:
            e['sprite'] = sprite
            e['dir'] = d
        if pages:
            e['pages'] = [{'if': c, 'label': l} if c else {'label': l} for c, l in pages]
        else:
            e['label'] = label
        if show:
            e['show'] = show
        if route:
            e['route'] = route
        if block:
            e['block'] = True
        self.events.append(e)
        return self

    def look(self, eid, x, y, label):
        """조사 지점 (원고 라벨은 P5에서 채움)"""
        self.events.append({'id': eid, 'x': x, 'y': y, 'trigger': 'talk', 'label': label})
        return self

    def save(self):
        used = {c for row in self.g for c in row} | {c for row in self.o for c in row if c != ' '}
        legend = {}
        for c in sorted(used):
            v = LEG[c]
            if isinstance(v, str):
                legend[c] = v
            else:
                legend[c] = {'tile': v[0], v[1]: True}
        data = {
            'name': self.name,
            'indoor': self.indoor,
            'legend': legend,
            'ground': [''.join(r) for r in self.g],
            'objects': [''.join(r) for r in self.o],
            'props': self.props,
            'events': self.events,
        }
        if self.hospital:
            data['hospital'] = self.hospital
        with open(os.path.join(OUT, self.id + '.json'), 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        print(f'{self.id}: {self.w}×{self.h}  소품 {len(self.props)}  이벤트 {len(self.events)}')


def build():
    maps = []

    # ── 콜드 오픈: 안개 낀 바다 ──
    m = M('sea_coldopen', '바다', 23, 13, 'W')
    m.rect(10, 5, 3, 3, 'V')  # 작은 배
    m.rect(11, 4, 1, 1, 'V')  # 뱃머리 (북쪽)
    maps.append(m)

    # ── 에리시아 · 클로토의 집 2층 ──
    m = M('erisia_home_2f', '클로토의 집 · 2층', 12, 9, '#', indoor=True)
    m.room(1, 0, 10, 8)
    m.prop('window_curtain', 5, 1).prop('bed_white', 2, 2).prop('bookshelf', 7, 2)
    m.prop('table_light', 7, 4).prop('chair_back', 7, 6).prop('rug_small', 3, 5)
    m.put(9, 7, 'q', 'g')
    m.go(9, 7, 'erisia_home_1f', 2, 9, 'right')
    maps.append(m)

    # ── 에리시아 · 클로토의 집 1층 (부엌·거실·아난의 방) ──
    m = M('erisia_home_1f', '클로토의 집 · 1층', 18, 12, '#', indoor=True)
    m.room(1, 0, 12, 11)  # 부엌·거실
    m.room(14, 0, 3, 8)  # 아난의 방
    m.rect(13, 4, 1, 1, '.')  # 아난의 방 문
    m.prop('counter', 2, 2).prop('rack', 6, 2).prop('window', 8, 1)
    m.prop('table_light', 4, 5).prop('chair_front', 4, 4).prop('chair_front2', 5, 4)
    m.prop('chair_back', 4, 7).prop('chair_back', 5, 7)
    m.prop('sofa', 9, 3).prop('rug_red', 8, 5)
    m.prop('table_dark', 9, 8).prop('stool', 11, 9)  # 거실 책상 (아난이 편지를 쓰는 곳)
    m.prop('bed_single', 16, 2).prop('rack', 14, 2).prop('window_small', 14, 1)
    m.put(1, 9, 'q', 'g')
    m.go(1, 9, 'erisia_home_2f', 8, 7, 'left')
    m.rect(6, 11, 1, 1, '.')
    m.go(6, 11, 'erisia_town', 4, 4, 'down')
    maps.append(m)

    # ── 에리시아 마을 ──
    m = M('erisia_town', '노그리아 에리시아', 34, 22, ',')
    # 북쪽 건물: 클로토의 집 / 빵집 / 지방시청
    m.rect(1, 0, 8, 3, 'R').rect(1, 3, 8, 1, 'F').put(4, 3, 'n', 'g')
    m.rect(12, 0, 7, 3, 'R').rect(12, 3, 7, 1, 'Q').put(15, 3, 'n', 'g')
    m.rect(22, 0, 11, 4, 'L').rect(22, 4, 11, 1, 'F').rect(26, 4, 3, 1, 'S').put(27, 4, 'n', 'g')
    # 큰길
    m.rect(0, 5, 34, 2, '=')
    m.rect(9, 7, 2, 15, '=')
    m.rect(11, 15, 23, 2, '=')
    # 광장 (국영 라디오 확성기)
    m.rect(12, 8, 10, 6, 'c')
    m.put(16, 9, 'G').put(13, 12, 'u').put(19, 12, 'u').put(12, 8, 'w').put(21, 8, 'w')
    # 벽보가 붙은 건물 (남서쪽)
    m.rect(1, 9, 7, 2, 'L').rect(1, 11, 7, 2, 'S')
    m.put(2, 12, 'P').put(4, 12, 'P').put(6, 12, 'P')
    # 남동쪽 집들
    m.rect(23, 9, 9, 2, 'R').rect(23, 11, 9, 2, 'F')
    m.rect(1, 17, 6, 2, 'R').rect(1, 19, 6, 2, 'F')
    m.rect(13, 18, 8, 2, 'L').rect(13, 20, 8, 1, 'F')
    for x, y in [(0, 8), (8, 8), (11, 18), (22, 18), (32, 18), (28, 7), (24, 14), (31, 13)]:
        m.put(x, y, 't')
    m.put(10, 4, 'Y').put(20, 4, 'Y').put(30, 7, 'Y')
    m.go(4, 3, 'erisia_home_1f', 6, 10, 'up')
    m.go(15, 3, 'erisia_bakery', 5, 7, 'up')
    m.go(27, 4, 'erisia_cityhall', 7, 9, 'up', '진행 >= 30')
    m.go(33, 15, 'noggria_port', 1, 7, 'right', '진행 >= 40').go(33, 16, 'noggria_port', 1, 8, 'right', '진행 >= 40')
    m.hospital = {'map': 'erisia_town', 'x': 27, 'y': 6}
    maps.append(m)

    # ── 에리시아 · 빵집 ──
    m = M('erisia_bakery', '빵집', 12, 9, '#', indoor=True)
    m.room(1, 0, 10, 8, 'E', 'e', ':')
    m.prop('shop_shelves', 6, 2).prop('counter', 2, 4).prop('window', 2, 1).prop('vase', 9, 6)
    m.rect(5, 8, 1, 1, ':')
    m.go(5, 8, 'erisia_town', 15, 4, 'down')
    maps.append(m)

    # ── 에리시아 · 지방시청 ──
    m = M('erisia_cityhall', '에리시아 지방시청', 16, 11, '#', indoor=True)
    m.room(1, 0, 14, 10, 'B', 'b', ';')
    m.prop('counter', 5, 4).prop('window', 7, 1).prop('rug_red_v', 6, 6)
    m.prop('door', 2, 1).prop('door', 13, 1).prop('vase', 1, 2).prop('sofa', 11, 7)
    m.put(10, 1, 'P')  # 엽사 등급 안내판
    m.rect(7, 10, 1, 1, ';')
    m.go(7, 10, 'erisia_town', 27, 5, 'down')
    m.go(2, 2, 'erisia_testground', 10, 1, 'down', '진행 >= 31')
    m.go(13, 2, 'erisia_clinic', 4, 5, 'up', '진행 >= 33')
    maps.append(m)

    # ── 에리시아 · 의무실 (혈액 검사) ──
    m = M('erisia_clinic', '지방시청 · 의무실', 9, 7, '#', indoor=True)
    m.room(1, 0, 7, 6, 'M', 'm', '_')
    m.prop('bed_single', 6, 2).prop('tv', 2, 2).prop('rack', 3, 2).prop('stool', 4, 3)
    m.rect(4, 6, 1, 1, '_')
    m.go(4, 6, 'erisia_cityhall', 13, 3, 'down')
    maps.append(m)

    # ── 에리시아 · 시험장 (체력 시험 코스, 실전 시험 철창) ──
    m = M('erisia_testground', '시청 뒤편 훈련장', 22, 14, '"')
    m.rect(0, 0, 22, 1, 'f', 'o').rect(0, 13, 22, 1, 'f', 'o').rect(0, 0, 1, 14, 'f', 'o').rect(21, 0, 1, 14, 'f', 'o')
    m.rect(10, 0, 1, 1, ' ', 'o')
    m.rect(2, 2, 1, 3, '|')  # 출발선
    m.rect(2, 2, 18, 3, '"')
    m.rect(2, 2, 1, 3, '|')
    m.rect(20, 2, 1, 3, '|')  # 결승선
    for x, y in [(5, 2), (8, 4), (11, 3), (14, 2), (17, 4)]:
        m.put(x, y, 'J')
    m.put(19, 3, 'Y')
    m.rect(4, 9, 3, 2, 'g').rect(12, 9, 3, 2, 'g')  # 철창 (원형 / 야형)
    m.put(8, 7, 'x').put(18, 10, 'x').put(19, 10, 'v')
    m.go(10, 0, 'erisia_cityhall', 2, 3, 'down')
    maps.append(m)

    # ── 노그리아 항구 (이름 미정) ──
    m = M('noggria_port', 'TODO(미정) 노그리아 항구', 26, 16, 'c')
    m.rect(0, 0, 26, 2, 'L').rect(0, 2, 12, 1, 'F')
    m.rect(12, 0, 14, 3, 'W')
    m.rect(12, 3, 4, 13, 'N')
    m.rect(16, 3, 10, 13, 'W')
    m.rect(18, 4, 7, 9, 'h').rect(19, 5, 5, 7, 'k').put(21, 8, 'p')  # 아르고 정기선 (선체 + 갑판 + 돛대)
    m.rect(16, 7, 2, 2, '>')  # 다리판
    m.put(3, 6, 'Y').put(9, 6, 'Y').put(6, 11, 'x').put(7, 11, 'x').put(6, 12, 'v').put(13, 13, 'v').put(14, 4, 'x')
    m.go(0, 7, 'erisia_town', 32, 15, 'left').go(0, 8, 'erisia_town', 32, 16, 'left')
    m.go(17, 7, 'argo_deck', 3, 6, 'right', '_개발_자유이동').go(17, 8, 'argo_deck', 3, 6, 'right', '_개발_자유이동')
    maps.append(m)

    # ── 아르고 정기선 · 갑판 ──
    m = M('argo_deck', '아르고 정기선 · 갑판', 24, 13, 'W')
    m.rect(1, 1, 22, 11, 'l')
    m.rect(2, 2, 20, 9, 'k')
    m.room(2, 2, 5, 3, 'D', 'd', 'k')  # 선실 입구
    m.rect(4, 3, 1, 1, 'd')
    m.put(12, 6, 'p')
    m.put(9, 9, 'x').put(10, 9, 'x').put(18, 3, 'v')
    for x in range(3, 23, 5):
        m.put(x, 0, 'y', 'g')  # 노란 부표 (경계)
    m.go(4, 4, 'argo_cabin', 5, 5, 'up')
    m.go(2, 6, 'noggria_port', 15, 7, 'left', '_개발_자유이동')  # 이야기 중에는 막힘 (개발용)
    maps.append(m)

    # ── 아르고 정기선 · 선실 ──
    m = M('argo_cabin', '아르고 정기선 · 선실', 11, 8, '#', indoor=True)
    m.room(1, 0, 9, 7, 'D', 'd', ';')
    m.prop('bed_single', 2, 2).prop('bed_single', 4, 2).prop('bed_single', 8, 2).prop('window_small', 5, 1).prop('stool', 6, 4)
    m.rect(5, 7, 1, 1, ';')
    m.go(5, 7, 'argo_deck', 4, 5, 'down')
    maps.append(m)

    # ── 미르 · 북항 ──
    m = M('mir_port', '미르 · 북항', 26, 16, 'o')
    m.rect(0, 0, 26, 2, 'X')  # 도시를 두른 거대한 콘크리트 방벽
    m.rect(1, 2, 9, 2, 'K').rect(1, 4, 9, 1, 'H')
    m.rect(14, 2, 11, 2, 'K').rect(14, 4, 11, 1, 'H')
    m.put(3, 2, 'z').put(19, 2, 'z')
    m.rect(10, 2, 4, 1, 'K').rect(11, 3, 2, 2, 'O')  # 막다른 골목 (소매치기)
    m.rect(1, 5, 9, 1, 'j', 'o').rect(14, 5, 11, 1, 'j', 'o')
    m.rect(0, 12, 26, 1, 'I')
    m.rect(0, 13, 26, 3, 'W')
    m.rect(5, 13, 10, 3, 'h').rect(6, 14, 8, 2, 'k').put(10, 14, 'p')  # 정박한 아르고
    m.put(4, 9, '%').put(20, 9, 'x').put(21, 9, 'x').put(22, 10, 'v').put(2, 11, 'v')
    m.go(25, 7, 'mir_market', 1, 8, 'right', '진행 >= 52').go(25, 8, 'mir_market', 1, 9, 'right', '진행 >= 52')
    m.hospital = {'map': 'mir_market', 'x': 3, 'y': 8}
    maps.append(m)

    # ── 미르 · 가르템 시장 ──
    m = M('mir_market', '미르 · 가르템 시장', 28, 18, 'o')
    m.rect(0, 0, 28, 2, 'K').rect(0, 2, 28, 1, 'H')
    m.rect(12, 0, 3, 3, 'o')  # 북쪽 출구 (망치골목)
    m.put(5, 0, 'z').put(22, 0, 'z')
    for i, x in enumerate([3, 8, 18, 23]):
        m.rect(x, 5, 3, 1, 'T' if i % 2 == 0 else 'U').rect(x, 6, 3, 1, 'Z', 'o')
        m.rect(x, 11, 3, 1, 'U' if i % 2 == 0 else 'T').rect(x, 12, 3, 1, 'Z', 'o')
    m.rect(0, 15, 28, 3, 'K').rect(0, 15, 28, 1, 'H')
    m.rect(0, 3, 28, 1, 'j', 'o')
    m.put(25, 8, '%').put(1, 13, 'x').put(26, 13, 'v')
    m.go(0, 8, 'mir_port', 24, 7, 'left').go(0, 9, 'mir_port', 24, 8, 'left')
    m.go(13, 0, 'mir_hammer', 10, 12, 'up')
    maps.append(m)

    # ── 미르 · 망치골목 ──
    m = M('mir_hammer', '미르 · 망치골목', 22, 14, 'o')
    m.rect(0, 0, 22, 3, 'K').rect(0, 3, 22, 2, 'H')
    m.rect(0, 9, 22, 3, 'K').rect(0, 9, 22, 1, 'H')
    m.rect(10, 9, 2, 5, 'o')
    m.put(11, 4, 'n', 'g')  # 레브리 문
    m.put(10, 4, 'K', 'g').put(12, 4, 'K', 'g')
    for x in (3, 7, 14, 18):
        m.put(x, 5, 's')  # 간판 (이상구 그림)
    m.put(12, 5, 's')  # 오래되고 큼직한 간판: 레브리 (문 오른쪽)
    m.rect(0, 6, 22, 1, 'j', 'o')
    m.put(2, 7, 'v').put(19, 7, 'x').put(20, 7, 'x')
    m.go(11, 4, 'mir_lebri', 6, 8, 'up')
    m.go(10, 13, 'mir_market', 13, 1, 'down').go(11, 13, 'mir_market', 13, 1, 'down')
    maps.append(m)

    # ── 미르 · 레브리 (한스의 공방) ──
    m = M('mir_lebri', '레브리', 14, 10, '#', indoor=True)
    m.room(1, 0, 12, 9, 'A', 'a', 'r')
    m.prop('table_dark', 3, 4).prop('table_dark', 8, 4).prop('rack', 2, 2).prop('rack', 11, 2)
    m.prop('bookshelf2', 5, 2).prop('door', 11, 1).prop('heater', 8, 7)
    m.rect(6, 9, 1, 1, 'r')
    m.go(6, 9, 'mir_hammer', 11, 5, 'down')
    maps.append(m)

    story({mm.id: mm for mm in maps})
    for mm in maps:
        mm.save()


def story(M):
    """프롤로그 이야기 이벤트 (원고: data/scenario/*.md). 변수 '진행'으로 장면을 나눈다."""
    m = M['sea_coldopen']
    m.ev('anan_boat', 11, 4, sprite='anan', d='up', label='콜드오픈', show='진행 < 10')

    m = M['erisia_home_2f']
    m.ev('bed', 2, 2, 'M01_침대').ev('window', 5, 1, 'M01_창문').ev('shelf', 7, 2, 'M01_책장').ev('desk', 7, 4, 'M01_책상')

    m = M['erisia_home_1f']
    m.ev('auto', 0, 0, trigger='autorun', pages=[('진행 == 10', 'M01_부엌'), ('진행 == 12', 'M01_저녁'), ('진행 == 34', 'M03_결과')])
    m.ev('anan_kitchen', 3, 3, sprite='anan', d='up', show='진행 >= 10 && 진행 <= 12', pages=[('진행 == 11', 'M01_아난_심부름'), (None, 'M01_부엌_조사')])
    m.ev('anan_dinner', 5, 4, sprite='anan', d='down', show='진행 == 13', label='M01_부엌_조사')
    m.ev('anan_night', 11, 9, sprite='anan', d='left', show='진행 == 14', label='M01_부엌_조사')
    m.ev('pot', 3, 2, 'M01_부엌_조사', show='진행 <= 12')
    m.ev('memo', 4, 6, 'M01_식탁', sprite='tile:memo', show='진행 == 15')
    m.ev('wardrobe', 14, 2, 'M01_아난의방', show='진행 == 15')
    m.ev('livingdesk', 9, 8, 'M01_거실책상', show='진행 == 15')
    m.ev('clerk', 6, 10, 'M01_부엌_조사', sprite='npc_clerk', d='up', show='진행 == 21')
    m.ev('papers', 8, 9, 'M02_신문더미', sprite='tile:newspapers', show='진행 == 23')
    m.ev('plate', 4, 6, 'M02_접시', sprite='tile:plate', show='진행 == 23')
    m.ev('calendar', 11, 1, 'M02_달력', sprite='tile:calendar', show='진행 == 23')
    m.ev('anan_door', 13, 4, 'M02_아난의방문', show='진행 == 23', block=True)
    m.ev('drawer', 9, 8, 'M02_서랍', show='진행 == 23')
    m.ev('hans_door', 6, 10, 'M02_노크', sprite='hans', d='up', show='진행 == 24')
    m.ev('hans_table', 5, 4, 'M02_노크', sprite='hans', d='down', show='진행 == 25')
    m.ev('hans_leave', 6, 9, 'M02_노크', sprite='hans', d='up', show='진행 == 26')

    m = M['erisia_town']
    m.ev('radio_auto', 0, 0, trigger='autorun', pages=[('진행 == 11 && !라디오_들음', 'M01_라디오')])
    m.ev('speaker', 16, 9, 'M01_확성기')
    m.ev('poster1', 2, 12, 'M01_벽보1').ev('poster2', 4, 12, 'M01_벽보2').ev('poster3', 6, 12, 'M01_벽보3')
    m.ev('marked_man', 18, 7, 'M01_명찰', sprite='npc_marked', d='left', show='진행 <= 12', route=['left*4', 'wait 1.5', 'right*4', 'wait 1.5'])
    m.ev('woman', 25, 8, 'M01_지나가는_여자', sprite='npc_woman', d='left', show='진행 <= 12', route=['left*2', 'wait 2', 'right*2', 'wait 2'])
    m.ev('cityhall_closed', 27, 4, 'M01_시청닫힘', trigger='touch', show='진행 < 30')
    m.ev('east_closed1', 33, 15, 'M01_항구닫힘', trigger='touch', show='진행 < 40')
    m.ev('east_closed2', 33, 16, 'M01_항구닫힘', trigger='touch', show='진행 < 40')

    m = M['erisia_bakery']
    m.ev('baker', 4, 3, sprite='npc_baker', d='down', pages=[('진행 == 11', 'M01_빵집'), (None, 'M01_빵집_평소')])
    m.ev('bread', 7, 2, 'M01_빵진열대')

    m = M['erisia_cityhall']
    m.ev('receptionist', 6, 3, sprite='npc_receptionist', d='down', show='진행 >= 30', pages=[('진행 == 30', 'M03_접수'), (None, 'M03_접수_평소')])
    m.ev('notice', 10, 1, 'M03_안내판')
    m.ev('back_closed', 2, 2, 'M03_뒷문닫힘', trigger='touch', show='진행 < 31')
    m.ev('clinic_closed', 13, 2, 'M03_의무실닫힘', trigger='touch', show='진행 < 33')

    m = M['erisia_testground']
    m.ev('examiner', 4, 6, sprite='npc_examiner', d='up', pages=[('진행 == 31', 'M03_체력시험'), ('진행 == 32', 'M03_실전시험'), (None, 'M03_시험관_평소')])
    for y in (2, 3, 4):
        m.ev(f'finish{y}', 20, y, 'M03_결승선', trigger='touch', show='체력시험_중')
    m.ev('cage1', 5, 9, 'M03_철창').ev('cage2', 13, 9, 'M03_철창')

    m = M['erisia_clinic']
    m.ev('doctor', 3, 4, sprite='npc_doctor', d='right', pages=[('진행 == 33', 'M03_혈액검사'), (None, 'M03_검사관_평소')])
    m.ev('machine', 2, 2, 'M03_측정기')

    m = M['noggria_port']
    m.ev('sailor', 15, 6, sprite='npc_sailor', d='down', show='진행 >= 40', pages=[('진행 == 40', 'M04_승선'), (None, 'M04_선원_항구')])
    m.ev('crates', 6, 11, 'M04_항구_조사')

    m = M['argo_deck']
    m.ev('deck_sailor', 16, 3, 'M04_선원_갑판', sprite='npc_sailor', d='down', show='진행 >= 41 && 진행 <= 43')
    for x in (8, 13, 18):
        m.ev(f'buoy{x}', x, 1, 'M04_부표')
    for i, x in enumerate((18, 19, 20)):
        m.ev(f'believer{i}', x, 4, 'M04_기도', sprite='npc_believer', d='up', show='진행 >= 44')

    m = M['argo_cabin']
    m.ev('beds', 4, 2, 'M04_선실_침대')

    m = M['mir_port']
    m.ev('mir_sailor', 13, 11, 'M04_선원_갑판', sprite='npc_sailor', d='up', show='진행 == 50')
    m.ev('boy', 16, 10, sprite='npc_boy', d='left', trigger='touch', show='진행 >= 50 && 진행 <= 51', pages=[('진행 == 51', 'M05_잡음')])
    m.ev('busstop', 4, 9, 'M05_정류장', show='진행 >= 52')
    m.ev('east_block1', 25, 7, 'M05_길막', trigger='touch', show='진행 < 52')
    m.ev('east_block2', 25, 8, 'M05_길막', trigger='touch', show='진행 < 52')

    m = M['mir_market']
    m.ev('auto', 0, 0, trigger='autorun', pages=[('진행 >= 52 && !보호비_봄', 'M05_보호비')])
    m.ev('merchant', 9, 7, 'M05_상인', sprite='npc_merchant', d='down')
    m.ev('collector1', 9, 8, 'M05_상인', sprite='npc_collector', d='up', show='!보호비_봄')
    m.ev('collector2', 10, 8, 'M05_상인', sprite='npc_collector', d='up', show='!보호비_봄')
    m.ev('vendor', 19, 13, 'M05_캡슐노점', sprite='npc_vendor', d='up')
    m.ev('unmarked1', 6, 9, 'M05_명찰없음', sprite='npc_unmarked', d='right', route=['right*3', 'wait 1', 'left*3', 'wait 1'])
    m.ev('unmarked2', 21, 10, 'M05_명찰없음', sprite='npc_unmarked', d='left', route=['left*2', 'wait 1.5', 'right*2', 'wait 1.5'])
    m.ev('sia_woman', 15, 9, 'M05_명찰없음', sprite='npc_sia_woman', d='down')
    m.ev('busstop', 25, 8, 'M05_정류장')

    m = M['mir_hammer']
    for x in (3, 7, 14, 18):
        m.ev(f'sign{x}', x, 5, 'M05_간판')
    m.ev('lebri_sign', 12, 5, 'M05_레브리간판')
    m.ev('smoke', 2, 7, 'M05_망치골목')

    m = M['mir_lebri']
    m.ev('auto', 0, 0, trigger='autorun', pages=[('진행 >= 52 && 진행 < 55', 'M05_레브리')])
    m.ev('rotte', 6, 5, 'M05_로테', sprite='npc_rotte', d='down')
    m.ev('hans_lebri', 11, 2, 'M05_한스_평소', sprite='hans', d='down', show='진행 >= 56')


if __name__ == '__main__':
    build()
