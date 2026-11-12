import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAssessmentReview, buildAssessmentReviewCorrectionMessages, buildAssessmentReviewMessages,
} from '../scripts/nash-assessment-review.js';
import {
  canonicalAssessment, draftedRequirements, rubricAssessment, sourceRequirements,
} from './fixtures/nash-assessment.fixture.js';

function reviewFor(view) {
  return {
    reviewedRequirementIds: view.requirements.map((row) => row.id),
    coreUpdates: {},
    requirementCorrections: [],
  };
}

test('critical review explicitly receives the whole matrix, original context and selected policy', () => {
  const [message] = buildAssessmentReviewMessages({
    view: canonicalAssessment(),
    requirements: sourceRequirements(),
    sourceContext: 'Original source with incomplete draft ratings',
    solutionSlugs: ['aem'],
  });
  assert.match(message.content, /Original source with incomplete draft ratings/);
  assert.match(message.content, /REQ-2/);
  assert.match(message.content, /Content Fragment Delivery with OpenAPI first/);
  assert.match(message.content, /authoring\/storage\/localization/);
  assert.match(message.content, /all seven conclusions/);
  assert.match(message.content, /short solution-and-customer title/);
  assert.match(message.content, /fit conclusion and evidence caveats belong in summary\/conditions/);
});

test('a reviewed correction changes only model-supplied content and preserves source locations', () => {
  const view = canonicalAssessment();
  view.requirements[0].sourceLocator = 'Comparison, row 8';
  const review = reviewFor(view);
  review.requirementCorrections = [{
    ...view.requirements[0],
    response: 'The exact template workflow needs a scoped demonstration.',
    sourceLocator: 'An invented location',
  }];
  const result = applyAssessmentReview(view, JSON.stringify(review), sourceRequirements());
  assert.equal(result.requirements[0].sourceLocator, 'Comparison, row 8');
  assert.match(result.requirements[0].response, /exact template workflow/);
  assert.equal(result.requirements[1], view.requirements[1]);
  assert.notEqual(result, view);
  assert.doesNotMatch(view.requirements[0].response, /exact template workflow/);
});

test('a focused dimension correction cannot discard the other reviews or rich AI sections', () => {
  const view = canonicalAssessment();
  const review = reviewFor(view);
  review.dimensionUpdates = [{
    name: 'Functional Coverage',
    details: { scoreRationale: 'Authoring and message execution need separate evidence.' },
    notes: 'The exact template workflow remains unknown.',
  }];
  const result = applyAssessmentReview(view, JSON.stringify(review), sourceRequirements());
  assert.equal(result.dimensionDetails.length, 7);
  assert.equal(result.dimensionDetails.at(-1).sections.length, 4);
  assert.deepEqual(result.dimensionDetails.at(-1), view.dimensionDetails.at(-1));
  assert.match(result.dimensionDetails[2].scoreRationale, /separate evidence/);
  assert.match(result.dimensions[2].notes, /template workflow/);
  assert.equal(view.dimensionDetails[2].scoreRationale.includes('separate evidence'), false);
});

test('coverage omissions, duplicate IDs, source reprioritization and unlinked changes fail closed', () => {
  [
    (review) => { review.reviewedRequirementIds.pop(); },
    (review) => { review.reviewedRequirementIds[1] = 'REQ-1'; },
    (review) => { review.coreUpdates.provenance = {}; },
    (review, view) => {
      review.requirementCorrections = [{ ...view.requirements[0], priority: 'M' }];
    },
    (review, view) => {
      review.requirementCorrections = [{ ...view.requirements[0], evidenceRefs: ['missing'] }];
    },
    (review, view) => {
      review.coreUpdates.solutions = [{ ...view.solutions[0], requirements: [] }];
    },
    (review, view) => {
      review.coreUpdates.solutions = [{ ...view.solutions[0], dependencies: ['Pass G99'] }];
    },
  ].forEach((mutate) => {
    const view = canonicalAssessment();
    const review = reviewFor(view);
    mutate(review, view);
    assert.throws(() => applyAssessmentReview(view, JSON.stringify(review), sourceRequirements()));
  });
});

