import uuid from 'uuid';

import type { PluginTemplateTag } from '../../../../templating/extensions';

export const uuidTag: { templateTag: PluginTemplateTag } = {
    templateTag: {
        env: 'local',
        displayName: 'UUID',
        name: 'uuid',
        description: 'generate v1 or v4 UUIDs',
        args: [
            {
                displayName: 'Version',
                type: 'enum',
                options: [
                    { displayName: 'Version 4', value: 'v4' },
                    { displayName: 'Version 1', value: 'v1' },
                ],
            },
        ],
        run(_context, uuidType = 'v4') {
            switch ((uuidType + '').toLowerCase()) {
                case '1':
                case 'v1':
                    return uuid.v1();
                case '4':
                case 'v4':
                    return uuid.v4();
                default:
                    throw new Error(`Invalid UUID type "${uuidType}"`);
            }
        },
        author: '',
    },
};
