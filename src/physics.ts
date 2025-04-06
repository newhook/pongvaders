import { GameObject } from './types';
import RAPIER from '@dimforge/rapier3d';
import { GameConfig } from './config';

const FIXED_TIMESTEP = 1 / 30;

export class PhysicsWorld {
  world: RAPIER.World;
  bodies: GameObject[];
  // Add collision event handler
  eventQueue: RAPIER.EventQueue;
  collisionHandlers: Map<number, (other: GameObject) => void>;

  accumulatedTime: number = 0;

  constructor(config: GameConfig) {
    // Create a physics world
    const gravity = { x: 0.0, y: -9.81, z: 0.0 };
    this.world = new RAPIER.World(gravity);
    this.world.timestep = FIXED_TIMESTEP;
    this.bodies = [];

    // Initialize collision handling with explicit enablement of contact collection
    this.eventQueue = new RAPIER.EventQueue(true);
    this.collisionHandlers = new Map();

    // Create ground plane with configurable size
    const groundSize = config.worldSize / 2; // Divide by 2 since the size is total width
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(
      groundSize,
      0.1,
      groundSize
    ).setTranslation(0, -0.1, 0);

    // Make the ground slightly bouncy
    groundColliderDesc.setRestitution(0.3);
    groundColliderDesc.setFriction(0.8);

    this.world.createCollider(groundColliderDesc);
  }

  // Get the count of physics objects
  getPhysicsObjectCount(): number {
    return this.bodies.length;
  }

  update(deltaTime: number): void {
    this.accumulatedTime += deltaTime;
    // Step physics in fixed intervals
    while (this.accumulatedTime >= FIXED_TIMESTEP) {
      this.world.step(this.eventQueue);
      // save previous frame and next frame's transforms here
      this.accumulatedTime -= FIXED_TIMESTEP;

      // Process collision events
      this.processCollisionEvents();

      // Update all physics objects
      for (let i = 0; i < this.bodies.length; i++) {
        const body = this.bodies[i];
        if (body.mesh) {
          const position = body.body.translation();
          const rotation = body.body.rotation();

          // Update mesh position and rotation from physics body
          body.mesh.position.set(position.x, position.y, position.z);
          body.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
        }
      }
    }
  }

  // Process collision events from RAPIER
  private processCollisionEvents(): void {
    this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      if (started) {
        const collider1 = this.world.getCollider(handle1);
        const collider2 = this.world.getCollider(handle2);

        const parent1 = collider1.parent();
        const parent2 = collider2.parent();

        if (parent1 && parent2) {
          const body1Handle = parent1.handle;
          const body2Handle = parent2.handle;

          // Find the GameObjects associated with these rigid bodies
          const gameObj1 = this.findGameObjectByHandle(body1Handle);
          const gameObj2 = this.findGameObjectByHandle(body2Handle);

          // Trigger collision handlers if they exist
          if (gameObj1 && this.collisionHandlers.has(body1Handle)) {
            const handler = this.collisionHandlers.get(body1Handle);
            if (handler && gameObj2) {
              handler(gameObj2);
            }
          }
          if (gameObj2 && this.collisionHandlers.has(body2Handle)) {
            const handler = this.collisionHandlers.get(body2Handle);
            if (handler && gameObj1) {
              handler(gameObj1);
            }
          }
        }
      }
    });

    // Clear the event queue after processing
    this.eventQueue.clear();
  }

  // Find a GameObject by its physics body handle
  private findGameObjectByHandle(handle: number): GameObject | null {
    for (const body of this.bodies) {
      if (body.body.handle === handle) {
        return body;
      }
    }
    return null;
  }

  // Register a collision handler for a specific body
  registerCollisionHandler(body: GameObject, handler: (other: GameObject) => void): void {
    this.collisionHandlers.set(body.body.handle, handler);
  }

  // Unregister a collision handler
  unregisterCollisionHandler(body: GameObject): void {
    this.collisionHandlers.delete(body.body.handle);
  }

  addBody(body: GameObject): void {
    this.bodies.push(body);
  }

  removeBody(body: GameObject): void {
    const index = this.bodies.indexOf(body);
    if (index !== -1) {
      this.bodies.splice(index, 1);
      this.world.removeRigidBody(body.body);
      // Remove any collision handlers
      this.unregisterCollisionHandler(body);
    }
  }
}

export function createObstacleBody(
  size: { width: number; height: number; depth: number },
  position: { x: number; y: number; z: number },
  world: RAPIER.World,
  mass: number = 0
): RAPIER.RigidBody {
  // Create appropriate rigid body based on mass
  const rigidBodyDesc = mass === 0 ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic();

  // Set position
  rigidBodyDesc.setTranslation(position.x, position.y, position.z);

  const body = world.createRigidBody(rigidBodyDesc);

  // Create collider for this body
  const colliderDesc = RAPIER.ColliderDesc.cuboid(size.width / 2, size.height / 2, size.depth / 2);

  if (mass > 0) {
    colliderDesc.setDensity(mass / (size.width * size.height * size.depth));
  }

  // Increase friction and add bounce for more dynamic collisions
  colliderDesc.setFriction(0.8);
  colliderDesc.setRestitution(0.4); // Increased bounciness

  // Ensure all collision types are active
  colliderDesc.setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.ALL);

  // CRITICAL: Enable all events to ensure we get collision notifications
  colliderDesc.setActiveEvents(
    RAPIER.ActiveEvents.COLLISION_EVENTS | RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS
  );

  // Attach collider to body
  world.createCollider(colliderDesc, body);

  return body;
}
