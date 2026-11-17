import { describe, expect, it } from "vitest";
import { checkCommitMessage } from "../src/scanners/commitMessage.js";

describe("Commit message checker", () => {
  it("accepts valid standard Conventional Commit messages", () => {
    expect(checkCommitMessage("feat: add login")).toEqual({
      valid: true,
      message: "feat: add login",
      errors: [],
    });
    expect(checkCommitMessage("fix: handle errors")).toMatchObject({
      valid: true,
      errors: [],
    });
  });

  it("accepts messages with scopes", () => {
    expect(checkCommitMessage("feat(auth): add login")).toMatchObject({
      valid: true,
      errors: [],
    });
    expect(checkCommitMessage("fix(api): handle errors")).toMatchObject({
      valid: true,
      errors: [],
    });
  });

  it.each([
    "feat: add feature",
    "fix: correct bug",
    "docs: update guide",
    "style: format source",
    "refactor: simplify parser",
    "perf: improve startup",
    "test: cover scanner",
    "build: update tooling",
    "ci: run checks",
    "chore: update metadata",
    "revert: restore change",
  ])("accepts the standard type in %s", (message) => {
    expect(checkCommitMessage(message).valid).toBe(true);
  });

  it("rejects messages without a type", () => {
    const result = checkCommitMessage("add login");

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("format");
  });

  it("rejects unsupported types", () => {
    const result = checkCommitMessage("release: publish package");

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Unsupported commit type "release".');
  });

  it("rejects empty descriptions", () => {
    const result = checkCommitMessage("feat:");

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Commit message description must not be empty.");
  });

  it.each(["update stuff", "changes", "fixed things", "misc", "work in progress"])(
    "rejects vague message %s",
    (message) => {
      const result = checkCommitMessage(message);

      expect(result.valid).toBe(false);
      expect(result.errors.join(" ")).toContain("vague");
    }
  );

  it("supports custom allowed types", () => {
    expect(checkCommitMessage("release: publish package", {
      allowedTypes: ["release"],
    })).toMatchObject({
      valid: true,
      errors: [],
    });
    expect(checkCommitMessage("feat: add feature", {
      allowedTypes: ["release"],
    }).valid).toBe(false);
  });

  it.each(["", "   ", "\n  "])("rejects empty input %j", (message) => {
    const result = checkCommitMessage(message);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Commit message must not be empty.");
  });

  it("validates only the first line of a multiline message", () => {
    const message = "feat: add login\n\nThis explains the implementation.";

    expect(checkCommitMessage(message)).toEqual({
      valid: true,
      message,
      errors: [],
    });
  });
});
