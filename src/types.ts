// You can add custom types for your project here
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';

export interface GameObject {
  mesh: THREE.Mesh;
  body: RAPIER.RigidBody;
  update?: (delta: number) => void;
}
