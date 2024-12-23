import classnames from 'classnames';
import React, { FC, Suspense } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
  LoaderFunction,
  Route,
  Routes,
  useFetcher,
  useFetchers,
  useLoaderData,
  useNavigate,
  useParams,
} from 'react-router-dom';

import {
  DEFAULT_SIDEBAR_SIZE,
} from '../../common/constants';
import * as models from '../../models';
import type { UnitTestSuite } from '../../models/unit-test-suite';
import { invariant } from '../../utils/invariant';
import { Button } from '../components/base/button';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../components/base/dropdown';
import { WorkspaceSyncDropdown } from '../components/dropdowns/workspace-sync-dropdown';
import { ErrorBoundary } from '../components/error-boundary';
import { showPrompt } from '../components/modals';
import { TestRunStatus } from './test-results';
import TestSuiteRoute from './test-suite';

interface TestLoaderData {
  unitTestSuites: UnitTestSuite[];
}

export const loader: LoaderFunction = async ({
  params,
}): Promise<TestLoaderData> => {
  const { workspaceId } = params;

  invariant(workspaceId, 'Workspace ID is required');

  const unitTestSuites = await models.unitTestSuite.findByParentId(workspaceId);
  invariant(unitTestSuites, 'Unit test suites not found');

  return {
    unitTestSuites,
  };
};

const TestRoute: FC = () => {
  const { unitTestSuites } = useLoaderData() as TestLoaderData;

  const { organizationId, projectId, workspaceId, testSuiteId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    testSuiteId: string;
  };

  const createUnitTestSuiteFetcher = useFetcher();
  const deleteUnitTestSuiteFetcher = useFetcher();
  const runAllTestsFetcher = useFetcher();
  const runningTests = useFetchers()
    .filter(
      fetcher =>
        fetcher.formAction?.includes('run-all-tests') ||
        fetcher.formAction?.includes('run')
    )
    .some(({ state }) => state !== 'idle');

  const navigate = useNavigate();

  return (
    <PanelGroup autoSaveId="insomnia-sidebar" id="wrapper" className='new-sidebar w-full h-full text-[--color-font]' direction='horizontal'>
      <Panel id="sidebar" className='sidebar theme--sidebar' defaultSize={DEFAULT_SIDEBAR_SIZE} maxSize={40} minSize={10} collapsible>

        <ErrorBoundary showAlert>
          <div className="unit-tests__sidebar">
            <div className="pad-sm">
              <Button
                variant="outlined"
                onClick={() => {
                  showPrompt({
                    title: 'New Test Suite',
                    defaultValue: 'New Suite',
                    submitName: 'Create Suite',
                    label: 'Test Suite Name',
                    selectText: true,
                    onComplete: async name => {
                      createUnitTestSuiteFetcher.submit(
                        {
                          name,
                        },
                        {
                          method: 'post',
                          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/new`,
                        }
                      );
                    },
                  });
                }}
              >
                New Test Suite
              </Button>
            </div>
            <ul>
              {unitTestSuites.map(suite => (
                <li
                  key={suite._id}
                  className={classnames({
                    active: suite._id === testSuiteId,
                  })}
                >
                  <Button
                    onClick={e => {
                      e.preventDefault();
                      navigate(
                        `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${suite._id}`
                      );
                    }}
                  >
                    {suite.name}
                  </Button>

                  <Dropdown
                    aria-label='Test Suite Actions'
                    triggerButton={
                      <DropdownButton className="unit-tests__sidebar__action">
                        <i className="fa fa-caret-down" />
                      </DropdownButton>
                    }
                  >
                    <DropdownItem aria-label='Run Tests'>
                      <ItemContent
                        stayOpenAfterClick
                        isDisabled={runAllTestsFetcher.state === 'submitting'}
                        label={runAllTestsFetcher.state === 'submitting'
                          ? 'Running... '
                          : 'Run Tests'}
                        onClick={() => {
                          runAllTestsFetcher.submit(
                            {},
                            {
                              method: 'post',
                              action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${suite._id}/run-all-tests`,
                            }
                          );
                        }}
                      />
                    </DropdownItem>
                    <DropdownItem aria-label='Delete Suite'>
                      <ItemContent
                        label="Delete Suite"
                        withPrompt
                        onClick={() =>
                          deleteUnitTestSuiteFetcher.submit(
                            {},
                            {
                              action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${suite._id}/delete`,
                              method: 'post',
                            }
                          )
                        }
                      />
                    </DropdownItem>
                  </Dropdown>
                </li>
              ))}
            </ul>
          </div>
            <WorkspaceSyncDropdown />
        </ErrorBoundary>

      </Panel>
      <PanelResizeHandle className='h-full w-[1px] bg-[--hl-md]' />
      <Panel id="pane-one" className='pane-one theme--pane'>

        <Routes>
          <Route
            path={'test-suite/:testSuiteId/*'}
            element={
              <Suspense>
                <TestSuiteRoute />
              </Suspense>
            }
          />
          <Route
            path="*"
            element={
              <div className="unit-tests pad theme--pane__body">
                No test suite selected
              </div>
            }
          />
        </Routes>

      </Panel>
      <PanelResizeHandle className='h-full w-[1px] bg-[--hl-md]' />
      <Panel id="pane-two" className='pane-two theme--pane'>

        <Routes>
          <Route
            path="test-suite/:testSuiteId/test-result/:testResultId"
            element={
              runningTests ? (
                <div className="unit-tests__results">
                  <div className="unit-tests__top-header">
                    <h2>Running Tests...</h2>
                  </div>
                </div>
              ) : (
                <TestRunStatus />
              )
            }
          />
          <Route
            path="*"
            element={
              runningTests ? (
                <div className="unit-tests__results">
                  <div className="unit-tests__top-header">
                    <h2>Running Tests...</h2>
                  </div>
                </div>
              ) : (
                <div className="unit-tests__results">
                  <div className="unit-tests__top-header">
                    <h2>No Results</h2>
                  </div>
                </div>
              )
            }
          />
        </Routes>

      </Panel>
    </PanelGroup>
  );
};

export default TestRoute;
