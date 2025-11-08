import { NextResponse } from 'next/server';

/**
 * Liveness probe endpoint
 * Used by Docker/Kubernetes to determine if the container should be restarted
 * Returns 200 if the application is running
 */
export async function GET() {
  try {
    // Basic health check - just verify the app is responding
    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: '404-ultimate',
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}

