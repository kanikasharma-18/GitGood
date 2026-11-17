const { simpleGit } = require("simple-git");
const { getGitRoot, getStagedFiles } = require("../utils/git");

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024;

function formatSize(size) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }

  if (size >= 1024) {
    return `${(size / 1024).toFixed(2)} KB`;
  }

  return `${size} bytes`;
}

function getMaxSize(options) {
  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;

  if (!Number.isFinite(maxSize) || maxSize < 0) {
    throw new Error("The large file size limit must be a non-negative number of bytes.");
  }

  return maxSize;
}

async function getStagedFileSize(git, filePath) {
  try {
    const output = await git.raw(["cat-file", "-s", `:${filePath}`]);
    return Number.parseInt(output.trim(), 10);
  } catch {
    return null;
  }
}

async function scanLargeFiles(directory = process.cwd(), options = {}) {
  const maxSize = getMaxSize(options);
  const root = await getGitRoot(directory);
  const stagedFiles = await getStagedFiles(directory);
  const git = simpleGit(root);
  const findings = [];

  for (const filePath of stagedFiles) {
    const size = await getStagedFileSize(git, filePath);

    if (size === null || size <= maxSize) {
      continue;
    }

    findings.push({
      file: filePath,
      size,
      sizeFormatted: formatSize(size),
      limit: maxSize,
    });
  }

  return {
    hasLargeFiles: findings.length > 0,
    findings,
  };
}

module.exports = {
  scanLargeFiles,
};
