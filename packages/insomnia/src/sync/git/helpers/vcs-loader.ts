import path from 'path';

import * as models from '../../../models';
import type { GitRepository } from '../../../models/git-repository';
import type { Project } from '../../../models/project';
import type { Workspace } from '../../../models/workspace';
import { fsClient } from '../fs-client';
import { NeDBClient } from '../ne-db-client';
import { routableFSClient } from '../routable-fs-client';
import {
  GIT_CLONE_DIR,
  GIT_INSOMNIA_DIR,
  GIT_INTERNAL_DIR,
  GitVCS,
} from '../vcs';

/**
 *
 * @param gitRepository: GitRepository
 */
export const gitLoadByRepository = async (workspace: Workspace, project: Project, gitRepository: GitRepository): Promise<GitVCS> => {
    const baseDir = path.join(
      process.env['INSOMNIA_DATA_PATH'] || window.app.getPath('userData'),
      `version-control/git/${gitRepository._id}`
    );

    // All app data is stored within a namespaced GIT_INSOMNIA_DIR directory at the root of the repository and is read/written from the local NeDB database
    const neDbClient = NeDBClient.createClient(workspace._id, project._id);

    // All git metadata in the GIT_INTERNAL_DIR directory is stored in a git/ directory on the filesystem
    const gitDataClient = fsClient(baseDir);

    // All data outside the directories listed below will be stored in an 'other' directory. This is so we can support files that exist outside the ones the app is specifically in charge of.
    const otherDataClient = fsClient(path.join(baseDir, 'other'));

    // The routable FS client directs isomorphic-git to read/write from the database or from the correct directory on the file system while performing git operations.
    const routableFS = routableFSClient(otherDataClient, {
      [GIT_INSOMNIA_DIR]: neDbClient,
      [GIT_INTERNAL_DIR]: gitDataClient,
    });

    // Init VCS
    const { credentials, uri, author } = gitRepository;

    const vcs = GitVCS.createInstace();

    // Configure basic info
    if (gitRepository.needsFullClone) {
      await vcs.initFromClone({
        repoId: gitRepository._id,
        url: uri,
        gitCredentials: credentials,
        directory: GIT_CLONE_DIR,
        fs: routableFS,
        gitDirectory: GIT_INTERNAL_DIR,
      });

      await models.gitRepository.update(gitRepository, {
        needsFullClone: false,
      });
    } else {
      await vcs.init({
        repoId: gitRepository._id,
        uri,
        directory: GIT_CLONE_DIR,
        fs: routableFS,
        gitDirectory: GIT_INTERNAL_DIR,
        gitCredentials: credentials,
      });
    }

    // Configure basic info
    await vcs.setAuthor(author.name, author.email);
    await vcs.addRemote(uri);

    return vcs;
};
