import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync('components/AgentWorkspace.tsx', 'utf8');

test('desktop Agent workspace uses companion chat and task canvas layout', () => {
  assert.match(source, /agent-desktop-shell/);
  assert.match(source, /agent-companion-panel/);
  assert.match(source, /agent-task-canvas/);
  assert.match(source, /agent-support-drawer/);
  assert.doesNotMatch(source, /grid-cols-\[300px_minmax\(0,1fr\)_300px\]/);
});

test('desktop Agent workspace keeps real capability entry points visible', () => {
  assert.match(source, /查看题目解释/);
  assert.match(source, /不确定怎么选/);
  assert.match(source, /暂停填写/);
  assert.match(source, /我来接管/);
  assert.match(source, /继续填写/);
  assert.match(source, /最近结果/);
});
