// Optimized CUDA boids kernel with spatial hashing
// Reduces complexity from O(n²) to O(n) for neighbor queries

extern "C" __global__ void build_spatial_grid(
    int n,
    const float* x,
    const float* y,
    int gridWidth,
    int gridHeight,
    float cellSize,
    int* gridStart,
    int* gridEnd,
    int* particleIndices
) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= n) return;
    
    int cellX = (int)(x[i] / cellSize);
    int cellY = (int)(y[i] / cellSize);
    cellX = max(0, min(gridWidth - 1, cellX));
    cellY = max(0, min(gridHeight - 1, cellY));
    
    int cellIdx = cellY * gridWidth + cellX;
    
    // Atomic increment to get index in particle list
    int idx = atomicAdd(&gridEnd[cellIdx], 1);
    if (idx < n) {
        particleIndices[cellIdx * n + idx] = i;
    }
}

extern "C" __global__ void boids_step_spatial(
    int n,
    float dt,
    float sepRadius,
    float alignRadius,
    float cohRadius,
    float sepWeight,
    float alignWeight,
    float cohWeight,
    float maxSpeed,
    const unsigned char* species,
    float* x,
    float* y,
    float* vx,
    float* vy,
    int width,
    int height,
    int gridWidth,
    int gridHeight,
    float cellSize,
    const int* gridStart,
    const int* gridEnd,
    const int* particleIndices
) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= n) return;

    float xi = x[i];
    float yi = y[i];
    float vxi = vx[i];
    float vyi = vy[i];
    unsigned char si = species[i];

    float sepX = 0.0f, sepY = 0.0f; int sepC = 0;
    float aliX = 0.0f, aliY = 0.0f; int aliC = 0;
    float cohX = 0.0f, cohY = 0.0f; int cohC = 0;
    float chaseX = 0.0f, chaseY = 0.0f; int chaseC = 0;
    float fleeX = 0.0f, fleeY = 0.0f; int fleeC = 0;

    const float predatorRadius = cohRadius * 1.5f;
    const float preyFearRadius = sepRadius * 2.0f;
    const float maxRadius = max(max(sepRadius, alignRadius), max(cohRadius, predatorRadius));

    // Get cell coordinates
    int cellX = (int)(xi / cellSize);
    int cellY = (int)(yi / cellSize);
    
    // Check neighboring cells (3x3 grid)
    for (int dy = -1; dy <= 1; dy++) {
        for (int dx = -1; dx <= 1; dx++) {
            int checkX = cellX + dx;
            int checkY = cellY + dy;
            
            if (checkX < 0 || checkX >= gridWidth || checkY < 0 || checkY >= gridHeight) {
                continue;
            }
            
            int cellIdx = checkY * gridWidth + checkX;
            int start = gridStart[cellIdx];
            int end = gridEnd[cellIdx];
            
            // Check particles in this cell
            for (int j = start; j < end; j++) {
                int idx = particleIndices[cellIdx * n + j];
                if (idx == i || idx >= n) continue;
                
                float dx = x[idx] - xi;
                float dy = y[idx] - yi;
                float d2 = dx*dx + dy*dy;
                
                // Skip if too far
                if (d2 > maxRadius * maxRadius) continue;
                
                unsigned char sj = species[idx];

                if (d2 < sepRadius*sepRadius) {
                    float d = sqrtf(d2) + 1e-6f;
                    sepX -= dx / d;
                    sepY -= dy / d;
                    sepC++;
                }
                if (d2 < alignRadius*alignRadius) {
                    aliX += vx[idx];
                    aliY += vy[idx];
                    aliC++;
                }
                if (d2 < cohRadius*cohRadius) {
                    cohX += x[idx];
                    cohY += y[idx];
                    cohC++;
                }

                if (si == 2 && sj == 1 && d2 < predatorRadius * predatorRadius) {
                    chaseX += -dx;
                    chaseY += -dy;
                    chaseC++;
                }
                if (si == 1 && sj == 2 && d2 < preyFearRadius * preyFearRadius) {
                    float d = sqrtf(d2) + 1e-6f;
                    fleeX -= dx / d;
                    fleeY -= dy / d;
                    fleeC++;
                }
            }
        }
    }

    float ax = 0.0f;
    float ay = 0.0f;

    if (sepC > 0) {
        ax += (sepX / (float)sepC) * sepWeight;
        ay += (sepY / (float)sepC) * sepWeight;
    }
    if (aliC > 0) {
        float tx = (aliX / (float)aliC) - vxi;
        float ty = (aliY / (float)aliC) - vyi;
        ax += tx * alignWeight;
        ay += ty * alignWeight;
    }
    if (cohC > 0) {
        float tx = (cohX / (float)cohC) - xi;
        float ty = (cohY / (float)cohC) - yi;
        ax += tx * cohWeight;
        ay += ty * cohWeight;
    }
    if (chaseC > 0 && si == 2) {
        float tx = (chaseX / (float)chaseC);
        float ty = (chaseY / (float)chaseC);
        ax += tx * 0.8f;
        ay += ty * 0.8f;
    }
    if (fleeC > 0 && si == 1) {
        ax += (fleeX / (float)fleeC) * 2.0f;
        ay += (fleeY / (float)fleeC) * 2.0f;
    }
    if (si == 0) {
        float centerX = width * 0.5f;
        float centerY = height * 0.5f;
        ax += (centerX - xi) * 0.02f;
        ay += (centerY - yi) * 0.02f;
    }

    vxi += ax * dt;
    vyi += ay * dt;

    float sp = sqrtf(vxi*vxi + vyi*vyi);
    if (sp > maxSpeed) {
        vxi = vxi / sp * maxSpeed;
        vyi = vyi / sp * maxSpeed;
    }

    xi += vxi * dt;
    yi += vyi * dt;

    // Wrap around boundaries
    if (xi < 0.0f) xi += width; if (xi >= width) xi -= width;
    if (yi < 0.0f) yi += height; if (yi >= height) yi -= height;

    x[i] = xi; y[i] = yi; vx[i] = vxi; vy[i] = vyi;
}

