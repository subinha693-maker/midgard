// 임시 타일 — 코드로 그린 48px 타일. 실제 타일셋이 정해지면 교체 (docs/asset_todo.md)
// 에리시아(근대 유럽풍 석조 거리)는 따뜻한 회색·붉은 지붕, 미르(덧댄 요새 도시)는 차가운 콘크리트·녹슨 철판.
import Phaser from 'phaser';
import { DISPLAY } from '../config/display';
import { SHEETS } from './sheets';

const T = DISPLAY.tile;

type Draw = (g: CanvasRenderingContext2D) => void;

function rnd(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
function fill(c: string): Draw {
  return (g) => {
    g.fillStyle = c;
    g.fillRect(0, 0, T, T);
  };
}
function bricks(base: string, mortar: string, bw = 16, bh = 12): Draw {
  return (g) => {
    fill(mortar)(g);
    g.fillStyle = base;
    for (let y = 0; y < T; y += bh)
      for (let x = -((y / bh) % 2) * (bw / 2); x < T; x += bw) g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
  };
}
function speckle(base: string, dot: string, n: number, seed: number): Draw {
  return (g) => {
    fill(base)(g);
    const r = rnd(seed);
    g.fillStyle = dot;
    for (let i = 0; i < n; i++) g.fillRect(Math.floor(r() * T), Math.floor(r() * T), 2, 2);
  };
}
function planks(base: string, line: string): Draw {
  return (g) => {
    fill(base)(g);
    g.fillStyle = line;
    for (let y = 0; y < T; y += 12) g.fillRect(0, y, T, 2);
    for (let y = 0; y < T; y += 12) g.fillRect(((y / 12) % 2) * 24 + 10, y, 2, 12);
  };
}
function topBorder(inner: Draw, edge: string): Draw {
  return (g) => {
    inner(g);
    g.fillStyle = edge;
    g.fillRect(0, T - 6, T, 6);
  };
}
function object(bg: Draw | null, draw: Draw): Draw {
  return (g) => {
    bg?.(g);
    draw(g);
  };
}

/** 타일 이름 → 그리기. 순서가 곧 타일 번호 */
export const TILE_DEFS: [string, Draw][] = [
  ['void', fill('#000000')],
  // 공통
  ['grass', speckle('#5d7a45', '#4b6638', 40, 3)],
  ['dirt', speckle('#8a7454', '#76623f', 30, 5)],
  ['water', (g) => {
    fill('#2f5a78')(g);
    g.fillStyle = '#4a7a9a';
    for (let y = 6; y < T; y += 12) g.fillRect(((y / 6) % 3) * 8, y, 18, 2);
  }],
  ['water_deep', (g) => {
    fill('#1d3a52')(g);
    g.fillStyle = '#2b4f6a';
    for (let y = 6; y < T; y += 14) g.fillRect(((y / 7) % 3) * 10, y, 14, 2);
  }],
  ['fog', fill('#9aa3a8')],
  // 에리시아: 석조
  ['stone_road', bricks('#a39a8a', '#7d7568', 24, 16)],
  ['stone_floor', bricks('#b9b2a4', '#958d80', 24, 24)],
  ['stone_wall', topBorder(bricks('#c8bfae', '#8f8676'), '#6d665a')],
  ['brick_wall', topBorder(bricks('#9a5a46', '#6b3c2f'), '#4f2c22')],
  ['roof_red', (g) => {
    fill('#8a3b2e')(g);
    g.fillStyle = '#6e2d23';
    for (let y = 0; y < T; y += 8) g.fillRect(0, y, T, 2);
  }],
  ['wood_floor', planks('#9b7650', '#7c5c3c')],
  ['rug', (g) => {
    fill('#7a3940')(g);
    g.strokeStyle = '#c9a25c';
    g.lineWidth = 3;
    g.strokeRect(5, 5, T - 10, T - 10);
  }],
  ['plaster_wall', topBorder(fill('#e3d9c4'), '#b5a98f')],
  // 미르: 덧댄 요새 도시
  ['concrete', speckle('#8c9094', '#787c80', 50, 7)],
  ['concrete_wall', topBorder(speckle('#7a7f84', '#666a6e', 40, 9), '#4c5054')],
  ['iron_plate', (g) => {
    fill('#5d6166')(g);
    g.fillStyle = '#8a5a3a';
    g.fillRect(4, 30, 10, 6);
    g.fillStyle = '#44484c';
    g.fillRect(0, 23, T, 2);
    g.fillStyle = '#9aa0a6';
    [6, 42].forEach((x) => [6, 42].forEach((y) => g.fillRect(x, y, 2, 2)));
  }],
  ['bars', (g) => {
    fill('#3d4246')(g);
    g.fillStyle = '#868c92';
    for (let x = 4; x < T; x += 10) g.fillRect(x, 0, 3, T);
  }],
  ['dock_wood', planks('#7a6650', '#5a4a38')],
  // 물체 (투명 배경 위)
  ['table', object(null, (g) => {
    g.fillStyle = '#6b4a2e';
    g.fillRect(3, 10, T - 6, 26);
    g.fillStyle = '#8a6440';
    g.fillRect(3, 10, T - 6, 6);
    g.fillStyle = '#4a321e';
    g.fillRect(6, 36, 4, 10);
    g.fillRect(T - 10, 36, 4, 10);
  })],
  ['bed', object(null, (g) => {
    g.fillStyle = '#5a3f2a';
    g.fillRect(4, 2, T - 8, T - 4);
    g.fillStyle = '#e9e4d8';
    g.fillRect(8, 6, T - 16, 14);
    g.fillStyle = '#5b7a9a';
    g.fillRect(8, 20, T - 16, T - 26);
  })],
  ['shelf', object(null, (g) => {
    g.fillStyle = '#5a3f2a';
    g.fillRect(4, 2, T - 8, T - 4);
    g.fillStyle = '#3a2a1c';
    [12, 26, 40].forEach((y) => g.fillRect(6, y, T - 12, 2));
    g.fillStyle = '#c9b48a';
    g.fillRect(10, 5, 6, 7);
    g.fillRect(22, 19, 8, 7);
  })],
  ['door', object(null, (g) => {
    g.fillStyle = '#4e3522';
    g.fillRect(8, 0, T - 16, T);
    g.fillStyle = '#c9a25c';
    g.fillRect(T - 16, 24, 3, 3);
  })],
  ['crate', object(null, (g) => {
    g.fillStyle = '#8a6a44';
    g.fillRect(6, 8, T - 12, T - 12);
    g.strokeStyle = '#5a4428';
    g.lineWidth = 3;
    g.strokeRect(6, 8, T - 12, T - 12);
    g.beginPath();
    g.moveTo(6, 8);
    g.lineTo(T - 6, T - 4);
    g.stroke();
  })],
  ['lamp', object(null, (g) => {
    g.fillStyle = '#2f2f33';
    g.fillRect(22, 10, 4, T - 10);
    g.fillStyle = '#e8d27a';
    g.fillRect(16, 2, 16, 10);
  })],
  ['poster', object(null, (g) => {
    g.fillStyle = '#e8dcc0';
    g.fillRect(10, 6, 28, 30);
    g.fillStyle = '#a03a3a';
    g.fillRect(14, 10, 20, 6);
    g.fillStyle = '#555';
    for (let y = 20; y < 34; y += 4) g.fillRect(14, y, 20, 2);
  })],
  ['tree', object(null, (g) => {
    g.fillStyle = '#5a3f2a';
    g.fillRect(20, 30, 8, 18);
    g.fillStyle = '#3e5e34';
    g.beginPath();
    g.arc(24, 20, 18, 0, Math.PI * 2);
    g.fill();
  })],
  ['sign', object(null, (g) => {
    g.fillStyle = '#4a321e';
    g.fillRect(22, 24, 4, 24);
    g.fillStyle = '#8a6440';
    g.fillRect(8, 8, 32, 18);
  })],
  // ── P4 추가: 에리시아 (근대 유럽풍 석조 거리) ──
  ['cobble', (g) => {
    fill('#9c9384')(g);
    const r = rnd(11);
    for (let y = 0; y < T; y += 8)
      for (let x = (y / 8) % 2 ? -4 : 0; x < T; x += 8) {
        const v = 140 + Math.floor(r() * 30);
        g.fillStyle = `rgb(${v},${v - 8},${v - 20})`;
        g.fillRect(x + 1, y + 1, 6, 6);
      }
  }],
  ['facade', topBorder(bricks('#cfc4ae', '#a89d88', 24, 12), '#8f8573')],
  ['facade_window', (g) => {
    bricks('#cfc4ae', '#a89d88', 24, 12)(g);
    g.fillStyle = '#5a4a3a';
    g.fillRect(12, 8, 24, 30);
    g.fillStyle = '#7fa3b8';
    g.fillRect(15, 11, 8, 11);
    g.fillRect(25, 11, 8, 11);
    g.fillRect(15, 24, 8, 11);
    g.fillRect(25, 24, 8, 11);
  }],
  ['facade_door', (g) => {
    bricks('#cfc4ae', '#a89d88', 24, 12)(g);
    g.fillStyle = '#4e3522';
    g.fillRect(10, 6, 28, 42);
    g.fillStyle = '#6b4a2e';
    g.fillRect(13, 9, 10, 36);
    g.fillRect(25, 9, 10, 36);
    g.fillStyle = '#c9a25c';
    g.fillRect(22, 28, 4, 4);
  }],
  ['facade_shop', (g) => {
    bricks('#cfc4ae', '#a89d88', 24, 12)(g);
    g.fillStyle = '#7a3940';
    g.fillRect(0, 2, T, 10);
    g.fillStyle = '#e9e4d8';
    for (let x = 0; x < T; x += 12) g.fillRect(x, 2, 6, 10);
    g.fillStyle = '#8fb3c8';
    g.fillRect(6, 18, 36, 24);
  }],
  ['roof_slate', (g) => {
    fill('#4f5a6a')(g);
    g.fillStyle = '#3d4655';
    for (let y = 0; y < T; y += 8) for (let x = (y / 8) % 2 ? -6 : 0; x < T; x += 12) g.fillRect(x, y, 11, 7);
  }],
  ['speaker_post', (g) => {
    g.fillStyle = '#2f2f33';
    g.fillRect(22, 8, 4, 40);
    g.fillStyle = '#8a8f96';
    g.beginPath();
    g.moveTo(26, 6); g.lineTo(42, 0); g.lineTo(42, 18); g.lineTo(26, 12); g.fill();
    g.fillStyle = '#e8d27a';
    g.fillRect(14, 20, 20, 6);
  }],
  ['iron_fence', (g) => {
    g.fillStyle = '#2b2d33';
    g.fillRect(0, 30, T, 3);
    g.fillRect(0, 42, T, 3);
    for (let x = 2; x < T; x += 8) g.fillRect(x, 24, 3, 24);
  }],
  ['bench', (g) => {
    g.fillStyle = '#6b4a2e';
    g.fillRect(4, 22, 40, 8);
    g.fillRect(4, 12, 40, 6);
    g.fillStyle = '#2f2f33';
    g.fillRect(6, 30, 3, 14);
    g.fillRect(39, 30, 3, 14);
  }],
  ['flowerbed', (g) => {
    fill('#5a3f2a')(g);
    const r = rnd(5);
    for (let i = 0; i < 18; i++) {
      g.fillStyle = ['#c94a4a', '#e8d27a', '#e9e4d8', '#5d7a45'][i % 4];
      g.fillRect(4 + Math.floor(r() * 38), 4 + Math.floor(r() * 38), 5, 5);
    }
  }],
  ['stairs', (g) => {
    fill('#6b4a2e')(g);
    g.fillStyle = '#8a6440';
    for (let y = 0; y < T; y += 8) g.fillRect(0, y, T, 5);
  }],
  // ── 미르 (덧댄 요새 도시: 콘크리트·철판·철창) ──
  ['patched_wall', (g) => {
    speckle('#7a7f84', '#666a6e', 40, 21)(g);
    g.fillStyle = '#5d6166';
    g.fillRect(4, 6, 20, 16);
    g.fillStyle = '#8a5a3a';
    g.fillRect(28, 26, 16, 14);
    g.fillStyle = '#9aa0a6';
    [[5, 7], [22, 7], [5, 20], [22, 20], [29, 27], [42, 27], [29, 38], [42, 38]].forEach(([x, y]) => g.fillRect(x, y, 2, 2));
    g.fillStyle = '#4c5054';
    g.fillRect(0, T - 6, T, 6);
  }],
  ['barred_window', (g) => {
    speckle('#7a7f84', '#666a6e', 30, 23)(g);
    g.fillStyle = '#2a2f36';
    g.fillRect(10, 8, 28, 26);
    g.fillStyle = '#c9b46a';
    g.fillRect(12, 10, 24, 22);
    g.fillStyle = '#3d4246';
    for (let x = 12; x < 38; x += 6) g.fillRect(x, 8, 2, 26);
    g.fillStyle = '#4c5054';
    g.fillRect(0, T - 6, T, 6);
  }],
  ['sea_wall', (g) => {
    fill('#6a6e72')(g);
    g.fillStyle = '#585c60';
    for (let y = 0; y < T; y += 16) g.fillRect(0, y, T, 2);
    g.fillStyle = '#7b4a32';
    g.fillRect(30, 4, 3, 30);
  }],
  ['siren', (g) => {
    g.fillStyle = '#3d4246';
    g.fillRect(22, 20, 4, 28);
    g.fillStyle = '#b8bec4';
    g.beginPath();
    g.arc(24, 16, 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3d4246';
    g.fillRect(14, 14, 20, 4);
  }],
  ['laundry', (g) => {
    g.strokeStyle = '#2f2f33';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, 6); g.lineTo(T, 10); g.stroke();
    ['#c94a4a', '#e9e4d8', '#5b7a9a'].forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(4 + i * 15, 7 + i, 10, 14);
    });
  }],
  ['tent_red', (g) => {
    for (let x = 0; x < T; x += 12) {
      g.fillStyle = (x / 12) % 2 ? '#e9e4d8' : '#a8423c';
      g.fillRect(x, 0, 12, T - 8);
    }
    g.fillStyle = '#5a3f2a';
    g.fillRect(0, T - 8, T, 8);
  }],
  ['tent_blue', (g) => {
    for (let x = 0; x < T; x += 12) {
      g.fillStyle = (x / 12) % 2 ? '#e9e4d8' : '#3c5a8a';
      g.fillRect(x, 0, 12, T - 8);
    }
    g.fillStyle = '#5a3f2a';
    g.fillRect(0, T - 8, T, 8);
  }],
  ['stall', (g) => {
    g.fillStyle = '#6b4a2e';
    g.fillRect(2, 16, 44, 28);
    g.fillStyle = '#8a6440';
    g.fillRect(2, 16, 44, 6);
    const r = rnd(31);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = ['#e8d27a', '#c94a4a', '#5d7a45', '#d8a060'][i % 4];
      g.fillRect(6 + Math.floor(r() * 32), 8 + Math.floor(r() * 8), 6, 6);
    }
  }],
  ['barrel', (g) => {
    g.fillStyle = '#6b4a2e';
    g.fillRect(12, 10, 24, 34);
    g.fillStyle = '#3d4246';
    g.fillRect(12, 16, 24, 3);
    g.fillRect(12, 36, 24, 3);
  }],
  ['rubble', speckle('#8c9094', '#5d6166', 120, 41)],
  ['bus_stop', (g) => {
    g.fillStyle = '#2f2f33';
    g.fillRect(22, 14, 4, 34);
    g.fillStyle = '#d8b04a';
    g.fillRect(12, 2, 24, 16);
    g.fillStyle = '#2f2f33';
    g.fillRect(16, 6, 16, 3);
    g.fillRect(16, 11, 10, 3);
  }],
  // ── 배·바다 ──
  ['deck', planks('#c9b08a', '#a8906c')],
  ['hull', (g) => {
    fill('#e9e9e4')(g);
    g.fillStyle = '#b8bcc0';
    g.fillRect(0, 36, T, 4);
    g.fillStyle = '#2f5a78';
    g.fillRect(0, 42, T, 6);
  }],
  ['rail', (g) => {
    g.fillStyle = '#e9e9e4';
    g.fillRect(0, 10, T, 4);
    g.fillRect(0, 26, T, 3);
    for (let x = 4; x < T; x += 12) g.fillRect(x, 10, 3, 30);
  }],
  ['mast', (g) => {
    g.fillStyle = '#6b4a2e';
    g.fillRect(19, 0, 10, T);
    g.fillStyle = '#4e3522';
    g.fillRect(26, 0, 3, T);
  }],
  ['buoy', (g) => {
    fill('#1d3a52')(g);
    g.fillStyle = '#e8c64a';
    g.beginPath();
    g.arc(24, 26, 10, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f2f2f2';
    g.fillRect(22, 10, 4, 10);
  }],
  ['boat', planks('#7a5a3a', '#5a4028')],
  ['gangway', planks('#9a9a92', '#7a7a72')],
  ['cage', (g) => {
    fill('#3d4246')(g);
    g.fillStyle = '#8a8f96';
    for (let x = 3; x < T; x += 9) g.fillRect(x, 0, 3, T);
    g.fillRect(0, 2, T, 3);
    g.fillRect(0, T - 5, T, 3);
  }],
  ['start_line', (g) => {
    fill('#8a7454')(g);
    for (let x = 0; x < T; x += 12) {
      g.fillStyle = (x / 12) % 2 ? '#111' : '#eee';
      g.fillRect(x, 18, 12, 12);
    }
  }],
  ['hurdle', (g) => {
    g.fillStyle = '#e9e4d8';
    g.fillRect(4, 18, 40, 6);
    g.fillStyle = '#c94a4a';
    g.fillRect(4, 18, 8, 6);
    g.fillRect(28, 18, 8, 6);
    g.fillStyle = '#5a5a5a';
    g.fillRect(6, 24, 3, 20);
    g.fillRect(39, 24, 3, 20);
  }],
];

