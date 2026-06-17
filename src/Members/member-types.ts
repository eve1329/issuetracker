export type InternalMatchSource = 'org' | 'repo' | 'whitelist' | 'none';

export interface GitCodeMember {
	username: string;
	name?: string;
}

export interface InternalMemberRecord {
	username: string;
	source: Exclude<InternalMatchSource, 'none'>;
	repo?: string;
}

export interface InternalMemberIndex {
	usernames: Record<string, InternalMemberRecord>;
}
