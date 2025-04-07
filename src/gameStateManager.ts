import * as THREE from 'three';
import { IGameState } from './gameStates';
import { PlayState } from './playState';
import { SoundManager } from './soundManager';
import { PreMarquee } from './preMarquee';

export class GameStateManager {
  private currentState: IGameState;
  public soundManager?: SoundManager;
  public renderer: THREE.WebGLRenderer;

  constructor(renderer: THREE.WebGLRenderer) {
    this.currentState = new PreMarquee(this); // Set PreMarquee as the initial state
    this.currentState.onEnter();
    this.renderer = renderer;
  }

  initSoundManager(): SoundManager {
    if (this.soundManager) {
      return this.soundManager;
    }
    this.soundManager = new SoundManager();
    return this.soundManager;
  }

  switchToPlay(): void {
    if (this.currentState) {
      this.currentState.onExit();
    }
    this.currentState = new PlayState(this);
    this.currentState.onEnter();
  }

  getCurrentState(): IGameState {
    return this.currentState;
  }

  update(deltaTime: number): void {
    this.currentState.update(deltaTime);
  }

  render(): void {
    this.currentState.render(this.renderer);
  }
}
