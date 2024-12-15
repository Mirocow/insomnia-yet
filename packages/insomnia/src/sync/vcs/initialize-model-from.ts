import * as models from '../../models';
import type { RemoteProject } from '../../models/project';
import type { Project } from '../../models/project';
import { type Workspace, WorkspaceScopeKeys } from '../../models/workspace';
import type { Team } from '../types';
import type { BackendProject } from '../types';

export const initializeProjectFromTeam = (team: Team) => models.initModel<RemoteProject>(
  models.project.type,
  {
    _id: `${models.project.prefix}_${team.id}`,
    remoteId: team.id,
    name: team.name,
  }
);

export const initializeWorkspaceFromBackendProject = (backendProject: BackendProject, project: Project) => models.initModel<Workspace>(
  models.workspace.type,
  {
    _id: backendProject.rootDocumentId,
    name: backendProject.name,
    parentId: project._id,
    scope: WorkspaceScopeKeys.collection,
  }
);
