import { routableFSClient } from './routable-fs-client';
import GitVCS, {
  GIT_CLONE_DIR,
  GIT_INSOMNIA_DIR,
  GIT_INSOMNIA_DIR_NAME,
  GIT_INTERNAL_DIR,
  type GitLogEntry,
} from './vcs';

const vcs: GitVCS | null = null;

export const VCSInstance = () => {
  if (vcs) {
    return vcs;
  }

  // The routable FS client directs isomorphic-git to read/write from the database or from the correct directory on the file system while performing git operations.
  const routableFS = routableFSClient(otherDataClient, {
    [GIT_INSOMNIA_DIR]: neDbClient,
    [GIT_INTERNAL_DIR]: gitDataClient,
  });

  await GitVCS.init({
    repoId: gitRepository._id,
    uri,
    directory: GIT_CLONE_DIR,
    fs: routableFS,
    gitDirectory: GIT_INTERNAL_DIR,
    gitCredentials: credentials,
  });

  return vcs;
};

/* const vcs = VCSInstance().newInstance();
await initializeLocalBackendProjectAndMarkForSync({ vcs, workspace });
await pushSnapshotOnInitialize({ vcs, workspace, project: project }); */
