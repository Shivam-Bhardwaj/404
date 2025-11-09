# 404 - The Ultimate Error Page

A cutting-edge 404 error page featuring advanced web animations including:
- Neural typography with Markov chains
- SPH particle physics explosions
- Evolutionary artificial life ecosystem
- Hardware-adaptive performance scaling

## Features

### Animation Phases

1. **Glitched Typography** - Error messages typed with Markov chain prediction and glitch effects
2. **White Flash** - High-energy transition effect
3. **Circle Closing** - Signed Distance Field rendering for perfect geometry
4. **Particle Explosion** - Smoothed Particle Hydrodynamics with curl noise turbulence
5. **Biological Ecosystem** - Extended Boids algorithm with genetic evolution

### Technical Highlights

- **Hardware Detection**: Automatic GPU/CPU benchmarking and device tier classification
- **Dynamic Quality Scaling**: Real-time performance monitoring with adaptive particle counts
- **Genetic Algorithms**: Organisms evolve with mutations, crossover, and natural selection
- **Spatial Indexing**: Quadtree implementation for efficient collision detection
- **SPH Physics**: Fluid-like particle dynamics with pressure and viscosity forces
- **Object Pooling**: Memory-efficient particle management
- **Performance Monitoring**: Real-time FPS tracking and telemetry overlay

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the 404 page in action.

### Production Build

```bash
npm run build
npm run start
```

## Deployment

- **Production (`https://too.foo`)** now lives on a separate Vercel project (different repository); this repo no longer pushes there, so don’t run `vercel deploy` from this workspace.
- **Staging (`https://staging.too.foo`)** is served from the on-prem Docker/Traefik stack defined in the `docker-compose.*` files and deployed via the GitHub Actions workflow (`.github/workflows/deploy.yml`) or the manual commands in `DEPLOYMENT.md`.
- Treat this repository as “staging-only”: validate locally, merge to `staging`, let the self-hosted pipeline redeploy, and verify at `staging.too.foo` before coordinating any changes with the separate production site.

## Agent / Worktree Workflow

Whenever you (or an LLM) start working on an issue:

1. Create or reuse a dedicated git worktree for that issue (never edit directly in `/404-public/repo`).
2. Implement and run the required local tests inside that worktree.
3. Push the branch, open a PR targeting `staging`, and wait for the staging deployment before handing it off.

See [`WORKFLOW.md`](./WORKFLOW.md) for the full checklist.

## Project Structure

```
/404/
├── app/
│   ├── page.tsx          # Main 404 page with animation orchestration
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── lib/
│   ├── biology/          # Genetic algorithms and Boids system
│   │   ├── genetics.ts   # Gene mutation and crossover
│   │   └── boids.ts      # Flocking behavior with predator-prey
│   ├── hardware/         # Device detection and benchmarking
│   │   └── detection.ts  # GPU/CPU performance tests
│   ├── performance/      # Performance optimization systems
│   │   ├── quality-scaler.ts  # Dynamic quality adjustment
│   │   └── object-pool.ts     # Memory pooling
│   ├── phases/           # Animation phase implementations
│   │   ├── typing-phase.ts     # Glitch typography
│   │   ├── white-phase.ts      # Flash transition
│   │   ├── circle-phase.ts     # SDF circle closing
│   │   ├── explosion-phase.ts  # SPH particle explosion
│   │   └── ecosystem-phase.ts  # Biological simulation
│   ├── physics/          # Physics engines
│   │   └── sph.ts        # Smoothed Particle Hydrodynamics
│   ├── spatial/          # Spatial indexing structures
│   │   └── quadtree.ts   # Efficient collision detection
│   ├── utils/            # Utility functions
│   │   └── math.ts       # Math helpers and curl noise
│   ├── constants.ts      # Theme colors and configurations
│   └── types/            # TypeScript type definitions
│       └── index.ts
└── README.md
```

## Performance

### Device Tiers

The system automatically detects device capabilities and adjusts:

- **Low** (Mobile): 100 particles, 30 FPS target, simplified effects
- **Medium** (Mobile High/Laptop): 500 particles, 60 FPS target
- **High** (Desktop): 2000 particles, 60 FPS target, full effects
- **Ultra** (Workstation): 10,000+ particles, 120+ FPS target

### Optimization Techniques

- Verlet integration for energy conservation
- Barnes-Hut spatial optimization (O(n log n) vs O(n²))
- Adaptive particle counts based on real-time FPS
- Object pooling to eliminate garbage collection spikes
- Quadtree spatial partitioning for collision detection
- Curl noise for divergence-free fluid motion

## Algorithm Implementations

### Smoothed Particle Hydrodynamics

```typescript
- Poly6 kernel for density calculation
- Spiky kernel gradient for pressure forces
- Viscosity forces for realistic fluid behavior
- Boundary condition handling with elastic collision
```

### Genetic Evolution

```typescript
- 7-parameter gene sequence (hue, saturation, brightness, size, speed, aggression, efficiency)
- Mutation with configurable rate and intensity
- Single-point crossover reproduction
- Fitness-based natural selection
```

### Boids System

```typescript
- Separation: Avoid crowding
- Alignment: Match velocity with neighbors
- Cohesion: Stay with group
- Predator-Prey: Chase/flee dynamics
- Resource competition
```

## Technologies

- Next.js 14
- TypeScript 5
- React 18
- Tailwind CSS
- Canvas 2D API
- WebGL (for future enhancements)

## Browser Compatibility

Tested and optimized for:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance Metrics

Reference hardware (RTX 3060, Ryzen 5600X):
- 10,000 particles at stable 60 FPS
- 500 organisms in ecosystem at 60 FPS
- Sub-millisecond spatial queries
- <100MB memory usage

## Future Enhancements

- WebGPU compute shaders for physics
- Gray-Scott reaction-diffusion for text transformations
- Ray marching for volumetric effects
- NEAT algorithm for organism neural networks
- Multiplayer ecosystem competition

## Contributing

This is a demonstration project showcasing advanced web animation techniques. Feel free to use the algorithms and patterns in your own projects.

## License

MIT License - Feel free to use this code in your projects!

## Credits

Inspired by:
- Reynolds' Boids algorithm (1987)
- Müller et al.'s SPH implementation (2003)
- Turing's reaction-diffusion systems (1952)
- Perlin's noise functions (1985)

---

Built with ❤️ to demonstrate that even error pages can be extraordinary.
