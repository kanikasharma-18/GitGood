const { getCurrentBranch } = require("../utils/git");

const DEFAULT_PROTECTED_BRANCHES = [
  "main",
  "master",
  "production",
  "develop",
];

async function checkBranchSafety(directory = process.cwd(), options = {}) {
  const branch = await getCurrentBranch(directory);
  const protectedBranches =
    options.protectedBranches ?? DEFAULT_PROTECTED_BRANCHES;
  const protectedBranch = branch !== null && protectedBranches.includes(branch);

  return {
    safe: !protectedBranch,
    branch,
    protected: protectedBranch,
    warning: protectedBranch
      ? `Current branch "${branch}" is protected. Review changes carefully before committing.`
      : null,
  };
}

module.exports = {
  checkBranchSafety,
};
