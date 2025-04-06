import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';
import { Paddle } from './Paddle';
import { Ball } from './Ball';
import { AlienManager } from './AlienManager';
import { PhysicsWorld } from './physics';
import { GameObject } from './types';

// Game states
enum GameState {
  READY, // Initial state, waiting for player to start
  PLAYING, // Game in progress
  GAME_OVER, // Player lost
  LEVEL_COMPLETE, // Player cleared a level
  PAUSED, // Game paused
}

export class GameManager implements GameObject {
  private scene: THREE.Scene;
  private physicsWorld: PhysicsWorld;
  private worldSize: number;

  // Game objects
  private paddle: Paddle;
  private ball: Ball;
  private alienManager: AlienManager;

  // Game state
  private state: GameState = GameState.READY;
  private score: number = 0;
  private lives: number = 3;
  private level: number = 1;

  // UI elements
  private scoreElement: HTMLElement | null = null;
  private livesElement: HTMLElement | null = null;
  private levelElement: HTMLElement | null = null;
  private messageElement: HTMLElement | null = null;

  // Boundaries
  private bottomBoundary: number = 0.5;
  private wallThickness: number = 1.0;

  // Ball lost tracking
  private ballLostTimeout: number | null = null;

  constructor(scene: THREE.Scene, physicsWorld: PhysicsWorld, worldSize: number) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.worldSize = worldSize;

    // Create game elements
    this.paddle = this.createPaddle();
    this.ball = this.createBall();
    this.alienManager = this.createAlienManager();

    // Create walls
    this.createWalls();

    // Create UI elements
    this.createUI();

    // Set up alien collision callback
    this.alienManager.setOnReachBottomCallback(() => {
      if (this.state === GameState.PLAYING) {
        this.gameOver();
      }
    });

    // Set up keyboard controls for game
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  private createPaddle(): Paddle {
    // Create paddle at bottom of screen
    const paddleSize = { width: 4, height: 0.5, depth: 1 };
    const paddlePosition = { x: 0, y: this.bottomBoundary, z: 0 };
    const paddle = new Paddle(paddleSize, paddlePosition, this.physicsWorld, this.worldSize);

    // Add to scene
    this.scene.add(paddle.mesh);

    return paddle;
  }

  private createBall(): Ball {
    // Create ball above paddle
    const ballRadius = 0.4;
    const ballPosition = { x: 0, y: this.bottomBoundary + 2, z: 0 };
    const ball = new Ball(ballRadius, ballPosition, this.physicsWorld, this.scene);

    // Add to scene
    this.scene.add(ball.mesh);

    return ball;
  }

  private createAlienManager(): AlienManager {
    // Create alien manager
    const alienManager = new AlienManager(
      this.scene,
      this.physicsWorld,
      this.worldSize,
      this.bottomBoundary + 1 // Bottom boundary for aliens slightly above paddle
    );

    return alienManager;
  }

