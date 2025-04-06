// filepath: /Users/matthew/games/ponginvaders/src/gameObjectFactory.ts
import * as THREE from 'three';
import { Ball } from './Ball';
import { Paddle } from './Paddle';
import { PhysicsSystem } from './physics';
import { GameObject } from './types';

// Create a static box (like walls or obstacles)
export function createStaticBox(
  size: { width: number; height: number; depth: number },
  position: { x: number; y: number; z: number },
  physicsSystem: PhysicsSystem,
  scene: THREE.Scene,
  color: number = 0xffffff,
  emissive: number = 0x333333
): GameObject {
  // Create box geometry
  const geometry = new THREE.BoxGeometry(size.width, size.height, size.depth);

  // Create box material
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 0.5,
    metalness: 0.5,
    roughness: 0.5,
  });

  // Create mesh
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(position.x, position.y, position.z);
  scene.add(mesh);

  // Create simple game object
  const obj: GameObject = {
    mesh,
    position: new THREE.Vector3(position.x, position.y, position.z),
    velocity: new THREE.Vector3(0, 0, 0),
    isStatic: true,
    isBall: false,
    isPaddle: false,
    size,
  };

  // Add to physics system
  physicsSystem.addObject(obj);

  return obj;
}

// Create a game ball
export function createBall(
  radius: number,
  position: { x: number; y: number; z: number },
  physicsSystem: PhysicsSystem,
  scene: THREE.Scene
): Ball {
  return new Ball(radius, position, physicsSystem, scene);
}

// Create a player paddle
export function createPaddle(
  size: { width: number; height: number; depth: number },
  position: { x: number; y: number; z: number },
  physicsSystem: PhysicsSystem,
  worldSize: number
): Paddle {
  return new Paddle(size, position, physicsSystem, worldSize);
}
