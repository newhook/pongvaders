import * as THREE from 'three';
import { GameObject } from './types';
import { PlayState, SimplePhysicsBody } from './playState';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

export class Alien implements GameObject {
  public mesh: THREE.Mesh;
  public body: SimplePhysicsBody;
  public size: { width: number; height: number; depth: number };
  public isDestroyed: boolean = false;
  public points: number; // Points awarded when destroyed

  private animationMixer: THREE.AnimationMixer | null = null;
  private animations: THREE.AnimationAction[] = [];
  private hoverAmplitude: number = 0.2; // How much to hover up and down
  private hoverFrequency: number = 2; // Hover cycles per second
  private hoverOffset: number = 0; // Random offset so aliens don't all hover in sync
  private initialY: number = 0; // Initial Y position

  constructor(
    game: PlayState,
    size: { width: number; height: number; depth: number },
    position: { x: number; y: number; z: number },
    type: 'small' | 'medium' | 'large' = 'medium'
  ) {
    this.size = size;
    this.initialY = position.y;
    this.hoverOffset = Math.random() * Math.PI * 2; // Random start position in hover cycle

    // Set points based on alien type
    switch (type) {
      case 'small':
        this.points = 30;
        break;
      case 'large':
        this.points = 10;
        break;
      case 'medium':
      default:
        this.points = 20;
        break;
    }

    // Create alien geometry - different shapes based on type
    let geometry: THREE.BufferGeometry;

    switch (type) {
      case 'small':
        // Create small alien - octahedron shape
        geometry = new THREE.OctahedronGeometry(size.width / 2, 1);
        break;
      case 'large':
        // Create large alien - sphere with tentacles (using lathe)
        geometry = this.createTentacledAlien(size.width / 2);
        break;
      case 'medium':
      default:
        // Create medium alien - classic flying saucer shape
        geometry = this.createFlyingSaucerGeometry(size.width / 2, size.height / 2);
        break;
    }

    // Create material with color based on type
    const materialColor = this.getAlienColor(type);
    const material = new THREE.MeshStandardMaterial({
      color: materialColor,
      emissive: materialColor,
      emissiveIntensity: 0.5,
      metalness: 0.8,
      roughness: 0.2,
    });

    // Create mesh
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.position.set(position.x, position.y, position.z);

    // Create physics body with simplified physics
    this.body = new SimplePhysicsBody(position, true, false, false, size);
    game.addBody(this);

    // Create animation mixer if needed
    this.animationMixer = new THREE.AnimationMixer(this.mesh);
    this.setupAnimations();

    // Add eyes/details based on alien type
    this.addAlienDetails(type);
  }

  private getAlienColor(type: 'small' | 'medium' | 'large'): number {
    switch (type) {
      case 'small':
        return 0xff5500; // Orange-red
      case 'medium':
        return 0x00ff66; // Green
      case 'large':
        return 0xaa22ff; // Purple
      default:
        return 0x00ff66; // Default green
    }
  }

  private createFlyingSaucerGeometry(radius: number, height: number): THREE.BufferGeometry {
    // Create points for a flying saucer shape
    const points = [];

    // Bottom point
    points.push(new THREE.Vector2(0, -height / 2));

    // Bottom curve
    for (let i = 0; i <= 5; i++) {
      const angle = (Math.PI / 5) * i;
      const x = radius * Math.sin(angle);
      const y = -height / 2 + height * 0.3 * (1 - Math.cos(angle));
      points.push(new THREE.Vector2(x, y));
    }

    // Middle (widest part)
    points.push(new THREE.Vector2(radius, 0));

    // Top curve
    for (let i = 4; i >= 0; i--) {
      const angle = (Math.PI / 5) * i;
      const x = radius * Math.sin(angle);
      const y = height / 2 - height * 0.2 * (1 - Math.cos(angle));
      points.push(new THREE.Vector2(x, y));
    }

    // Top center point
    points.push(new THREE.Vector2(0, height / 2));

    // Create lathe geometry from points
    return new THREE.LatheGeometry(points, 32);
  }

