// filepath: /Users/matthew/games/ponginvaders/src/fakePhysics.ts
import * as THREE from 'three';
import { GameConfig } from './config';
import { GameObject } from './types';

// Simple physics body with just the essential properties needed for pong/breakout
export class SimpleBody {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  isStatic: boolean;
  isBall: boolean;
  isPaddle: boolean;
  size: { width: number; height: number; depth: number } | { radius: number };

  constructor(
    position: { x: number; y: number; z: number },
    isStatic: boolean = false,
    isBall: boolean = false,
    isPaddle: boolean = false,
    size: any
  ) {
    this.position = new THREE.Vector3(position.x, position.y, position.z);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.isStatic = isStatic;
    this.isBall = isBall;
    this.isPaddle = isPaddle;
    this.size = size;
  }

  // Get current position
  translation(): { x: number; y: number; z: number } {
    return { x: this.position.x, y: this.position.y, z: this.position.z };
  }

  // Move a kinematic body (like paddles)
  setNextKinematicTranslation(position: { x: number; y: number; z: number }): void {
    this.position.set(position.x, position.y, position.z);
  }

  // Set position
  setTranslation(position: { x: number; y: number; z: number }): void {
    this.position.set(position.x, position.y, position.z);
  }

  // Get velocity
  linvel(): { x: number; y: number; z: number } {
    return { x: this.velocity.x, y: this.velocity.y, z: this.velocity.z };
  }

  // Set velocity
  setLinvel(velocity: { x: number; y: number; z: number }): void {
    this.velocity.set(velocity.x, velocity.y, velocity.z);
  }

  // Add to velocity
  applyImpulse(impulse: { x: number; y: number; z: number }): void {
    if (!this.isStatic) {
      this.velocity.x += impulse.x;
      this.velocity.y += impulse.y;
      this.velocity.z += impulse.z;
    }
  }

  // For compatibility with existing code - returns empty quaternion
  rotation(): { x: number; y: number; z: number; w: number } {
    return { x: 0, y: 0, z: 0, w: 1 };
  }
}

