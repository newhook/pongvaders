import * as THREE from 'three';
import { GameObject } from './types';
import { PlayState } from './playState';

// Import the debug flag
const DEBUG_COLLISION_BOUNDARIES = false; // This will be overridden by the value in playState.ts

export class Ball implements GameObject {
  private game: PlayState;
  public mesh: THREE.Mesh;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public size: { radius: number };

  // Flag to track if the ball is attached to the paddle
  public isAttachedToPaddle: boolean = true;

  // Add collision debug helper
  public collisionHelper: THREE.Mesh | null = null;

  private radius: number;
  private initialVelocity: { x: number; y: number; z: number };
  private maxSpeed: number = 20;
  private trailParticles: THREE.Points[] = [];
  private scene: THREE.Scene;
  private trailLifetime: number = 0.5; // Trail lifetime in seconds
  private trailInterval: number = 0.05; // Time between trail particles
  private lastTrailTime: number = 0;

  constructor(
    game: PlayState,
    radius: number,
    position: { x: number; y: number; z: number },
    scene: THREE.Scene
  ) {
    this.game = game;
    this.radius = radius;
    this.scene = scene;
    this.size = { radius };

    // Create position and velocity vectors
    this.position = new THREE.Vector3(position.x, position.y, position.z);
    this.velocity = new THREE.Vector3(0, 0, 0);

    // Create ball geometry
    const geometry = new THREE.SphereGeometry(radius, 24, 16);

    // Create material with glowing effect
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x88aaff,
      emissiveIntensity: 0.8,
      metalness: 0.5,
      roughness: 0.2,
    });

    // Create mesh
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.position.copy(this.position);

    // Save initial velocity for resets
    this.initialVelocity = {
      x: (Math.random() * 2 - 1) * 5, // Random X direction
      y: -8, // Always start moving down
      z: 0, // No Z velocity initially
    };

    // Don't apply initial velocity when creating the ball
    // This will be applied when the ball is released from the paddle

    // Add point light to ball for glow effect
    const light = new THREE.PointLight(0x88aaff, 1, 10);
    light.position.set(0, 0, 0);
    this.mesh.add(light);

    // Create a larger, transparent sphere for glow effect
    const glowGeometry = new THREE.SphereGeometry(radius * 1.5, 24, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x88aaff,
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide,
    });

    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    this.mesh.add(glowMesh);

    // Add debug collision helper if debug mode is enabled
    if (DEBUG_COLLISION_BOUNDARIES) {
      this.createCollisionHelper();
    }
  }

  // Create a wireframe sphere to visualize the collision boundary
  public createCollisionHelper(): void {
    if (!this.scene) return;
    if (this.collisionHelper) {
      return;
    }

    const helperGeometry = new THREE.SphereGeometry(this.radius, 16, 8);
    const helperMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      wireframe: true,
    });

    this.collisionHelper = new THREE.Mesh(helperGeometry, helperMaterial);
    this.scene.add(this.collisionHelper);
  }

  public removeCollisionHelper(): void {
    // Remove ball helpers
    if (this.collisionHelper) {
      this.scene.remove(this.collisionHelper);
      if (this.collisionHelper.geometry) this.collisionHelper.geometry.dispose();
      if (this.collisionHelper.material instanceof THREE.Material) {
        this.collisionHelper.material.dispose();
      }
      this.collisionHelper = null;
    }
  }

  update(deltaTime: number): void {
    // If attached to paddle, don't update physics
    if (this.isAttachedToPaddle) {
      return;
    }
    // Update position based on velocity
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;
    this.position.z += this.velocity.z * deltaTime;

    // Update mesh position from physics body
    this.mesh.position.copy(this.position);

    // Update collision helper position
    if (this.collisionHelper) {
      this.collisionHelper.position.copy(this.position);
    }

    // Create trail effect
    this.updateTrail(deltaTime);

    // Enforce maximum speed
    this.enforceMaxSpeed();

    // Ensure ball has some Y velocity to prevent horizontal stalemates
    this.preventHorizontalStalemate();
  }

  // Attach the ball to a specific position (usually on top of the paddle)
  attachToPaddle(
    paddlePosition: THREE.Vector3,
    paddleSize: { width: number; height: number; depth: number }
  ): void {
    this.isAttachedToPaddle = true;

    // Position the ball on top of the paddle
    const ballY = paddlePosition.y + paddleSize.height / 2 + this.radius;
    this.position.set(paddlePosition.x, ballY, paddlePosition.z);
    this.mesh.position.copy(this.position);

    // Zero out velocity while attached
    this.velocity.set(0, 0, 0);

    // Clear trail particles
    this.clearTrail();
  }

  // Release the ball from the paddle with initial velocity
  releaseBall(): void {
    if (!this.isAttachedToPaddle) return;

    this.isAttachedToPaddle = false;

    // Apply initial velocity upward with random x direction
    const releaseVelocity = {
      x: (Math.random() * 2 - 1) * 5, // Random X direction
      y: 8, // Always start moving up
      z: 0, // No Z velocity initially
    };

    this.applyVelocity(releaseVelocity);
  }

  private updateTrail(deltaTime: number): void {
    // Don't create trail when attached to paddle
    if (this.isAttachedToPaddle) return;

    const now = performance.now() / 1000;

    // Add new trail particle at intervals
    if (now - this.lastTrailTime > this.trailInterval) {
      this.lastTrailTime = now;
      this.addTrailParticle();
    }

    // Update existing trail particles
    this.trailParticles.forEach((particle, index) => {
      const age = now - particle.userData.creationTime;
      const lifeRatio = age / this.trailLifetime;

      // Update opacity based on age
      if (particle.material instanceof THREE.PointsMaterial) {
        particle.material.opacity = 1 - lifeRatio;
      }

      // Remove if too old
      if (age > this.trailLifetime) {
        if (this.scene) {
          this.scene.remove(particle);
          if (particle.material instanceof THREE.Material) {
            particle.material.dispose();
          }
          if (particle.geometry) {
            particle.geometry.dispose();
          }
        }
        this.trailParticles.splice(index, 1);
      }
    });
  }

  private addTrailParticle(): void {
    if (!this.scene) return;

    // Create particle geometry
    const geometry = new THREE.BufferGeometry();
    const posArray = new Float32Array(3);
    posArray[0] = this.position.x;
    posArray[1] = this.position.y;
    posArray[2] = this.position.z;

    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    // Create material
    const material = new THREE.PointsMaterial({
      color: 0x88aaff,
      size: this.radius * 1.8,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });

    // Create particle
    const particle = new THREE.Points(geometry, material);
    particle.userData.creationTime = performance.now() / 1000;

    // Add to scene and trail array
    this.scene.add(particle);
    this.trailParticles.push(particle);
  }

  private enforceMaxSpeed(): void {
    const speed = Math.sqrt(
      this.velocity.x * this.velocity.x +
        this.velocity.y * this.velocity.y +
        this.velocity.z * this.velocity.z
    );

    if (speed > this.maxSpeed) {
      // Scale down velocity to max speed
      const scale = this.maxSpeed / speed;
      this.velocity.x *= scale;
      this.velocity.y *= scale;
      this.velocity.z *= scale;
    }
  }

  private preventHorizontalStalemate(): void {
    const minYSpeed = 2.0; // Minimum y-speed to maintain

    // If y velocity is too small, add some
    if (Math.abs(this.velocity.y) < minYSpeed) {
      this.velocity.y = this.velocity.y < 0 ? -minYSpeed : minYSpeed;
    }
  }

  // Apply velocity to the ball
  applyVelocity(velocity: { x: number; y: number; z: number }): void {
    this.velocity.set(velocity.x, velocity.y, velocity.z);
  }

  // Reset the ball position and apply a new random velocity
  reset(position: { x: number; y: number; z: number }): void {
    // Reset position
    this.position.set(position.x, position.y, position.z);
    this.mesh.position.copy(this.position);

    // Set as attached to paddle
    this.isAttachedToPaddle = true;

    // Reset velocity to zero (will be set when released)
    this.velocity.set(0, 0, 0);

    // Clear trail particles
    this.clearTrail();
  }

  // Clear all trail particles
  private clearTrail(): void {
    if (!this.scene) return;

    this.trailParticles.forEach((particle) => {
      this.scene?.remove(particle);
      if (particle.material instanceof THREE.Material) {
        particle.material.dispose();
      }
      if (particle.geometry) {
        particle.geometry.dispose();
      }
    });

    this.trailParticles = [];
  }

  // Clean up resources
  dispose(): void {
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }

    this.clearTrail();

    if (this.mesh.geometry) {
      this.mesh.geometry.dispose();
    }

    if (this.mesh.material instanceof THREE.Material) {
      this.mesh.material.dispose();
    }
  }
}
