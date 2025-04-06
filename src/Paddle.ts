import * as THREE from 'three';
import { SimplePhysics, SimpleBody, createPaddle } from './fakePhysics';
import { GameObject } from './types';

export class Paddle implements GameObject {
  public mesh: THREE.Mesh;
  public body: SimpleBody;
  public size: { width: number; height: number; depth: number };
  private speed: number = 15; // Movement speed
  private boundaries: { min: number; max: number };
  private targetPosition: number = 0;
  private isLeftPressed: boolean = false;
  private isRightPressed: boolean = false;

  constructor(
    size: { width: number; height: number; depth: number },
    position: { x: number; y: number; z: number },
    physicsWorld: SimplePhysics,
    worldSize: number
  ) {
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
    this.mesh.position.set(position.x, position.y, position.z);

    // Create physics body
    this.body = createPaddle(size, position);
    this.targetPosition = position.x;

    // Add to physics world
    physicsWorld.addBody(this);

    // Store size
    this.size = size;

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

    // Get current position
    const position = this.body.translation();

    // Set new position
    this.body.setNextKinematicTranslation({
      x: this.targetPosition,
      y: position.y,
      z: position.z,
    });

    // Update mesh position to match physics body
    this.mesh.position.set(this.targetPosition, position.y, position.z);
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
    this.body.setTranslation({ x: position.x, y: position.y, z: position.z }, true);
    this.mesh.position.set(position.x, position.y, position.z);
    this.isLeftPressed = false;
    this.isRightPressed = false;
  }
}
