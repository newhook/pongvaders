import * as THREE from 'three';

export interface IGameState {
  update(deltaTime: number): void;
  onEnter(): void;
  onExit(): void;
  render(renderer: THREE.WebGLRenderer): void;
}
