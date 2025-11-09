import { SimulationSourceTracker } from '@/lib/telemetry/simulation-source'

describe('SimulationSourceTracker', () => {
  it('tracks extended telemetry fields', () => {
    const tracker = SimulationSourceTracker.getInstance()
    tracker.update('explosion', 'server', {
      accelerator: 'cuda',
      latencyMs: 12.5,
      roundTripMs: 48.2,
      sampleSize: 256,
    })
    const status = tracker.getStatus('explosion')
    expect(status).toBeDefined()
    expect(status?.accelerator).toBe('cuda')
    expect(status?.latencyMs).toBeCloseTo(12.5)
    expect(status?.roundTripMs).toBeCloseTo(48.2)
    expect(status?.sampleSize).toBe(256)
  })
})
