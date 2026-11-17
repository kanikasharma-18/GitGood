const path = require("node:path");
const { simpleGit } = require("simple-git");

function createGit(directory) {
  return simpleGit(directory);
}

function repositoryError(directory, operation, error) {
  const reason = error && error.message ? `: ${error.message}` : "";
  return new Error(`Unable to ${operation} in "${directory}". Is it inside a Git repository?${reason}`);
}

async function isGitRepository(directory = process.cwd()) {
  try {
    return await createGit(directory).checkIsRepo();
  } catch {
    return false;
  }
}

async function getGitRoot(directory = process.cwd()) {
  try {
    const root = await createGit(directory).revparse(["--show-toplevel"]);
    return path.resolve(root.trim());
  } catch (error) {
    throw repositoryError(directory, "find the Git repository root", error);
  }
}

/**
 * Returns null when HEAD is detached instead of returning "HEAD".
 */
async function getCurrentBranch(directory = process.cwd()) {
  try {
    const branch = (await createGit(directory).revparse(["--abbrev-ref", "HEAD"])).trim();
    return branch === "HEAD" ? null : branch;
  } catch (error) {
    throw repositoryError(directory, "get the current Git branch", error);
  }
}

async function hasStagedChanges(directory = process.cwd()) {
  try {
    const status = await createGit(directory).status();
    return status.files.some((file) => file.index !== " " && file.index !== "?");
  } catch (error) {
    throw repositoryError(directory, "check for staged changes", error);
  }
}

async function getStagedFiles(directory = process.cwd()) {
  try {
    const status = await createGit(directory).status();
    return status.files
      .filter((file) => file.index !== " " && file.index !== "?")
      .map((file) => file.path);
  } catch (error) {
    throw repositoryError(directory, "get staged files", error);
  }
}

module.exports = {
  isGitRepository,
  getGitRoot,
  getCurrentBranch,
  hasStagedChanges,
  getStagedFiles,
};
