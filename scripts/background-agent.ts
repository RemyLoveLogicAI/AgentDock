#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';

// Root directory of the repo
const ROOT = path.resolve(__dirname, '..');

// Utility: Recursively get all files in a directory
function getAllFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      fileList = getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });
  return fileList;
}

// Utility: Summarize the codebase structure
function summarizeCodebase() {
  const folders = ['agentdock-core', 'agents', 'src', 'docs', 'scripts', 'tests', 'content'];
  console.log('--- Codebase Summary ---');
  folders.forEach((folder) => {
    const abs = path.join(ROOT, folder);
    if (fs.existsSync(abs)) {
      const files = getAllFiles(abs);
      console.log(`${folder}/: ${files.length} files`);
    }
  });
  console.log('------------------------');
}

// Utility: Suggest TODOs based on file types
function suggestTODOs() {
  const todos: string[] = [];
  // Example: Check for missing README in agents/
  const agentsDir = path.join(ROOT, 'agents');
  if (fs.existsSync(agentsDir)) {
    const agentFolders = fs.readdirSync(agentsDir).filter(f => fs.statSync(path.join(agentsDir, f)).isDirectory());
    agentFolders.forEach(agent => {
      const readme = path.join(agentsDir, agent, 'README.md');
      if (!fs.existsSync(readme)) {
        todos.push(`Add README.md for agent: ${agent}`);
      }
    });
  }
  // Example: Check for test coverage in src/
  const srcDir = path.join(ROOT, 'src');
  if (fs.existsSync(srcDir)) {
    const files = getAllFiles(srcDir);
    const hasTests = files.some(f => f.includes('test') || f.includes('__tests__'));
    if (!hasTests) {
      todos.push('Consider adding tests in src/.');
    }
  }
  if (todos.length) {
    console.log('--- Suggested TODOs ---');
    todos.forEach(todo => console.log('- ' + todo));
    console.log('-----------------------');
  } else {
    console.log('No immediate TODOs found.');
  }
}

// Watch for file changes and report
function watchRepo() {
  const watcher = chokidar.watch(ROOT, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
  });

  watcher
    .on('add', filePath => console.log(`[File added] ${path.relative(ROOT, filePath)}`))
    .on('change', filePath => console.log(`[File changed] ${path.relative(ROOT, filePath)}`))
    .on('unlink', filePath => console.log(`[File removed] ${path.relative(ROOT, filePath)}`));

  console.log('Watching for file changes...');
}

// Main
function main() {
  summarizeCodebase();
  suggestTODOs();
  watchRepo();
}

main(); 