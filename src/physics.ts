import * as THREE from 'three';
import { GameObject } from './types';
import { GameConfig } from './config';

// Collision detection functions
export function checkBallVsBox(
  ballPos: THREE.Vector3,
  ballRadius: number,
  boxPos: THREE.Vector3,
  boxSize: { width: number; height: number; depth: number }
): boolean {
  // Find the closest point on the box to the ball
  const closest = new THREE.Vector3(
    Math.max(boxPos.x - boxSize.width / 2, Math.min(ballPos.x, boxPos.x + boxSize.width / 2)),
    Math.max(boxPos.y - boxSize.height / 2, Math.min(ballPos.y, boxPos.y + boxSize.height / 2)),
    Math.max(boxPos.z - boxSize.depth / 2, Math.min(ballPos.z, boxPos.z + boxSize.depth / 2))
  );

  // Calculate distance from closest point to ball center
  const distance = ballPos.distanceTo(closest);

  // If distance is less than ball radius, there's a collision
  return distance < ballRadius;
}

export function checkBallVsBall(
  pos1: THREE.Vector3,
  radius1: number,
  pos2: THREE.Vector3,
  radius2: number
): boolean {
  const distance = pos1.distanceTo(pos2);
  return distance < radius1 + radius2;
}

// Collision resolution for ball vs box
export function resolveBallBoxCollision(
  ballPos: THREE.Vector3,
  ballVelocity: THREE.Vector3,
  ballRadius: number,
  boxPos: THREE.Vector3,
  boxSize: { width: number; height: number; depth: number }
): void {
  // Find the closest point on the box to the ball
  const closest = new THREE.Vector3(
    Math.max(boxPos.x - boxSize.width / 2, Math.min(ballPos.x, boxPos.x + boxSize.width / 2)),
    Math.max(boxPos.y - boxSize.height / 2, Math.min(ballPos.y, boxPos.y + boxSize.height / 2)),
    Math.max(boxPos.z - boxSize.depth / 2, Math.min(ballPos.z, boxPos.z + boxSize.depth / 2))
  );

  // Direction from box to ball
  const normal = new THREE.Vector3().subVectors(ballPos, closest).normalize();

  // Calculate reflection direction
  const dot = ballVelocity.dot(normal);

  // Update ball velocity (reflect)
  ballVelocity.x -= 2 * dot * normal.x;
  ballVelocity.y -= 2 * dot * normal.y;
  ballVelocity.z -= 2 * dot * normal.z;

  // Move ball outside the box
  const penetration = ballRadius - ballPos.distanceTo(closest);
  if (penetration > 0) {
    ballPos.x += normal.x * penetration;
    ballPos.y += normal.y * penetration;
    ballPos.z += normal.z * penetration;
  }
}

// Get world boundaries based on config
export function getWorldBounds(config: GameConfig): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
} {
  const halfSize = config.worldSize / 2;
  return {
    minX: -halfSize,
    maxX: halfSize,
    minY: 0, // Bottom at y=0
    maxY: 30, // Top at y=30 (from createWalls in GameManager)
    minZ: -halfSize,
    maxZ: halfSize,
  };
}

// Check and handle world boundary collisions for balls
export function handleBallWorldBoundsCollision(
  position: THREE.Vector3,
  velocity: THREE.Vector3,
  radius: number,
  worldBounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  }
): void {
  // X bounds
  if (position.x - radius < worldBounds.minX) {
    position.x = worldBounds.minX + radius;
    velocity.x = -velocity.x; // Bounce
  } else if (position.x + radius > worldBounds.maxX) {
    position.x = worldBounds.maxX - radius;
    velocity.x = -velocity.x; // Bounce
  }

  // Y bounds
  if (position.y - radius < worldBounds.minY) {
    position.y = worldBounds.minY + radius;
    velocity.y = -velocity.y; // Bounce
  } else if (position.y + radius > worldBounds.maxY) {
    position.y = worldBounds.maxY - radius;
    velocity.y = -velocity.y; // Bounce
  }

  // Z bounds
  if (position.z - radius < worldBounds.minZ) {
    position.z = worldBounds.minZ + radius;
    velocity.z = -velocity.z; // Bounce
  } else if (position.z + radius > worldBounds.maxZ) {
    position.z = worldBounds.maxZ - radius;
    velocity.z = -velocity.z; // Bounce
  }
}

// System for managing and updating all game objects
export class PhysicsSystem {
  private objects: GameObject[] = [];
  private config: GameConfig;

  constructor(config: GameConfig) {
    this.config = config;
  }

  addObject(gameObject: GameObject): void {
    this.objects.push(gameObject);
  }

  removeObject(gameObject: GameObject): void {
    const index = this.objects.indexOf(gameObject);
    if (index !== -1) {
      this.objects.splice(index, 1);
    }
  }

  getObjectCount(): number {
    return this.objects.length;
  }

  update(deltaTime: number): void {
    // Update all objects
    for (const obj of this.objects) {
      if (obj.update) {
        obj.update(deltaTime);
      }
    }

    // Check for collisions
    this.checkCollisions();
  }

  checkCollisions(): void {
    // Check for collisions between objects
    for (let i = 0; i < this.objects.length; i++) {
      const objA = this.objects[i];

      for (let j = i + 1; j < this.objects.length; j++) {
        const objB = this.objects[j];

        // Skip static vs static collisions
        if (objA.isStatic && objB.isStatic) continue;

        // Check if the objects can collide
        if (objA.checkCollision && objA.checkCollision(objB)) {
          // Resolve the collision if possible
          if (objA.resolveCollision) {
            objA.resolveCollision(objB);
          }

          // Notify objects of collision
          if (objA.onCollision) {
            objA.onCollision(objB);
          }

          if (objB.onCollision) {
            objB.onCollision(objA);
          }
        }
      }
    }
  }

  getWorldBounds(): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  } {
    return getWorldBounds(this.config);
  }
}
