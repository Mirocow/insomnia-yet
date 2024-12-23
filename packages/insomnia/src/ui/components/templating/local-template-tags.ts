import iconv from 'iconv-lite';
import { JSONPath } from 'jsonpath-plus';
import { CookieJar } from 'tough-cookie';

import type { Request, RequestParameter } from '../../../models/request';
import type { Response } from '../../../models/response';
import type { TemplateTag } from '../../../plugins';
import type { PluginTemplateTag } from '../../../templating/extensions';
import { buildQueryStringFromParams, joinUrlAndQueryString, smartEncodeUrl } from '../../../utils/url/querystring';

const localTemplatePlugins: { templateTag: PluginTemplateTag }[] = [
  {
    templateTag: {
      name: 'currentrequest',
      displayName: 'Request',
      description: 'reference value from current request',
      args: [
        {
          displayName: 'Attribute',
          type: 'enum',
          options: [
            {
              displayName: 'Name',
              value: 'name',
              description: 'name of request',
            },
            {
              displayName: 'Folder',
              value: 'folder',
              description: 'name of parent folder (or workspace)',
            },
            {
              displayName: 'URL',
              value: 'url',
              description: 'fully qualified URL',
            },
            {
              displayName: 'Query Parameter',
              value: 'parameter',
              description: 'query parameter by name',
            },
            {
              displayName: 'Header',
              value: 'header',
              description: 'header value by name',
            },
            {
              displayName: 'Cookie',
              value: 'cookie',
              description: 'cookie value by name',
            },
            {
              displayName: 'OAuth 2.0 Access Token',
              value: 'oauth2',
              /*
                This value is left as is and not renamed to 'oauth2-access' so as to not
                break the current release's usage of `oauth2`.
              */
            },
            {
              displayName: 'OAuth 2.0 Identity Token',
              value: 'oauth2-identity',
            },
            {
              displayName: 'OAuth 2.0 Refresh Token',
              value: 'oauth2-refresh',
            },
          ],
        },
        {
          type: 'string',
          hide: args => ['url', 'oauth2', 'oauth2-identity', 'oauth2-refresh', 'name', 'folder'].includes(
            args[0].value + ''
          ),
          displayName: args => {
            switch (args[0].value) {
              case 'cookie':
                return 'Cookie Name';
              case 'parameter':
                return 'Query Parameter Name';
              case 'header':
                return 'Header Name';
              default:
                return 'Name';
            }
          },
        },
        {
          hide: args => args[0].value !== 'folder',
          displayName: 'Parent Index',
          help: 'Specify an index (Starting at 0) for how high up the folder tree to look',
          type: 'number',
        },
      ],

      async run(context: PluginTemplateTagContext, attribute, name, folderIndex) {
        const { meta } = context;

        if (!meta.requestId || !meta.workspaceId) {
          return null;
        }

        const request: Request = await context.util.models.request.getById(meta.requestId);
        const workspace = await context.util.models.workspace.getById(meta.workspaceId);

        if (!request) {
          throw new Error(`Request not found for ${meta.requestId}`);
        }

        if (!workspace) {
          throw new Error(`Workspace not found for ${meta.workspaceId}`);
        }
        const params: RequestParameter[] = [];
        if (attribute === 'url') {
          for (const p of request.parameters) {
            params.push({
              name: await context.util.render(p.name),
              value: await context.util.render(p.value),
            });
          }
          return smartEncodeUrl(joinUrlAndQueryString((await context.util.render(request.url)), buildQueryStringFromParams(params)), request.settingEncodeUrl);
        }
        if (attribute === 'cookie') {
          if (!name) {
            throw new Error('No cookie specified');
          }

          const cookieJar = await context.util.models.cookieJar.getOrCreateForWorkspace(workspace);
          for (const p of request.parameters) {
            params.push({
              name: await context.util.render(p.name),
              value: await context.util.render(p.value),
            });
          }
          const url = smartEncodeUrl(joinUrlAndQueryString((await context.util.render(request.url)), buildQueryStringFromParams(params)), request.settingEncodeUrl);
          return new Promise((resolve, reject) => {
            let jar;
            try {
              // For some reason, fromJSON modifies `cookies`.
              // Create a copy first just to be sure.
              const copy = JSON.stringify({ cookies: cookieJar.cookies });
              jar = CookieJar.fromJSON(copy);
            } catch (error) {
              console.log('[cookies] Failed to initialize cookie jar', error);
              jar = new CookieJar();
            }
            jar.rejectPublicSuffixes = false;
            jar.looseMode = true;

            jar.getCookies(url, {}, (err, cookies) => {
              if (err) {
                console.warn(`Failed to find cookie for ${url}`, err);
              }

              if (!cookies || cookies.length === 0) {
                reject(new Error(`No cookies in store for url "${url}"`));
              }

              const cookie = cookies.find(cookie => cookie.key === name);
              if (!cookie) {
                const names = cookies.map(c => `"${c.key}"`).join(',\n\t');
                throw new Error(
                  `No cookie with name "${name}".\nChoices are [\n\t${names}\n] for url "${url}"`
                );
              } else {
                resolve(cookie ? cookie.value : null);
              }
            });
          });
        }
        if (attribute === 'parameter') {
          if (!name) {
            throw new Error('No query parameter specified');
          }

          const parameterNames: string[] = [];

          if (request.parameters.length === 0) {
            throw new Error('No query parameters available');
          }

          for (const queryParameter of request.parameters) {
            const queryParameterName = await context.util.render(queryParameter.name);
            parameterNames.push(queryParameterName);
            if (queryParameterName.toLowerCase() === name.toLowerCase()) {
              return context.util.render(queryParameter.value);
            }
          }

          const parameterNamesStr = parameterNames.map(n => `"${n}"`).join(',\n\t');
          throw new Error(
            `No query parameter with name "${name}".\nChoices are [\n\t${parameterNamesStr}\n]`
          );
        }
        if (attribute === 'header') {
          if (!name) {
            throw new Error('No header specified');
          }

          const headerNames: string[] = [];

          if (request.headers.length === 0) {
            throw new Error('No headers available');
          }

          for (const header of request.headers) {
            const headerName = await context.util.render(header.name);
            headerNames.push(headerName);
            if (headerName.toLowerCase() === name.toLowerCase()) {
              return context.util.render(header.value);
            }
          }

          const headerNamesStr = headerNames.map(n => `"${n}"`).join(',\n\t');
          throw new Error(`No header with name "${name}".\nChoices are [\n\t${headerNamesStr}\n]`);
        }
        if (attribute === 'oauth2' || attribute === 'oauth2-identity' || attribute === 'oauth2-refresh') {
          const access = await context.util.models.oAuth2Token.getByRequestId(request._id);
          if (!access || !access.accessToken) {
            throw new Error('No OAuth 2.0 access tokens found for request');
          }
          if (attribute === 'oauth2') {
            return access.accessToken;
          }
          if (attribute === 'oauth2-identity') {
            return access.identityToken;
          }
          if (attribute === 'oauth2-refresh') {
            return access.refreshToken;
          }
        }
        if (attribute === 'name') {
          return request.name;
        }
        if (attribute === 'folder') {
          const ancestors = await context.util.models.request.getAncestors(request);
          const doc = ancestors[folderIndex || 0];
          if (!doc) {
            throw new Error(
              `Could not get folder by index ${folderIndex}. Must be between 0-${ancestors.length -
              1}`
            );
          }
          return doc ? doc.name : null;
        }

        return null;
      },
      author: '',
    },
  },
  {
    templateTag: {
      name: 'otherrequest',
      displayName: 'Request',
      description: 'reference values from other request',
      args: [
        {
          displayName: 'Attribute',
          type: 'enum',
          options: [
            {
              displayName: 'Body Attribute',
              description: 'value of request body',
              value: 'body',
            },
            {
              displayName: 'Formfield',
              description: 'value of request form-field',
              value: 'form-field',
            },
            {
              displayName: 'Raw Body',
              description: 'entire request body',
              value: 'raw',
            },
            {
              displayName: 'QueryParam',
              description: 'value of request query param',
              value: 'query-param',
            },
          ],
        },
        {
          displayName: 'Request',
          type: 'model',
          model: 'Request',
        },
        {
          type: 'string',
          encoding: 'base64',
          hide: args => !(args[0].value !== 'raw' && args[0].value !== 'url'),
          displayName: args => {
            switch (args[0].value) {
              case 'body':
                return 'Filter (JSONPath or XPath)';
              case 'form-field':
                return 'Field Name';
              case 'query-param':
                return 'Attribute Name';
              default:
                return 'Filter';
            }
          },
        },
      ],
      author: '',

      async run(context, field, id, filter) {
        filter = filter || '';

        if (!['body', 'raw', 'form-field', 'query-param'].includes(field)) {
          throw new Error(`Invalid response field ${field}`);
        }

        if (!id) {
          throw new Error('No request specified');
        }

        const request = await context.util.models.request.getById(id);
        if (!request) {
          throw new Error(`Could not find request ${id}`);
        }

        if (field === 'form-field') {
          if (!request.body.params) {
            throw new Error('No form-fields for request');
          }
          return searchByParams(request.body.params. filter, context);

        } else if (field === 'body') {
          if (!request.body.text) {
            throw new Error('No body for request');
          }
          return searchByMethod(request.body.text, filter, context);

        } else if (field === 'query-param') {
          if (!request.parameters) {
            throw new Error('No query for request');
          }
          return searchByParams(request.parameters, filter, context);

        } else {
          throw new Error(`Unknown field ${field}`);
        }
      },
    },
  },
  {
    templateTag: {
      name: 'otherresponse',
      displayName: 'Response',
      description: 'reference values from other request\'s responses',
      args: [
        {
          displayName: 'Attribute',
          type: 'enum',
          options: [
            {
              displayName: 'Body Attribute',
              description: 'value of response body',
              value: 'body',
            },
            {
              displayName: 'Raw Body',
              description: 'entire response body',
              value: 'raw',
            },
            {
              displayName: 'Header',
              description: 'value of response header',
              value: 'header',
            },
            {
              displayName: 'Request URL',
              description: 'Url of initiating request',
              value: 'url',
            },
          ],
        },
        {
          displayName: 'Request',
          type: 'model',
          model: 'Request',
        },
        {
          type: 'string',
          encoding: 'base64',
          hide: args => !(args[0].value !== 'raw' && args[0].value !== 'url'),
          displayName: args => {
            switch (args[0].value) {
              case 'body':
                return 'Filter (JSONPath or XPath)';
              case 'header':
                return 'Header Name';
              default:
                return 'Filter';
            }
          },
          },
        {
          displayName: 'Trigger Behavior',
          help: 'Configure when to resend the dependent request',
          type: 'enum',
          defaultValue: 'never',
          options: [
            {
              displayName: 'Never',
              description: 'never resend request',
              value: 'never',
            },
            {
              displayName: 'No History',
              description: 'resend when no responses present',
              value: 'no-history',
            },
            {
              displayName: 'When Expired',
              description: 'resend when existing response has expired',
              value: 'when-expired',
            },
            {
              displayName: 'Always',
              description: 'resend request when needed',
              value: 'always',
            },
          ],
        },
        {
          displayName: 'Max age (seconds)',
          help: 'The maximum age of a response to use before it expires',
          type: 'number',
          hide: args => {
            const triggerBehavior = (args[3] && args[3].value) || 'never';
            return triggerBehavior !== 'when-expired';
          },
          defaultValue: 60,
        },
      ],

      async run(context, field, id, filter, resendBehavior, maxAgeSeconds) {
        filter = filter || '';
        resendBehavior = (resendBehavior || 'never').toLowerCase();

        if (!['body', 'header', 'raw', 'url'].includes(field)) {
          throw new Error(`Invalid response field ${field}`);
        }

        if (!id) {
          throw new Error('No request specified');
        }

        const request = await context.util.models.request.getById(id);
        if (!request) {
          throw new Error(`Could not find request ${id}`);
        }

        const environmentId = context.context.getEnvironmentId?.();
        let response: Response = await context.util.models.response.getLatestForRequestId(id, environmentId);

        let shouldResend = false;
        switch (resendBehavior) {
          case 'no-history':
            shouldResend = !response;
            break;

          case 'when-expired':
            if (!response) {
              shouldResend = true;
            } else {
              const ageSeconds = (Date.now() - response.created) / 1000;
              shouldResend = ageSeconds > maxAgeSeconds;
            }
            break;

          case 'always':
            shouldResend = true;
            break;

          case 'never':
          default:
            shouldResend = false;
            break;
        }

        // Make sure we only send the request once per render so we don't have infinite recursion
        const requestChain = context.context.getExtraInfo?.('requestChain') || [];
        if (requestChain.some((id: any) => id === request._id)) {
          console.log('[response tag] Preventing recursive render');
          shouldResend = false;
        }

        if (shouldResend && context.renderPurpose === 'send') {
          console.log('[response tag] Resending dependency');
          requestChain.push(request._id);
          response = await context.network.sendRequest(request, [
            { name: 'requestChain', value: requestChain },
          ]);
        }

        if (!response) {
          console.log('[response tag] No response found');
          throw new Error('No responses for request');
        }

        if (response.error) {
          console.log('[response tag] Response error ' + response.error);
          throw new Error('Failed to send dependent request ' + response.error);
        }

        if (!response.statusCode) {
          console.log('[response tag] Invalid status code ' + response.statusCode);
          throw new Error('No successful responses for request');
        }

        if ((field !== 'raw' && field !== 'url') && !filter) {
          throw new Error(`No ${field} filter specified`);
        }

        const sanitizedFilter = filter.trim();
        const bodyBuffer = context.util.models.response.getBodyBuffer(response, '');
        const match = response.contentType && response.contentType.match(/charset=([\w-]+)/);
        const charset = match && match.length >= 2 ? match[1] : 'utf-8';
        if (field === 'url') {
          return response.url;
        }
        if (field === 'raw') {
          // Sometimes iconv conversion fails so fallback to regular buffer
          try {
            return iconv.decode(bodyBuffer, charset);
          } catch (err) {
            console.warn('[response] Failed to decode body', err);
            return bodyBuffer.toString();
          }
        }
        if (field === 'header') {
          if (!response.headers.length) {
            throw new Error('No headers available');
          }
          const header = response.headers.find((h: { name: string }) => h.name.toLowerCase() === sanitizedFilter.toLowerCase());
          if (!header) {
            const names = response.headers.map((c: { name: any }) => `"${c.name}"`).join(',\n\t');
            throw new Error(`No header with name "${sanitizedFilter}".\nChoices are [\n\t${names}\n]`);
          }
          return header.value;
        }
        if (field === 'body') {
          // Sometimes iconv conversion fails so fallback to regular buffer
          let body;
          try {
            body = iconv.decode(bodyBuffer, charset);
          } catch (err) {
            console.warn('[response] Failed to decode body', err);
            body = bodyBuffer.toString();
          }

          if (sanitizedFilter.indexOf('$') === 0) {
            let bodyJSON;
            let results;

            try {
              bodyJSON = JSON.parse(body);
            } catch (err) {
              throw new Error(`Invalid JSON: ${err.message}`);
            }

            try {
              results = JSONPath({ json: bodyJSON, path: sanitizedFilter });
            } catch (err) {
              throw new Error(`Invalid JSONPath query: ${sanitizedFilter}`);
            }

            if (results.length === 0) {
              throw new Error(`Returned no results: ${sanitizedFilter}`);
            }

            if (results.length > 1) {
              return JSON.stringify(results);
            }

            if (typeof results[0] !== 'string') {
              return JSON.stringify(results[0]);
            } else {
              return results[0];
            }
          } else {
            const DOMParser = (await import('@xmldom/xmldom')).DOMParser;
            const dom = new DOMParser().parseFromString(body);
            let selectedValues: SelectedValue[] = [];
            if (sanitizedFilter === undefined) {
              throw new Error('Must pass an XPath query.');
            }
            try {
              selectedValues = (await import('xpath')).select(sanitizedFilter, dom);
            } catch (err) {
              throw new Error(`Invalid XPath query: ${sanitizedFilter}`);
            }
            let results: { outer: string; inner: string | null }[] = [];

            // Functions return plain strings
            if (typeof selectedValues === 'string') {
              results = [{ outer: selectedValues, inner: selectedValues }];
            }

            results = (selectedValues as Node[])
              .filter(sv => sv.nodeType === Node.ATTRIBUTE_NODE
                || sv.nodeType === Node.ELEMENT_NODE
                || sv.nodeType === Node.TEXT_NODE)
              .map(selectedValue => {
                const outer = selectedValue.toString().trim();
                if (selectedValue.nodeType === Node.ATTRIBUTE_NODE) {
                  return { outer, inner: selectedValue.nodeValue };
                }
                if (selectedValue.nodeType === Node.ELEMENT_NODE) {
                  return { outer, inner: selectedValue.childNodes.toString() };
                }
                if (selectedValue.nodeType === Node.TEXT_NODE) {
                  return { outer, inner: selectedValue.toString().trim() };
                }
                return { outer, inner: null };
              });

            if (results.length === 0) {
              throw new Error(`Returned no results: ${sanitizedFilter}`);
            } else if (results.length > 1) {
              throw new Error(`Returned more than one result: ${sanitizedFilter}`);
            }

            return results[0].inner;
          }
        }
      },
      author: '',
    },
  },
];

