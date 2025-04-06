import * as THREE from 'three';
import { IGameState } from './gameStates';
import { GameStateManager } from './gameStateManager';

export class PreMarquee implements IGameState {
  private gameStateManager: GameStateManager;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private keydownListener: (event: KeyboardEvent) => void;
  private clickListener: () => void;

  constructor(gameStateManager: GameStateManager) {
    this.gameStateManager = gameStateManager;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    this.camera.position.set(0, 1.5, 5);
    this.camera.lookAt(0, 1.5, 0);

    // Add a welcome message
    const welcomeElement = document.createElement('div');
    welcomeElement.id = 'welcome';
    welcomeElement.style.position = 'absolute';
    welcomeElement.style.top = '50%';
    welcomeElement.style.left = '50%';
    welcomeElement.style.transform = 'translate(-50%, -50%)';
    welcomeElement.style.color = '#00ff00';
    welcomeElement.style.fontFamily = 'monospace';
    welcomeElement.style.fontSize = '24px';
    welcomeElement.style.textAlign = 'center';
    welcomeElement.style.zIndex = '1000'; // Ensure it appears on top
    welcomeElement.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.7)'; // Add shadow for better visibility
    welcomeElement.innerHTML = 'Welcome to BOILER!<br>Press space or click to enter the game';

    document.body.appendChild(welcomeElement);

    // Create event listener for space key
    this.keydownListener = async (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        await this.startGame();
      }
    };

    // Create event listener for click
    this.clickListener = async () => {
      await this.startGame();
    };

    // Add both event listeners
    document.addEventListener('keydown', this.keydownListener);
    document.addEventListener('click', this.clickListener);
  }

  private async startGame() {
    // Remove event listeners to prevent multiple triggers
    document.removeEventListener('keydown', this.keydownListener);
    document.removeEventListener('click', this.clickListener);

    const soundManager = this.gameStateManager.initSoundManager();
    await soundManager.startAudioContext();
    await soundManager.loadMarqueeMusic();
    this.startMarquee();
  }

  private startMarquee() {
    const welcomeElement = document.getElementById('welcome');
    if (welcomeElement) {
      welcomeElement.remove();
    }
    this.gameStateManager.switchToMarquee();
  }

  update(deltaTime: number): void {
    // No updates needed for the pre-marquee state
  }

  onEnter(): void {}

  onExit(): void {
    // Clean up by removing event listeners if they weren't removed already
    document.removeEventListener('keydown', this.keydownListener);
    document.removeEventListener('click', this.clickListener);
    const soundManager = this.gameStateManager.initSoundManager();
    soundManager.stopMarqueeMusic();
  }

  render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera);
  }
}
