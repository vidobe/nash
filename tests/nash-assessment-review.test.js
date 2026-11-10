import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAssessmentReview, buildAssessmentReviewMessages,
} from '../scripts/nash-assessment-review.js';
import { canonicalAssessment, sourceRequirements } from './fixtures/nash-assessment.fixture.js';

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
