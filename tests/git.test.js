import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { simpleGit } from "simple-git";
import * as gitUtilities from "../src/utils/git.js";
const {
  getCurrentBranch,
  getGitRoot,
  getStagedFiles,
  hasStagedChanges,
  isGitRepository,
} = gitUtilities;

describe("Git utilities", () => {
  let temporaryDirectory;
  let git;

  beforeEach(async () => {
    temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "git-good-guard-"));
    git = simpleGit(temporaryDirectory);
    await git.init();
    await git.addConfig("user.name", "Git Good Test");
    await git.addConfig("user.email", "git-good-test@example.com");
    await git.checkoutLocalBranch("main");
  });

  afterEach(async () => {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("recognizes a Git repository and rejects a non-Git directory", async () => {
    const nonGitDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "not-a-git-repo-"));

    await expect(isGitRepository(temporaryDirectory)).resolves.toBe(true);
    await expect(isGitRepository(nonGitDirectory)).resolves.toBe(false);

    await fs.rm(nonGitDirectory, { recursive: true, force: true });
  });

  it("gets the repository root and current branch", async () => {
    const nestedDirectory = path.join(temporaryDirectory, "nested", "directory");
    await fs.mkdir(nestedDirectory, { recursive: true });
    await fs.writeFile(path.join(temporaryDirectory, "initial.txt"), "content");
    await git.add("initial.txt");
    await git.commit("Initial commit");

    await expect(getGitRoot(nestedDirectory)).resolves.toBe(
      await fs.realpath(temporaryDirectory)
    );
    await expect(getCurrentBranch(temporaryDirectory)).resolves.toBe("main");
  });

  it("throws a helpful error for a non-Git directory", async () => {
    const nonGitDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "not-a-git-repo-"));

    await expect(getGitRoot(nonGitDirectory)).rejects.toThrow("find the Git repository root");
    await expect(getCurrentBranch(nonGitDirectory)).rejects.toThrow("get the current Git branch");

    await fs.rm(nonGitDirectory, { recursive: true, force: true });
  });

  it("returns null for a detached HEAD", async () => {
    await fs.writeFile(path.join(temporaryDirectory, "file.txt"), "content");
    await git.add("file.txt");
    await git.commit("Initial commit");
    await git.raw(["checkout", "--detach", "HEAD"]);

    await expect(getCurrentBranch(temporaryDirectory)).resolves.toBeNull();
  });

  it("separates staged and unstaged changes", async () => {
    await fs.writeFile(path.join(temporaryDirectory, "tracked.txt"), "initial");
    await git.add("tracked.txt");
    await git.commit("Initial commit");

    await fs.writeFile(path.join(temporaryDirectory, "tracked.txt"), "staged");
    await git.add("tracked.txt");
    await fs.writeFile(path.join(temporaryDirectory, "unstaged.txt"), "unstaged");

    await expect(hasStagedChanges(temporaryDirectory)).resolves.toBe(true);
    await expect(getStagedFiles(temporaryDirectory)).resolves.toEqual(["tracked.txt"]);
  });

  it("returns staged filenames containing spaces", async () => {
    const filename = "staged file.txt";
    await fs.writeFile(path.join(temporaryDirectory, filename), "content");
    await git.add(filename);

    await expect(getStagedFiles(temporaryDirectory)).resolves.toEqual([filename]);
  });

  it("returns no staged changes when only an unstaged file exists", async () => {
    await fs.writeFile(path.join(temporaryDirectory, "unstaged.txt"), "content");

    await expect(hasStagedChanges(temporaryDirectory)).resolves.toBe(false);
    await expect(getStagedFiles(temporaryDirectory)).resolves.toEqual([]);
  });
});
