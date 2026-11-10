/* eslint-env node */

import assert from 'node:assert/strict';
import test from 'node:test';
import { assessmentScore, dimensionPercent } from '../scripts/nash-scoring.js';

const legacyDimensions = () => [
  { dimension: 'Strategic Fit', scored: 12, max: 20 },
  { dimension: 'Technical Fit', scored: 13, max: 20 },
  { dimension: 'Functional Coverage', scored: 14, max: 20 },
  { dimension: 'Commercial Viability', scored: 8, max: 15 },
  { dimension: 'Competitive Position', scored: 9, max: 15 },
  { dimension: 'Delivery Risk', scored: 6, max: 10 },
];

test('assessmentScore distinguishes absent and invalid values from genuine zero', () => {
  [null, undefined, '', ' \n\t ', false, true, [], {}, NaN, Infinity, '59 points'].forEach((score) => {
    assert.equal(assessmentScore({ score }), null, `Invalid score: ${String(score)}`);
  });
  assert.equal(assessmentScore(null), null);
  assert.equal(assessmentScore(), null);
  [0, '0', ' 0 ', '0.0'].forEach((score) => assert.equal(assessmentScore({ score }), 0));
});

test('recorded historical scores and nonblank numeric strings are not recomputed', () => {
  [59, 62, 0, 59.5, '59', ' 62 ', '0', '59.5'].forEach((score) => {
    assert.equal(assessmentScore({ score, dimensions: legacyDimensions() }), Number(score));
  });
  assert.equal(assessmentScore({ score: 59, dimensions: [{ scored: null, max: null }] }), 59);
});

test('explicit canonical unscored status overrides numeric scores and dimensions', () => {
  ['not-calibrated', 'pending', '', null].forEach((status) => {
    assert.equal(assessmentScore({
      score: 62,
      dimensions: legacyDimensions(),
      assessmentView: { scoring: { status, reason: 'No approved calibration.' } },
    }), null);
  });
  assert.equal(assessmentScore({
    score: '0',
    assessmentView: { scoring: { status: 'scored', reason: '' } },
  }), 0);
  assert.equal(assessmentScore({
    score: 59,
    assessmentView: { scoring: { reason: 'Historical score.' } },
  }), 59);
  assert.equal(assessmentScore({
    score: null,
    assessmentView: { scoring: { status: 'scored' } },
    dimensions: [{ scored: null, max: null }],
  }), null, 'A scoring status alone does not provide a numeric score');
});

test('indexed scoringstatus preserves unscored state while canonical scoring remains authoritative', () => {
  [0, '0', 59, 62, '', null].forEach((score) => {
    assert.equal(assessmentScore({
      score,
      scoringstatus: 'not-calibrated',
      dimensions: legacyDimensions(),
    }), null);
  });
  [undefined, '', ' ', 'scored', ' Scored '].forEach((scoringstatus) => {
    [0, 59, 62].forEach((score) => {
      assert.equal(assessmentScore({ score: String(score), scoringstatus }), score);
    });
  });
  assert.equal(assessmentScore({
    score: 62,
    scoringstatus: 'scored',
    assessmentView: { scoring: { status: 'not-calibrated' } },
  }), null);
  assert.equal(assessmentScore({
    score: 0,
    scoringstatus: 'not-calibrated',
    assessmentView: { scoring: { status: 'scored' } },
  }), 0);
});

test('complete qualitative assessments remain unscored', () => {
  const dimensions = Array.from({ length: 7 }, (_, index) => ({
    dimension: `Dimension ${index + 1}`,
    scored: null,
    max: null,
    weight: null,
    notes: 'Qualitative finding.',
  }));
  assert.equal(assessmentScore({ score: null, dimensions }), null);
  assert.ok(dimensions.every((dimension) => dimensionPercent(dimension) === null));
});

test('legacy point fallback requires every input and a complete /100 basis', () => {
  const dimensions = legacyDimensions();
  assert.equal(assessmentScore({ dimensions }), 62);
  assert.equal(assessmentScore({
    dimensions: dimensions.map((dimension) => ({
      ...dimension, scored: String(dimension.scored), max: String(dimension.max),
    })),
  }), 62);
  assert.equal(assessmentScore({
    dimensions: dimensions.map((dimension) => ({ ...dimension, scored: '0' })),
  }), 0);
  assert.equal(assessmentScore({ dimensions: dimensions.slice(0, -1) }), null);
  assert.equal(assessmentScore({ dimensions: [] }), null);

  [null, '', ' ', 'unknown', -1, 21, Infinity].forEach((scored) => {
    assert.equal(assessmentScore({
      dimensions: [{ ...dimensions[0], scored }, ...dimensions.slice(1)],
    }), null);
  });
  [null, '', ' ', 0, -20, Infinity].forEach((max) => {
    assert.equal(assessmentScore({
      dimensions: [{ ...dimensions[0], max }, ...dimensions.slice(1)],
    }), null);
  });
  assert.equal(assessmentScore({ dimensions: [...dimensions, null] }), null);
});

test('dimensionPercent preserves zero and supports valid legacy point strings', () => {
  assert.equal(dimensionPercent({ scored: 0, max: 20 }), 0);
  assert.equal(dimensionPercent({ scored: '0', max: '20' }), 0);
  assert.equal(dimensionPercent({ scored: ' 12 ', max: '20' }), 60);
  assert.equal(dimensionPercent({ score: '12', max: '20' }), 60);
  assert.equal(dimensionPercent({ scored: 10, max: 10 }), 100);
});

test('dimensionPercent never substitutes zero or a default maximum for missing inputs', () => {
  [null, undefined, '', ' ', false, [], {}, Infinity, '12/20', -1, 21].forEach((scored) => {
    assert.equal(dimensionPercent({ scored, max: 20 }), null);
  });
  [null, undefined, '', ' ', false, [], {}, Infinity, 0, -1].forEach((max) => {
    assert.equal(dimensionPercent({ scored: 0, max }), null);
  });
  assert.equal(dimensionPercent({ scored: null, score: 12, max: 20 }), null);
  assert.equal(dimensionPercent(null), null);
  assert.equal(dimensionPercent(), null);
});