  private createTentacledAlien(radius: number): THREE.BufferGeometry {
    // Create a group to hold all geometries
    const tentacleGroup = new THREE.Group();

    // Create center sphere
    const bodyGeometry = new THREE.SphereGeometry(radius * 0.7, 16, 16);
    const body = new THREE.Mesh(bodyGeometry);
    tentacleGroup.add(body);

    // Create tentacles
    const tentacleCount = 6;
    const tentacleLength = radius * 1.2;
    const tentacleWidth = radius * 0.2;

    for (let i = 0; i < tentacleCount; i++) {
      const angle = ((Math.PI * 2) / tentacleCount) * i;
      const x = Math.cos(angle) * radius * 0.5;
      const z = Math.sin(angle) * radius * 0.5;
      const y = -radius * 0.5;

      const tentacleGeometry = new THREE.CylinderGeometry(
        tentacleWidth,
        tentacleWidth * 0.5,
        tentacleLength,
        8,
        3,
        true
      );

      const tentacle = new THREE.Mesh(tentacleGeometry);
      tentacle.position.set(x, y - tentacleLength / 2, z);
      tentacle.rotation.x = Math.PI / 6; // Angle tentacles slightly outward
      tentacle.rotation.z = angle;

      tentacleGroup.add(tentacle);
    }

    // Convert group to buffer geometry
    const finalGeometry = new THREE.BufferGeometry();
    const geometries: THREE.BufferGeometry[] = [];

    tentacleGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const cloned = child.geometry.clone();
        cloned.applyMatrix4(child.matrixWorld);
        geometries.push(cloned);
      }
    });

    // Merge all geometries
    return BufferGeometryUtils.mergeGeometries(geometries);
  }

  private addAlienDetails(type: 'small' | 'medium' | 'large'): void {
    switch (type) {
      case 'small':
        this.addAlienEyes(0.1, 0.15, 0xff0000);
        break;
      case 'medium':
        this.addAlienEyes(0.15, 0.2, 0xffff00);
        break;
      case 'large':
        this.addAlienEyes(0.2, 0.3, 0xff00ff);
        // Add an antenna to large aliens
        this.addAlienAntenna(0.5);
        break;
    }
  }

  private addAlienEyes(size: number, spacing: number, color: number): void {
    // Create eye geometry
    const eyeGeometry = new THREE.SphereGeometry(size, 16, 16);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: color });

    // Create left eye
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-spacing, size * 1.5, size * 4);
    this.mesh.add(leftEye);

    // Create right eye
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(spacing, size * 1.5, size * 4);
    this.mesh.add(rightEye);
  }

  private addAlienAntenna(height: number): void {
    const antennaGeometry = new THREE.CylinderGeometry(0.05, 0.05, height, 8);
    const antennaMaterial = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 0.8,
    });

    const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
    antenna.position.set(0, height / 2 + 0.2, 0);
    this.mesh.add(antenna);

    // Add a blinking light to the antenna
    const light = new THREE.PointLight(0xffff00, 0.8, 3);
    light.position.set(0, height, 0);
    this.mesh.add(light);

    // Make the light blink
    const blinkInterval = 0.5 + Math.random() * 0.5;
    setInterval(() => {
      light.visible = !light.visible;
    }, blinkInterval * 1000);
  }

  private setupAnimations(): void {
    // Setup alien spin animation
    const spinTrack = new THREE.NumberKeyframeTrack(
      '.rotation[y]', // Property to animate
      [0, 1], // Keyframe times
      [0, Math.PI * 2] // Values
    );

    // Create animation clip
    const spinClip = new THREE.AnimationClip('spin', 5, [spinTrack]);

    // Create animation action
    const spinAction = this.animationMixer!.clipAction(spinClip);
    spinAction.setLoop(THREE.LoopRepeat, Infinity);
    spinAction.play();

    this.animations.push(spinAction);
  }

  update(deltaTime: number): void {
    if (this.isDestroyed) return;

    // Update animations
    if (this.animationMixer) {
      this.animationMixer.update(deltaTime);
    }

    // Apply hovering motion
    const time = performance.now() / 1000;
    const hoverY = Math.sin(time * this.hoverFrequency + this.hoverOffset) * this.hoverAmplitude;

    // Get current position
    const position = this.body.translation();

    // Update position with hover effect
    this.body.setNextKinematicTranslation({
      x: position.x,
      y: this.initialY + hoverY,
      z: position.z,
    });

    // Update mesh position
    this.mesh.position.set(position.x, this.initialY + hoverY, position.z);
  }

  // Move the alien down by a specific amount
  moveDown(amount: number): void {
    this.initialY -= amount;

    // Update position
    const position = this.body.translation();
    this.body.setNextKinematicTranslation({
      x: position.x,
      y: this.initialY,
      z: position.z,
    });
  }

  // Handle alien being destroyed
  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    // Make the alien blink before disappearing
    if (this.mesh.material instanceof THREE.MeshStandardMaterial) {
      const material = this.mesh.material;
      const originalEmissiveIntensity = material.emissiveIntensity;

      // Flash before destroying
      let flashCount = 0;
      const maxFlashes = 3;
      const flashInterval = setInterval(() => {
        material.emissiveIntensity = flashCount % 2 === 0 ? 1.5 : originalEmissiveIntensity;
        flashCount++;

        if (flashCount >= maxFlashes * 2) {
          clearInterval(flashInterval);
          this.explode();
        }
      }, 100);
    } else {
      // If material manipulation not possible, just explode
      this.explode();
    }
  }

  private explode(): void {
    // Create explosion effect (particles, light flash, etc.)
    this.createExplosionEffect();

    // Hide the mesh
    this.mesh.visible = false;
  }

  private createExplosionEffect(): void {
    const position = this.body.translation();

    // Create explosion particles
    const particleCount = 30;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);

    // All particles start at center
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = 0;
      particlePositions[i * 3 + 1] = 0;
      particlePositions[i * 3 + 2] = 0;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    // Create particle material
    const particleMaterial = new THREE.PointsMaterial({
      color:
        this.mesh.material instanceof THREE.MeshStandardMaterial
          ? this.mesh.material.color
          : 0x00ff66,
      size: 0.2,
      transparent: true,
      opacity: 1.0,
    });

    // Create particle system
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.position.copy(this.mesh.position);

    // Get parent scene
    const scene = this.mesh.parent;
    if (scene) {
      scene.add(particles);

      // Create velocities for particles
      const velocities = [];
      for (let i = 0; i < particleCount; i++) {
        // Random direction
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const speed = Math.random() * 5 + 2;

        velocities.push({
          x: Math.sin(phi) * Math.cos(theta) * speed,
          y: Math.sin(phi) * Math.sin(theta) * speed,
          z: Math.cos(phi) * speed,
        });
      }

      // Animate particles
      const startTime = Date.now();
      const duration = 1000; // ms

      const animateExplosion = function () {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / duration;

        if (progress < 1.0) {
          const positions = particles.geometry.getAttribute('position').array;

          for (let i = 0; i < particleCount; i++) {
            const idx = i * 3;
            positions[idx] += velocities[i].x * 0.016;
            positions[idx + 1] += velocities[i].y * 0.016;
            positions[idx + 2] += velocities[i].z * 0.016;
          }

          particles.geometry.getAttribute('position').needsUpdate = true;

          // Fade out
          if (particles.material instanceof THREE.PointsMaterial) {
            particles.material.opacity = 1.0 - progress;
          }

          requestAnimationFrame(animateExplosion);
        } else {
          // Clean up
          scene.remove(particles);
          particles.geometry.dispose();

          if (particles.material instanceof THREE.Material) {
            particles.material.dispose();
          }
        }
      };

      // Start animation
      animateExplosion();

      // Add flash of light
      const flash = new THREE.PointLight(
        this.mesh.material instanceof THREE.MeshStandardMaterial
          ? this.mesh.material.color
          : 0x00ff66,
        2,
        10
      );
      flash.position.copy(this.mesh.position);
      scene.add(flash);

      // Remove flash after a short time
      setTimeout(() => {
        scene.remove(flash);
      }, 200);
    }
  }

  // Check if alien has reached the bottom of the play area
  hasReachedBottom(bottomY: number): boolean {
    return this.initialY <= bottomY;
  }

  dispose(): void {
    // Clean up resources
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }

    if (this.mesh.geometry) {
      this.mesh.geometry.dispose();
    }

    if (this.mesh.material instanceof THREE.Material) {
      this.mesh.material.dispose();
    } else if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach((material) => material.dispose());
    }
  }
}
