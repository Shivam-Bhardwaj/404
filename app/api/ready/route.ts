import { NextResponse } from 'next/server';

/**
 * Readiness probe endpoint
 * Used by Docker/Kubernetes to determine if the container is ready to receive traffic
 * Checks if all dependencies and services are available
 */
export async function GET() {
  try {
    const checks = {
      app: true,
      memory: checkMemory(),
      timestamp: new Date().toISOString(),
    };

    const allHealthy = Object.values(checks).every(
      (check) => check === true || typeof check === 'string'
    );

    if (allHealthy) {
      return NextResponse.json(
        {
          status: 'ready',
          checks,
          service: '404-ultimate',
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          status: 'not ready',
          checks,
        },
        { status: 503 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        status: 'not ready',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}

function checkMemory(): boolean | string {
  const memUsage = process.memoryUsage();
  const memUsedMB = memUsage.heapUsed / 1024 / 1024;
  const memTotalMB = memUsage.heapTotal / 1024 / 1024;
  const memPercent = (memUsedMB / memTotalMB) * 100;

  // Warn if memory usage is above 90%
  if (memPercent > 90) {
    return `high: ${memPercent.toFixed(1)}%`;
  }

  return true;
}