export const TILE_INDEX: Record<string, number> = Object.fromEntries(TILE_DEFS.map(([n], i) => [n, i]));

/**
 * 타일 텍스처 'tiles' 생성. 코드로 그린 타일 뒤에, 맵이 쓰는 외부 시트 칸("rb:1,13")을 잘라 덧붙인다.
 */
export function buildTiles(scene: Phaser.Scene, sheetRefs: string[] = []): void {
  if (scene.textures.exists('tiles')) return;
  const refs = [...new Set(sheetRefs)].filter((r) => {
    const [k] = r.split(':');
    return scene.textures.exists('sheet:' + k);
  });
  const cols = 8;
  const rows = Math.ceil((TILE_DEFS.length + refs.length) / cols);
  const c = document.createElement('canvas');
  c.width = cols * T;
  c.height = rows * T;
  const g = c.getContext('2d')!;
  TILE_DEFS.forEach(([, draw], i) => {
    g.save();
    g.translate((i % cols) * T, Math.floor(i / cols) * T);
    g.beginPath();
    g.rect(0, 0, T, T);
    g.clip();
    draw(g);
    g.restore();
  });
  refs.forEach((ref, j) => {
    const i = TILE_DEFS.length + j;
    const [k, cr] = ref.split(':');
    const [col, row] = cr.split(',').map(Number);
    const sh = SHEETS[k];
    const img = scene.textures.get('sheet:' + k).getSourceImage() as HTMLImageElement;
    g.imageSmoothingEnabled = false;
    g.drawImage(img, col * sh.tile, row * sh.tile, sh.tile, sh.tile, (i % cols) * T, Math.floor(i / cols) * T, T, T);
    TILE_INDEX[ref] = i;
  });
  scene.textures.addCanvas('tiles', c);
}
