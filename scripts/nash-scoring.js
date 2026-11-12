function numericValue(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function dimensionPoints(dimension) {
  if (!dimension || typeof dimension !== 'object') return null;
  const scored = numericValue(dimension.scored === undefined ? dimension.score : dimension.scored);
  const max = numericValue(dimension.max);
  if (scored === null || max === null || max <= 0 || scored < 0 || scored > max) return null;
  return { scored, max };
}

/**
 * Returns a dimension's percentage, or null when either point input is unknown or invalid.
 * An explicitly unknown `scored` value is not replaced by a legacy `score` alias.
 */
export function dimensionPercent(dimension) {
  const points = dimensionPoints(dimension);
  if (points) return (points.scored / points.max) * 100;
  // Rubric-rated dimensions outside the total (AI & Agentic Fit) still show their 1-5 rating.
  const { rating } = dimension || {};
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating * 20 : null;
}

/**
 * Returns the recorded score without recalculation, including zero and numeric legacy strings.
 * Explicit canonical scoring status takes precedence over indexed `scoringstatus` metadata.
 * A missing score can only fall back to a complete legacy /100 point scorecard;
 * unknown rows never contribute zero.
 */
export function assessmentScore(assessment) {
  const scoring = assessment?.assessmentView?.scoring;
  if (scoring && Object.hasOwn(scoring, 'status')) {
    if (scoring.status !== 'scored') return null;
  } else {
    const indexedStatus = typeof assessment?.scoringstatus === 'string'
      ? assessment.scoringstatus.trim().toLowerCase() : '';
    if (indexedStatus && indexedStatus !== 'scored') return null;
  }
  const score = numericValue(assessment?.score);
  if (score !== null) return score;

  if (!Array.isArray(assessment?.dimensions) || !assessment.dimensions.length) return null;
  const points = assessment.dimensions.map(dimensionPoints);
  if (points.some((point) => point === null)) return null;
  const max = points.reduce((sum, point) => sum + point.max, 0);
  if (Math.abs(max - 100) > 0.000001) return null;
  const total = points.reduce((sum, point) => sum + point.scored, 0);
  return Number.isFinite(total) ? total : null;
}
