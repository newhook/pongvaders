import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';
import { PhysicsWorld } from './physics';
import { GameObject } from './types';

export class Ball implements GameObject {
  public mesh: THREE.Mesh;
  public body: RAPIER.RigidBody;
  private radius: number;
  private initialVelocity: { x: number; y: number; z: number };
  private maxSpeed: number = 20;
  private trailParticles: THREE.Points[] = [];
  private scene: THREE.Scene | null = null;
  private trailLifetime: number = 0.5; // Trail lifetime in seconds
  private lastTrailTime: number = 0;
  private trailInterval: number = 0.05; // Time between trail particles

  constructor(
    radius: number,
    position: { x: number; y: number; z: number },
    physicsWorld: PhysicsWorld,
    scene: THREE.Scene
  ) {
    this.radius = radius;
    this.scene = scene;

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
    this.mesh.position.set(position.x, position.y, position.z);

    // Create rigid body
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setLinearDamping(0) // No damping to keep ball moving
      .setAngularDamping(0.5); // Some angular damping

    this.body = physicsWorld.world.createRigidBody(bodyDesc);

    // Create collider
    const colliderDesc = RAPIER.ColliderDesc.ball(radius);
    colliderDesc.setRestitution(1.0); // Perfect bounce
    colliderDesc.setFriction(0.0); // No friction for smooth movement
    colliderDesc.setDensity(1.0); // Standard density

    physicsWorld.world.createCollider(colliderDesc, this.body);

    // Save initial velocity for resets
    this.initialVelocity = {
      x: (Math.random() * 2 - 1) * 5, // Random X direction
      y: -8, // Always start moving down
      z: 0, // No Z velocity initially
    };

    // Apply initial velocity
    this.applyVelocity(this.initialVelocity);

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
    // Update mesh position from physics body
    const position = this.body.translation();
    this.mesh.position.set(position.x, position.y, position.z);

    // Update mesh rotation from physics body
    const rotation = this.body.rotation();
    this.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

    // Create trail effect
    this.updateTrail(deltaTime);

    // Enforce maximum speed
    this.enforceMaxSpeed();

    // Ensure ball has some Y velocity to prevent horizontal stalemates
    this.preventHorizontalStalemate();
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

    // Get current position
    const position = this.body.translation();

    // Create particle geometry
    const geometry = new THREE.BufferGeometry();
    const posArray = new Float32Array(3);
    posArray[0] = position.x;
    posArray[1] = position.y;
    posArray[2] = position.z;

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
    const velocity = this.body.linvel();
    const speed = Math.sqrt(
      velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z
    );

    if (speed > this.maxSpeed) {
      // Scale down velocity to max speed
      const scale = this.maxSpeed / speed;
      this.body.setLinvel(
        {
          x: velocity.x * scale,
          y: velocity.y * scale,
          z: velocity.z * scale,
        },
        true
      );
    }
  }

  private preventHorizontalStalemate(): void {
    const velocity = this.body.linvel();
    const minYSpeed = 2.0; // Minimum y-speed to maintain

    // If y velocity is too small, add some
    if (Math.abs(velocity.y) < minYSpeed) {
      const newYVel = velocity.y < 0 ? -minYSpeed : minYSpeed;
      this.body.setLinvel(
        {
          x: velocity.x,
          y: newYVel,
          z: velocity.z,
        },
        true
      );
    }
  }

  // Apply initial velocity to the ball
  applyVelocity(velocity: { x: number; y: number; z: number }): void {
    this.body.setLinvel(velocity, true);
  }

  // Reset the ball position and apply a new random velocity
  reset(position: { x: number; y: number; z: number }): void {
    // Reset position
    this.body.setTranslation(position, true);

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

    if (this.mesh.geometry) {
      this.mesh.geometry.dispose();
    }

    if (this.mesh.material instanceof THREE.Material) {
      this.mesh.material.dispose();
    }
  }
}
