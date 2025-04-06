import * as THREE from 'three';
import { Alien } from './Alien';
import { PlayState } from './playState';
import { Ball } from './Ball';

// Direction of alien swarm movement
type SwarmDirection = 'left' | 'right';

export class AlienManager {
  private game: PlayState;
  private aliens: Alien[] = [];
  private scene: THREE.Scene;

  private rows: number = 5;
  private columns: number = 9;
  private horizontalSpacing: number = 2;
  private verticalSpacing: number = 1.5;
  private horizontalSpeed: number = 1.5; // How fast the aliens move sideways
  private moveDownAmount: number = 0.5; // How far down aliens move when reaching edge
  private currentDirection: SwarmDirection = 'right';
  private moveTimer: number = 0;
  private moveInterval: number = 1.0; // Time between alien movements
  private speedIncreasePerAlien: number = 0.025; // How much to speed up per dead alien
  private worldBounds: { min: number; max: number };

  // Bottom boundary for game over condition
  private bottomBoundary: number;

  // Track if the swarm has reached the bottom
  private hasReachedBottom: boolean = false;

  // Reference to the callback function for reaching bottom
  private onReachBottom: (() => void) | null = null;

  constructor(
    game: PlayState,
    scene: THREE.Scene,
    worldSize: number,
    bottomBoundary: number = 1.0
  ) {
    this.game = game;
    this.scene = scene;
    this.worldBounds = {
      min: -worldSize / 2 + 1.5, // Add margin from edge
      max: worldSize / 2 - 1.5,
    };
    this.bottomBoundary = bottomBoundary;

    // Create initial alien formation
    this.createAlienFormation();
  }

