import * as THREE from 'three';
import { GameObject } from './types';
import { PlayState } from './playState';

export class Paddle implements GameObject {
  private game: PlayState;
  public mesh: THREE.Mesh;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public size: { width: number; height: number; depth: number };

  private speed: number = 15; // Movement speed
  private boundaries: { min: number; max: number };
  private targetPosition: number = 0;
  private isLeftPressed: boolean = false;
  private isRightPressed: boolean = false;

  constructor(
    game: PlayState,
    size: { width: number; height: number; depth: number },
    position: { x: number; y: number; z: number },
    worldSize: number
  ) {
    this.game = game;
    this.size = size;

    // Create position and velocity vectors
    this.position = new THREE.Vector3(position.x, position.y, position.z);
    this.velocity = new THREE.Vector3(0, 0, 0);

    // Create paddle geometry - wider than tall
    const geometry = new THREE.BoxGeometry(size.width, size.height, size.depth);

    // Create paddle material - with a neon blue glow effect
    const material = new THREE.MeshStandardMaterial({
      color: 0x00aaff,
      emissive: 0x0066cc,
      emissiveIntensity: 0.5,
      metalness: 0.8,
      roughness: 0.2,
    });

    // Create mesh
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.position.copy(this.position);

    this.targetPosition = position.x;

    // Set movement boundaries based on world size
    this.boundaries = {
      min: -worldSize / 2 + size.width / 2,
      max: worldSize / 2 - size.width / 2,
    };

    // Set up keyboard event listeners
    this.setupEventListeners();
  }

  update(deltaTime: number): void {
    // Calculate target position based on input
    if (this.isLeftPressed) {
      this.targetPosition -= this.speed * deltaTime;
    }
    if (this.isRightPressed) {
      this.targetPosition += this.speed * deltaTime;
    }

    // Ensure paddle stays within boundaries
    this.targetPosition = Math.max(
      this.boundaries.min,
      Math.min(this.targetPosition, this.boundaries.max)
    );

    // Set new position
    this.position.x = this.targetPosition;

    // Update mesh position
    this.mesh.position.copy(this.position);
  }

  private setupEventListeners(): void {
    // Add keyboard event listeners
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    window.addEventListener('keyup', this.handleKeyUp.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.isLeftPressed = true;
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.isRightPressed = true;
        break;
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.isLeftPressed = false;
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.isRightPressed = false;
        break;
    }
  }

  removeEventListeners(): void {
    window.removeEventListener('keydown', this.handleKeyDown.bind(this));
    window.removeEventListener('keyup', this.handleKeyUp.bind(this));
  }

  // Reset paddle to starting position
  reset(position: { x: number; y: number; z: number }): void {
    this.targetPosition = position.x;
    this.position.set(position.x, position.y, position.z);
    this.mesh.position.copy(this.position);

    this.isLeftPressed = false;
    this.isRightPressed = false;
  }

  // Clean up resources
  dispose(): void {
    this.removeEventListeners();

    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }

    if (this.mesh.geometry) {
      this.mesh.geometry.dispose();
    }

    if (this.mesh.material instanceof THREE.Material) {
      this.mesh.material.dispose();
    }
  }
}
