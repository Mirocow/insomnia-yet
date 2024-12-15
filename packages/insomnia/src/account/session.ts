import * as srp from 'srp-js';

import { userSession } from '../models';
import * as crypt from './crypt';

type LoginCallback = (isLoggedIn: boolean) => void;

export interface WhoamiResponse {
  sessionAge: number;
  sessionExpiry: number;
  accountId: string;
  email: string;
  firstName: string;
  lastName: string;
  created: number;
  publicKey: string;
  encSymmetricKey: string;
  encPrivateKey: string;
  saltEnc: string;
  isPaymentRequired: boolean;
  isTrialing: boolean;
  isVerified: boolean;
  isAdmin: boolean;
  trialEnd: string;
  planName: string;
  planId: string;
  canManageTeams: boolean;
  maxTeamMembers: number;
}

export interface SessionData {
  accountId: string;
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  symmetricKey: JsonWebKey;
  publicKey: JsonWebKey;
  encPrivateKey: crypt.AESMessage;
}
export function onLoginLogout(loginCallback: LoginCallback) {
  window.main.on('loggedIn', async () => {
    loginCallback(await isLoggedIn());
  });
}

/** Creates a session from a sessionId and derived symmetric key. */
export async function absorbKey(sessionId: string, key: string) {
  // Get and store some extra info (salts and keys)
  const {
    publicKey,
    encPrivateKey,
    encSymmetricKey,
    email,
    accountId,
    firstName,
    lastName,
  } = await _whoami(sessionId);
  const symmetricKeyStr = crypt.decryptAES(key, JSON.parse(encSymmetricKey));

  // Store the information for later
  await setSessionData(
    sessionId,
    accountId,
    firstName,
    lastName,
    email,
    JSON.parse(symmetricKeyStr),
    JSON.parse(publicKey),
    JSON.parse(encPrivateKey),
  );

  window.main.loginStateChange();
}

export async function getPublicKey() {
  return (await getUserSession())?.publicKey;
}

export async function getPrivateKey() {
  const sessionData = await getUserSession();

  if (!sessionData) {
    throw new Error("Can't get private key: session is blank.");
  }

  const { symmetricKey, encPrivateKey } = sessionData;

  if (!symmetricKey || !encPrivateKey) {
    throw new Error("Can't get private key: session is missing keys.");
  }

  const privateKeyStr = crypt.decryptAES(symmetricKey, encPrivateKey);
  return JSON.parse(privateKeyStr) as JsonWebKey;
}

export async function getCurrentSessionId() {
  const { id } = await userSession.getOrCreate();
  return id;
}

export async function getAccountId() {
  return (await getUserSession())?.accountId;
}

export function getEmail() {
  return _getSessionData()?.email;
}

export function getFirstName() {
  return _getSessionData()?.firstName;
}

export function getLastName() {
  return _getSessionData()?.lastName;
}

export function getFullName() {
  return `${getFirstName()} ${getLastName()}`.trim();
}

/** Check if we (think) we have a session */
export async function isLoggedIn() {
  return Boolean(await getCurrentSessionId());
}

/** Set data for the new session and store it encrypted with the sessionId */
export async function setSessionData(
  id: string,
  accountId: string,
  firstName: string,
  lastName: string,
  email: string,
  symmetricKey: JsonWebKey,
  publicKey: JsonWebKey,
  encPrivateKey: crypt.AESMessage,
) {
  const sessionData: SessionData = {
    id,
    accountId,
    symmetricKey,
    publicKey,
    encPrivateKey,
    email,
    firstName,
    lastName,
  };
  const dataStr = JSON.stringify(sessionData);
  window.localStorage.setItem(_getSessionKey(id), dataStr);
  // NOTE: We're setting this last because the stuff above might fail
  window.localStorage.setItem('currentSessionId', id);
  return sessionData;
}

// ~~~~~~~~~~~~~~~~ //
// Helper Functions //
// ~~~~~~~~~~~~~~~~ //
function _getSymmetricKey() {
  return _getSessionData()?.symmetricKey;
}

const _getSessionData = (): Partial<SessionData> | null => {
  const sessionId = getCurrentSessionId();

  if (!sessionId || !window) {
    return {};
  }

  const dataStr = window.localStorage.getItem(_getSessionKey(sessionId));
  if (dataStr === null) {
    return null;
  }
  return JSON.parse(dataStr) as SessionData;
};

function _unsetSessionData() {
  const sessionId = getCurrentSessionId();
  window.localStorage.removeItem(_getSessionKey(sessionId));
  window.localStorage.removeItem('currentSessionId');
}

function _getSessionKey(sessionId: string | null) {
  return `session__${(sessionId || '').slice(0, 10)}`;
}

function _getSrpParams() {
  return srp.params[2048];
}

function _sanitizePassphrase(passphrase: string) {
  return passphrase.trim().normalize('NFKD');
}
