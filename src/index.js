const { Command } = require("commander");
const chalk = require("chalk");
const { simpleGit } = require("simple-git");
const { scanSecrets } = require("./scanners/secrets");
const { scanLargeFiles } = require("./scanners/largeFiles");
const { checkCommitMessage } = require("./scanners/commitMessage");
const { checkBranchSafety } = require("./scanners/branchSafety");
const { initConfig, loadConfig } = require("./config");
const { installHooks, uninstallHooks } = require("./hooks");

const program = new Command();

program
  .name("git-good")
  .description("Your Personal Git Safety Net")
  .version("0.1.0");

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "Unexpected error.";
}

async function checkCommit(directory) {
  const git = simpleGit(directory);
  if (!(await git.checkIsRepo())) {
    throw new Error(`"${directory}" is not inside a Git repository.`);
  }

  try {
    await git.raw(["rev-parse", "--verify", "HEAD"]);
  } catch {
    return {
      status: "SKIPPED",
      details: "No commit exists yet, so commit message validation was skipped.",
    };
  }

  const log = await git.log({ maxCount: 1 });
  const result = checkCommitMessage(log.latest.message);
  return {
    status: result.valid ? "PASS" : "FAIL",
    details: result.valid ? "Latest commit message follows the expected format." : result.errors,
  };
}

async function checkBranch(directory, options = {}) {
  try {
    return await checkBranchSafety(directory, options);
  } catch (error) {
    const git = simpleGit(directory);
    if (!(await git.checkIsRepo())) {
      throw error;
    }

    try {
      await git.raw(["rev-parse", "--verify", "HEAD"]);
    } catch {
      return {
        safe: true,
        branch: null,
        protected: false,
        warning: null,
      };
    }

    throw error;
  }
}

async function runCheck(title, check, getStatus, getDetails) {
  try {
    const result = await check();
    return {
      title,
      status: getStatus(result),
      details: getDetails(result),
    };
  } catch (error) {
    return {
      title,
      status: "FAIL",
      details: getErrorMessage(error),
    };
  }
}

async function runChecks(directory = process.cwd()) {
  let config;

  try {
    config = await loadConfig(directory);
  } catch (error) {
    const details = getErrorMessage(error);
    return {
      checks: ["Secrets", "Large files", "Commit message", "Branch safety"].map(
        (title) => ({
          title,
          status: "FAIL",
          details,
        })
      ),
      exitCode: 1,
    };
  }

  const checks = await Promise.all([
    runCheck(
      "Secrets",
      () => scanSecrets(directory),
      (result) => (result.hasSecrets ? "FAIL" : "PASS"),
      (result) =>
        result.hasSecrets
          ? result.findings.map(
              (finding) =>
                `${finding.file}:${finding.line} - ${finding.description}`
            )
          : "No staged secrets detected."
    ),
    runCheck(
      "Large files",
      () =>
        scanLargeFiles(directory, {
          maxSize: config.maxFileSize * 1024 * 1024,
        }),
      (result) => (result.hasLargeFiles ? "FAIL" : "PASS"),
      (result) =>
        result.hasLargeFiles
          ? result.findings.map(
              (finding) =>
                `${finding.file} - ${finding.sizeFormatted} (limit ${finding.limit} bytes)`
            )
          : "No oversized staged files detected."
    ),
    runCheck(
      "Commit message",
      () => checkCommit(directory),
      (result) => result.status,
      (result) => result.details
    ),
    runCheck(
      "Branch safety",
      () =>
        checkBranch(directory, {
          protectedBranches: config.protectedBranches,
        }),
      (result) => (result.protected ? "WARN" : "PASS"),
      (result) =>
        result.protected
          ? result.warning
          : result.branch === null
            ? "Detached HEAD; no protected branch warning."
            : `Current branch "${result.branch}" is not protected.`
    ),
  ]);

  return {
    checks,
    exitCode: checks.some((check) => check.status === "FAIL") ? 1 : 0,
  };
}

function statusColor(status) {
  const colors = {
    PASS: "green",
    WARN: "yellow",
    FAIL: "red",
    SKIPPED: "gray",
  };
  return chalk[colors[status]](status);
}

function formatCheckReport(report) {
  const lines = ["GitGood check report", ""];

  for (const check of report.checks) {
    lines.push(`${statusColor(check.status)} ${check.title}`);
    const details = Array.isArray(check.details) ? check.details : [check.details];
    for (const detail of details) {
      lines.push(`  ${detail}`);
    }
  }

  return lines.join("\n");
}

program
  .command("check")
  .description("Run GitGood safety checks")
  .action(async () => {
    const report = await runChecks();
    console.log(formatCheckReport(report));
    process.exitCode = report.exitCode;
  });

program
  .command("init")
  .description("Create a GitGood configuration file")
  .action(async () => {
    try {
      const result = await initConfig();
      if (result.created) {
        console.log(chalk.green(`Created ${result.path} with default settings.`));
      } else {
        console.log(chalk.yellow(`Configuration already exists at ${result.path}.`));
      }
    } catch (error) {
      console.error(chalk.red(`Unable to initialize GitGood: ${getErrorMessage(error)}`));
      process.exitCode = 1;
    }
  });

const hooksCommand = program
  .command("hooks")
  .description("Manage GitGood Git hooks");

hooksCommand
  .command("install")
  .description("Install the GitGood pre-commit hook")
  .action(async () => {
    try {
      const result = await installHooks();
      console.log(
        result.alreadyInstalled
          ? chalk.yellow("GitGood pre-commit hook is already installed.")
          : chalk.green("GitGood pre-commit hook installed successfully.")
      );
    } catch (error) {
      console.error(chalk.red(`Unable to install GitGood hooks: ${getErrorMessage(error)}`));
      process.exitCode = 1;
    }
  });

hooksCommand
  .command("uninstall")
  .description("Uninstall the GitGood pre-commit hook")
  .action(async () => {
    try {
      const result = await uninstallHooks();
      console.log(
        result.uninstalled
          ? result.restored
            ? chalk.green("GitGood hook removed and the original hook restored.")
            : chalk.green("GitGood pre-commit hook removed.")
          : chalk.yellow("GitGood pre-commit hook is not installed.")
      );
    } catch (error) {
      console.error(chalk.red(`Unable to uninstall GitGood hooks: ${getErrorMessage(error)}`));
      process.exitCode = 1;
    }
  });

program.action(() => {
  console.log(
    "Welcome to git-good! Feature commands are coming soon to help keep your Git workflow safe."
  );
});

program.runChecks = runChecks;
program.formatCheckReport = formatCheckReport;

module.exports = program;