// Simple collision detection functions
function ballVsBox(
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

function ballVsBall(
  pos1: THREE.Vector3,
  radius1: number,
  pos2: THREE.Vector3,
  radius2: number
): boolean {
  const distance = pos1.distanceTo(pos2);
  return distance < radius1 + radius2;
}

// Simple collision resolution for ball vs box
function resolveBallBoxCollision(
  ball: SimpleBody,
  boxPos: THREE.Vector3,
  boxSize: { width: number; height: number; depth: number }
): void {
  // We know the ball is colliding with the box
  // Find the closest point on the box to the ball
  const ballPos = ball.position;
  const ballRadius = (ball.size as { radius: number }).radius;

  const closest = new THREE.Vector3(
    Math.max(boxPos.x - boxSize.width / 2, Math.min(ballPos.x, boxPos.x + boxSize.width / 2)),
    Math.max(boxPos.y - boxSize.height / 2, Math.min(ballPos.y, boxPos.y + boxSize.height / 2)),
    Math.max(boxPos.z - boxSize.depth / 2, Math.min(ballPos.z, boxPos.z + boxSize.depth / 2))
  );

  // Direction from box to ball
  const normal = new THREE.Vector3().subVectors(ballPos, closest).normalize();

  // Calculate reflection direction
  const dot = ball.velocity.dot(normal);

  // Update ball velocity (reflect)
  ball.velocity.x -= 2 * dot * normal.x;
  ball.velocity.y -= 2 * dot * normal.y;
  ball.velocity.z -= 2 * dot * normal.z;

  // Move ball outside the box
  const penetration = ballRadius - ballPos.distanceTo(closest);
  if (penetration > 0) {
    ballPos.x += normal.x * penetration;
    ballPos.y += normal.y * penetration;
    ballPos.z += normal.z * penetration;
  }
}

// Simple physics world
export class SimplePhysics {
  objects: { gameObj: GameObject; collisionCallback?: (other: GameObject) => void }[] = [];
  gravity: number = 0; // No gravity for pong/breakout!
  worldBounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };

  constructor(config: GameConfig) {
    // Set up world bounds based on config
    const halfSize = config.worldSize / 2;
    this.worldBounds = {
      minX: -halfSize,
      maxX: halfSize,
      minY: 0, // Bottom at y=0
      maxY: 30, // Top at y=30 (from createWalls in GameManager)
      minZ: -halfSize,
      maxZ: halfSize,
    };
  }

  addBody(gameObject: GameObject, collisionCallback?: (other: GameObject) => void): void {
    this.objects.push({
      gameObj: gameObject,
      collisionCallback: collisionCallback,
    });
  }

  removeBody(gameObject: GameObject): void {
    const index = this.objects.findIndex((obj) => obj.gameObj === gameObject);
    if (index !== -1) {
      this.objects.splice(index, 1);
    }
  }

  getPhysicsObjectCount(): number {
    return this.objects.length;
  }

  update(deltaTime: number): void {
    // Update positions based on velocities
    for (const obj of this.objects) {
      const body = obj.gameObj.body;

      if (!body.isStatic) {
        // Apply gravity
        body.velocity.y -= this.gravity * deltaTime;

        // Update position based on velocity
        body.position.x += body.velocity.x * deltaTime;
        body.position.y += body.velocity.y * deltaTime;
        body.position.z += body.velocity.z * deltaTime;
      }

      // Update mesh position from physics body
      if (obj.gameObj.mesh) {
        obj.gameObj.mesh.position.copy(body.position);
      }
    }

    // Check for collisions
    this.checkCollisions();

    // Keep balls within world bounds
    for (const obj of this.objects) {
      const body = obj.gameObj.body;

      // Only handle ball bounds collision
      if (body.isBall) {
        const radius = (body.size as { radius: number }).radius;

        // X bounds
        if (body.position.x - radius < this.worldBounds.minX) {
          body.position.x = this.worldBounds.minX + radius;
          body.velocity.x = -body.velocity.x; // Bounce
        } else if (body.position.x + radius > this.worldBounds.maxX) {
          body.position.x = this.worldBounds.maxX - radius;
          body.velocity.x = -body.velocity.x; // Bounce
        }

        // Y bounds
        if (body.position.y - radius < this.worldBounds.minY) {
          // Ball reached bottom - in a real game this might be "ball lost"
          body.position.y = this.worldBounds.minY + radius;
          body.velocity.y = -body.velocity.y; // Bounce
        } else if (body.position.y + radius > this.worldBounds.maxY) {
          body.position.y = this.worldBounds.maxY - radius;
          body.velocity.y = -body.velocity.y; // Bounce
        }

        // Z bounds
        if (body.position.z - radius < this.worldBounds.minZ) {
          body.position.z = this.worldBounds.minZ + radius;
          body.velocity.z = -body.velocity.z; // Bounce
        } else if (body.position.z + radius > this.worldBounds.maxZ) {
          body.position.z = this.worldBounds.maxZ - radius;
          body.velocity.z = -body.velocity.z; // Bounce
        }
      }
    }
  }

  checkCollisions(): void {
    // Simple O(n²) collision check - fine for small number of objects
    for (let i = 0; i < this.objects.length; i++) {
      const objA = this.objects[i];
      const bodyA = objA.gameObj.body;

      for (let j = i + 1; j < this.objects.length; j++) {
        const objB = this.objects[j];
        const bodyB = objB.gameObj.body;

        // Skip static vs static collisions
        if (bodyA.isStatic && bodyB.isStatic) continue;

        let collision = false;

        // Ball vs ball
        if (bodyA.isBall && bodyB.isBall) {
          collision = ballVsBall(
            bodyA.position,
            (bodyA.size as { radius: number }).radius,
            bodyB.position,
            (bodyB.size as { radius: number }).radius
          );
        }
        // Ball vs box
        else if (bodyA.isBall && !bodyB.isBall) {
          collision = ballVsBox(
            bodyA.position,
            (bodyA.size as { radius: number }).radius,
            bodyB.position,
            bodyB.size as { width: number; height: number; depth: number }
          );

          if (collision) {
            resolveBallBoxCollision(
              bodyA,
              bodyB.position,
              bodyB.size as { width: number; height: number; depth: number }
            );
          }
        }
        // Box vs ball
        else if (!bodyA.isBall && bodyB.isBall) {
          collision = ballVsBox(
            bodyB.position,
            (bodyB.size as { radius: number }).radius,
            bodyA.position,
            bodyA.size as { width: number; height: number; depth: number }
          );

          if (collision) {
            resolveBallBoxCollision(
              bodyB,
              bodyA.position,
              bodyA.size as { width: number; height: number; depth: number }
            );
          }
        }

        // Handle collision callbacks
        if (collision) {
          if (objA.collisionCallback) objA.collisionCallback(objB.gameObj);
          if (objB.collisionCallback) objB.collisionCallback(objA.gameObj);
        }
      }
    }
  }
}

// Helper functions to create bodies
export function createStaticBox(
  size: { width: number; height: number; depth: number },
  position: { x: number; y: number; z: number }
): SimpleBody {
  return new SimpleBody(position, true, false, false, size);
}

export function createBall(
  radius: number,
  position: { x: number; y: number; z: number }
): SimpleBody {
  return new SimpleBody(position, false, true, false, { radius });
}

export function createPaddle(
  size: { width: number; height: number; depth: number },
  position: { x: number; y: number; z: number }
): SimpleBody {
  return new SimpleBody(position, false, false, true, size);
}