  // Create a formation of aliens in rows and columns
  private createAlienFormation(): void {
    // Start position for the grid (centered)
    const startX = -((this.columns - 1) * this.horizontalSpacing) / 2;
    const startY = 15; // Start height
    const startZ = -5; // Start depth position

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        // Determine alien type based on row
        let type: 'small' | 'medium' | 'large';
        if (row === 0) {
          type = 'small'; // Top row has small aliens worth more points
        } else if (row < 3) {
          type = 'medium'; // Middle rows have medium aliens
        } else {
          type = 'large'; // Bottom rows have large aliens
        }

        // Calculate position
        const x = startX + col * this.horizontalSpacing;
        const y = startY - row * this.verticalSpacing;
        const z = startZ;

        // Create alien with size based on type
        let size: { width: number; height: number; depth: number };
        switch (type) {
          case 'small':
            size = { width: 1.0, height: 0.8, depth: 1.0 };
            break;
          case 'medium':
            size = { width: 1.3, height: 0.6, depth: 1.3 };
            break;
          case 'large':
            size = { width: 1.5, height: 1.0, depth: 1.5 };
            break;
        }

        // Create alien
        const alien = new Alien(this.game, size, { x, y, z }, type);

        // Add to scene and aliens array
        this.scene.add(alien.mesh);
        this.aliens.push(alien);
      }
    }
  }

  update(deltaTime: number): void {
    // Update each alien
    this.aliens.forEach((alien) => alien.update(deltaTime));

    // Move swarm over time
    this.moveTimer += deltaTime;
    if (this.moveTimer >= this.moveInterval) {
      this.moveTimer = 0;
      this.moveSwarm();
    }

    // Check if the formation has reached the bottom
    this.checkBottomReached();
  }

  // Move the entire alien formation
  private moveSwarm(): void {
    // Calculate movement distance
    const movementDistance = this.horizontalSpeed * this.moveInterval;

    // Find the alien at the edge in the current direction
    let edgeAlien: Alien | null = null;
    if (this.currentDirection === 'right') {
      // Find rightmost alien
      let maxX = -Infinity;
      this.aliens.forEach((alien) => {
        if (!alien.isDestroyed) {
          const position = alien.translation();
          if (position.x > maxX) {
            maxX = position.x;
            edgeAlien = alien;
          }
        }
      });
    } else {
      // Find leftmost alien
      let minX = Infinity;
      this.aliens.forEach((alien) => {
        if (!alien.isDestroyed) {
          const position = alien.translation();
          if (position.x < minX) {
            minX = position.x;
            edgeAlien = alien;
          }
        }
      });
    }

    // Check if swarm needs to change direction
    let shouldMoveDown = false;
    if (edgeAlien) {
      const position = edgeAlien.translation();
      const alienHalfWidth = edgeAlien.size.width / 2;

      if (
        this.currentDirection === 'right' &&
        position.x + alienHalfWidth + movementDistance > this.worldBounds.max
      ) {
        this.currentDirection = 'left';
        shouldMoveDown = true;
      } else if (
        this.currentDirection === 'left' &&
        position.x - alienHalfWidth - movementDistance < this.worldBounds.min
      ) {
        this.currentDirection = 'right';
        shouldMoveDown = true;
      }
    }

    // Move all aliens
    this.aliens.forEach((alien) => {
      if (!alien.isDestroyed) {
        // Move horizontally
        const position = alien.translation();
        const movement = this.currentDirection === 'right' ? movementDistance : -movementDistance;

        alien.setTranslation({
          x: position.x + movement,
          y: position.y,
          z: position.z,
        });

        // Move down if needed
        if (shouldMoveDown) {
          alien.moveDown(this.moveDownAmount);
        }
      }
    });
  }

  // Check if ball has hit any aliens
  checkCollisions(ball: Ball): number {
    let pointsScored = 0;
    const ballPosition = ball.position;
    const ballRadius = ball.size.radius;

    this.aliens.forEach((alien) => {
      if (!alien.isDestroyed) {
        const alienPos = alien.translation();
        const alienRadius = alien.size.width / 2;

        // Calculate distance between ball and alien (ignoring z coordinate for 2D collision)
        const distance = Math.sqrt(
          Math.pow(ballPosition.x - alienPos.x, 2) + Math.pow(ballPosition.y - alienPos.y, 2)
        );

        // If collision detected
        if (distance < ballRadius + alienRadius) {
          // Calculate normal vector (direction from alien to ball)
          const normal = new THREE.Vector3(
            ballPosition.x - alienPos.x,
            ballPosition.y - alienPos.y,
            0 // Set z component to 0 to keep bounce reflections in the xy plane
          ).normalize();

          // Calculate dot product for reflection
          const dot = ball.velocity.dot(normal);

          // Update ball velocity (reflect)
          ball.velocity.x -= 2 * dot * normal.x;
          ball.velocity.y -= 2 * dot * normal.y;
          ball.velocity.z -= 2 * dot * normal.z;

          // Slightly boost the ball speed after hitting an alien
          const speedBoost = 1.05;
          ball.velocity.multiplyScalar(speedBoost);

          // Destroy the alien and score points
          alien.destroy();
          pointsScored += alien.points;

          // Increase speed as aliens are destroyed
          this.increaseSpeed();
        }
      }
    });

    return pointsScored;
  }

  // Increase swarm speed as aliens are destroyed
  private increaseSpeed(): void {
    const aliveCount = this.getAliveCount();
    const totalCount = this.rows * this.columns;

    // Calculate new movement interval based on how many aliens are left
    const destroyedCount = totalCount - aliveCount;
    const speedIncrease = destroyedCount * this.speedIncreasePerAlien;

    // Don't let the interval go below a minimum threshold
    const minInterval = 0.2;
    this.moveInterval = Math.max(1.0 - speedIncrease, minInterval);
  }

  // Check if the formation has reached the bottom boundary
  private checkBottomReached(): void {
    if (this.hasReachedBottom) return;

    for (const alien of this.aliens) {
      if (!alien.isDestroyed && alien.hasReachedBottom(this.bottomBoundary)) {
        this.hasReachedBottom = true;
        if (this.onReachBottom) {
          this.onReachBottom();
        }
        break;
      }
    }
  }

  // Set callback for when aliens reach the bottom
  setOnReachBottomCallback(callback: () => void): void {
    this.onReachBottom = callback;
  }

  // Get the number of aliens still alive
  getAliveCount(): number {
    return this.aliens.filter((alien) => !alien.isDestroyed).length;
  }

  // Check if all aliens are destroyed
  areAllDestroyed(): boolean {
    return this.getAliveCount() === 0;
  }

  // Reset the alien formation for a new level
  reset(): void {
    // Remove all existing aliens
    this.aliens.forEach((alien) => {
      alien.dispose();
    });
    this.aliens = [];

    // Create new formation
    this.createAlienFormation();

    // Reset state
    this.moveTimer = 0;
    this.currentDirection = 'right';
    this.moveInterval = 1.0;
    this.hasReachedBottom = false;
  }

  // Set the difficulty level (used for new levels)
  setDifficulty(level: number): void {
    // Increase speed and movement based on level
    this.horizontalSpeed = 1.5 + (level - 1) * 0.3;
    this.moveDownAmount = 0.5 + (level - 1) * 0.1;
    this.speedIncreasePerAlien = 0.025 + (level - 1) * 0.005;
  }

  // Clean up resources
  dispose(): void {
    this.aliens.forEach((alien) => {
      alien.dispose();
    });
    this.aliens = [];
  }
}