  private createWalls(): void {
    // Calculate half size for the world
    const halfSize = this.worldSize / 2;

    // Create materials for the walls
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x444488,
      emissive: 0x111133,
      metalness: 0.3,
      roughness: 0.7,
    });

    // Create THREE wall meshes and physics bodies

    // Left Wall
    const leftWallGeometry = new THREE.BoxGeometry(this.wallThickness, 30, this.worldSize);
    const leftWallMesh = new THREE.Mesh(leftWallGeometry, wallMaterial);
    leftWallMesh.position.set(-halfSize - this.wallThickness / 2, 15, 0);
    this.scene.add(leftWallMesh);

    // Right Wall
    const rightWallGeometry = new THREE.BoxGeometry(this.wallThickness, 30, this.worldSize);
    const rightWallMesh = new THREE.Mesh(rightWallGeometry, wallMaterial);
    rightWallMesh.position.set(halfSize + this.wallThickness / 2, 15, 0);
    this.scene.add(rightWallMesh);

    // Top Wall
    const topWallGeometry = new THREE.BoxGeometry(
      this.worldSize + this.wallThickness * 2,
      this.wallThickness,
      this.worldSize
    );
    const topWallMesh = new THREE.Mesh(topWallGeometry, wallMaterial);
    topWallMesh.position.set(0, 30, 0);
    this.scene.add(topWallMesh);

    // Create physics bodies for walls

    // Left Wall
    const leftWallBody = this.physicsWorld.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(-halfSize - this.wallThickness / 2, 15, 0)
    );
    const leftWallCollider = RAPIER.ColliderDesc.cuboid(
      this.wallThickness / 2,
      15,
      this.worldSize / 2
    );
    leftWallCollider.setRestitution(1.0);
    this.physicsWorld.world.createCollider(leftWallCollider, leftWallBody);

    // Right Wall
    const rightWallBody = this.physicsWorld.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(halfSize + this.wallThickness / 2, 15, 0)
    );
    const rightWallCollider = RAPIER.ColliderDesc.cuboid(
      this.wallThickness / 2,
      15,
      this.worldSize / 2
    );
    rightWallCollider.setRestitution(1.0);
    this.physicsWorld.world.createCollider(rightWallCollider, rightWallBody);

    // Top Wall
    const topWallBody = this.physicsWorld.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, 30, 0)
    );
    const topWallCollider = RAPIER.ColliderDesc.cuboid(
      (this.worldSize + this.wallThickness * 2) / 2,
      this.wallThickness / 2,
      this.worldSize / 2
    );
    topWallCollider.setRestitution(1.0);
    this.physicsWorld.world.createCollider(topWallCollider, topWallBody);
  }

  private createUI(): void {
    // Create UI container
    const uiContainer = document.createElement('div');
    uiContainer.style.position = 'absolute';
    uiContainer.style.top = '10px';
    uiContainer.style.left = '10px';
    uiContainer.style.color = 'white';
    uiContainer.style.fontFamily = 'monospace';
    uiContainer.style.fontSize = '18px';
    uiContainer.style.textShadow = '2px 2px 2px black';

    // Score display
    this.scoreElement = document.createElement('div');
    this.scoreElement.id = 'score';
    this.scoreElement.textContent = `SCORE: ${this.score}`;
    this.scoreElement.style.marginBottom = '10px';
    uiContainer.appendChild(this.scoreElement);

    // Lives display
    this.livesElement = document.createElement('div');
    this.livesElement.id = 'lives';
    this.livesElement.textContent = `LIVES: ${this.lives}`;
    this.livesElement.style.marginBottom = '10px';
    uiContainer.appendChild(this.livesElement);

    // Level display
    this.levelElement = document.createElement('div');
    this.levelElement.id = 'level';
    this.levelElement.textContent = `LEVEL: ${this.level}`;
    uiContainer.appendChild(this.levelElement);

    // Message element (for game over, level complete, etc.)
    this.messageElement = document.createElement('div');
    this.messageElement.id = 'message';
    this.messageElement.style.position = 'absolute';
    this.messageElement.style.top = '50%';
    this.messageElement.style.left = '50%';
    this.messageElement.style.transform = 'translate(-50%, -50%)';
    this.messageElement.style.color = 'white';
    this.messageElement.style.fontFamily = 'monospace';
    this.messageElement.style.fontSize = '36px';
    this.messageElement.style.textShadow = '2px 2px 4px black';
    this.messageElement.style.padding = '20px';
    this.messageElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    this.messageElement.style.borderRadius = '10px';
    this.messageElement.style.textAlign = 'center';
    this.messageElement.style.display = 'none';

    // Add UI elements to DOM
    document.body.appendChild(uiContainer);
    document.body.appendChild(this.messageElement);

    // Show initial message
    this.showMessage('PONG INVADERS\n\nPress SPACE to Start\n\nUse A/D or Arrow Keys to move');
  }

  update(deltaTime: number): void {
    if (this.state === GameState.PAUSED) {
      return;
    }

    // Update game objects
    this.paddle.update(deltaTime);
    this.ball.update(deltaTime);
    this.alienManager.update(deltaTime);

    // Only process gameplay logic when in PLAYING state
    if (this.state === GameState.PLAYING) {
      // Check for collisions with aliens
      const ballPosition = this.ball.mesh.position;
      const points = this.alienManager.checkCollisions(ballPosition, 0.4);

      // Add points if any were scored
      if (points > 0) {
        this.addScore(points);
      }

      // Check if level is complete
      if (this.alienManager.areAllDestroyed()) {
        this.levelComplete();
      }

      // Check if ball is below paddle (lost ball)
      if (ballPosition.y < this.bottomBoundary - 3) {
        this.ballLost();
      }
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case ' ': // Space bar
        if (this.state === GameState.READY || this.state === GameState.LEVEL_COMPLETE) {
          this.startGame();
        } else if (this.state === GameState.GAME_OVER) {
          this.resetGame();
        }
        break;

      case 'p':
      case 'P':
        this.togglePause();
        break;
    }
  }

  private startGame(): void {
    // Hide message
    this.hideMessage();

    // Set game state to playing
    this.state = GameState.PLAYING;

    // Reset ball if needed
    if (this.state === GameState.LEVEL_COMPLETE) {
      const resetPosition = {
        x: 0,
        y: this.bottomBoundary + 2,
        z: 0,
      };
      this.ball.reset(resetPosition);
    }
  }

  private togglePause(): void {
    if (this.state === GameState.PLAYING) {
      this.state = GameState.PAUSED;
      this.showMessage('PAUSED\n\nPress P to Resume');
    } else if (this.state === GameState.PAUSED) {
      this.state = GameState.PLAYING;
      this.hideMessage();
    }
  }

  private ballLost(): void {
    // Prevent multiple ball lost events
    if (this.ballLostTimeout !== null) {
      return;
    }

    // Decrement lives
    this.lives--;
    this.updateLivesDisplay();

    // Check for game over
    if (this.lives <= 0) {
      this.gameOver();
      return;
    }

    // Reset ball position
    const resetPosition = {
      x: 0,
      y: this.bottomBoundary + 2,
      z: 0,
    };
    this.ball.reset(resetPosition);

    // Show message
    this.showMessage(`BALL LOST\n\nLives: ${this.lives}\n\nContinuing in 2 seconds...`);

    // Pause briefly before continuing
    this.state = GameState.READY;

    this.ballLostTimeout = window.setTimeout(() => {
      this.hideMessage();
      this.state = GameState.PLAYING;
      this.ballLostTimeout = null;
    }, 2000);
  }

  private gameOver(): void {
    this.state = GameState.GAME_OVER;
    this.showMessage('GAME OVER\n\nPress SPACE to Restart');
  }

  private levelComplete(): void {
    this.state = GameState.LEVEL_COMPLETE;

    // Increment level
    this.level++;
    this.updateLevelDisplay();

    // Show message
    this.showMessage(
      `LEVEL ${this.level - 1} COMPLETE!\n\nPress SPACE to Start Level ${this.level}`
    );

    // Reset aliens with increased difficulty
    this.alienManager.reset();
    this.alienManager.setDifficulty(this.level);
  }

  private resetGame(): void {
    // Reset game state
    this.score = 0;
    this.lives = 3;
    this.level = 1;

    // Update UI
    this.updateScoreDisplay();
    this.updateLivesDisplay();
    this.updateLevelDisplay();

    // Reset game objects
    const paddlePosition = { x: 0, y: this.bottomBoundary, z: 0 };
    this.paddle.reset(paddlePosition);

    const ballPosition = { x: 0, y: this.bottomBoundary + 2, z: 0 };
    this.ball.reset(ballPosition);

    this.alienManager.reset();
    this.alienManager.setDifficulty(this.level);

    // Set state to ready
    this.state = GameState.READY;

    // Show start message
    this.showMessage('PONG INVADERS\n\nPress SPACE to Start\n\nUse A/D or Arrow Keys to move');
  }

  private addScore(points: number): void {
    this.score += points;
    this.updateScoreDisplay();
  }

  private updateScoreDisplay(): void {
    if (this.scoreElement) {
      this.scoreElement.textContent = `SCORE: ${this.score}`;
    }
  }

  private updateLivesDisplay(): void {
    if (this.livesElement) {
      this.livesElement.textContent = `LIVES: ${this.lives}`;
    }
  }

  private updateLevelDisplay(): void {
    if (this.levelElement) {
      this.levelElement.textContent = `LEVEL: ${this.level}`;
    }
  }

  private showMessage(message: string): void {
    if (this.messageElement) {
      this.messageElement.innerHTML = message.replace(/\n/g, '<br>');
      this.messageElement.style.display = 'block';
    }
  }

  private hideMessage(): void {
    if (this.messageElement) {
      this.messageElement.style.display = 'none';
    }
  }

  dispose(): void {
    // Clear timeout if it exists
    if (this.ballLostTimeout !== null) {
      clearTimeout(this.ballLostTimeout);
      this.ballLostTimeout = null;
    }

    // Remove event listeners
    window.removeEventListener('keydown', this.handleKeyDown.bind(this));

    // Clean up game objects
    this.paddle.removeEventListeners();
    this.ball.dispose();
    this.alienManager.dispose();

    // Remove UI elements
    if (this.scoreElement?.parentNode) {
      this.scoreElement.parentNode.remove();
    }
    if (this.messageElement) {
      this.messageElement.remove();
    }
  }
}
