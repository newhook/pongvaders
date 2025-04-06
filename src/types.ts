// You can add custom types for your project here
import * as THREE from 'three';

export interface GameObject {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  size: { width: number; height: number; depth: number } | { radius: number };
  update?: (delta: number) => void;
  onCollision?: (other: GameObject) => void;
}
