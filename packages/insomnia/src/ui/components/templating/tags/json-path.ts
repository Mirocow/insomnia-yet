import { JSONPath } from 'jsonpath-plus';

import type { PluginTemplateTag } from '../../../../templating/extensions';

export const jsonPathTag: { templateTag: PluginTemplateTag } = {
    templateTag: {
        env: 'local',
        displayName: 'JSONPath',
        name: 'jsonpath',
        description: 'pull data from JSON strings with JSONPath',
        args: [
            {
                displayName: 'JSON string',
                type: 'string',
            },
            {
                displayName: 'JSONPath Filter',
                encoding: 'base64', // So it doesn't cause syntax errors
                type: 'string',
            },
        ],
        run(_context, jsonString, filter) {
            let body;
            try {
                body = JSON.parse(jsonString);
            } catch (err) {
                throw new Error(`Invalid JSON: ${err.message}`);
            }

            let results;
            try {
                results = JSONPath({ json: body, path: filter });
                if (!Array.isArray(results)) {
                    results = [results];
                }
            } catch (err) {
                throw new Error(`Invalid JSONPath query: ${filter}`);
            }

            if (results.length === 0) {
                throw new Error(`JSONPath query returned no results: ${filter}`);
            }

            return results[0];
        },
    },
};
