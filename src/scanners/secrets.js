const path = require("node:path");
const { simpleGit } = require("simple-git");
const { getGitRoot, getStagedFiles } = require("../utils/git");

const SECRET_PATTERNS = [
  {
    type: "private-key",
    pattern: /^-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/,
    description: "Private key header detected",
  },
  {
    type: "api-key",
    pattern: /\b(?:AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk_(?:live|test)_[A-Za-z0-9]{16,}|xox[baprs]-[A-Za-z0-9-]{10,}|ya29\.[A-Za-z0-9_-]{20,})\b/,
    description: "Known API key or access token format detected",
  },
  {
    type: "credential-assignment",
    pattern: /\b(?:api[_-]?key|access[_-]?key|password|passwd|secret|token)\b\s*[:=]\s*(?:["'][^"']+["']|[^\s#]+)/i,
    description: "Credential assignment detected",
  },
];

function isEnvironmentFile(filePath) {
  const fileName = path.basename(filePath);
  return fileName === ".env" || fileName.startsWith(".env.");
}

function findLineFindings(filePath, content) {
  const findings = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const secretPattern of SECRET_PATTERNS) {
      if (secretPattern.pattern.test(line)) {
        findings.push({
          file: filePath,
          line: index + 1,
          type: secretPattern.type,
          description: secretPattern.description,
        });
        break;
      }
    }
  });

  return findings;
}

async function readStagedFile(git, filePath) {
  try {
    return await git.raw(["show", `:${filePath}`]);
  } catch {
    // Deleted staged files have no blob in the index to scan.
    return null;
  }
}

/**
 * Scans only staged file contents from Git's index for likely secrets.
 */
async function scanSecrets(directory = process.cwd()) {
  const root = await getGitRoot(directory);
  const stagedFiles = await getStagedFiles(directory);
  const git = simpleGit(root);
  const findings = [];

  for (const filePath of stagedFiles) {
    const content = await readStagedFile(git, filePath);

    if (content === null || content.includes("\0")) {
      continue;
    }

    if (isEnvironmentFile(filePath)) {
      findings.push({
        file: filePath,
        line: 1,
        type: "environment-file",
        description: "Staged environment file may contain secrets",
      });
    }

    findings.push(...findLineFindings(filePath, content));
  }

  return {
    hasSecrets: findings.length > 0,
    findings,
  };
}

module.exports = {
  scanSecrets,
};
