import { describe, expect, it } from 'vitest';
import { decodeTransform, describeTransformOrigin, formatTransform } from './transform';

/** Chrome's computed `matrix(...)` string, with its 6-digit precision. */
function matrix(...values: number[]): string {
  return `matrix(${values.map((value) => Number(value.toFixed(6))).join(', ')})`;
}

function decoded(value: string): string {
  const result = decodeTransform(value);
  if (!result) throw new Error(`Could not decode ${value}`);
  return formatTransform(result);
}

const radians = (degrees: number) => (degrees * Math.PI) / 180;

describe('decodeTransform', () => {
  it('returns null for none and for true 3D matrices', () => {
    expect(decodeTransform('none')).toBeNull();
    // rotateX(45deg)
    expect(decodeTransform('matrix3d(1, 0, 0, 0, 0, 0.707107, 0.707107, 0, 0, -0.707107, 0.707107, 0, 0, 0, 0, 1)')).toBeNull();
    // translateZ(20px)
    expect(decodeTransform('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 20, 1)')).toBeNull();
  });

  it('decodes a flat matrix3d, such as translate3d(x, y, 0)', () => {
    expect(decoded('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 120, -8, 0, 1)')).toBe('translate 120px, -8px');
  });

  it('decodes a translation', () => {
    expect(decoded('matrix(1, 0, 0, 1, 0, -40)')).toBe('translate 0px, -40px');
  });

  it('decodes rotate(-9deg) scale(0.82)', () => {
    const angle = radians(-9);
    const s = 0.82;
    expect(decoded(matrix(s * Math.cos(angle), s * Math.sin(angle), -s * Math.sin(angle), s * Math.cos(angle), 0, 0))).toBe(
      'rotate -9° · scale 0.82',
    );
  });

  it('decodes a skew', () => {
    expect(decoded(matrix(1, 0, Math.tan(radians(20)), 1, 0, 0))).toBe('skew 20°');
  });

  it('describes a horizontal mirror as a negative x scale', () => {
    expect(decoded('matrix(-1, 0, 0, 1, 0, 0)')).toBe('scale -1, 1');
  });

  it('handles scale(0), a common animation start state', () => {
    expect(decoded('matrix(0, 0, 0, 0, 0, 0)')).toBe('scale 0');
  });

  it('says when a matrix changes nothing', () => {
    expect(decoded('matrix(1, 0, 0, 1, 0, 0)')).toBe('none (no visible change)');
  });
});

describe('describeTransformOrigin', () => {
  const size = { width: 320, height: 480 };

  it('treats the center as the default for HTML elements', () => {
    expect(describeTransformOrigin('160px 240px', size)).toEqual({ isDefault: true, text: 'center' });
  });

  it('names corners and edges', () => {
    expect(describeTransformOrigin('0px 0px', size)).toEqual({ isDefault: false, text: 'top left' });
    expect(describeTransformOrigin('160px 480px', size)).toEqual({ isDefault: false, text: 'bottom center' });
  });

  it('uses percentages for other points', () => {
    expect(describeTransformOrigin('80px 120px', size).text).toBe('25% 25%');
  });

  it('treats 0 0 as the default for SVG elements inside an <svg>', () => {
    expect(describeTransformOrigin('0px 0px', null).isDefault).toBe(true);
    expect(describeTransformOrigin('12px 8px', null)).toEqual({ isDefault: false, text: '12px 8px' });
  });

  it('mentions a z offset', () => {
    expect(describeTransformOrigin('160px 240px 20px', size)).toEqual({ isDefault: false, text: 'center · z 20px' });
  });
});
