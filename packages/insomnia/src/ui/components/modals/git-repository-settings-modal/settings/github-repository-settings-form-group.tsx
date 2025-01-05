import React, { type MouseEvent, useEffect, useState } from 'react';
import { useInterval, useLocalStorage } from 'react-use';

import type { GitRepository } from '../../../../../models/git-repository';
import {
  exchangeCodeForToken,
  generateAppAuthorizationUrl,
  signOut,
} from '../../../../../sync/git/github-oauth-provider';
import { Button } from '../../../base/button';
import { showAlert, showError } from '../..';
import { GitHubRepositorySelect } from './github-repository-select';

interface Props {
  uri?: string;
  onSubmit: (args: Partial<GitRepository>) => void;
  hasGitRepository: boolean;
}

export const GitHubRepositorySetupFormGroup = (props: Props) => {
  const { onSubmit, uri, hasGitRepository } = props;

  const [githubToken, setGitHubToken] = useState(
    localStorage.getItem('github-oauth-token') || ''
  );

  useInterval(
    () => {
      const token = localStorage.getItem('github-oauth-token');

      if (token) {
        setGitHubToken(token);
      }
    },
    githubToken ? null : 500
  );

  if (!githubToken) {
    return <GitHubSignInForm hasGitRepository={hasGitRepository} />;
  }

  return (
    <GitHubRepositoryForm
      uri={uri}
      onSubmit={onSubmit}
      token={githubToken}
      onSignOut={() => {
        setGitHubToken('');
        signOut();
      }}
    />
  );
};

// this interface is backward-compatible with
// existing GitHub user info stored in localStorage
interface GitHubUser {
  name?: string;
  login: string;
  email: string | null;
  avatarUrl: string;
  url: string;
}

const Avatar = ({ src }: { src: string }) => {
  const [imageSrc, setImageSrc] = useState('');

  useEffect(() => {
    const img = new Image();

    img.src = src;

    function onLoad() {
      setImageSrc(src);
    }

    function onError() {
      setImageSrc('');
    }

    img.addEventListener('load', onLoad);
    img.addEventListener('error', onError);

    return () => {
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
    };
  }, [src]);

  return imageSrc ? (
    <img src={imageSrc} className="rounded-md w-8 h-8" />
  ) : (
    <i className="fas fa-user-circle" />
  );
};

interface GitHubRepositoryFormProps {
  uri?: string;
  hasGitRepository?: boolean;
  onSubmit: (args: Partial<GitRepository>) => void;
  onSignOut: () => void;
  token?: string;
}

const GitHubRepositoryForm = ({
  uri,
  token,
  onSubmit,
  onSignOut,
}: GitHubRepositoryFormProps) => {
  const [error, setError] = useState('');

  const [user, setUser, removeUser] = useLocalStorage<GitHubUser>(
    'github-user-info',
    undefined
  );

  const handleSignOut = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    showAlert({
      title: 'Sign out of GitHub',
      message:
        'Are you sure you want to sign out? You will need to re-authenticate with GitHub to use this feature.',
      okLabel: 'Sign out',
      onConfirm: () => {
        removeUser();
        onSignOut();
      },
    });
  };

  return (
    <form
      id="github"
      className="form-group"
      onSubmit={event => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const uri = formData.get('uri') as string;
        if (!uri) {
          setError('Please select a repository');
          return;
        }
        onSubmit({
          uri,
          author: {
            // try to use the name from the user info, but fall back to the login (username)
            name: user?.name ? user?.name : user?.login ?? '',
            // rfc: fall back to the email from the Insomnia session?
            email: user?.email ?? '',
          },
          credentials: {
            username: token ?? '',
            token: token ?? '',
            oauth2format: 'github',
          },
        });
      }}
    >
      {user && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              border: '1px solid var(--hl-sm)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--padding-sm)',
              boxSizing: 'border-box',
              marginBottom: 'var(--padding-sm)',
              alignItems: 'center',
            }}
          >
            <div className="flex gap-2 items-center">
              <Avatar src={user?.avatarUrl ?? ''} />
              <div className="flex flex-col">
                <span
                  style={{
                    fontSize: 'var(--font-size-lg)',
                  }}
                >
                  {user?.login}
                </span>
                <span
                  style={{
                    fontSize: 'var(--font-size-md)',
                  }}
                >
                  {user?.email || 'Signed in'}
                </span>
              </div>
            </div>
            <Button type="button" onClick={handleSignOut}>
              Sign out
            </Button>
        </div>
      )}
      {token && <GitHubRepositorySelect uri={uri} token={token} />}
      {error && (
        <p className="notice error margin-bottom-sm">
          <button className="pull-right icon" onClick={() => setError('')}>
            <i className="fa fa-times" />
          </button>
          {error}
        </p>
      )}
    </form>
  );
};

interface GitHubSignInFormProps {
  token?: string;
  hasGitRepository?: boolean;
}

const GitHubSignInForm = ({
  token,
  hasGitRepository,
}: GitHubSignInFormProps) => {
  const [error, setError] = useState('');
  const [authUrl, setAuthUrl] = useState(() => generateAppAuthorizationUrl());
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // When we get a new token we reset the authenticating flag and auth url. This happens because we can use the generated url for only one authorization flow.
  useEffect(() => {
    if (token) {
      setIsAuthenticating(false);
      setAuthUrl(generateAppAuthorizationUrl());
    }
  }, [token]);

  return (
    <div
      style={{
        display: 'flex',
        placeContent: 'center',
        placeItems: 'center',
        flexDirection: 'column',
        border: '1px solid var(--hl-sm)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--padding-sm)',
        boxSizing: 'border-box',
      }}
    >
      {!hasGitRepository ? (
          <a
            href={authUrl}
            onClick={() => {
              setIsAuthenticating(true);
            }}
          >
            <i className="fa fa-github" />
            {isAuthenticating ? 'Authenticating with GitHub App' : 'Authenticate with GitHub App'}
          </a>
      ) : (
        <span>You have already been authenticating</span>
      )}

      {isAuthenticating && (
        <form
          onSubmit={event => {
            event.preventDefault();
            event.stopPropagation();
            const formData = new FormData(event.currentTarget);
            const link = formData.get('link');
            if (typeof link === 'string') {
              let parsedURL: URL;
              try {
                parsedURL = new URL(link);
              } catch (error) {
                setError('Invalid URL');
                return;
              }

              const code = parsedURL.searchParams.get('code');
              const state = parsedURL.searchParams.get('state');

              if (!(typeof code === 'string') || !(typeof state === 'string')) {
                setError('Incomplete URL');
                return;
              }

              exchangeCodeForToken({
                code,
                state,
                path: '/v1/oauth/github-app',
              }).catch((error: Error) => {
                showError({
                  error,
                  title: 'Error authorizing GitHub',
                  message: error.message,
                });
              });
            }
          }}
        >
          <label className="form-control form-control--outlined">
            <div>
              If you aren't redirected to the app you can manually paste the authentication url here:
            </div>
            <div className="form-row">
              <input name="link" />
              <Button bg="surprise" name="add-token">Authenticate</Button>
            </div>
          </label>
          {error && (
            <p className="notice error margin-bottom-sm">
              <button className="pull-right icon" onClick={() => setError('')}>
                <i className="fa fa-times" />
              </button>
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
};
