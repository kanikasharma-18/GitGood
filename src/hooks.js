const fs = require("node:fs/promises");
const path = require("node:path");
const { simpleGit } = require("simple-git");
const { getGitRoot } = require("./utils/git");

const HOOK_NAME = "pre-commit";
const BACKUP_NAME = "pre-commit.gitgood-backup";
const HOOK_MARKER = "# git-good-managed-hook";

function shellQuote(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function createHookContent() {
  const cliPath = path.resolve(__dirname, "../bin/git-good.js");
  return `#!/bin/sh\n${HOOK_MARKER}\nexec node ${shellQuote(cliPath)} check\n`;
}

async function getHooksDirectory(root) {
  const git = simpleGit(root);
  const hooksPath = (await git.raw(["rev-parse", "--git-path", "hooks"])).trim();
  return path.resolve(root, hooksPath);
}

async function readIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function installHooks(directory = process.cwd()) {
  const root = await getGitRoot(directory);
  const hooksDirectory = await getHooksDirectory(root);
  const hookPath = path.join(hooksDirectory, HOOK_NAME);
  const backupPath = path.join(hooksDirectory, BACKUP_NAME);
  const existingHook = await readIfExists(hookPath);

  if (existingHook && existingHook.includes(HOOK_MARKER)) {
    return {
      installed: false,
      alreadyInstalled: true,
      hookPath,
      backupPath,
    };
  }

  if (existingHook) {
    const existingBackup = await readIfExists(backupPath);
    if (existingBackup !== null) {
      throw new Error(
        `A GitGood backup already exists at ${backupPath}; refusing to replace the existing hook.`
      );
    }

    await fs.rename(hookPath, backupPath);
  }

  await fs.writeFile(hookPath, createHookContent(), {
    encoding: "utf8",
    mode: 0o755,
  });
  await fs.chmod(hookPath, 0o755);

  return {
    installed: true,
    alreadyInstalled: false,
    hookPath,
    backupPath: existingHook ? backupPath : null,
  };
}

async function uninstallHooks(directory = process.cwd()) {
  const root = await getGitRoot(directory);
  const hooksDirectory = await getHooksDirectory(root);
  const hookPath = path.join(hooksDirectory, HOOK_NAME);
  const backupPath = path.join(hooksDirectory, BACKUP_NAME);
  const existingHook = await readIfExists(hookPath);

  if (!existingHook || !existingHook.includes(HOOK_MARKER)) {
    return {
      uninstalled: false,
      restored: false,
      hookPath,
      backupPath,
    };
  }

  await fs.rm(hookPath);
  const backup = await readIfExists(backupPath);

  if (backup !== null) {
    await fs.rename(backupPath, hookPath);
  }

  return {
    uninstalled: true,
    restored: backup !== null,
    hookPath,
    backupPath,
  };
}

module.exports = {
  BACKUP_NAME,
  HOOK_MARKER,
  installHooks,
  uninstallHooks,
};
