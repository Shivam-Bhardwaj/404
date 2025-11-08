extern "C" __global__ void boids_step(
    int n,
    float dt,
    float sepRadius,
    float alignRadius,
    float cohRadius,
    float sepWeight,
    float alignWeight,
    float cohWeight,
    float maxSpeed,
    float* x,
    float* y,
    float* vx,
    float* vy,
    int width,
    int height
) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= n) return;

    float xi = x[i];
    float yi = y[i];
    float vxi = vx[i];
    float vyi = vy[i];

    float sepX = 0.0f, sepY = 0.0f; int sepC = 0;
    float aliX = 0.0f, aliY = 0.0f; int aliC = 0;
    float cohX = 0.0f, cohY = 0.0f; int cohC = 0;

    for (int j = 0; j < n; ++j) {
        if (j == i) continue;
        float dx = x[j] - xi;
        float dy = y[j] - yi;
        float d2 = dx*dx + dy*dy;

        if (d2 < sepRadius*sepRadius) {
            float d = sqrtf(d2) + 1e-6f;
            sepX -= dx / d;
            sepY -= dy / d;
            sepC++;
        }
        if (d2 < alignRadius*alignRadius) {
            aliX += vx[j];
            aliY += vy[j];
            aliC++;
        }
        if (d2 < cohRadius*cohRadius) {
            cohX += x[j];
            cohY += y[j];
            cohC++;
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

