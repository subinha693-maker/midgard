import Phaser from 'phaser';
import { DISPLAY } from '../config/display';
import { NEW_GAME } from '../config/game';
import { DEBUG } from '../core/debug';
import { hasAnySave } from '../core/save';
import { game, newState } from '../core/state';
import { button, COLORS, SERIF } from '../ui/widgets';

// 타이틀 화면
export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create(): void {
    const { width: W, height: H } = DISPLAY;
    this.cameras.main.fadeIn(400);
    this.add.text(W / 2, H * 0.32, '미드가르드', { fontFamily: SERIF, fontSize: '68px', color: '#e8e2d0' }).setOrigin(0.5);
    this.add.text(W / 2, H * 0.32 + 62, '챕터 1 · 프롤로그', { fontFamily: SERIF, fontSize: '22px', color: COLORS.dim }).setOrigin(0.5);

    const bw = 300;
    this.add.existing(button(this, (W - bw) / 2, H * 0.58, bw, 66, '새 게임', () => this.newGame(), 26));
    const cont = button(this, (W - bw) / 2, H * 0.58 + 84, bw, 66, '이어하기', () => this.openLoad(), 26);
    cont.setEnabled(hasAnySave());
    this.add.existing(cont);
    if (DEBUG) this.add.text(10, H - 30, '개발 모드 (?debug=1)', { fontSize: '16px', color: '#666' });
  }

  private newGame(): void {
    game.state = newState();
    const s = game.state;
    s.map = { id: NEW_GAME.map, x: NEW_GAME.x, y: NEW_GAME.y, dir: NEW_GAME.dir };
    s.playerSprite = NEW_GAME.sprite;
    s.money = NEW_GAME.money;
    this.cameras.main.fadeOut(300);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Field', { label: NEW_GAME.label }));
  }

  private openLoad(): void {
    this.scene.launch('Menu', { fromTitle: true, page: 'load' });
    this.scene.bringToTop('Menu');
  }
}
