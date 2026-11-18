# 맵 형식 (`data/maps/*.json`)

파일 이름이 맵 id 다 (`test.json` → `test`). 1칸 = 48px.

```json
{
  "name": "에리시아 · 집",
  "indoor": true,
  "legend": {
    "#": { "tile": "stone_wall", "block": true },
    ".": "wood_floor",
    "T": { "tile": "table", "block": true },
    "L": { "tile": "lamp", "block": true, "above": true }
  },
  "ground": ["#####", "#...#", "#####"],
  "objects": ["     ", "  T  ", "     "],
  "events": [ … ]
}
```

- `ground`: 바닥 레이어. 모든 칸에 legend 문자가 있어야 한다.
- `objects`: 바닥 위 물체 레이어 (선택). 빈칸(공백)은 없음.
- legend 값이 문자열이면 타일 이름만, 객체면 `block`(통행 불가), `above`(캐릭터보다 위에 그림).
- `indoor: true` 면 시간대 색조를 적용하지 않는다.
- `hospital: { "map": "id", "x": 3, "y": 4 }` 이 맵 근처에서 전투에 지면 깨어날 병원 (없으면 그 자리)
- 타일 이름은 `src/core/tiles.ts` 의 코드 타일 이름, 또는 외부 시트 칸 `"시트:열,행"` (예: `"rb:1,13"` = Modern Interiors Room Builder 의 1열 13행). 시트는 `src/core/sheets.ts`.
- `props`: 여러 칸짜리 소품 `{ "prop": "bed_white", "x": 2, "y": 2 }` — 이름은 `data/props.json` (시트 픽셀 영역, 차지하는 칸, `flat` 바닥 깔개, `wall` 벽 장식, `counter` 계산대: 너머 사람에게 말 걸기).
- 챕터 1 맵은 `tools/maps/build_maps.py` 로 만든다 (스크립트를 다시 돌리면 덮어씀).

## 이벤트

```json
{ "id": "anan", "x": 3, "y": 2, "sprite": "anan", "dir": "down",
  "trigger": "talk",
  "pages": [ { "if": "아침_끝", "label": "M01_아난2" }, { "label": "M01_아난" } ],
  "show": "!아난_떠남",
  "route": ["left*2", "wait 1", "right*2", "face down"], "routeLoop": true }
```

| 항목 | 설명 |
| --- | --- |
| `trigger` | `talk` 마주 보고 조사 / `touch` 밟거나 부딪힘 / `autorun` 맵에 들어오면 자동(원고에서 플래그를 바꿔 멈춰야 함) / `parallel` 뒤에서 계속 |
| `pages` | 위에서부터 `if` 가 참인 첫 페이지의 라벨을 실행. 하나뿐이면 `"label": "…"` 로 줄여 씀 |
| `show` | 이 조건이 참일 때만 나타남 |
| `sprite` | 걸음 도트 시트 키. 없으면 보이지 않는 조사 지점 |
| `through` | 도트가 있어도 통과 가능 |
| `route` | NPC 이동: `left`/`위` 같은 방향, `up*3`, `wait 1`, `face down`, `random` |
| `transfer` | `{ "map": "id", "x": 1, "y": 5, "dir": "right" }` 밟으면 맵 이동 |

맵을 옮길 때마다 자동 저장된다.
