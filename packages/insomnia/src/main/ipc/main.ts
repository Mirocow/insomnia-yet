import { type RulesetDefinition, Spectral } from '@stoplight/spectral-core';
// @ts-expect-error - This is a bundled file not sure why it's not found
import { bundleAndLoadRuleset } from '@stoplight/spectral-ruleset-bundler/with-loader';
import { oas } from '@stoplight/spectral-rulesets';
import { app, ipcMain, shell } from 'electron';
import fs from 'fs';

import { SegmentEvent, trackPageView, trackSegmentEvent } from '../analytics';
import installPlugin from '../install-plugin';
import { axiosRequest } from '../network/axios-request';
import { cancelCurlRequest, curlRequest } from '../network/libcurl-promise';

export function registerMainHandlers() {

  ipcMain.handle('axiosRequest', async (_, options: Parameters<typeof axiosRequest>[0]) => {
    return axiosRequest(options);
  });

  ipcMain.handle('writeFile', async (_, options: { path: string; content: string }) => {
    try {
      await fs.promises.writeFile(options.path, options.content);
      return options.path;
    } catch (err) {
      throw new Error(err);
    }
  });

  ipcMain.handle('curlRequest', (_, options: Parameters<typeof curlRequest>[0]) => {
    return curlRequest(options);
  });

  ipcMain.on('cancelCurlRequest', (_, requestId: string): void => {
    cancelCurlRequest(requestId);
  });

  ipcMain.on('trackSegmentEvent', (_, options: { event: SegmentEvent; properties?: Record<string, unknown> }): void => {
    trackSegmentEvent(options.event, options.properties);
  });
  ipcMain.on('trackPageView', (_, options: { name: string }): void => {
    trackPageView(options.name);
  });

  ipcMain.handle('installPlugin', (_, lookupName: string) => {
    return installPlugin(lookupName);
  });

  ipcMain.on('restart', () => {
    app.relaunch();
    app.exit();
  });

  ipcMain.on('openInBrowser', (_, href: string) => {
    const { protocol } = new URL(href);
    if (protocol === 'http:' || protocol === 'https:') {
      // eslint-disable-next-line no-restricted-properties
      shell.openExternal(href);
    }
  });

  ipcMain.handle('spectralRun', async (_, { contents, rulesetPath }: {
    contents: string;
    rulesetPath?: string;
  }) => {
    const spectral = new Spectral();

    if (rulesetPath) {
      try {
        const ruleset = await bundleAndLoadRuleset(rulesetPath, {
          fs,
          fetch: (url: string) => {
            return axiosRequest({ url, method: 'GET' });
          },
        });

        spectral.setRuleset(ruleset);
      } catch (err) {
        console.log('Error while parsing ruleset:', err);
        spectral.setRuleset(oas as RulesetDefinition);
      }
    } else {
      spectral.setRuleset(oas as RulesetDefinition);
    }

    const diagnostics = await spectral.run(contents);

    return diagnostics;
  });

}
