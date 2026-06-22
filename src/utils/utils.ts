export function sanitizeFileName(value: string) {
	return value
		.replace(/[:]/g, '')
		.replace(/[*"/\\<>|?]/g, '-');
}

export function logger(message: string) {

	const pluginNamePrefix = 'IssueTracker: ';

	console.log(pluginNamePrefix + message);
}

export const DEFAULT_TEMPLATE = `---
id: {{id}}
title: {{{title}}}
dueDate: {{due_date}}
webUrl: {{web_url}}
project: {{references.full}}
---

### {{{title}}}
##### Due on {{due_date}}

{{{description}}}

[Open in GitCode]({{web_url}})
`;
