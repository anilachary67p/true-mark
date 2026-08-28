import { SignalEvaluatorService } from './signal-evaluator.service';
import { VerificationResult } from '@truemark/db';

describe('SignalEvaluatorService', () => {
  const service = new SignalEvaluatorService();

  it('returns REVERIFIED for second scan in same area', () => {
    const result = service.evaluateReuse({
      previousCount: 1,
      lastLocation: { latitude: 12.97, longitude: 77.59, city: 'Bangalore' },
      currentLocation: { latitude: 12.97, longitude: 77.59, city: 'Bangalore' },
      lastVerifiedAt: new Date(Date.now() - 30 * 60 * 1000),
    });
    expect(result.suggestedResult).toBe(VerificationResult.REVERIFIED);
    expect(result.riskLevel).toBe('LOW');
  });

  it('detects impossible travel', () => {
    const result = service.evaluateReuse({
      previousCount: 1,
      lastLocation: { latitude: 12.97, longitude: 77.59, city: 'Bangalore' },
      currentLocation: { latitude: 17.38, longitude: 78.49, city: 'Hyderabad' },
      lastVerifiedAt: new Date(Date.now() - 5 * 60 * 1000),
    });
    expect(result.suggestedResult).toBe(VerificationResult.POSSIBLE_CLONE);
    expect(result.signals.some((s: { type: string }) => s.type === 'IMPOSSIBLE_TRAVEL')).toBe(true);
  });

  it('flags high scan frequency', () => {
    const result = service.evaluateReuse({
      previousCount: 50,
      recentScansInWindow: 55,
      config: { highScanCount: 50, highScanWindowMinutes: 30 },
    });
    expect(result.suggestedResult).toBe(VerificationResult.SUSPICIOUS);
  });
});
