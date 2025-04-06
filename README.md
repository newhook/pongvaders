# Pong Invaders

This game is a mash up of space invaders and pong. The aliens decend from above and a mighty paddle and ball are all that is there to defend the earth from invasion!

## Features

- 3D physics simulation with @dimforge/rapier3d
- Game state management system
- Interactive cubes with collision detection
- Particle-based explosion effects
- Sound management
- Multiple game states (marquee, play)
- TypeScript for type safety
- Vite for fast development and bundling
- Responsive design with window resize handling

## Getting Started

### Prerequisites

- Node.js (recommended version 16+)
- npm or yarn

### Installation

1. Clone or download this repository
2. Install dependencies:

```bash
npm install
# or
yarn
```

### Development

Start the development server:

```bash
npm run dev
# or
yarn dev
```

This will start a local development server at http://localhost:5173 (or another port if 5173 is in use).

### Building for Production

Build the project for production:

```bash
npm run build
# or
yarn build
```

The built files will be in the `dist` directory.

## Project Structure

- `src/main.ts` - Entry point for the application
- `src/Cube.ts` - Implementation of interactive 3D cubes with physics and explosion effects
- `src/physics.ts` - Physics world setup and interactions using Rapier
- `src/gameStateManager.ts` - Game state management system
- `src/gameStates.ts` - Base interface for different game states
- `src/playState.ts` - Main gameplay state implementation
- `src/marqueeState.ts` - Title screen/marquee state
- `src/preMarquee.ts` - Pre-marquee state for initialization
- `src/soundManager.ts` - Audio management system
- `src/types.ts` - Type definitions
- `src/config.ts` - Game configuration

## License

This project is licensed under the ISC License.
