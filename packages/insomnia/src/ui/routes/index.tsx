import '../rendererListeners';

import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import {
  createMemoryRouter,
  matchPath,
  Outlet,
  RouterProvider,
} from 'react-router-dom';

import {
  ACTIVITY_DEBUG,
  ACTIVITY_SPEC,
  getProductName,
  isDevelopment,
} from '../../common/constants';
import { database } from '../../common/database';
import { initializeLogging } from '../../common/log';
import * as models from '../../models';
import { DEFAULT_ORGANIZATION_ID } from '../../models/organization';
import { DEFAULT_PROJECT_ID } from '../../models/project';
import { initNewOAuthSession } from '../../network/o-auth-2/get-token';
import { init as initPlugins } from '../../plugins';
import { applyColorScheme } from '../../plugins/misc';
import { invariant } from '../../utils/invariant';
import { AppLoadingIndicator } from '../components/app-loading-indicator';
import { ErrorRoute } from './error';
import { Root } from './root';
import { OrganizationShouldRevalidate } from './windows/organization';

const Project = lazy(() => import('./windows/project'));
const Workspace = lazy(() => import('./windows/workspace'));
const UnitTest = lazy(() => import('./windows/unit-test'));
const Debug = lazy(() => import('./windows/debug'));
const Design = lazy(() => import('./windows/design'));

initializeLogging();
// Handy little helper
document.body.setAttribute('data-platform', process.platform);
document.title = getProductName();

let locationHistoryEntry = `/organization/${DEFAULT_ORGANIZATION_ID}/project/${DEFAULT_PROJECT_ID}`;
const prevLocationHistoryEntry = localStorage.getItem('locationHistoryEntry');

if (prevLocationHistoryEntry && matchPath({ path: '/organization/:organizationId', end: false }, prevLocationHistoryEntry)) {
  locationHistoryEntry = prevLocationHistoryEntry;
}

