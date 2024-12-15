import { Analytics } from '@segment/analytics-node';
import crypto from 'crypto';
import { net } from 'electron';
import { v4 as uuidv4 } from 'uuid';

import {
  getAppPlatform,
  getAppVersion,
  getProductName,
  getSegmentWriteKey,
} from '../common/constants';
import * as models from '../models/index';

const getDeviceId = async () => {
  const settings = await models.settings.getOrCreate();
  return settings.deviceId || (await models.settings.update(settings, { deviceId: uuidv4() })).deviceId;
};

export enum SegmentEvent {
  appStarted = 'App Started',
  collectionCreate = 'Collection Created',
  dataExport = 'Data Exported',
  dataImport = 'Data Imported',
  documentCreate = 'Document Created',
  kongConnected = 'Kong Connected',
  kongSync = 'Kong Synced',
  requestBodyTypeSelect = 'Request Body Type Selected',
  requestCreate = 'Request Created',
  requestExecute = 'Request Executed',
  collectionRunExecute = 'Collection Run Executed',
  projectLocalCreate = 'Local Project Created',
  projectLocalDelete = 'Local Project Deleted',
  testSuiteCreate = 'Test Suite Created',
  testSuiteDelete = 'Test Suite Deleted',
  unitTestCreate = 'Unit Test Created',
  unitTestDelete = 'Unit Test Deleted',
  unitTestRun = 'Ran Individual Unit Test',
  unitTestRunAll = 'Ran All Unit Tests',
  vcsSyncStart = 'VCS Sync Started',
  vcsSyncComplete = 'VCS Sync Completed',
  vcsAction = 'VCS Action Executed',
  buttonClick = 'Button Clicked',
}

function hashString(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function trackSegmentEvent(
  event: SegmentEvent,
  properties?: Record<string, any>,
) {
  console.log(event, properties);
}

export async function trackPageView(name: string) {
  console.log(name);
}
