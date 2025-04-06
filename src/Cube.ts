import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';
import { PhysicsWorld, createObstacleBody } from './physics';
import { GameObject } from './types';

export class Cube implements GameObject {
  public mesh: THREE.Mesh;
  public body: RAPIER.RigidBody;
  public mass: number;
  public size: { width: number; height: number; depth: number };

  // Explosion properties
  public exploding: boolean = false;
  private explosionParticles: THREE.Points[] = [];
  private explosionStartTime: number = 0;
  private explosionDuration: number = 1.5; // seconds
  private scene: THREE.Scene | null = null;
  private physicsWorld: PhysicsWorld | null = null;

  constructor(
    size: number,
    material: THREE.Material,
    position: { x: number; y: number; z: number },
    physicsWorld: RAPIER.World,
    mass: number = 1.0
  ) {
    // Create cube geometry
    const geometry = new THREE.BoxGeometry(size, size, size);

    // Create mesh
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // Create physics body for the cube
    this.body = createObstacleBody(
      { width: size, height: size, depth: size },
      position,
      physicsWorld,
      mass
    );

    // Store properties
    this.mass = mass;
    this.size = { width: size, height: size, depth: size };
  }

  // Set references needed for explosion management
  setSceneAndPhysicsWorld(scene: THREE.Scene, physicsWorld: PhysicsWorld): void {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
  }

  // Apply random rotation to the cube
  applyRandomRotation(torqueStrength: number = 5.0): void {
    // Generate random torque around each axis
    const torqueX = (Math.random() - 0.5) * torqueStrength;
    const torqueY = (Math.random() - 0.5) * torqueStrength;
    const torqueZ = (Math.random() - 0.5) * torqueStrength;

    // Apply the torque to make the cube spin as it falls
    this.body.applyTorqueImpulse({ x: torqueX, y: torqueY, z: torqueZ }, true);
  }

  // Apply random horizontal impulse
  applyRandomImpulse(impulseStrength: number = 1.0): void {
    // Create a small random linear impulse for more varied movement
    const impulseX = (Math.random() - 0.5) * impulseStrength;
    const impulseZ = (Math.random() - 0.5) * impulseStrength;

    // Apply only horizontal impulse to avoid counteracting gravity
    this.body.applyImpulse({ x: impulseX, y: 0, z: impulseZ }, true);
  }

  // Handle collision with another cube
  handleCollision(other: GameObject): void {
    // Only explode if not already exploding and the impact is significant
    if (!this.exploding) {
      this.explode();

      // If the other object is a cube, make it explode too
      if (other instanceof Cube && !other.exploding) {
        other.explode();
      }
    }
  }

  // Create explosion effect
  explode(): void {
    if (this.exploding || !this.scene || !this.physicsWorld) return;

    this.exploding = true;
    this.explosionStartTime = performance.now() / 1000;

    // Get the current position of the cube
    const position = this.body.translation();
    const material = this.mesh.material;

    // Create particles for the explosion
    const particleCount = 50;
    const particleSize = this.size.width / 5;

    // Create geometry for particles
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    // Initialize particles at the center
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Create particle material
    const particleMaterial =
      material instanceof THREE.MeshStandardMaterial
        ? new THREE.PointsMaterial({
            color: material.color,
            size: particleSize,
            transparent: true,
            opacity: 1.0,
          })
        : new THREE.PointsMaterial({
            color: 0xffffff,
            size: particleSize,
            transparent: true,
            opacity: 1.0,
          });

    // Create the particle system
    const particles = new THREE.Points(particleGeometry, particleMaterial);

    // Position the particle system at the cube's position
    particles.position.set(position.x, position.y, position.z);

    // Create velocity data for each particle
    const velocities = [];
    for (let i = 0; i < particleCount; i++) {
      // Random direction for each particle
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = Math.random() * 5 + 3; // Random speed

      const vx = Math.sin(phi) * Math.cos(theta) * speed;
      const vy = Math.sin(phi) * Math.sin(theta) * speed;
      const vz = Math.cos(phi) * speed;

      velocities.push({ x: vx, y: vy, z: vz });
    }

    // Store velocities with the particles
    particles.userData.velocities = velocities;
    particles.userData.startSize = particleSize;

    // Add particles to scene
    this.scene.add(particles);
    this.explosionParticles.push(particles);

    // Hide original cube
    this.mesh.visible = false;

    // Play explosion sound (if available)
    // this.playExplosionSound();

    // Optional: Spawn small debris cubes for more realistic explosion
    this.spawnDebris(position, 8);

    // Add particle system to be updated
    this.scene.userData.explosions = this.scene.userData.explosions || [];
    this.scene.userData.explosions.push({
      particles,
      velocities,
      startTime: this.explosionStartTime,
      duration: this.explosionDuration,
    });

    // Remove the cube's physics body
    if (this.physicsWorld) {
      this.physicsWorld.removeBody(this);
    }
  }

