const fs = require('fs');
const path = require('path');

const packagePath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

function fail(message) {
  console.error(`[release-check] ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(`[release-check] ${message}`);
}

const version = packageJson.version;
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  fail(`package.json version is invalid: ${version}`);
}

const publishConfig = packageJson.build && packageJson.build.win && packageJson.build.win.publish;
if (!Array.isArray(publishConfig) || publishConfig.length === 0) {
  fail('build.win.publish configuration is missing.');
}

const githubPublish = publishConfig.find((entry) => entry.provider === 'github');
if (!githubPublish || !githubPublish.owner || !githubPublish.repo) {
  fail('GitHub publish configuration is incomplete.');
}

const refName = process.env.GITHUB_REF_NAME || '';
if (refName.startsWith('v') && refName.slice(1) !== version) {
  fail(`git tag ${refName} does not match package version ${version}.`);
}

info(`Version OK: ${version}`);
info(`GitHub publish target OK: ${githubPublish.owner}/${githubPublish.repo}`);

if (refName) {
  info(`Git ref OK: ${refName}`);
}

if (!process.env.GH_TOKEN && process.env.CI) {
  fail('GH_TOKEN is required in CI to publish release assets.');
}

info('Release validation passed.');
