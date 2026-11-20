const fs = require("node:fs/promises");
const path = require("node:path");
const { simpleGit } = require("simple-git");
const { getGitRoot } = require("./utils/git");

const HOOK_NAME = "pre-commit";
const BACKUP_NAME = "pre-commit.gitgood-backup";
const COMMIT_MSG_HOOK_NAME = "commit-msg";
const COMMIT_MSG_BACKUP_NAME = "commit-msg.gitgood-backup";
const HOOK_MARKER = "# git-good-managed-hook";

function shellQuote(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function createHookContent(hookName) {
  const cliPath = path.resolve(__dirname, "../bin/git-good.js");
  const command =
    hookName === COMMIT_MSG_HOOK_NAME
      ? `commit-msg "$1"`
      : "check";
  return `#!/bin/sh\n${HOOK_MARKER}\nexec node ${shellQuote(cliPath)} ${command}\n`;
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
  const hookDefinitions = [
    {
      name: HOOK_NAME,
      backupName: BACKUP_NAME,
    },
    {
      name: COMMIT_MSG_HOOK_NAME,
      backupName: COMMIT_MSG_BACKUP_NAME,
    },
  ].map((hook) => ({
    ...hook,
    hookPath: path.join(hooksDirectory, hook.name),
    backupPath: path.join(hooksDirectory, hook.backupName),
  }));
  const existingHooks = await Promise.all(
    hookDefinitions.map(async (hook) => ({
      ...hook,
      content: await readIfExists(hook.hookPath),
      backup: await readIfExists(hook.backupPath),
    }))
  );

  if (existingHooks.every((hook) => hook.content?.includes(HOOK_MARKER))) {
    return {
      installed: false,
      alreadyInstalled: true,
      hooks: existingHooks.map(({ hookPath, backupPath }) => ({
        hookPath,
        backupPath,
      })),
    };
  }

  for (const hook of existingHooks) {
    if (hook.content && !hook.content.includes(HOOK_MARKER) && hook.backup !== null) {
      throw new Error(
        `A GitGood backup already exists at ${hook.backupPath}; refusing to replace the existing hook.`
      );
    }
  }

  for (const hook of existingHooks) {
    if (hook.content && !hook.content.includes(HOOK_MARKER)) {
      await fs.rename(hook.hookPath, hook.backupPath);
    }

    if (!hook.content || !hook.content.includes(HOOK_MARKER)) {
      await fs.writeFile(hook.hookPath, createHookContent(hook.name), {
        encoding: "utf8",
        mode: 0o755,
      });
      await fs.chmod(hook.hookPath, 0o755);
    }
  }

  return {
    installed: true,
    alreadyInstalled: false,
    hooks: existingHooks.map(({ hookPath, backupPath, content }) => ({
      hookPath,
      backupPath: content && !content.includes(HOOK_MARKER) ? backupPath : null,
    })),
  };
}

async function uninstallHooks(directory = process.cwd()) {
  const root = await getGitRoot(directory);
  const hooksDirectory = await getHooksDirectory(root);
  const hookDefinitions = [
    { name: HOOK_NAME, backupName: BACKUP_NAME },
    { name: COMMIT_MSG_HOOK_NAME, backupName: COMMIT_MSG_BACKUP_NAME },
  ].map((hook) => ({
    ...hook,
    hookPath: path.join(hooksDirectory, hook.name),
    backupPath: path.join(hooksDirectory, hook.backupName),
  }));
  let uninstalled = false;
  let restored = false;

  for (const hook of hookDefinitions) {
    const existingHook = await readIfExists(hook.hookPath);
    if (!existingHook || !existingHook.includes(HOOK_MARKER)) {
      continue;
    }

    uninstalled = true;
    await fs.rm(hook.hookPath);
    const backup = await readIfExists(hook.backupPath);

    if (backup !== null) {
      await fs.rename(hook.backupPath, hook.hookPath);
      restored = true;
    }
  }

  return {
    uninstalled,
    restored,
    hooks: hookDefinitions.map(({ hookPath, backupPath }) => ({
      hookPath,
      backupPath,
    })),
  };
}

module.exports = {
  BACKUP_NAME,
  COMMIT_MSG_BACKUP_NAME,
  HOOK_MARKER,
  installHooks,
  uninstallHooks,
};