test('a restarted review stream with a skipped closer applies exactly like the clean review', () => {
  const view = rubricAssessment();
  const review = reviewFor(view);
  review.dimensionUpdates = [{
    name: 'Strategic Fit',
    rating: 3,
    details: {
      scoreRationale: 'Two of four channels are documented.',
      unknowns: ['Channel roadmap'],
    },
  }];
  const clean = JSON.stringify(review);
  const damaged = `${clean.slice(0, 120)}${clean.replace('"Channel roadmap"]}}]', '"Channel roadmap"]}]')}`;
  assert.throws(() => JSON.parse(damaged));
  assert.deepEqual(
    applyAssessmentReview(view, damaged, sourceRequirements()),
    applyAssessmentReview(view, clean, sourceRequirements()),
  );
  assert.throws(
    () => applyAssessmentReview(view, clean.slice(0, -40), sourceRequirements()),
    /returned invalid JSON/,
    'Truncated reviews are never completed',
  );
});

test('a review that closes its root early and again at the end applies like the clean review', () => {
  const view = rubricAssessment();
  const review = reviewFor(view);
  review.dimensionUpdates = [{
    name: 'Strategic Fit',
    rating: 3,
    details: { scoreRationale: 'Two of four channels are documented.' },
  }];
  const clean = JSON.stringify(review);
  const damaged = `${clean.replace('"coreUpdates":{},', '"coreUpdates":{}},')}}`;
  assert.notEqual(damaged, `${clean}}`);
  assert.throws(() => JSON.parse(damaged));
  assert.deepEqual(
    applyAssessmentReview(view, damaged, sourceRequirements()),
    applyAssessmentReview(view, clean, sourceRequirements()),
  );
});

test('a review that leaves its dimension updates open applies like the clean review', () => {
  const view = rubricAssessment();
  const review = {
    reviewedRequirementIds: view.requirements.map((row) => row.id),
    coreUpdates: {},
    dimensionUpdates: [{
      name: 'Strategic Fit',
      rating: 3,
      details: { scoreRationale: 'Two of four channels are documented.' },
    }],
    requirementCorrections: [],
  };
  const clean = JSON.stringify(review);
  const damaged = clean.replace('}}],"requirementCorrections"', '}},"requirementCorrections"');
  assert.notEqual(damaged, clean);
  assert.deepEqual(
    applyAssessmentReview(view, damaged, sourceRequirements()),
    applyAssessmentReview(view, clean, sourceRequirements()),
  );
  assert.throws(
    () => applyAssessmentReview(view, JSON.stringify({ ...review, notes: 'x' }), sourceRequirements()),
    /unknown top-level fields \(notes\)/,
    'Unknown root members are rejected, so a repair can never silently misplace content',
  );
});

test('a review correction points at the exact JSON slip, and only for syntax errors', () => {
  const view = rubricAssessment();
  const clean = JSON.stringify(reviewFor(view));
  let rejection;
  assert.throws(
    () => applyAssessmentReview(view, clean.replace('"coreUpdates":{}', '"coreUpdates"{}'), sourceRequirements()),
    (error) => {
      rejection = error;
      return /returned invalid JSON/.test(error.message);
    },
  );
  const messages = [{ role: 'user', content: 'review' }];
  const correction = buildAssessmentReviewCorrectionMessages(messages, clean, rejection).at(-1);
  assert.ok(correction.content.includes('"coreUpdates"<<<HERE>>>{}'), correction.content);
  assert.match(correction.content, /Fix that exact spot/);
  const coverage = new Error('The integrity review did not cover every requirement.');
  const semantic = buildAssessmentReviewCorrectionMessages(messages, clean, coverage).at(-1);
  assert.doesNotMatch(semantic.content, /JSON syntax error|<<<HERE>>>/);
});

