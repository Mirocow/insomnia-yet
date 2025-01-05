import type { PluginTemplateTag } from '../../../../templating/extensions';
import { fakerFunctions } from '../faker-functions';

export const fakerTag: { templateTag: PluginTemplateTag } = {
    templateTag: {
        env: 'local',
        name: 'faker',
        displayName: 'Faker',
        description: 'generate random outputs',
        args: [
            {
                displayName: 'Function',
                type: 'enum',
                options: Object.keys(fakerFunctions).map(key => ({ displayName: key, value: key })),
            },
        ],
        run(_context, keys: keyof typeof fakerFunctions) {
            return fakerFunctions[keys]();
        },
        author: '',
    },
};
