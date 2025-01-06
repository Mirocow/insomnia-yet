import '../css/styles.css';

import type { IpcRendererEvent } from 'electron';
import React, { Fragment, useEffect, useState } from 'react';
import {
  Breadcrumb,
  Breadcrumbs,
  Button,
  Link,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components';
import {
  type LoaderFunction,
  NavLink,
  Outlet,
  useLoaderData,
  useParams,
  useRouteLoaderData,
} from 'react-router-dom';

import { ACTIVITY_COLLECTION, ACTIVITY_SPEC, ACTIVITY_TEST, isDevelopment } from '../../common/constants';
import * as models from '../../models';
import type { Settings } from '../../models/settings';
import { isCollection, isDesign } from '../../models/workspace';
import { reloadPlugins } from '../../plugins';
import { createPlugin } from '../../plugins/create';
import { setTheme } from '../../plugins/misc';
import { exchangeCodeForToken } from '../../sync/git/github-oauth-provider';
import { exchangeCodeForGitLabToken } from '../../sync/git/gitlab-oauth-provider';
import { WorkspaceDropdown } from '../components/dropdowns/workspace-dropdown';
import { Hotkey } from '../components/hotkey';
import { Icon } from '../components/icon';
import { showError, showModal } from '../components/modals';
import { AlertModal } from '../components/modals/alert-modal';
import { AskModal } from '../components/modals/ask-modal';
import { ImportModal } from '../components/modals/import-modal';
import {
  SettingsModal,
  showSettingsModal,
  TAB_INDEX_PLUGINS,
  TAB_INDEX_THEMES } from '../components/modals/settings-modal';
import { AppHooks } from '../containers/app-hooks';
import { NunjucksEnabledProvider } from '../context/nunjucks/nunjucks-enabled-context';
import { useSettingsPatcher } from '../hooks/use-request';
import Modals from './windows/modals';
import type { WorkspaceLoaderData } from './windows/workspace';

export interface RootLoaderData {
  settings: Settings;
}

export const useRootLoaderData = () => {
  return useRouteLoaderData('root') as RootLoaderData;
};

export const loader: LoaderFunction = async (): Promise<RootLoaderData> => {
  return {
    settings: await models.settings.getOrCreate(),
  };
};

export const Root = () => {
  const { settings } = useLoaderData() as RootLoaderData;
  const workspaceData = useRouteLoaderData(
    ':workspaceId'
  ) as WorkspaceLoaderData | null;
  const [importUri, setImportUri] = useState('');
  const patchSettings = useSettingsPatcher();

  useEffect(() => {
    return window.main.on(
      'shell:open',
      async (_: IpcRendererEvent, url: string) => {
        // Get the url without params
        let parsedUrl;
        try {
          parsedUrl = new URL(url);
        } catch (err) {
          console.log('[deep-link] Invalid args, expected insomnia://x/y/z', url);
          return;
        }
        let urlWithoutParams = url.substring(0, url.indexOf('?')) || url;
        const params = Object.fromEntries(parsedUrl.searchParams);
        // Change protocol for dev redirects to match switch case
        if (isDevelopment()) {
          urlWithoutParams = urlWithoutParams.replace(
            'insomniadev://',
            'insomnia://',
          );
        }
        switch (urlWithoutParams) {
          case 'insomnia://app/alert':
            showModal(AlertModal, {
              title: params.title,
              message: params.message,
            });
            break;

          case 'insomnia://app/import':
            setImportUri(params.uri);
            break;

          case 'insomnia://plugins/install':
            showModal(AskModal, {
              title: 'Plugin Install',
              message: (
                <>
                  Do you want to install <code>{params.name}</code>?
                </>
              ),
              yesText: 'Install',
              noText: 'Cancel',
              onDone: async (isYes: boolean) => {
                if (isYes) {
                  try {
                    await window.main.installPlugin(params.name);
                    showModal(SettingsModal, { tab: TAB_INDEX_PLUGINS });
                  } catch (err) {
                    showError({
                      title: 'Plugin Install',
                      message: 'Failed to install plugin',
                      error: err.message,
                    });
                  }
                }
              },
            });
            break;

          case 'insomnia://plugins/theme':
            const parsedTheme = JSON.parse(decodeURIComponent(params.theme));
            showModal(AskModal, {
              title: 'Install Theme',
              message: (
                <>
                  Do you want to install <code>{parsedTheme.displayName}</code>?
                </>
              ),
              yesText: 'Install',
              noText: 'Cancel',
              onDone: async (isYes: boolean) => {
                if (isYes) {
                  const mainJsContent = `module.exports.themes = [${JSON.stringify(
                    parsedTheme,
                    null,
                    2,
                  )}];`;
                  await createPlugin(
                    `theme-${parsedTheme.name}`,
                    '0.0.1',
                    mainJsContent,
                  );
                  patchSettings({ theme: parsedTheme.name });
                  await reloadPlugins();
                  await setTheme(parsedTheme.name);
                  showModal(SettingsModal, { tab: TAB_INDEX_THEMES });
                }
              },
            });
            break;

          case 'insomnia://oauth/github/authenticate': {
            const { code, state } = params;
            await exchangeCodeForToken({ code, state }).catch(
              (error: Error) => {
                showError({
                  error,
                  title: 'Error authorizing GitHub',
                  message: error.message,
                });
              },
            );
            break;
          }

          case 'insomnia://oauth/gitlab/authenticate': {
            const { code, state } = params;
            await exchangeCodeForGitLabToken({ code, state }).catch(
              (error: Error) => {
                showError({
                  error,
                  title: 'Error authorizing GitLab',
                  message: error.message,
                });
              },
            );
            break;
          }

          default: {
            console.log(`Unknown deep link: ${url}`);
          }
        }
      }
    );
  }, [patchSettings]);

  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId?: string;
    workspaceId?: string;
  };

  const crumbs = workspaceData
    ? [
        {
          id: workspaceData.activeProject._id,
          label: workspaceData.activeProject.name,
          node: (
            <Link>
              <NavLink
                to={`/organization/${organizationId}/project/${workspaceData.activeProject._id}`}
              >
                {isCollection(workspaceData.activeWorkspace) ? (
                  <div className="px-1 h-full rounded-s-sm bg-[--color-surprise] text-[--color-font-surprise] w-[15px]">
                    <Icon icon="bars" />
                  </div>
                ) : (
                  <div className="px-1 h-full rounded-s-sm bg-[--color-info] text-[--color-font-info] w-[15px]">
                    <Icon icon="file" className='svg-inline--fa fa-file'/>
                  </div>
                )}
                {/* <div className="px-1 h-full w-full">
                {workspaceData.activeProject.name}
                </div> */}
              </NavLink>
            </Link>
          ),
        },
        {
          id: workspaceData.activeWorkspace._id,
          label: workspaceData.activeWorkspace.name,
          node: <WorkspaceDropdown />,
        },
      ]
    : [];

    if (workspaceData && isDesign(workspaceData?.activeWorkspace)) {
      crumbs.push({
        id: '',
        label: '',
        node: (
          [{ 'id':ACTIVITY_SPEC, 'name':'spec' }, { 'id':'debug', 'name':ACTIVITY_COLLECTION }, { 'id':ACTIVITY_TEST, 'name':'test' }].map(item => (
            <NavLink
              key={item.id}
              to={`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/${item.id}`}
              className={({ isActive }) => `uppercase ${isActive ? 'underline px-2 hover:bg-[--hl-xs] ' : 'px-2 hover:bg-[--hl-xs] '}`}
            >
              {item.name}
            </NavLink>)
          )
        ),
      });
    }

  return (
      <NunjucksEnabledProvider>
        <AppHooks />
        <div className="app">
          <div className="w-full h-full">
          <Modals />
            {/* triggered by insomnia://app/import */}
            {importUri && (
              <ImportModal
                onHide={() => setImportUri('')}
                projectName="Insomnia"
                defaultProjectId={projectId}
                organizationId={organizationId}
                from={{ type: 'uri', defaultValue: importUri }}
              />
            )}
            {/* Main window */}
            <div className="w-full h-full divide-x divide-solid divide-[--hl-md] grid-template-app-layout grid relative bg-[--color-bg]">
              {/* Header */}
              <header className="[grid-area:Header] grid grid-cols-3 items-center border-b border-solid border-[--hl-md]">
                <div className="flex items-center gap-2" />
              </header>
              {/* Content */}
              <div className="[grid-area:Content] overflow-hidden border-b border-[--hl-md]">
                <Outlet />
              </div>
              {/* Footer */}
              <div className="relative [grid-area:Statusbar] flex items-center overflow-hidden">
                <div className="flex w-full h-full items-center justify-between">
                  <div className="flex h-full">
                    {workspaceData && (
                      <Fragment>
                        { /* Menu in footer */ }
                        <Breadcrumbs items={crumbs} className="px-4 py-1 h-full flex items-center justify-center gap-1 aria-pressed:bg-[--hl-sm] text-[--color-font] text-xs focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all">
                          {item => (
                            <Breadcrumb key={item.id} id={item.id} className="px-1">
                              {item.node}
                            </Breadcrumb>
                          )}
                        </Breadcrumbs>
                      </Fragment>
                    )}
                  </div>
                  <div className="flex h-full">
                    <TooltipTrigger>
                    <Button
                      data-testid="settings-button"
                      className="px-4 py-1 h-full flex items-center justify-center gap-1 aria-pressed:bg-[--hl-sm] text-[--color-font] text-xs hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all"
                      onPress={showSettingsModal}
                    >
                      <Icon icon="gear" /> Preferences
                    </Button>
                    <Tooltip
                      placement="top"
                      offset={8}
                      className=""
                    >
                      Preferences
                      <Hotkey
                        keyBindings={
                          settings.hotKeyRegistry.preferences_showGeneral
                        }
                      />
                    </Tooltip>
                  </TooltipTrigger>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </NunjucksEnabledProvider>
  );
};
