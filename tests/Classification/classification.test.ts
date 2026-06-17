import {matchInternalAuthor} from "../../src/Classification/classification";

describe('matchInternalAuthor', () => {
	it('marks an internal author using the matched source', () => {
		const result = matchInternalAuthor('org_user', {
			usernames: {
				org_user: {username: 'org_user', source: 'org'},
			},
		});

		expect(result).toEqual({
			isInternalAuthor: true,
			internalMatchedBy: 'org',
		});
	});

	it('marks an external author as non-internal when not present in the index', () => {
		const result = matchInternalAuthor('outside_user', {
			usernames: {
				org_user: {username: 'org_user', source: 'org'},
			},
		});

		expect(result).toEqual({
			isInternalAuthor: false,
			internalMatchedBy: 'none',
		});
	});
});
