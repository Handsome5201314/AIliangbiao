import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function readProjectFile(...segments: string[]) {
  return fs.readFile(path.join(root, ...segments), "utf8");
}

test("theme contract exposes only modern and warm themes", async () => {
  const themeContext = await readProjectFile("contexts", "ThemeContext.tsx");
  const themeSwitcher = await readProjectFile("components", "ThemeSwitcher.tsx");
  const globals = await readProjectFile("app", "globals.css");

  assert.match(themeContext, /export type ThemeName = 'modern' \| 'warm';/);
  assert.doesNotMatch(themeContext, /'dark'|深色模式|data-theme", "dark"|data-theme', 'dark'/);
  assert.doesNotMatch(themeSwitcher, /Moon|深色模式|dark/);
  assert.doesNotMatch(globals, /\[data-theme="dark"\]|color-scheme:\s*dark/);
});

test("theme provider writes the active theme to the document root", async () => {
  const themeContext = await readProjectFile("contexts", "ThemeContext.tsx");
  const layout = await readProjectFile("app", "layout.tsx");

  assert.match(themeContext, /document\.documentElement/);
  assert.doesNotMatch(themeContext, /document\.body\.setAttribute\('data-theme'/);
  assert.doesNotMatch(themeContext, /document\.body\.removeAttribute\('data-theme'\)/);
  assert.match(layout, /localStorage\.getItem\('app-theme'\)/);
  assert.match(layout, /document\.documentElement\.setAttribute\('data-theme', stored\)/);
});

test("avatar component and call sites use nickname instead of legacy avatar state", async () => {
  const avatar = await readProjectFile("components", "Avatar.tsx");
  const filesToCheck = [
    ["app", "page.tsx"],
    ["components", "AssessmentResult.tsx"],
    ["components", "ProfileSetupModal.tsx"],
    ["components", "Questionnaire.tsx"],
  ];

  assert.match(avatar, /interface AvatarProps \{\s*nickname\?: string;\s*className\?: string;\s*\}/s);
  assert.doesNotMatch(avatar, /state\?:|gender\?:|deprecated|unknown/);

  for (const segments of filesToCheck) {
    const source = await readProjectFile(...segments);
    assert.doesNotMatch(source, /<Avatar[\s\S]*?\bstate=/);
    assert.doesNotMatch(source, /<Avatar[\s\S]*?\bgender=/);
  }

  const assessmentResult = await readProjectFile("components", "AssessmentResult.tsx");
  const profileSetupModal = await readProjectFile("components", "ProfileSetupModal.tsx");
  const questionnaire = await readProjectFile("components", "Questionnaire.tsx");

  assert.match(assessmentResult, /<Avatar\s+nickname=\{profile\.nickname\}/);
  assert.match(profileSetupModal, /<Avatar\s+nickname=\{formData\.nickname/);
  assert.match(questionnaire, /<Avatar\s+nickname=\{profile\.nickname\}/);
});
