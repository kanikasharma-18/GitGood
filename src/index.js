const { Command } = require("commander");

const program = new Command();

program
  .name("git-good")
  .description("Your Personal Git Safety Net")
  .version("0.1.0");

program.action(() => {
  console.log(
    "Welcome to git-good! Feature commands are coming soon to help keep your Git workflow safe."
  );
});

module.exports = program;
