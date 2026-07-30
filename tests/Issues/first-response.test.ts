import {findFirstOtherPersonResponseAt} from '../../src/Issues/first-response';

describe('findFirstOtherPersonResponseAt', () => {
	it('returns the earliest ordinary comment from someone other than the Issue author', () => {
		const result = findFirstOtherPersonResponseAt('Partner_A', [
			{authorUsername: 'partner_a', createdAt: '2026-06-17T09:15:00+08:00', isSystem: false},
			{authorUsername: 'reviewer_b', createdAt: '2026-06-17T10:20:00+08:00', isSystem: false},
			{authorUsername: 'reviewer_c', createdAt: '2026-06-17T09:45:00+08:00', isSystem: false},
			{authorUsername: 'reviewer_d', createdAt: '2026-06-17T09:30:00+08:00', isSystem: true},
		]);

		expect(result).toBe('2026-06-17T09:45:00+08:00');
	});

	it('ignores system notes, missing authors, and invalid timestamps', () => {
		const result = findFirstOtherPersonResponseAt('partner_a', [
			{authorUsername: '', createdAt: '2026-06-17T09:20:00+08:00', isSystem: false},
			{authorUsername: 'reviewer_b', createdAt: 'not-a-date', isSystem: false},
			{authorUsername: 'reviewer_c', createdAt: '2026-06-17T09:25:00+08:00', isSystem: true},
		]);

		expect(result).toBe('');
	});
});
