import { Injectable } from '@nestjs/common';
import {
  FraudSignalType,
  LifecycleStatus,
  LocationSource,
  VerificationMethod,
  VerificationResult,
} from '@truemark/db';
import {
  DEFAULT_HIGH_SCAN_COUNT,
  DEFAULT_HIGH_SCAN_WINDOW_MINUTES,
  DEFAULT_MAX_TRAVEL_SPEED_KMH,
} from '@truemark/shared';

export interface LocationInput {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  source?: LocationSource;
}

export interface FraudEvaluation {
  signals: Array<{ type: FraudSignalType; severity: string; evidence: Record<string, unknown> }>;
  riskLevel: string;
  suggestedResult?: VerificationResult;
}

@Injectable()
export class SignalEvaluatorService {
  evaluateReuse(params: {
    previousCount: number;
    lastLocation?: LocationInput | null;
    currentLocation?: LocationInput | null;
    lastVerifiedAt?: Date | null;
    config?: {
      highScanCount?: number;
      highScanWindowMinutes?: number;
      maxTravelSpeedKmh?: number;
    };
    recentScansInWindow?: number;
  }): FraudEvaluation {
    const signals: FraudEvaluation['signals'] = [];
    let riskLevel = 'LOW';
    let suggestedResult: VerificationResult | undefined;

    const highScanCount = params.config?.highScanCount ?? DEFAULT_HIGH_SCAN_COUNT;
    const windowMinutes = params.config?.highScanWindowMinutes ?? DEFAULT_HIGH_SCAN_WINDOW_MINUTES;

    if (params.recentScansInWindow && params.recentScansInWindow >= highScanCount) {
      signals.push({
        type: FraudSignalType.HIGH_SCAN_FREQUENCY,
        severity: 'HIGH',
        evidence: { count: params.recentScansInWindow, windowMinutes },
      });
      riskLevel = 'HIGH';
      suggestedResult = VerificationResult.SUSPICIOUS;
    } else if (params.previousCount > 0) {
      const travel = this.checkImpossibleTravel(
        params.lastLocation,
        params.currentLocation,
        params.lastVerifiedAt,
        params.config?.maxTravelSpeedKmh ?? DEFAULT_MAX_TRAVEL_SPEED_KMH,
      );
      if (travel.impossible) {
        signals.push({
          type: FraudSignalType.IMPOSSIBLE_TRAVEL,
          severity: 'HIGH',
          evidence: travel,
        });
        signals.push({
          type: FraudSignalType.GEOGRAPHIC_ANOMALY,
          severity: 'HIGH',
          evidence: travel,
        });
        riskLevel = 'HIGH';
        suggestedResult = VerificationResult.POSSIBLE_CLONE;
      } else {
        suggestedResult = VerificationResult.REVERIFIED;
      }
    }

    if (params.previousCount > 5 && riskLevel === 'LOW') {
      signals.push({
        type: FraudSignalType.EXCESSIVE_QR_REUSE,
        severity: 'MEDIUM',
        evidence: { count: params.previousCount },
      });
      riskLevel = 'MEDIUM';
    }

    return { signals, riskLevel, suggestedResult };
  }

  private checkImpossibleTravel(
    from: LocationInput | null | undefined,
    to: LocationInput | null | undefined,
    lastAt: Date | null | undefined,
    maxSpeedKmh: number,
  ) {
    if (!from?.latitude || !from?.longitude || !to?.latitude || !to?.longitude || !lastAt) {
      return { impossible: false };
    }
    const distanceKm = this.haversineKm(from.latitude, from.longitude, to.latitude, to.longitude);
    const hoursElapsed = (Date.now() - lastAt.getTime()) / (1000 * 60 * 60);
    if (hoursElapsed <= 0) return { impossible: false };
    const speedKmh = distanceKm / hoursElapsed;
    return {
      impossible: speedKmh > maxSpeedKmh,
      distanceKm,
      speedKmh,
      from,
      to,
    };
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

export function mapLifecycleToResult(status: LifecycleStatus): VerificationResult {
  switch (status) {
    case LifecycleStatus.REVOKED:
      return VerificationResult.REVOKED_QR;
    case LifecycleStatus.BLOCKED:
      return VerificationResult.BLOCKED_QR;
    case LifecycleStatus.RECALLED:
      return VerificationResult.RECALLED;
    case LifecycleStatus.SUSPENDED:
      return VerificationResult.SUSPENDED;
    case LifecycleStatus.RETIRED:
    case LifecycleStatus.INACTIVE:
      return VerificationResult.INVALID_QR;
    default:
      return VerificationResult.UNABLE_TO_VERIFY;
  }
}
