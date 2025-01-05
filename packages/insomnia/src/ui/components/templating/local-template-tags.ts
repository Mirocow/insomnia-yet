
import type { TemplateTag } from '../../../plugins';
import type { PluginTemplateTag } from '../../../templating/extensions';
import { base64Tag } from './tags/base64';
import { cookieTag } from './tags/cookie';
import { currentRequestTag } from './tags/current-request';
import { fakerTag } from './tags/faker';
import { fileTag } from './tags/file';
import { hashTag } from './tags/hashed';
import { jsonPathTag } from './tags/json-path';
import { osTag } from './tags/os';
import { otherRequestTag } from './tags/other-request';
import { otherResponseTag } from './tags/other-response';
import { promptTag } from './tags/prompt';
import { timestampTag } from './tags/timestamp';
import { uuidTag } from './tags/uuid';

const localTemplatePlugins: { templateTag: PluginTemplateTag }[] = [
  uuidTag,
  hashTag,
  timestampTag,
  promptTag,
  otherResponseTag,
  otherRequestTag,
  osTag,
  jsonPathTag,
  fileTag,
  currentRequestTag,
  cookieTag,
  base64Tag,
  fakerTag,
];

export const localTemplateTags: TemplateTag[] = localTemplatePlugins.map(t => ({
  plugin: {
    name: t.templateTag.name,
    author: t.templateTag.author,
    description: 'Built-in plugin',
    version: '0.0.0',
    directory: '',
    config: {
      disabled: false,
    },
    module: {},
  },
  templateTag: t.templateTag,
}));
