// You can add custom types for your project here
import * as THREE from 'three';
import { SimpleBody } from './fakePhysics';

export interface GameObject {
  mesh: THREE.Mesh;
  body: SimpleBody;
  update?: (delta: number) => void;
}
