import { JSONPath } from 'jsonpath-plus';
import os from 'os';

import type { PluginTemplateTag } from '../../../../templating/extensions';

export const osTag: { templateTag: PluginTemplateTag } = {
    templateTag: {
        env: 'local',
        displayName: 'OS',
        name: 'os',
        description: 'get OS info',
        args: [
            {
                displayName: 'Function',
                type: 'enum',
                options: [
                    { displayName: 'arch', value: 'arch' },
                    { displayName: 'cpus', value: 'cpus' },
                    { displayName: 'freemem', value: 'freemem' },
                    { displayName: 'hostname', value: 'hostname' },
                    { displayName: 'platform', value: 'platform' },
                    { displayName: 'release', value: 'release' },
                    { displayName: 'userInfo', value: 'userInfo' },
                ],
            },
            {
                displayName: 'JSONPath Filter',
                help: 'Some OS functions return objects. Use JSONPath queries to extract desired values.',
                hide: args => !['userInfo', 'cpus'].includes(args[0].value + ''),
                type: 'string',
            },
        ],
        run(_context, fnName: 'arch' | 'cpus', filter) {
            let value = os[fnName]();

            if (JSONPath && ['userInfo', 'cpus'].includes(fnName)) {
                try {
                    const results = JSONPath({ json: value, path: filter });
                    value = Array.isArray(results) ? results[0] : results;
                } catch (err) { }
            }

            if (typeof value !== 'string') {
                return JSON.stringify(value);
            } else {
                return value;
            }
        },
    },
};
