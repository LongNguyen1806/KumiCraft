import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const CLIENT_DIR = fileURLToPath(new URL('./client', import.meta.url));
const TRANSFORM_DIR = fileURLToPath(new URL('./transform', import.meta.url));

function collectTsFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('bridge architecture [R-FW-04]', () => {
  it('keeps bundler and framework code out of the page client [R-FW-04]', () => {
    const clientFiles = collectTsFiles(CLIENT_DIR);
    const transformFiles = collectTsFiles(TRANSFORM_DIR);

    const clientForbidden = [
      "from 'vite'",
      'from "vite"',
      "from 'react'",
      'from "react"',
      "from '@babel/",
      'from "@babel/',
    ];
    const transformForbidden = ["from 'vite'", 'from "vite"'];

    const clientViolations: string[] = [];
    for (const file of clientFiles) {
      const content = readFileSync(file, 'utf8');
      for (const pattern of clientForbidden) {
        if (content.includes(pattern)) {
          clientViolations.push(`${file}: contains ${pattern}`);
        }
      }
    }

    const transformViolations: string[] = [];
    for (const file of transformFiles) {
      const content = readFileSync(file, 'utf8');
      for (const pattern of transformForbidden) {
        if (content.includes(pattern)) {
          transformViolations.push(`${file}: contains ${pattern}`);
        }
      }
    }

    expect(clientViolations).toEqual([]);
    expect(transformViolations).toEqual([]);
  });
});
