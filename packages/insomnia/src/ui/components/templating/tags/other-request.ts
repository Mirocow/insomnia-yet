import { DOMParser } from '@xmldom/xmldom';
import { JSONPath } from 'jsonpath-plus';
import xpath from 'xpath';

import type { PluginTemplateTag } from '../../../../templating/extensions';

export const otherRequestTag: { templateTag: PluginTemplateTag } = {
    templateTag: {
        env: 'local',
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
                return searchByParams(request.body.params.filter, context);

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
};

/**
 * @param attributes
 * @param filter
 * @param context
 * @returns
 */
function searchByParams(attributes: any[], filter: string | undefined, context: PluginTemplateTag) {
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
