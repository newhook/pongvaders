// You can add custom types for your project here
import * as THREE from 'three';

export interface GameObject {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  isStatic: boolean;
  isBall: boolean;
  isPaddle: boolean;
  size: { width: number; height: number; depth: number } | { radius: number };
  update?: (delta: number) => void;
  checkCollision?: (other: GameObject) => boolean;
  resolveCollision?: (other: GameObject) => void;
  onCollision?: (other: GameObject) => void;
  getWorldBounds?: () => {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
}
