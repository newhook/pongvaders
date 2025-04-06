import * as THREE from 'three';
import { GameStateManager } from './gameStateManager';

// Function to initialize the app
async function init() {
  // Create renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x87ceeb, 1); // Set a light blue sky color
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // Better dynamic range
  renderer.toneMappingExposure = 1.5; // Increase overall brightness

  document.body.appendChild(renderer.domElement);
  const clock = new THREE.Clock();

  const loadingElement = document.getElementById('loading');
  if (loadingElement) {
    loadingElement.style.display = 'none';
  }

  // FPS counter variables
  let frameCount = 0;
  let lastTime = performance.now();
  const fpsElement = document.getElementById('fps');
  if (fpsElement) {
    fpsElement.style.display = 'block';
    fpsElement.style.color = 'white';
  }
  let elapsedTime = 0;

  // Update FPS counter
  function updateFPS(deltaTime: number) {
    frameCount++;
    elapsedTime += deltaTime;
    // Update FPS display once per second
    if (elapsedTime >= 1) {
      const fps = Math.round(frameCount / elapsedTime);
      if (fpsElement) {
        fpsElement.textContent = `FPS: ${fps}`;
      }
      // Reset values
      frameCount = 0;
      elapsedTime = 0;
    }
  }
  // Initialize game state manager
  let gameStateManager = new GameStateManager(renderer);

  // Set up animation loop
  function animate() {
    requestAnimationFrame(animate);

    // Get elapsed time since last frame
    const deltaTime = clock.getDelta();
    // Update FPS counter
    updateFPS(deltaTime);

    // Update game state
    gameStateManager.update(deltaTime);
    gameStateManager.render();
  }

  // Start the animation loop
  animate();

  // Handle window resize
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// Start when the DOM is fully loaded
init();
