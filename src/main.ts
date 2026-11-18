import Phaser from 'phaser';
import { DISPLAY } from './config/display';
import { DEBUG } from './core/debug';
import { game } from './core/state';
import { mountDevPanel } from './core/devpanel';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { CGScene } from './scenes/CGScene';
import { DialogueScene } from './scenes/DialogueScene';
import { FieldScene } from './scenes/FieldScene';
import { HudScene } from './scenes/HudScene';
import { LetterScene } from './scenes/LetterScene';
import { MenuScene } from './scenes/MenuScene';
import { TitleScene } from './scenes/TitleScene';

const phaserGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: DISPLAY.width,
  height: DISPLAY.height,
  backgroundColor: DISPLAY.backgroundColor,
  pixelArt: true, // 도트가 뭉개지지 않게
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 },
  scene: [BootScene, TitleScene, FieldScene, HudScene, CGScene, DialogueScene, LetterScene, BattleScene, MenuScene],
});

if (DEBUG) {
  mountDevPanel();
  (window as unknown as { __game: Phaser.Game }).__game = phaserGame;
  (window as unknown as { __state: () => unknown }).__state = () => game.state;
}
