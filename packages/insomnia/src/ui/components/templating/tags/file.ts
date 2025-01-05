import fs from 'fs';

import type { PluginTemplateTag } from '../../../../templating/extensions';

export const fileTag: { templateTag: PluginTemplateTag } = {
    templateTag: {
        env: 'local',
        name: 'file',
        displayName: 'File',
        description: 'read contents from a file',
        args: [
            {
                displayName: 'Choose File',
                type: 'file',
            },
        ],
        run(_context, path) {
            if (!path) {
                throw new Error('No file selected');
            }

            return fs.readFileSync(path, 'utf8');
        },
    },
};
