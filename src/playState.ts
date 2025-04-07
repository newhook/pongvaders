import * as THREE from 'three';
import { IGameState } from './gameStates';
import { GameStateManager } from './gameStateManager';
import { GameConfig, defaultConfig } from './config';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GameObject } from './types';
import { Paddle } from './Paddle';
import { Ball } from './Ball';
import { AlienManager } from './AlienManager';

// Game states
enum GameState {
  READY, // Initial state, waiting for player to start
  PLAYING, // Game in progress
  GAME_OVER, // Player lost
  LEVEL_COMPLETE, // Player cleared a level
  PAUSED, // Game paused
}

// Add debug flag
const DEBUG_COLLISION_BOUNDARIES = false; // Set to true to enable collision boundary visualization

export class PlayState implements IGameState {
  public gameStateManager: GameStateManager;
  scene: THREE.Scene;
  worldBounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };

  // Expose debug collision boundaries property that can be accessed by other classes
  public debugCollisionBoundaries: boolean = DEBUG_COLLISION_BOUNDARIES;

  private camera: THREE.PerspectiveCamera;
  private cameraControls: OrbitControls | null = null;
  config: GameConfig;

  // Make balls public so AlienManager can access them
  public balls: Ball[] = [];
  private paddles: Paddle[] = [];
  private alienManager: AlienManager;

  // Wireframe mode state
  private isWireframeMode: boolean = false;

  // Keyboard event listener for wireframe toggle
  private keydownListener: (event: KeyboardEvent) => void;
  // Click event listener for ball release
  private clickListener: (event: MouseEvent) => void;

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

  constructor(gameStateManager: GameStateManager) {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000022); // Deep space blue

    // Setup game state with configuration
    this.config = {
      ...defaultConfig,
    };

    this.gameStateManager = gameStateManager;

    // Set up world bounds based on config
    const halfSize = this.config.worldSize / 2;
    this.worldBounds = {
      minX: -halfSize,
      maxX: halfSize,
      minY: 0, // Bottom at y=0
      maxY: 30, // Top at y=30 (from createWalls in GameManager)
      minZ: -halfSize,
      maxZ: halfSize,
    };

    // Set up camera with increased far plane
    this.camera = new THREE.PerspectiveCamera(
      60, // FOV
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );

    // Position the camera to view the game area
    this.camera.position.set(0, 15, 20);
    this.camera.lookAt(0, 8, 0);

    // Add camera controls to allow user to rotate and zoom
    const renderer = this.gameStateManager.renderer;
    if (renderer) {
      this.cameraControls = new OrbitControls(this.camera, renderer.domElement);
      this.cameraControls.enableDamping = true;
      this.cameraControls.dampingFactor = 0.05;
      this.cameraControls.screenSpacePanning = false;
      this.cameraControls.minDistance = 15;
      this.cameraControls.maxDistance = 40;
      this.cameraControls.maxPolarAngle = Math.PI / 2 - 0.1; // Prevent going below ground

      // Set initial position for best game viewing
      this.cameraControls.target.set(0, 8, 0);
    }

    // Add lighting for the game scene
    this.setupLighting();

    // Create keyboard event listener for wireframe toggle and game controls
    this.setupKeyboardControls();

    // Create click listener for ball release
    this.setupClickListener();

    // Create surface mesh
    this.createSurfaceMesh();

    // Create walls
    this.createWalls();

    // Create UI elements
    this.createUI();

    // Initialize game elements
    this.paddles.push(this.createPaddle());
    this.balls.push(this.createBall());
    this.alienManager = this.createAlienManager();
    this.alienManager.setOnReachBottomCallback(() => {
      if (this.state === GameState.PLAYING) {
        this.gameOver();
      }
    });
  }

  getPhysicsObjectCount(): number {
    return this.balls.length + this.paddles.length;
  }

  // Simple collision detection integrated into PlayState
  private ballVsBox(
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

  private ballVsBall(
    pos1: THREE.Vector3,
    radius1: number,
    pos2: THREE.Vector3,
    radius2: number
  ): boolean {
    const distance = pos1.distanceTo(pos2);
    return distance < radius1 + radius2;
  }

  // Simple collision resolution for ball vs box
  private resolveBallBoxCollision(
    ball: GameObject,
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

  // Set up keyboard event listeners
  private setupKeyboardControls(): void {
    this.keydownListener = (event: KeyboardEvent) => {
      // Wireframe toggle
      if (event.key === 'f' || event.key === 'F') {
        this.isWireframeMode = !this.isWireframeMode;
        this.toggleWireframeMode(this.scene, this.isWireframeMode);
      }
      // Collision boundary visualization toggle
      else if (event.key === 'c' || event.key === 'C') {
        this.debugCollisionBoundaries = !this.debugCollisionBoundaries;
        this.toggleCollisionBoundaries();
      }
      // Game controls
      else if (event.key === ' ') {
        // Space bar
        if (this.state === GameState.READY || this.state === GameState.LEVEL_COMPLETE) {
          this.startGame();
        } else if (this.state === GameState.GAME_OVER) {
          this.resetGame();
        } else if (this.state === GameState.PLAYING) {
          // Release the ball if it's attached to the paddle
          this.releaseBall();
        }
      } else if (event.key === 'p' || event.key === 'P') {
        this.togglePause();
      }
    };
  }

  // Set up click event listener for ball release
  private setupClickListener(): void {
    this.clickListener = (event: MouseEvent) => {
      // Only release the ball if we're in PLAYING state
      if (this.state === GameState.PLAYING) {
        this.releaseBall();
      }
    };
  }

  // Release the ball from the paddle
  private releaseBall(): void {
    for (const ball of this.balls) {
      if (ball.isAttachedToPaddle) {
        ball.releaseBall();
        break; // Only release one ball at a time
      }
    }
  }

  private createPaddle(): Paddle {
    // Create paddle at bottom of screen
    const paddleSize = { width: 4, height: 0.5, depth: 1 };
    const paddlePosition = { x: 0, y: this.bottomBoundary, z: 0 };
    const paddle = new Paddle(this, paddleSize, paddlePosition, this.config.worldSize);

    // Add to scene
    this.scene.add(paddle.mesh);

    return paddle;
  }

  private createBall(): Ball {
    // Create ball above paddle
    const ballRadius = 0.4;
    const ballPosition = { x: 0, y: this.bottomBoundary + 2, z: 0 };
    const ball = new Ball(this, ballRadius, ballPosition, this.scene);

    // Ensure the ball starts on the paddle
    if (this.paddles.length > 0) {
      ball.attachToPaddle(this.paddles[0].position, this.paddles[0].size);
    }

    // Add to scene
    this.scene.add(ball.mesh);

    return ball;
  }

  private createAlienManager(): AlienManager {
    // Create alien manager
    const alienManager = new AlienManager(
      this,
      this.scene,
      this.config.worldSize,
      this.bottomBoundary + 1 // Bottom boundary for aliens slightly above paddle
    );

    return alienManager;
  }

  private createWalls(): void {
    // Calculate half size for the world
    const halfSize = this.config.worldSize / 2;

    // Create materials for the walls
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x444488,
      emissive: 0x111133,
      metalness: 0.3,
      roughness: 0.7,
    });

    // Create THREE wall meshes and physics bodies

    // Left Wall
    const leftWallGeometry = new THREE.BoxGeometry(this.wallThickness, 30, this.config.worldSize);
    const leftWallMesh = new THREE.Mesh(leftWallGeometry, wallMaterial);
    leftWallMesh.position.set(-halfSize - this.wallThickness / 2, 15, 0);
    this.scene.add(leftWallMesh);

    // Right Wall
    const rightWallGeometry = new THREE.BoxGeometry(this.wallThickness, 30, this.config.worldSize);
    const rightWallMesh = new THREE.Mesh(rightWallGeometry, wallMaterial);
    rightWallMesh.position.set(halfSize + this.wallThickness / 2, 15, 0);
    this.scene.add(rightWallMesh);

    // Top Wall
    const topWallGeometry = new THREE.BoxGeometry(
      this.config.worldSize + this.wallThickness * 2,
      this.wallThickness,
      this.config.worldSize
    );
    const topWallMesh = new THREE.Mesh(topWallGeometry, wallMaterial);
    topWallMesh.position.set(0, 30, 0);
    this.scene.add(topWallMesh);

    // Note: We don't need to create explicit physics bodies for walls
    // since the SimplePhysics system handles world boundaries automatically
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

    // Instructions for ball release
    const instructionsElement = document.createElement('div');
    instructionsElement.id = 'instructions';
    instructionsElement.style.position = 'absolute';
    instructionsElement.style.bottom = '20px';
    instructionsElement.style.left = '50%';
    instructionsElement.style.transform = 'translateX(-50%)';
    instructionsElement.style.color = 'white';
    instructionsElement.style.fontFamily = 'monospace';
    instructionsElement.style.fontSize = '16px';
    instructionsElement.style.textShadow = '1px 1px 2px black';
    instructionsElement.style.padding = '10px';
    instructionsElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    instructionsElement.style.borderRadius = '5px';
    instructionsElement.style.textAlign = 'center';
    instructionsElement.textContent = 'Click or press SPACE to release ball';
    document.body.appendChild(instructionsElement);

    // Show initial message
    this.showMessage('PONG INVADERS\n\nPress SPACE to Start\n\nUse A/D or Arrow Keys to move');
  }

  // Set up lighting for the game scene
  private setupLighting(): void {
    // Ambient light for overall scene brightness
    const ambientLight = new THREE.AmbientLight(0x444466, 1.0);
    this.scene.add(ambientLight);

    // Main directional light to cast shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(0, 30, 10);
    directionalLight.castShadow = true;

    // Configure shadow properties
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;

    // Set up shadow camera frustum
    const d = 30;
    directionalLight.shadow.camera.left = -d;
    directionalLight.shadow.camera.right = d;
    directionalLight.shadow.camera.top = d;
    directionalLight.shadow.camera.bottom = -d;

    this.scene.add(directionalLight);

    // Add point lights for dramatic effect
    const pointLight1 = new THREE.PointLight(0x0077ff, 2, 20);
    pointLight1.position.set(-10, 10, 5);
    this.scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xff3300, 2, 20);
    pointLight2.position.set(10, 10, 5);
    this.scene.add(pointLight2);
  }

  // Game state management methods
  private startGame(): void {
    // Hide message
    this.hideMessage();
    this.alienManager.reset();

    // Set game state to playing
    this.state = GameState.PLAYING;
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

  private ballLost(ball: Ball): void {
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
    ball.reset(resetPosition);

    // Attach ball to paddle
    if (this.paddles.length > 0) {
      ball.attachToPaddle(this.paddles[0].position, this.paddles[0].size);
    }

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

    // Reset ball position on paddle
    const ballPosition = { x: 0, y: this.bottomBoundary + 2, z: 0 };
    for (const ball of this.balls) {
      ball.reset(ballPosition);
      if (this.paddles.length > 0) {
        ball.attachToPaddle(this.paddles[0].position, this.paddles[0].size);
      }
    }
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
    for (const paddle of this.paddles) {
      paddle.reset(paddlePosition);
    }

    const ballPosition = { x: 0, y: this.bottomBoundary + 2, z: 0 };
    for (const ball of this.balls) {
      ball.reset(ballPosition);
      if (this.paddles.length > 0) {
        ball.attachToPaddle(this.paddles[0].position, this.paddles[0].size);
      }
    }

    this.alienManager.reset();
    this.alienManager.setDifficulty(this.level);

    // Clear any additional objects that might have been added
    this.balls = [this.createBall()];
    this.paddles = [this.createPaddle()];

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

  // Create a surface-level mesh to represent the ground/base
  private createSurfaceMesh(): void {
    // Create a ground plane with dark material
    const groundSize = this.config.worldSize;
    const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize);

    // Rotate plane to be horizontal
    groundGeometry.rotateX(-Math.PI / 2);

    // Create ground material with a grid pattern
    const gridTexture = new THREE.TextureLoader().load(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAF8WlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczpxPSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNi4wLWMwMDIgNzkuMTY0NDg4LCAyMDIwLzA3LzEwLTIyOjA2OjUzICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczpxbXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bWxuczpxbXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ0MgKFdpbmRvd3MpIiB4bXA6Q3JlYXRlRGF0ZT0iMjAyMC0wOC0xMFQxMjo1MjozNyswMjowMCIgeG1wOk1vZGlmeURhdGU9IjIwMjAtMDgtMTBUMTI6NTU6NDMrMDI6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMjAtMDgtMTBUMTI6NTU6NDMrMDI6MDAiIGRjOmZvcm1hdD0iaW1hZ2UvcG5nIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWQ6NDJmNjFmNzUtNzBlZS00YTRhLThlNzAtZjAzMTI4MGNlNGE4OCIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpjNzNmNjkyYi00MDdlLTQzOTAtODBlNC1jNzVlYmU0ZTRmZDYiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjcmVhdGVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWQ6YzczZjY5MmItNDA3ZS00MzkwLTgwZTQtYzc1ZWJlNGU0ZmQ2IiBzdEV2dDp3aGVuPSIyMDIwLTA4LTEwVDEyOjU1OjQzKzAyOjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgQ0MgKFdpbmRvd3MpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDwvcmRmOlNlcT4gPC94bXBNTTpIaXN0b3J5PiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Ps3gIaEAAAFRSURBVHja7dpBDoMgEAVQ6L3qCt3D/U/gHu5dV5jYGI3owEyVCfMXJhiG8QvVaPR8nJcB8I+AAiiAAvgdIAfNGxF9XtNvXdYp/fQkACnFVNYlvX7TJU3Hf3QBZPt0gGTzwQBq9PQTwOzRmwDMHr1qAFUIFkAVggVQhWABXCEYAL2IzAJQSsoNMDN+HMAMAgZQQlgA7SCVgHtCqAFmEVgAsSOsAlQhWgBViB5AEaIHQIIo2YSQIEo2ISSIr06CCKJkE8KFCAsQQoQFCCHCAnQR2QCeEKEALUQ4QA0RDlBDhAPkjehlKhzA+kj9tAs8IGrWRx4QTYMYGsQiPe1qvl9tAD6ivgJrfV+H+P41Ig6dg/MQMeicnIOIQefkHEQMOifnIGLQOTkHkUZnA+IqXYN4ZLIHcZWWgXhk62A/AAAAAAAAAAAAzMcNlrWuLcW3oLkAAAAASUVORK5CYII='
    );

    // Set texture repeating
    gridTexture.wrapS = THREE.RepeatWrapping;
    gridTexture.wrapT = THREE.RepeatWrapping;
    gridTexture.repeat.set(groundSize / 5, groundSize / 5);

    // Create ground material with grid texture
    const groundMaterial = new THREE.MeshStandardMaterial({
      map: gridTexture,
      color: 0x110022, // Dark purple for space feel
      roughness: 0.8,
      metalness: 0.2,
    });

    // Create the ground mesh
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.receiveShadow = true;
    groundMesh.position.y = 0;

    // Add ground mesh to the scene
    this.scene.add(groundMesh);

    // Add stars to the background
    this.createStarfield();
  }

  // Create a starfield for the background
  private createStarfield(): void {
    const starCount = 2000;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    // Random star positions in a large sphere around the scene
    const radius = 500;
    for (let i = 0; i < starCount; i++) {
      // Random spherical coordinates
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * Math.cbrt(Math.random()); // Cube root for more uniform distribution

      // Convert to cartesian coordinates
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);

      // Random star colors (mostly white, some blue/red)
      const colorChoice = Math.random();
      if (colorChoice < 0.8) {
        // White to light blue
        starColors[i * 3] = 0.8 + Math.random() * 0.2;
        starColors[i * 3 + 1] = 0.8 + Math.random() * 0.2;
        starColors[i * 3 + 2] = 0.9 + Math.random() * 0.1;
      } else if (colorChoice < 0.95) {
        // Red/orange
        starColors[i * 3] = 0.8 + Math.random() * 0.2;
        starColors[i * 3 + 1] = 0.3 + Math.random() * 0.5;
        starColors[i * 3 + 2] = 0.2 + Math.random() * 0.2;
      } else {
        // Bright blue
        starColors[i * 3] = 0.2 + Math.random() * 0.2;
        starColors[i * 3 + 1] = 0.5 + Math.random() * 0.3;
        starColors[i * 3 + 2] = 0.8 + Math.random() * 0.2;
      }
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(stars);

    // Add a few brighter stars that twinkle
    this.createTwinklingStars();
  }

  // Create some larger stars that twinkle
  private createTwinklingStars(): void {
    const twinkleCount = 50;
    const twinkleGeometry = new THREE.BufferGeometry();
    const twinklePositions = new Float32Array(twinkleCount * 3);

    // Random positions for twinkling stars
    const radius = 300;
    for (let i = 0; i < twinkleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * Math.random();

      twinklePositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      twinklePositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      twinklePositions[i * 3 + 2] = r * Math.cos(phi);
    }

    twinkleGeometry.setAttribute('position', new THREE.BufferAttribute(twinklePositions, 3));

    // Create materials with different colors
    const materials = [
      new THREE.PointsMaterial({ color: 0xffffff, size: 3, transparent: true }),
      new THREE.PointsMaterial({ color: 0x88ccff, size: 2.5, transparent: true }),
      new THREE.PointsMaterial({ color: 0xffcc88, size: 2.7, transparent: true }),
    ];

    // Create different star groups with different materials
    for (const material of materials) {
      const twinkleStars = new THREE.Points(twinkleGeometry, material);
      this.scene.add(twinkleStars);

      // Create twinkling animation
      const minOpacity = 0.2 + Math.random() * 0.3;
      const maxOpacity = 0.7 + Math.random() * 0.3;
      const twinkleSpeed = 0.3 + Math.random() * 0.7;

      // Animate opacity for twinkling effect
      const animate = () => {
        const time = Date.now() * 0.001;
        material.opacity = minOpacity + Math.sin(time * twinkleSpeed) * (maxOpacity - minOpacity);
        requestAnimationFrame(animate);
      };

      animate();
    }
  }

  // Toggle wireframe mode for all materials in the scene
  private toggleWireframeMode(scene: THREE.Scene, isWireframe: boolean): void {
    // Create a notification about wireframe mode
    const wireframeNotification = document.createElement('div');
    wireframeNotification.style.position = 'absolute';
    wireframeNotification.style.top = '140px';
    wireframeNotification.style.left = '10px';
    wireframeNotification.style.color = '#00ff00';
    wireframeNotification.style.fontFamily = 'monospace';
    wireframeNotification.style.fontSize = '16px';
    wireframeNotification.style.padding = '5px';
    wireframeNotification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    wireframeNotification.style.border = '1px solid #00ff00';
    wireframeNotification.style.transition = 'opacity 0.5s ease-in-out';
    wireframeNotification.style.opacity = '1';
    wireframeNotification.textContent = isWireframe ? 'WIREFRAME MODE: ON' : 'WIREFRAME MODE: OFF';

    document.body.appendChild(wireframeNotification);

    // Fade out after 2 seconds
    setTimeout(() => {
      wireframeNotification.style.opacity = '0';
      // Remove from DOM after fade out
      setTimeout(() => {
        document.body.removeChild(wireframeNotification);
      }, 500);
    }, 2000);

    // Process the scene to toggle wireframe for all materials
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material) {
        // Handle array of materials
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => {
            if (
              material instanceof THREE.MeshStandardMaterial ||
              material instanceof THREE.MeshBasicMaterial ||
              material instanceof THREE.MeshPhongMaterial
            ) {
              material.wireframe = isWireframe;
            }
          });
        }
        // Handle single material
        else if (
          object.material instanceof THREE.MeshStandardMaterial ||
          object.material instanceof THREE.MeshBasicMaterial ||
          object.material instanceof THREE.MeshPhongMaterial
        ) {
          object.material.wireframe = isWireframe;
        }
      }
    });
  }

  // Toggle collision boundary visualization
  private toggleCollisionBoundaries(): void {
    // Create a notification about collision boundaries mode
    const notification = document.createElement('div');
    notification.style.position = 'absolute';
    notification.style.top = '170px';
    notification.style.left = '10px';
    notification.style.color = '#ff00ff';
    notification.style.fontFamily = 'monospace';
    notification.style.fontSize = '16px';
    notification.style.padding = '5px';
    notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    notification.style.border = '1px solid #ff00ff';
    notification.style.transition = 'opacity 0.5s ease-in-out';
    notification.style.opacity = '1';
    notification.textContent = this.debugCollisionBoundaries
      ? 'COLLISION BOUNDARIES: ON'
      : 'COLLISION BOUNDARIES: OFF';

    document.body.appendChild(notification);

    // Fade out after 2 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      // Remove from DOM after fade out
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 500);
    }, 2000);

    // Create or remove collision helpers based on the new state
    if (this.debugCollisionBoundaries) {
      this.createCollisionHelpers();
    } else {
      this.removeCollisionHelpers();
    }
  }

  // Create collision helpers for all game objects
  private createCollisionHelpers(): void {
    for (const ball of this.balls) {
      ball.createCollisionHelper();
    }

    this.alienManager.createCollisionHelpers();

    for (const paddle of this.paddles) {
      paddle.createCollisionHelper();
    }
  }

  // Remove all collision helpers
  private removeCollisionHelpers(): void {
    for (const ball of this.balls) {
      ball.removeCollisionHelper();
    }

    this.alienManager.removeCollisionHelpers();

    for (const paddle of this.paddles) {
      paddle.removeCollisionHelper();
    }
  }

  render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera);
  }

  update(deltaTime: number): void {
    if (this.state !== GameState.PLAYING) {
      // Update paddle and ball
      this.alienManager.update(deltaTime);

      // Update camera controls if they exist
      if (this.cameraControls) {
        this.cameraControls.update();
      }

      return;
    }

    this.alienManager.update(deltaTime);

    // Update all other game objects
    this.paddles.forEach((paddle) => paddle.update(deltaTime));

    for (const ball of this.balls) {
      ball.update(deltaTime);

      // Skip collision detection for balls attached to the paddle
      if (ball.isAttachedToPaddle) continue;

      // 1. Ball with paddle collision
      for (const paddle of this.paddles) {
        const collision = this.ballVsBox(
          ball.position,
          (ball.size as { radius: number }).radius,
          paddle.position,
          paddle.size
        );

        if (collision) {
          // Resolve collision
          this.resolveBallBoxCollision(ball, paddle.position, paddle.size);
        }
      }

      const points = this.alienManager.checkCollisions(ball);

      // Add points if any were scored
      if (points > 0) {
        this.addScore(points);
      }

      // Check if level is complete
      if (this.alienManager.areAllDestroyed()) {
        this.levelComplete();
      }

      // Check if ball is below paddle (lost ball)
      if (ball.position.y < this.bottomBoundary - 3) {
        this.ballLost(ball);
      }

      // Only handle ball bounds collision
      const radius = (ball.size as { radius: number }).radius;

      // X bounds
      if (ball.position.x - radius < this.worldBounds.minX) {
        ball.position.x = this.worldBounds.minX + radius;
        ball.velocity.x = -ball.velocity.x; // Bounce
      } else if (ball.position.x + radius > this.worldBounds.maxX) {
        ball.position.x = this.worldBounds.maxX - radius;
        ball.velocity.x = -ball.velocity.x; // Bounce
      }

      // Y bounds
      if (ball.position.y - radius < this.worldBounds.minY) {
        // Ball reached bottom - in a real game this might be "ball lost"
        ball.position.y = this.worldBounds.minY + radius;
        ball.velocity.y = -ball.velocity.y; // Bounce
      } else if (ball.position.y + radius > this.worldBounds.maxY) {
        ball.position.y = this.worldBounds.maxY - radius;
        ball.velocity.y = -ball.velocity.y; // Bounce
      }

      // Z bounds
      if (ball.position.z - radius < this.worldBounds.minZ) {
        ball.position.z = this.worldBounds.minZ + radius;
        ball.velocity.z = -ball.velocity.z; // Bounce
      } else if (ball.position.z + radius > this.worldBounds.maxZ) {
        ball.position.z = this.worldBounds.maxZ - radius;
        ball.velocity.z = -ball.velocity.z; // Bounce
      }
    }

    // Update camera controls if they exist
    if (this.cameraControls) {
      this.cameraControls.update();
    }
  }

  onEnter(): void {
    // Add keyboard event listener for wireframe toggle
    document.addEventListener('keydown', this.keydownListener);

    // Add click listener for ball release
    document.addEventListener('click', this.clickListener);
  }

  onExit(): void {
    // Remove keyboard event listener for wireframe toggle
    document.removeEventListener('keydown', this.keydownListener);

    // Remove click listener for ball release
    document.removeEventListener('click', this.clickListener);

    // Clean up resources
    this.dispose();
  }

  // Clean up resources
  dispose(): void {
    // Clear timeout if it exists
    if (this.ballLostTimeout !== null) {
      clearTimeout(this.ballLostTimeout);
      this.ballLostTimeout = null;
    }

    // Clean up game objects
    for (const paddle of this.paddles) {
      paddle.removeEventListeners();
    }
    for (const ball of this.balls) {
      ball.dispose();
    }
    if (this.alienManager) this.alienManager.dispose();

    // Remove UI elements
    if (this.scoreElement?.parentNode) {
      this.scoreElement.parentNode.remove();
    }
    if (this.messageElement) {
      this.messageElement.remove();
    }

    // Remove instructions
    const instructionsElement = document.getElementById('instructions');
    if (instructionsElement) {
      instructionsElement.remove();
    }
  }
}
