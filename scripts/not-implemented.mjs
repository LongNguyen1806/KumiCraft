// Placeholder for root scripts whose work package has not been built yet (SPEC-07 section 4.3, step 9).
// Allowed only until the end of Phase 0: each script is replaced by its real command in the listed WP.
const [scriptName = 'script', workPackage = 'a later work package'] = process.argv.slice(2);

console.log(
  `[reactcraft] "${scriptName}" is not implemented yet. It is delivered in ${workPackage}.`,
);