/**
 * @param attributes
 * @param filter
 * @param context
 * @returns
 */
function searchByParams(attributes: any[], filter: string | undefined, context: PluginTemplateTagContext) {
    const sanitizedFilter = filter.trim();

    const choices = attributes.filter((attr: { disabled: any }) => !attr.disabled)
      .map((attr: { name: any }) => attr.name)
      .filter((value: any, index: any, self: string | any[]) => self.indexOf(value) === index)
      .join(',\n\t');

    if (!filter) {
      throw new Error('No attribute name given. Choices:\n\t' + choices);
    }

    for (const attr of attributes) {
        if (!attr.disabled && attr.name === sanitizedFilter) {
          return context.util.render(attr.value);
        }
    }

    throw new Error(`Attribute name '${sanitizedFilter}' not found. Choices:\n\t${choices}`);
}

/**
 * @param body
 * @param filter
 * @returns
 */
function searchByMethod(body: any, filter: string) {
    if (!filter) {
      filter = '$';
    }

    const sanitizedFilter = filter.trim();

    if (sanitizedFilter.indexOf('$') === 0) {
      return matchJSONPath(body, sanitizedFilter);
    } else {
      return matchXPath(body, sanitizedFilter);
    }
}

function matchJSONPath(bodyStr: string, query: any) {
  let body;
  let results;

  try {
    body = JSON.parse(bodyStr);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err.message}`);
  }

  try {
    results = JSONPath({ json: body, path: query });
  } catch (err) {
    throw new Error(`Invalid JSONPath query: ${query}`);
  }

  if (results.length === 0) {
    throw new Error(`Returned no results: ${query}`);
  }

  if (results.length > 1) {
    return JSON.stringify(results);
  }

  if (typeof results[0] !== 'string') {
    return JSON.stringify(results[0]);
  } else {
    return results[0];
  }
}

function matchXPath(bodyStr: any, query: any) {
  const results = queryXPath(bodyStr, query);

  if (results.length === 0) {
    throw new Error(`Returned no results: ${query}`);
  } else if (results.length > 1) {
    throw new Error(`Returned more than one result: ${query}`);
  }

  return results[0].inner;
}

/**
 * Query an XML blob with XPath
 */
const queryXPath = (xml: any, query: undefined) => {
  const DOMParser = xmldom.DOMParser;
  const dom = new DOMParser().parseFromString(xml);
  let selectedValues = [];
  if (query === undefined) {
    throw new Error('Must pass an XPath query.');
  }
  try {
    selectedValues = xpath.select(query, dom);
  } catch (err) {
    throw new Error(`Invalid XPath query: ${query}`);
  }
  const output = [];
  // Functions return plain strings
  if (typeof selectedValues === 'string') {
    output.push({
      outer: selectedValues,
      inner: selectedValues,
    });
  } else {
    for (const selectedValue of selectedValues || []) {
      switch (selectedValue.constructor.name) {
        case 'Attr':
          output.push({
            outer: selectedValue.toString().trim(),
            inner: selectedValue.nodeValue,
          });
          break;

        case 'Element':
          output.push({
            outer: selectedValue.toString().trim(),
            inner: selectedValue.childNodes.toString(),
          });
          break;

        case 'Text':
          output.push({
            outer: selectedValue.toString().trim(),
            inner: selectedValue.toString().trim(),
          });
          break;

        default:
          break;
      }
    }
  }
  return output;
};

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
