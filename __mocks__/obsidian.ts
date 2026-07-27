
export interface RequestUrlParam {
	/** @public */
	url: string;
	/** @public */
	method?: string;
	/** @public */
	contentType?: string;
	/** @public */
	body?: string | ArrayBuffer;
	/** @public */
	headers?: Record<string, string>;
	/**
	 * Whether to throw an error when the status code is >= 400
	 * Defaults to true
	 * @public
	 */
	throw?: boolean;
}

/** @public */
export interface RequestUrlResponse {
	/** @public */
	status: number;
	/** @public */
	headers: Record<string, string>;
	/** @public */
	arrayBuffer: ArrayBuffer;
	/** @public */
	json: any;
	/** @public */
	text: string;
}
export function requestUrl(): Promise<RequestUrlResponse>{
	return Promise.resolve({json: "mockJson", text: '', status: 200} as RequestUrlResponse)
}
export class App {
	keymap: any;
	scope: any;
	workspace: any;
	vault: any;
	metadataCache: any;
	fileManager: any;
	lastEvent: any | null;
	constructor() {
	}
}

export class TAbstractFile {
	path: string;
	name: string;

	constructor(path = '') {
		this.path = path;
		this.name = path.split('/').pop() ?? path;
	}
}

export class TFile extends TAbstractFile {
	extension: string;
	basename: string;

	constructor(path = '') {
		super(path);
		const parts = this.name.split('.');
		this.extension = parts.length > 1 ? parts[parts.length - 1] : '';
		this.basename = parts.length > 1 ? parts.slice(0, -1).join('.') : this.name;
	}
}

export class TFolder extends TAbstractFile {
	children: TAbstractFile[];

	constructor(path = '', children: TAbstractFile[] = []) {
		super(path);
		this.children = children;
	}
}

export class Vault {
	static recurseChildren(root: TAbstractFile, cb: (file: TAbstractFile) => void) {
		cb(root);
		if (root instanceof TFolder) {
			for (const child of root.children) {
				Vault.recurseChildren(child, cb);
			}
		}
	}
}

export function parseYaml(raw: string): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const line of raw.split('\n')) {
		const match = line.match(/^([^:#]+):\s*(.*)$/);
		if (!match) {
			continue;
		}
		const [, key, rawValue] = match;
		const value = rawValue.trim();
		if (value === '[]') {
			result[key.trim()] = [];
			continue;
		}
		if (value === 'true' || value === 'false') {
			result[key.trim()] = value === 'true';
			continue;
		}
		if (/^-?\d+(\.\d+)?$/.test(value)) {
			result[key.trim()] = Number(value);
			continue;
		}
		if (value.startsWith('"') && value.endsWith('"')) {
			result[key.trim()] = value.slice(1, -1);
			continue;
		}
		result[key.trim()] = value;
	}
	return result;
}
