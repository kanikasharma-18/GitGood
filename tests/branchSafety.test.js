import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { simpleGit } from "simple-git";
import { checkBranchSafety } from "../src/scanners/branchSafety.js";

describe("Branch safety checker", () => {
  let temporaryDirectory;
  let git;

  beforeEach(async () => {
    temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "git-good-branches-"));
    git = simpleGit(temporaryDirectory);
    await git.init();
    await git.addConfig("user.name", "Git Good Test");
    await git.addConfig("user.email", "git-good-test@example.com");
    await fs.writeFile(path.join(temporaryDirectory, "initial.txt"), "content");
    await git.add("initial.txt");
    await git.commit("Initial commit");
    await git.branch(["-M", "main"]);
  });

  afterEach(async () => {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });

  async function switchBranch(branch) {
    await git.checkoutLocalBranch(branch);
  }

  it.each(["main", "master", "production", "develop"])(
    "detects %s as protected",
    async (branch) => {
      if (branch !== "main") {
        await switchBranch(branch);
      }

      await expect(checkBranchSafety(temporaryDirectory)).resolves.toMatchObject({
        safe: false,
        branch,
        protected: true,
        warning: `Current branch "${branch}" is protected. Review changes carefully before committing.`,
      });
    }
  );

  it("treats a feature branch as safe", async () => {
    await switchBranch("feature/login");

    await expect(checkBranchSafety(temporaryDirectory)).resolves.toEqual({
      safe: true,
      branch: "feature/login",
      protected: false,
      warning: null,
    });
  });

  it("supports custom protected branches", async () => {
    await switchBranch("release");

    await expect(
      checkBranchSafety(temporaryDirectory, { protectedBranches: ["release"] })
    ).resolves.toMatchObject({
      safe: false,
      branch: "release",
      protected: true,
    });
  });

  it("compares branch names case-sensitively", async () => {
    await git.branch(["-M", "Main"]);

    await expect(checkBranchSafety(temporaryDirectory)).resolves.toEqual({
      safe: true,
      branch: "Main",
      protected: false,
      warning: null,
    });
  });

  it("handles detached HEAD without classifying it as protected", async () => {
    await git.raw(["checkout", "--detach", "HEAD"]);

    await expect(checkBranchSafety(temporaryDirectory)).resolves.toEqual({
      safe: true,
      branch: null,
      protected: false,
      warning: null,
    });
  });

  it("reports invalid Git directories clearly", async () => {
    const nonGitDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "not-a-git-repo-"));

    await expect(checkBranchSafety(nonGitDirectory)).rejects.toThrow(
      "get the current Git branch"
    );

    await fs.rm(nonGitDirectory, { recursive: true, force: true });
  });

  it("does not modify Git state", async () => {
    const beforeBranch = await git.revparse(["--abbrev-ref", "HEAD"]);
    const beforeStatus = await git.status();

    await checkBranchSafety(temporaryDirectory);

    const afterBranch = await git.revparse(["--abbrev-ref", "HEAD"]);
    const afterStatus = await git.status();
    expect(afterBranch).toBe(beforeBranch);
    expect(afterStatus.current).toBe(beforeStatus.current);
    expect(afterStatus.files).toEqual(beforeStatus.files);
  });
});
