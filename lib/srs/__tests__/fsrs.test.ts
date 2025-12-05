import { describe, expect, it } from 'vitest';
import { mapGradeToRating, scheduleReview, Rating, State } from '../fsrs';
import { GradeStatus } from '@/types';

describe('mapGradeToRating', () => {
  it('maps INCORRECT to Again', () => {
    expect(mapGradeToRating(GradeStatus.INCORRECT)).toBe(Rating.Again);
  });

  it('maps PARTIAL to Hard', () => {
    expect(mapGradeToRating(GradeStatus.PARTIAL)).toBe(Rating.Hard);
  });

  it('maps CORRECT to Good', () => {
    expect(mapGradeToRating(GradeStatus.CORRECT)).toBe(Rating.Good);
  });
});

describe('scheduleReview', () => {
  const fixedNow = new Date('2024-01-15T10:00:00Z');

  describe('new card behavior', () => {
    it('creates new card when null passed', () => {
      const card = scheduleReview(null, GradeStatus.CORRECT, fixedNow);
      expect(card.reps).toBe(1);
    });

    it('new card starts in Learning state after first review', () => {
      const card = scheduleReview(null, GradeStatus.CORRECT, fixedNow);
      expect(card.state).toBe(State.Learning);
    });

    it('sets due date in the future', () => {
      const card = scheduleReview(null, GradeStatus.CORRECT, fixedNow);
      expect(card.due.getTime()).toBeGreaterThan(fixedNow.getTime());
    });
  });

  describe('stability behavior', () => {
    it('CORRECT increases stability over multiple reviews', () => {
      let card = scheduleReview(null, GradeStatus.CORRECT, fixedNow);
      const initialStability = card.stability;

      // Advance through several correct reviews
      for (let i = 0; i < 3; i++) {
        card = scheduleReview(card, GradeStatus.CORRECT, new Date(card.due));
      }

      expect(card.stability).toBeGreaterThan(initialStability);
    });

    it('INCORRECT decreases stability and enters relearning', () => {
      // Build up a card with some stability (needs to graduate first)
      let card = scheduleReview(null, GradeStatus.CORRECT, fixedNow);
      for (let i = 0; i < 5; i++) {
        card = scheduleReview(card, GradeStatus.CORRECT, new Date(card.due));
      }

      // Card should be in Review state with decent stability
      expect(card.state).toBe(State.Review);
      const beforeLapse = card.stability;

      // Now fail
      card = scheduleReview(card, GradeStatus.INCORRECT, new Date(card.due));
      expect(card.stability).toBeLessThan(beforeLapse);
      expect(card.state).toBe(State.Relearning);
    });
  });

  describe('counter behavior', () => {
    it('increments reps on each review', () => {
      const card1 = scheduleReview(null, GradeStatus.CORRECT, fixedNow);
      expect(card1.reps).toBe(1);

      const card2 = scheduleReview(card1, GradeStatus.CORRECT, new Date(card1.due));
      expect(card2.reps).toBe(2);

      const card3 = scheduleReview(card2, GradeStatus.PARTIAL, new Date(card2.due));
      expect(card3.reps).toBe(3);
    });

    it('increments lapses on INCORRECT for graduated cards', () => {
      // Graduate card to Review state first (lapses only count in Review/Relearning)
      let card = scheduleReview(null, GradeStatus.CORRECT, fixedNow);
      while (card.state === State.Learning) {
        card = scheduleReview(card, GradeStatus.CORRECT, new Date(card.due));
      }
      expect(card.state).toBe(State.Review);
      expect(card.lapses).toBe(0);

      // Now fail - should increment lapses
      card = scheduleReview(card, GradeStatus.INCORRECT, new Date(card.due));
      expect(card.lapses).toBe(1);

      // Recover and fail again
      while (card.state === State.Relearning) {
        card = scheduleReview(card, GradeStatus.CORRECT, new Date(card.due));
      }
      card = scheduleReview(card, GradeStatus.INCORRECT, new Date(card.due));
      expect(card.lapses).toBe(2);
    });

    it('does not increment lapses on CORRECT or PARTIAL', () => {
      let card = scheduleReview(null, GradeStatus.CORRECT, fixedNow);
      card = scheduleReview(card, GradeStatus.CORRECT, new Date(card.due));
      card = scheduleReview(card, GradeStatus.PARTIAL, new Date(card.due));

      expect(card.lapses).toBe(0);
    });
  });

  describe('interval progression', () => {
    it('scheduled_days increases with correct reviews', () => {
      let card = scheduleReview(null, GradeStatus.CORRECT, fixedNow);

      // Graduate from learning phase
      while (card.state === State.Learning) {
        card = scheduleReview(card, GradeStatus.CORRECT, new Date(card.due));
      }

      // Now in Review state, check intervals grow
      const firstInterval = card.scheduled_days;
      card = scheduleReview(card, GradeStatus.CORRECT, new Date(card.due));
      const secondInterval = card.scheduled_days;

      expect(secondInterval).toBeGreaterThan(firstInterval);
    });
  });
});