const router = createMemoryRouter(
  // @TODO - Investigate file based routing to generate these routes:
  [
    {
      path: '/',
      id: 'root',
      loader: async (...args) =>
        (await import('./root')).loader(...args),
      element: <Root />,
      errorElement: <ErrorRoute />,
      children: [
        // Import
        {
          path: 'import',
          children: [
            {
              path: 'scan',
              action: async (...args) =>
                (await import('./actions/import')).scanForResourcesAction(
                  ...args,
                ),
            },
            {
              path: 'resources',
              action: async (...args) =>
                (await import('./actions/import')).importResourcesAction(
                  ...args,
                ),
            },
          ],
        },
        // Settings
        {
          path: 'settings/update',
          action: async (...args) =>
            (await import('./actions/actions')).updateSettingsAction(...args),
        },
        // Untracked Projects
        {
          path: 'untracked-projects',
          loader: async (...args) => (await import('./actions/untracked-projects')).loader(...args),
        },
        // Organization (main route)
        {
          path: 'organization',
          id: '/organization',
          shouldRevalidate: OrganizationShouldRevalidate,
          loader: async (...args) => (await import('./windows/organization')).loader(...args),
          children: [
            {
              path: ':organizationId',
              children: [
                {
                  index: true,
                  loader: async (...args) =>
                    (await import('./windows/project')).indexLoader(...args),
                },
                // Project
                {
                  path: 'project',
                  children: [
                    {
                      path: 'new',
                      action: async (...args) =>
                        (
                          await import('./actions/actions')
                        ).createNewProjectAction(...args),
                    },
                    // Remote collection
                    {
                      path: ':projectId/remote-collections',
                      loader: async (...args) =>
                        (
                          await import('./actions/remote-collections')
                        ).remoteCollectionsLoader(...args),
                      children: [
                        {
                          path: 'pull',
                          action: async (...args) =>
                            (
                              await import('./actions/remote-collections')
                            ).pullRemoteCollectionAction(...args),
                        },
                      ],
                    },
                    // Project`s collections, git
                    {
                      path: ':projectId',
                      id: '/project/:projectId',
                      loader: async (...args) =>
                        (await import('./windows/project')).loader(...args),
                      element: (
                        <Suspense fallback={<AppLoadingIndicator />}>
                          <Project />
                        </Suspense>
                      ),
                      children: [
                        {
                          path: 'delete',
                          action: async (...args) =>
                            (
                              await import('./actions/actions')
                            ).deleteProjectAction(...args),
                        },
                        {
                          path: 'rename',
                          action: async (...args) =>
                            (
                              await import('./actions/actions')
                            ).renameProjectAction(...args),
                        },
                        // GIT
                        {
                          path: 'git',
                          children: [
                            {
                              path: 'clone',
                              action: async (...args) =>
                                (
                                  await import('./actions/git-actions')
                                ).cloneGitRepoAction(...args),
                            },
                          ],
                        },
                      ],
                    },
                    // Workspace
                    {
                      path: ':projectId/workspace',
                      children: [
                        {
                          path: ':workspaceId',
                          id: ':workspaceId',
                          loader: async (...args) =>
                            (
                              await import('./windows/workspace')
                            ).workspaceLoader(...args),
                          element: (
                            <Suspense fallback={<AppLoadingIndicator />}>
                              <Workspace />
                            </Suspense>
                          ),
                          children: [
                            {
                              path: `${ACTIVITY_DEBUG}`,
                              loader: async (...args) =>
                                (await import('./windows/debug')).loader(
                                  ...args,
                                ),
                              element: (
                                <Suspense fallback={<AppLoadingIndicator />}>
                                  <Debug />
                                </Suspense>
                              ),
                              children: [
                                {
                                  path: 'reorder',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/actions')
                                    ).reorderCollectionAction(...args),
                                },
                                {
                                  path: 'request/:requestId',
                                  id: 'request/:requestId',
                                  loader: async (...args) =>
                                    (await import('./actions/request')).loader(
                                      ...args,
                                    ),
                                  element: <Outlet />,
                                  children: [
                                    {
                                      path: 'send',
                                      action: async (...args) =>
                                        (
                                          await import('./actions/request')
                                        ).sendAction(...args),
                                    },
                                    {
                                      path: 'connect',
                                      action: async (...args) =>
                                        (
                                          await import('./actions/request')
                                        ).connectAction(...args),
                                    },
                                    {
                                      path: 'duplicate',
                                      action: async (...args) =>
                                        (
                                          await import('./actions/request')
                                        ).duplicateRequestAction(...args),
                                    },
                                    {
                                      path: 'update',
                                      action: async (...args) =>
                                        (
                                          await import('./actions/request')
                                        ).updateRequestAction(...args),
                                    },
                                    {
                                      path: 'update-meta',
                                      action: async (...args) =>
                                        (
                                          await import('./actions/request')
                                        ).updateRequestMetaAction(...args),
                                    },
                                    {
                                      path: 'response/delete-all',
                                      action: async (...args) =>
                                        (
                                          await import('./actions/request')
                                        ).deleteAllResponsesAction(...args),
                                    },
                                    {
                                      path: 'response/delete',
                                      action: async (...args) =>
                                        (
                                          await import('./actions/request')
                                        ).deleteResponseAction(...args),
                                    },
                                  ],
                                },
                                {
                                  path: 'request/new',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/request')
                                    ).createRequestAction(...args),
                                },
                                {
                                  path: 'request/delete',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/request')
                                    ).deleteRequestAction(...args),
                                },
                                {
                                  path: 'request-group/new',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/request-group')
                                    ).createRequestGroupAction(...args),
                                },
                                {
                                  path: 'request-group/delete',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/request-group')
                                    ).deleteRequestGroupAction(...args),
                                },
                                {
                                  path: 'request-group/:requestGroupId/update',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/request-group')
                                    ).updateRequestGroupAction(...args),
                                },
                                {
                                  path: 'request-group/duplicate',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/request-group')
                                    ).duplicateRequestGroupAction(...args),
                                },
                                {
                                  path: 'request-group/:requestGroupId/update-meta',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/request-group')
                                    ).updateRequestGroupMetaAction(...args),
                                },
                              ],
                            },
                            {
                              path: `${ACTIVITY_SPEC}`,
                              loader: async (...args) =>
                                (await import('./windows/design')).loader(
                                  ...args,
                                ),
                              element: (
                                <Suspense fallback={<AppLoadingIndicator />}>
                                  <Design />
                                </Suspense>
                              ),
                              children: [
                                {
                                  path: 'update',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/actions')
                                    ).updateApiSpecAction(...args),
                                },
                                {
                                  path: 'generate-request-collection',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/actions')
                                    ).generateCollectionFromApiSpecAction(
                                      ...args,
                                    ),
                                },
                              ],
                            },
                            {
                              path: 'cacert',
                              children: [
                                {
                                  path: 'new',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/actions')
                                    ).createNewCaCertificateAction(...args),
                                },
                                {
                                  path: 'update',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/actions')
                                    ).updateCaCertificateAction(...args),
                                },
                                {
                                  path: 'delete',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/actions')
                                    ).deleteCaCertificateAction(...args),
                                },
                              ],
                            },
                            {
                              path: 'clientcert',
                              children: [
                                {
                                  path: 'new',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/actions')
                                    ).createNewClientCertificateAction(...args),
                                },
                                {
                                  path: 'update',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/actions')
                                    ).updateClientCertificateAction(...args),
                                },
                                {
                                  path: 'delete',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/actions')
                                    ).deleteClientCertificateAction(...args),
                                },
                              ],
                            },
                            {
                              path: 'environment',
                              children: [
                                {
                                  path: 'update',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/actions')
                                    ).updateEnvironment(...args),
                                },
                                {
                                  path: 'delete',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/actions')
                                    ).deleteEnvironmentAction(...args),
                                },
                                {
                                  path: 'create',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/actions')
                                    ).createEnvironmentAction(...args),
                                },
                                {
                                  path: 'duplicate',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/actions')
                                    ).duplicateEnvironmentAction(...args),
                                },
                                {
                                  path: 'set-active',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/actions')
                                    ).setActiveEnvironmentAction(...args),
                                },
                              ],
                            },
                            {
                              path: 'cookieJar',
                              children: [
                                {
                                  path: 'update',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/actions')
                                    ).updateCookieJarAction(...args),
                                },
                              ],
                            },
                            {
                              path: 'test/*',
                              loader: async (...args) =>
                                (await import('./windows/unit-test')).loader(
                                  ...args,
                                ),
                              element: (
                                <Suspense fallback={<AppLoadingIndicator />}>
                                  <UnitTest />
                                </Suspense>
                              ),
                              children: [
                                {
                                  index: true,
                                  loader: async (...args) =>
                                    (
                                      await import('./windows/test-suite')
                                    ).indexLoader(...args),
                                },
                                {
                                  path: 'test-suite',
                                  children: [
                                    {
                                      index: true,
                                      loader: async (...args) =>
                                        (
                                          await import('./windows/test-suite')
                                        ).indexLoader(...args),
                                    },
                                    {
                                      path: 'new',
                                      action: async (...args) =>
                                        (
                                          await import('./actions/actions')
                                        ).createNewTestSuiteAction(...args),
                                    },
                                    {
                                      path: ':testSuiteId',
                                      id: ':testSuiteId',
                                      loader: async (...args) =>
                                        (
                                          await import('./windows/test-suite')
                                        ).loader(...args),
                                      children: [
                                        {
                                          index: true,
                                          loader: async (...args) =>
                                            (
                                              await import(
                                                './windows/test-results'
                                              )
                                            ).indexLoader(...args),
                                        },
                                        {
                                          path: 'test-result',
                                          children: [
                                            {
                                              path: ':testResultId',
                                              id: ':testResultId',
                                              loader: async (...args) =>
                                                (
                                                  await import(
                                                    './windows/test-results'
                                                  )
                                                ).loader(...args),
                                            },
                                          ],
                                        },
                                        {
                                          path: 'delete',
                                          action: async (...args) =>
                                            (
                                              await import('./actions/actions')
                                            ).deleteTestSuiteAction(...args),
                                        },
                                        {
                                          path: 'rename',
                                          action: async (...args) =>
                                            (
                                              await import('./actions/actions')
                                            ).renameTestSuiteAction(...args),
                                        },
                                        {
                                          path: 'run-all-tests',
                                          action: async (...args) =>
                                            (
                                              await import('./actions/actions')
                                            ).runAllTestsAction(...args),
                                        },
                                        {
                                          path: 'test',
                                          children: [
                                            {
                                              path: 'new',
                                              action: async (...args) =>
                                                (
                                                  await import(
                                                    './actions/actions'
                                                  )
                                                ).createNewTestAction(...args),
                                            },
                                            {
                                              path: ':testId',
                                              children: [
                                                {
                                                  path: 'delete',
                                                  action: async (...args) =>
                                                    (
                                                      await import(
                                                        './actions/actions'
                                                      )
                                                    ).deleteTestAction(...args),
                                                },
                                                {
                                                  path: 'update',
                                                  action: async (...args) =>
                                                    (
                                                      await import(
                                                        './actions/actions'
                                                      )
                                                    ).updateTestAction(...args),
                                                },
                                                {
                                                  path: 'run',
                                                  action: async (...args) =>
                                                    (
                                                      await import(
                                                        './actions/actions'
                                                      )
                                                    ).runTestAction(...args),
                                                },
                                              ],
                                            },
                                          ],
                                        },
                                      ],
                                    },
                                  ],
                                },
                              ],
                            },
                            {
                              path: 'duplicate',
                              action: async (...args) =>
                                (
                                  await import('./actions/actions')
                                ).duplicateWorkspaceAction(...args),
                            },
                            {
                              path: 'git',
                              children: [

                                {
                                  path: 'repo',
                                  loader: async (...args) =>
                                    (
                                      await import('./actions/git-actions')
                                    ).gitRepoLoader(...args),
                                },
                                {
                                  path: 'changes',
                                  loader: async (...args) =>
                                    (
                                      await import('./actions/git-actions')
                                    ).gitChangesLoader(...args),
                                },
                                {
                                  path: 'log',
                                  loader: async (...args) =>
                                    (
                                      await import('./actions/git-actions')
                                    ).gitLogLoader(...args),
                                },
                                {
                                  path: 'branches',
                                  loader: async (...args) =>
                                    (
                                      await import('./actions/git-actions')
                                    ).gitBranchesLoader(...args),
                                },
                                {
                                  path: 'status',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/git-actions')
                                    ).gitStatusAction(...args),
                                },
                                {
                                  path: 'commit',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/git-actions')
                                    ).commitToGitRepoAction(...args),
                                },
                                {
                                  path: 'commit-and-push',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/git-actions')
                                    ).commitAndPushToGitRepoAction(...args),
                                },
                                {
                                  path: 'fetch',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/git-actions')
                                    ).gitFetchAction(...args),
                                },
                                {
                                  path: 'update',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/git-actions')
                                    ).updateGitRepoAction(...args),
                                },
                                {
                                  path: 'reset',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/git-actions')
                                    ).resetGitRepoAction(...args),
                                },
                                {
                                  path: 'push',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/git-actions')
                                    ).pushToGitRemoteAction(...args),
                                },
                                {
                                  path: 'stage',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/git-actions')
                                    ).stageChangesAction(...args),
                                },
                                {
                                  path: 'unstage',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/git-actions')
                                    ).unstageChangesAction(...args),
                                },
                                {
                                  path: 'discard',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/git-actions')
                                    ).discardChangesAction(...args),
                                },
                                {
                                  path: 'diff',
                                  loader: async (...args) =>
                                    (
                                      await import('./actions/git-actions')
                                    ).diffFileLoader(...args),
                                },

                                {
                                  path: 'branch',
                                  children: [
                                    {
                                      path: 'new',
                                      action: async (...args) =>
                                        (
                                          await import('./actions/git-actions')
                                        ).createNewGitBranchAction(...args),
                                    },
                                    {
                                      path: 'delete',
                                      action: async (...args) =>
                                        (
                                          await import('./actions/git-actions')
                                        ).deleteGitBranchAction(...args),
                                    },
                                    {
                                      path: 'checkout',
                                      action: async (...args) =>
                                        (
                                          await import('./actions/git-actions')
                                        ).checkoutGitBranchAction(...args),
                                    },
                                    {
                                      path: 'merge',
                                      action: async (...args) =>
                                        (
                                          await import('./actions/git-actions')
                                        ).mergeGitBranchAction(...args),
                                    },
                                  ],
                                },
                                {
                                  path: 'rollback',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/git-actions')
                                    ).discardChangesAction(...args),
                                },
                                {
                                  path: 'update',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/git-actions')
                                    ).updateGitRepoAction(...args),
                                },
                                {
                                  path: 'reset',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/git-actions')
                                    ).resetGitRepoAction(...args),
                                },
                                {
                                  path: 'pull',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/git-actions')
                                    ).pullFromGitRemoteAction(...args),
                                },
                                {
                                  path: 'push',
                                  action: async (...args) =>
                                    (
                                      await import('./actions/git-actions')
                                    ).pushToGitRemoteAction(...args),
                                },
                              ],
                            },
                          ],
                        },
                        {
                          path: 'new',
                          action: async (...args) =>
                            (
                              await import('./actions/actions')
                            ).createNewWorkspaceAction(...args),
                        },
                        {
                          path: 'delete',
                          action: async (...args) =>
                            (
                              await import('./actions/actions')
                            ).deleteWorkspaceAction(...args),
                        },
                        {
                          path: 'update',
                          action: async (...args) =>
                            (
                              await import('./actions/actions')
                            ).updateWorkspaceAction(...args),
                        },
                        {
                          path: ':workspaceId/update-meta',
                          action: async (...args) =>
                            (
                              await import('./actions/actions')
                            ).updateWorkspaceMetaAction(
                              ...args
                            ),
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  {
    initialEntries: [locationHistoryEntry],
  },
);

// Store the last location in local storage
router.subscribe(({ location }) => {
  const match = matchPath(
    {
      path: '/organization/:organizationId',
      end: false,
    },
    location.pathname
  );

  localStorage.setItem('locationHistoryEntry', location.pathname);
  match?.params.organizationId && localStorage.setItem(`locationHistoryEntry:${match?.params.organizationId}`, location.pathname);
});

async function renderApp() {
  await database.initClient();

  const settings = await models.settings.getOrCreate();

  if (settings.clearOAuth2SessionOnRestart) {
    initNewOAuthSession();
  }

  await initPlugins();

  await applyColorScheme(settings);

  const root = document.getElementById('root');

  invariant(root, 'Could not find root element');

  ReactDOM.createRoot(root).render(
    <RouterProvider router={router} />
  );
}

renderApp();

// Export some useful things for dev
if (isDevelopment()) {
  // @ts-expect-error -- TSCONVERSION needs window augmentation
  window.models = models;
  // @ts-expect-error -- TSCONVERSION needs window augmentation
  window.db = database;
}
