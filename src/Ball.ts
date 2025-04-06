import * as THREE from 'three';
import { GameObject } from './types';
import { PlayState, SimplePhysicsBody } from './playState';

export class Ball implements GameObject {
  public mesh: THREE.Mesh;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public isStatic: boolean = false;
  public isBall: boolean = true;
  public isPaddle: boolean = false;
  public size: { radius: number };
  public body: any; // Reference to physics body

  private radius: number;
  private initialVelocity: { x: number; y: number; z: number };
  private maxSpeed: number = 20;
  private trailParticles: THREE.Points[] = [];
  private scene: THREE.Scene | null = null;
  private trailLifetime: number = 0.5; // Trail lifetime in seconds
  private lastTrailTime: number = 0;
  private trailInterval: number = 0.05; // Time between trail particles

  constructor(
    game: PlayState,
    radius: number,
    position: { x: number; y: number; z: number },
    scene: THREE.Scene
  ) {
    this.radius = radius;
    this.scene = scene;
    this.size = { radius };

    // Create position and velocity vectors
    this.position = new THREE.Vector3(position.x, position.y, position.z);
    this.velocity = new THREE.Vector3(0, 0, 0);

    // Create physics body
    this.body = new SimplePhysicsBody(position, false, true, false, { radius });

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

    // Apply initial velocity
    this.applyVelocity(this.initialVelocity);

    // Add this ball to physics system
    game.addBody(this, this.onCollision.bind(this));

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
  }

  update(deltaTime: number): void {
    // Update local position and velocity from physics body
    const bodyPos = this.body.translation();
    const bodyVel = this.body.linvel();

    this.position.set(bodyPos.x, bodyPos.y, bodyPos.z);
    this.velocity.set(bodyVel.x, bodyVel.y, bodyVel.z);

    // Update mesh position
    this.mesh.position.copy(this.position);

    // Create trail effect
    this.updateTrail(deltaTime);

    // Enforce maximum speed
    this.enforceMaxSpeed();

    // Ensure ball has some Y velocity to prevent horizontal stalemates
    this.preventHorizontalStalemate();
  }

  // Handle collision with other objects
  onCollision(other: GameObject): void {
    // Can handle special collision effects here
    // The physics system handles the actual collision resolution
  }

  private updateTrail(deltaTime: number): void {
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

      // Update physics body velocity
      this.body.setLinvel(this.velocity);
    }
  }

  private preventHorizontalStalemate(): void {
    const minYSpeed = 2.0; // Minimum y-speed to maintain

    // If y velocity is too small, add some
    if (Math.abs(this.velocity.y) < minYSpeed) {
      this.velocity.y = this.velocity.y < 0 ? -minYSpeed : minYSpeed;

      // Update physics body velocity
      this.body.setLinvel(this.velocity);
    }
  }

  // Apply velocity to the ball
  applyVelocity(velocity: { x: number; y: number; z: number }): void {
    this.velocity.set(velocity.x, velocity.y, velocity.z);

    // Update physics body velocity
    if (this.body) {
      this.body.setLinvel(velocity);
    }
  }

  // Reset the ball position and apply a new random velocity
  reset(position: { x: number; y: number; z: number }): void {
    // Reset position
    this.position.set(position.x, position.y, position.z);
    this.mesh.position.copy(this.position);

    // Update physics body position
    this.body.setTranslation(position);

    // Reset velocity with random x direction
    const resetVelocity = {
      x: (Math.random() * 2 - 1) * 5,
      y: -8, // Always start moving down
      z: 0,
    };

    this.applyVelocity(resetVelocity);

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

    // Remove from physics system
    this.physicsWorld.removeBody(this);

    if (this.mesh.geometry) {
      this.mesh.geometry.dispose();
    }

    if (this.mesh.material instanceof THREE.Material) {
      this.mesh.material.dispose();
    }
  }
}