test('contract v4 review: a rating change is recomputed by Nash, never by the model', () => {
  const view = rubricAssessment();
  const review = reviewFor(view);
  review.dimensionUpdates = [{
    name: 'Strategic Fit',
    rating: '2',
    details: { scoreRationale: 'The documented strategy covers only one of four channels.' },
  }];
  review.coreUpdates = { meta: { score: 99, verdict: 'Go' } };
  const result = applyAssessmentReview(view, JSON.stringify(review), sourceRequirements());
  const strategic = result.dimensions.find((item) => item.dimension === 'Strategic Fit');
  assert.deepEqual([strategic.rating, strategic.scored], [2, 8]);
  assert.equal(result.meta.score, view.meta.score - 8);
  assert.equal(result.meta.verdict, 'Go');
  assert.equal(view.dimensions[0].rating, 4, 'The input view is not mutated');
  [0, 6, 'high', 3.5].forEach((rating) => {
    const invalid = reviewFor(view);
    invalid.dimensionUpdates = [{ name: 'Technical Fit', rating, details: { scoreRationale: 'Changed.' } }];
    assert.throws(() => applyAssessmentReview(view, JSON.stringify(invalid), sourceRequirements()), /integer from 1 to 5/);
  });
  const legacy = canonicalAssessment();
  const v3 = reviewFor(legacy);
  v3.dimensionUpdates = [{ name: 'Technical Fit', rating: 4, details: { scoreRationale: 'Changed.' } }];
  assert.throws(
    () => applyAssessmentReview(legacy, JSON.stringify(v3), sourceRequirements()),
    /integer from 1 to 5/,
    'Contract v3 reports keep their recorded scoring',
  );
  const unexplained = reviewFor(view);
  unexplained.dimensionUpdates = [{ name: 'Technical Fit', rating: 2, details: { unknowns: ['Hosting region'] } }];
  assert.throws(() => applyAssessmentReview(view, JSON.stringify(unexplained), sourceRequirements()), /needs its updated scoreRationale/);
  const unchanged = reviewFor(view);
  unchanged.dimensionUpdates = [{ name: 'Technical Fit', rating: 4, details: { unknowns: ['Hosting region'] } }];
  const same = applyAssessmentReview(view, JSON.stringify(unchanged), sourceRequirements());
  assert.equal(same.meta.score, view.meta.score);
});

test('contract v4 review: corrections move the fit, keep source ownership and recompute coverage', () => {
  const requirements = draftedRequirements();
  const view = rubricAssessment(requirements);
  const review = reviewFor(view);
  review.requirementCorrections = [{
    ...view.requirements[1],
    fit: 'Not supported',
    status: 'Covered',
    priority: 'Unclassified',
    response: 'The named mainframe connector is not available.',
  }];
  const result = applyAssessmentReview(view, JSON.stringify(review), requirements);
  const [, corrected] = result.requirements;
  assert.deepEqual([corrected.fit, corrected.status, corrected.priority], ['Not supported', 'Gap', 'M']);
  assert.deepEqual(corrected.draft, { answer: 'OPEN' });
  assert.deepEqual(result.scoring.functionalCoverage.mustGaps, ['REQ-2']);
  assert.equal(result.dimensions[2].rating, 1);
  assert.ok(result.meta.score < view.meta.score);
  const replaced = reviewFor(view);
  replaced.coreUpdates = { evidence: view.evidence.filter((item) => item.type !== 'source-citation') };
  const withCitation = structuredClone(view);
  withCitation.evidence.push({
    id: 'C1', type: 'source-citation', source: 'Draft source', locator: 'https://experienceleague.adobe.com/en/docs', claim: 'Cited by the draft.',
  });
  withCitation.requirements[0].evidenceRefs.push('C1');
  replaced.reviewedRequirementIds = withCitation.requirements.map((row) => row.id);
  const kept = applyAssessmentReview(withCitation, JSON.stringify(replaced), requirements);
  assert.equal(kept.evidence.filter((item) => item.id === 'C1').length, 1, 'Source citations survive an evidence rewrite');
  const unknownFit = reviewFor(view);
  unknownFit.requirementCorrections = [{ ...view.requirements[0], fit: 'Partly' }];
  assert.throws(() => applyAssessmentReview(view, JSON.stringify(unknownFit), requirements), /fit/);
});
