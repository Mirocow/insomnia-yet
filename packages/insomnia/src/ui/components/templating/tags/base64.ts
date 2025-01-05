import type { PluginTemplateTag } from '../../../../templating/extensions';
import { invariant } from '../../../../utils/invariant';

export const base64Tag: { templateTag: PluginTemplateTag } = {
    templateTag: {
        env: 'local',
        name: 'base64',
        displayName: 'Base64',
        description: 'encode or decode values',
        args: [
            {
                displayName: 'Action',
                type: 'enum',
                options: [
                    { displayName: 'Encode', value: 'encode' },
                    { displayName: 'Decode', value: 'decode' },
                ],
            },
            {
                displayName: 'Kind',
                type: 'enum',
                options: [
                    { displayName: 'Normal', value: 'normal' },
                    { displayName: 'URL', value: 'url' },
                    { displayName: 'Hex', value: 'hex' },
                ],
            },
            {
                displayName: 'Value',
                type: 'string',
                placeholder: 'My text',
            },
        ],
        run(_context, action: 'encode' | 'decode', kind: 'normal' | 'url' | 'hex', text) {
            text = text || '';
            invariant(action === 'encode' || action === 'decode', 'invalid action');
            invariant(kind === 'normal' || kind === 'url' || kind === 'hex', 'invalid kind');
            if (action === 'encode') {
                if (kind === 'normal') {
                    return Buffer.from(text, 'utf8').toString('base64');
                }
                if (kind === 'hex') {
                    return Buffer.from(text, 'hex').toString('base64');
                }
                if (kind === 'url') {
                    return Buffer.from(text, 'utf8')
                        .toString('base64')
                        .replace(/\+/g, '-')
                        .replace(/\//g, '_')
                        .replace(/=/g, '');
                }
            }
            if (kind === 'hex') {
                return Buffer.from(text, 'base64').toString('hex');
            }
            return Buffer.from(text, 'base64').toString('utf8');
        },
        author: '',
    },
};
