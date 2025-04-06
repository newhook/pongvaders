import * as THREE from 'three';
import { IGameState } from './gameStates';
import { GameStateManager } from './gameStateManager';

interface MarqueeCamera {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  duration: number;
}

export class MarqueeState implements IGameState {
  private gameStateManager: GameStateManager;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private marqueeCameras: MarqueeCamera[];
  private currentMarqueeIndex: number = 0;
  private marqueeStartTime: number = 0;
  private titleScreen: HTMLDivElement;
  private keydownHandler: (event: KeyboardEvent) => void;
  private cameraUpdateInterval?: number;
  private resizeHandler: () => void;

  constructor(gameStateManager: GameStateManager) {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.createTitleScreen();
    this.gameStateManager = gameStateManager;
    this.marqueeCameras = [
      {
        position: new THREE.Vector3(0, 30, 0),
        lookAt: new THREE.Vector3(0, 0, 0),
        duration: 5000,
      },
      {
        position: new THREE.Vector3(50, 5, 50),
        lookAt: new THREE.Vector3(0, 2, 0),
        duration: 4000,
      },
      {
        position: new THREE.Vector3(-30, 3, 20),
        lookAt: new THREE.Vector3(0, 1, 0),
        duration: 4000,
      },
      {
        position: new THREE.Vector3(0, 1.5, -40),
        lookAt: new THREE.Vector3(0, 1.5, 0),
        duration: 4000,
      },
    ];

    // Optional: Add some visual effects to the scene during marquee mode
    const ambientLight = new THREE.AmbientLight(0x404040, 3.0); // Brighter lighting for showcase
    this.scene.add(ambientLight);

    // Set up camera with increased far plane and narrower FOV for first person view
    this.camera = new THREE.PerspectiveCamera(
      60, // Reduced FOV for more realistic first person view
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    // Initial position will be adjusted by updateCamera, these are just starting values
    this.camera.position.set(0, 1.5, 0);
    this.camera.lookAt(0, 1.5, 10);

    // Handle window resize
    this.resizeHandler = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', this.resizeHandler);

    // Create the keydown handler function that we'll need to remove later
    this.keydownHandler = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        this.gameStart();
        this.gameStateManager.switchToPlay();
      }
    };
  }

  update(deltaTime: number): void {
    // Scale camera movements based on deltaTime for consistent speed
    const movementScale = deltaTime * 1000;
    const currentTime = performance.now() * (movementScale / 1000);

    if (this.marqueeStartTime === 0) {
      this.marqueeStartTime = currentTime;
    }

    const current = this.marqueeCameras[this.currentMarqueeIndex];
    const next = this.marqueeCameras[(this.currentMarqueeIndex + 1) % this.marqueeCameras.length];
    const elapsedTime = currentTime - this.marqueeStartTime;

    if (elapsedTime >= current.duration) {
      this.currentMarqueeIndex = (this.currentMarqueeIndex + 1) % this.marqueeCameras.length;
      this.marqueeStartTime = currentTime;
      return;
    }

    const progress = elapsedTime / current.duration;
    const position = new THREE.Vector3().lerpVectors(current.position, next.position, progress);
    const lookAt = new THREE.Vector3().lerpVectors(current.lookAt, next.lookAt, progress);

    this.camera.position.copy(position);
    this.camera.lookAt(lookAt);
  }

  onEnter(): void {
    this.currentMarqueeIndex = 0;
    this.marqueeStartTime = 0;

    // Hide gameplay UI elements
    const scoreElement = document.getElementById('score');
    const fpsElement = document.getElementById('fps');
    const instructionsElement = document.getElementById('instructions');

    if (scoreElement) scoreElement.style.opacity = '0';
    if (fpsElement) fpsElement.style.opacity = '0';
    if (instructionsElement) {
      instructionsElement.style.display = 'none';
      instructionsElement.style.opacity = '0';
    }

    // Add event listener for space key
    document.addEventListener('keydown', this.keydownHandler);
  }

  gameStart(): void {
    this.titleScreen.style.opacity = '0';
    setTimeout(() => this.titleScreen.remove(), 1000);

    // Show the instructions element
    const instructions = document.getElementById('instructions');
    if (instructions) {
      instructions.style.display = 'block';
      instructions.style.opacity = '1';
    }

    // Show score and FPS
    const score = document.getElementById('score');
    const fps = document.getElementById('fps');
    if (score) score.style.opacity = '1';
    if (fps) fps.style.opacity = '1';
  }

  onExit(): void {
    // Remove event listeners to prevent memory leaks
    document.removeEventListener('keydown', this.keydownHandler);
    window.removeEventListener('resize', this.resizeHandler);

    // Remove the title screen if it still exists
    if (this.titleScreen && this.titleScreen.parentNode) {
      this.titleScreen.remove();
    }

    // Remove style element if it exists
    const titleStyle = document.getElementById('title-screen-styles');
    if (titleStyle) {
      titleStyle.remove();
    }

    // Clean up any camera movement intervals
    if (this.cameraUpdateInterval) {
      clearInterval(this.cameraUpdateInterval);
      this.cameraUpdateInterval = undefined;
    }

    // Remove any added ambient lights or other scene elements
    this.scene.children.forEach((child) => {
      if (
        child instanceof THREE.AmbientLight ||
        child instanceof THREE.DirectionalLight ||
        child instanceof THREE.PointLight
      ) {
        this.scene.remove(child);
      }
    });

    this.gameStateManager.soundManager.stopMarqueeMusic();
  }

  render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera);
  }

  createTitleScreen(): void {
    const titleScreen = document.createElement('div');
    titleScreen.id = 'title-screen';
    titleScreen.innerHTML = `
    <div class="title">BOILER</div>
    <div class="press-start">PRESS SPACE TO START</div>
  `;
    document.body.appendChild(titleScreen);

    // Add title screen styles
    const style = document.createElement('style');
    style.textContent = `
    #title-screen {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      color: #00ff00;
      font-family: monospace;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
    }
    .title {
      font-size: 48px;
      margin-bottom: 40px;
      text-shadow: 0 0 10px #00ff00;
    }
    .press-start {
      font-size: 24px;
      animation: blink 1s infinite;
    }
    .credits {
      position: absolute;
      bottom: 40px;
      text-align: center;
      font-size: 16px;
      line-height: 1.5;
    }
    @keyframes blink {
      50% { opacity: 0; }
    }
  `;
    document.head.appendChild(style);

    this.titleScreen = titleScreen;
  }
}