  // Spawn smaller debris for the explosion
  private spawnDebris(position: RAPIER.Vector3, count: number): void {
    if (!this.scene || !this.physicsWorld) return;

    const debrisSize = this.size.width / 4;

    // Get the material color if it's a MeshStandardMaterial
    let color = 0xffffff;
    if (this.mesh.material instanceof THREE.MeshStandardMaterial) {
      color = this.mesh.material.color.getHex();
    }

    for (let i = 0; i < count; i++) {
      // Create a small debris cube
      const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.7,
        metalness: 0.3,
      });

      // Random position offset
      const offsetRange = this.size.width / 2;
      const offsetX = (Math.random() - 0.5) * offsetRange;
      const offsetY = (Math.random() - 0.5) * offsetRange;
      const offsetZ = (Math.random() - 0.5) * offsetRange;

      const debrisPosition = {
        x: position.x + offsetX,
        y: position.y + offsetY,
        z: position.z + offsetZ,
      };

      // Create a small debris cube
      const debris = new Cube(
        debrisSize,
        material,
        debrisPosition,
        this.physicsWorld.world,
        this.mass / 10 // Lighter debris
      );

      // Set references for the debris
      debris.setSceneAndPhysicsWorld(this.scene, this.physicsWorld);

      // Add to scene and physics
      this.scene.add(debris.mesh);
      this.physicsWorld.addBody(debris);

      // Apply explosion force
      const impulseStrength = 5.0;
      const impulseX = offsetX * impulseStrength;
      const impulseY = offsetY * impulseStrength + 2.0; // Add upward force
      const impulseZ = offsetZ * impulseStrength;

      debris.body.applyImpulse({ x: impulseX, y: impulseY, z: impulseZ }, true);

      // Apply random rotation
      debris.applyRandomRotation(10.0);
    }
  }

  update(delta: number): void {
    if (!this.exploding) {
      if (this.mesh.position.y < -10) {
        this.explode();
      }
      return;
    }

    // Update explosion particles
    const currentTime = performance.now() / 1000;
    const elapsed = currentTime - this.explosionStartTime;

    if (elapsed >= this.explosionDuration) {
      // Explosion is complete, clean up particles
      this.cleanupExplosion();
      return;
    }

    // Update particles
    this.updateExplosionParticles(elapsed, delta);
  }

  // Update the explosion particles
  private updateExplosionParticles(elapsed: number, delta: number): void {
    const progress = elapsed / this.explosionDuration;

    // Update each particle system
    this.explosionParticles.forEach((particles) => {
      const positions = particles.geometry.getAttribute('position').array as Float32Array;
      const velocities = particles.userData.velocities;

      // Update each particle position
      for (let i = 0; i < velocities.length; i++) {
        // Apply velocity with gravity
        const vx = velocities[i].x;
        const vy = velocities[i].y - 9.8 * delta; // Apply gravity
        const vz = velocities[i].z;

        // Update velocity for next frame
        velocities[i].y = vy;

        // Update position
        positions[i * 3] += vx * delta;
        positions[i * 3 + 1] += vy * delta;
        positions[i * 3 + 2] += vz * delta;
      }

      // Update opacity based on progress
      if (particles.material instanceof THREE.PointsMaterial) {
        particles.material.opacity = 1.0 - progress;
        particles.material.size = particles.userData.startSize * (1.0 - progress * 0.5);
      }

      // Mark position attribute for update
      particles.geometry.getAttribute('position').needsUpdate = true;
    });
  }

  // Clean up explosion effects
  private cleanupExplosion(): void {
    if (!this.scene) return;

    // Remove all particle systems
    this.explosionParticles.forEach((particles) => {
      this.scene?.remove(particles);
      particles.geometry.dispose();
      if (particles.material instanceof THREE.Material) {
        particles.material.dispose();
      }
    });

    this.explosionParticles = [];

    // Remove from scene's explosion list if it exists
    if (this.scene.userData.explosions) {
      this.scene.userData.explosions = this.scene.userData.explosions.filter(
        (exp: any) => !this.explosionParticles.includes(exp.particles)
      );
    }

    // Remove mesh from scene
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }

    // Dispose of geometry and material
    if (this.mesh.geometry) {
      this.mesh.geometry.dispose();
    }

    if (this.mesh.material instanceof THREE.Material) {
      this.mesh.material.dispose();
    }
  }

  // Static factory method to create a random cube
  static createRandom(
    physicsWorld: PhysicsWorld,
    materials: THREE.Material[],
    worldSize: number
  ): Cube {
    // Random size between 0.5 and 1.5
    const size = Math.random() * 1.0 + 0.5;

    // Select random material
    const material = materials[Math.floor(Math.random() * materials.length)];

    // Random position
    const posX = (Math.random() - 0.5) * worldSize * 0.8;
    const posY = Math.random() * 10 + 5;
    const posZ = (Math.random() - 0.5) * worldSize * 0.8;

    // Create cube
    const cube = new Cube(size, material, { x: posX, y: posY, z: posZ }, physicsWorld.world, 1.0);

    // Apply random forces
    cube.applyRandomRotation();
    cube.applyRandomImpulse();

    return cube;
  }
}
