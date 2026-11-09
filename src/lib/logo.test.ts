import { describe, expect, it } from 'vitest';
import { pointsLogo } from './logo.ts';

describe('pointsLogo', () => {
  const points = pointsLogo().split(' ').map((p) => p.split(',').map(Number) as [number, number]);

  it('360 points, départ au centre', () => {
    expect(points).toHaveLength(360);
    expect(points[0]).toEqual([50, 50]);
  });

  it('reste centré avec de la marge : x dans [32, 68], y dans [28, 72]', () => {
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(32);
      expect(x).toBeLessThanOrEqual(68);
      expect(y).toBeGreaterThanOrEqual(28);
      expect(y).toBeLessThanOrEqual(72);
    }
  });
});
