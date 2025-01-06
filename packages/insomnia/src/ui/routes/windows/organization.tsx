import { type LoaderFunction, type ShouldRevalidateFunction, useRouteLoaderData } from 'react-router-dom';

import { project } from '../../../models';
import { defaultOrganization, type Organization } from '../../../models/organization';
import { isRemoteProject } from '../../../models/project';

export interface LoaderData {
  organizations: Organization[];
}

export const loader: LoaderFunction = async () => {
  const allProjects = await project.all();

  const remoteOrgs = allProjects
    .filter(isRemoteProject)
    .map(({ _id, name }) => ({
      _id,
      name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    organizations: [defaultOrganization, ...remoteOrgs],
  };
};

export const useOrganizationLoaderData = () => {
  return useRouteLoaderData('/organization') as LoaderData;
};

export const OrganizationShouldRevalidate: ShouldRevalidateFunction = ({
  currentParams,
  nextParams,
  nextUrl,
}) => {
  const isSwitchingBetweenOrganizations = currentParams.organizationId !== nextParams.organizationId;
  // We need this for isLoggedIn to update the organization list
  // The hash gets removed from the URL after the first time it's used so it doesn't revalidate on every navigation
  const shouldForceRevalidate = nextUrl.hash === '#revalidate=true';

  return isSwitchingBetweenOrganizations || shouldForceRevalidate;
};
