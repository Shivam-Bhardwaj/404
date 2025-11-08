'use client';

import { useEffect, useState } from 'react';

interface TechStackInfo {
  gpu: string;
  backend: {
    language: string;
    framework: string;
    cudaVersion: string;
  };
  frontend: {
    framework: string;
    language: string;
    styling: string;
  };
  physics: {
    sph: boolean;
    boids: boolean;
    grayScott: boolean;
    sdf: boolean;
  };
}

export function TechStackDisplay() {
  const [techStack, setTechStack] = useState<TechStackInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTechStack() {
      try {
        const response = await fetch('/api/gpu-info');
        const data = await response.json();
        
        setTechStack({
          gpu: data.gpu,
          backend: {
            language: 'Rust 1.91.0',
            framework: 'Axum + Tokio (async)',
            cudaVersion: 'CUDA 12.3',
          },
          frontend: {
            framework: 'Next.js 14',
            language: 'TypeScript 5.3',
            styling: 'Tailwind CSS 3.3',
          },
          physics: {
            sph: true,
            boids: true,
            grayScott: true,
            sdf: true,
          },
        });
      } catch (error) {
        console.error('Failed to load tech stack:', error);
      } finally {
        setLoading(false);
      }
    }

    loadTechStack();
  }, []);

  if (loading) {
    return (
      <div className="tech-stack-loading">
        <div className="animate-pulse">Loading tech stack...</div>
      </div>
    );
  }

  if (!techStack) {
    return null;
  }

  return (
    <div className="tech-stack-container">
      <style jsx>{`
        .tech-stack-container {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: rgba(0, 0, 0, 0.9);
          border: 1px solid #ffb84d;
          padding: 16px;
          border-radius: 8px;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          color: #39ff14;
          max-width: 400px;
          z-index: 1000;
        }
        
        .tech-stack-header {
          color: #ffb84d;
          font-weight: bold;
          margin-bottom: 12px;
          font-size: 14px;
          text-align: center;
        }
        
        .tech-section {
          margin-bottom: 12px;
        }
        
        .tech-section-title {
          color: #4da6ff;
          font-weight: bold;
          margin-bottom: 4px;
        }
        
        .tech-item {
          margin-left: 8px;
          margin-bottom: 2px;
        }
        
        .tech-label {
          color: #888;
        }
        
        .tech-value {
          color: #39ff14;
        }
        
        .physics-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
          margin-left: 8px;
        }
        
        .physics-item {
          display: flex;
          align-items: center;
        }
        
        .status-indicator {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #39ff14;
          margin-right: 6px;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      
      <div className="tech-stack-header">⚡ TECH STACK</div>
      
      <div className="tech-section">
        <div className="tech-section-title">GPU</div>
        <div className="tech-item">
          <span className="tech-value">{techStack.gpu}</span>
        </div>
      </div>
      
      <div className="tech-section">
        <div className="tech-section-title">Backend</div>
        <div className="tech-item">
          <span className="tech-label">Language: </span>
          <span className="tech-value">{techStack.backend.language}</span>
        </div>
        <div className="tech-item">
          <span className="tech-label">Framework: </span>
          <span className="tech-value">{techStack.backend.framework}</span>
        </div>
        <div className="tech-item">
          <span className="tech-label">CUDA: </span>
          <span className="tech-value">{techStack.backend.cudaVersion}</span>
        </div>
      </div>
      
      <div className="tech-section">
        <div className="tech-section-title">Frontend</div>
        <div className="tech-item">
          <span className="tech-label">Framework: </span>
          <span className="tech-value">{techStack.frontend.framework}</span>
        </div>
        <div className="tech-item">
          <span className="tech-label">Language: </span>
          <span className="tech-value">{techStack.frontend.language}</span>
        </div>
        <div className="tech-item">
          <span className="tech-label">Styling: </span>
          <span className="tech-value">{techStack.frontend.styling}</span>
        </div>
      </div>
      
      <div className="tech-section">
        <div className="tech-section-title">Physics Simulations</div>
        <div className="physics-grid">
          {techStack.physics.sph && (
            <div className="physics-item">
              <span className="status-indicator"></span>
              <span>SPH</span>
            </div>
          )}
          {techStack.physics.boids && (
            <div className="physics-item">
              <span className="status-indicator"></span>
              <span>Boids</span>
            </div>
          )}
          {techStack.physics.grayScott && (
            <div className="physics-item">
              <span className="status-indicator"></span>
              <span>Gray-Scott</span>
            </div>
          )}
          {techStack.physics.sdf && (
            <div className="physics-item">
              <span className="status-indicator"></span>
              <span>SDF</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

