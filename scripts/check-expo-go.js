'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const output = path.resolve(process.cwd(), '.expo-go-check');
fs.rmSync(output, { recursive: true, force: true });

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const env = { ...process.env };
delete env.CEGONHA_NATIVE_RUNTIME;

const result = spawnSync(npx, ['expo', 'export', '--platform', 'android', '--output-dir', output, '--clear'], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

fs.rmSync(output, { recursive: true, force: true });
process.exit(result.status ?? 1);
