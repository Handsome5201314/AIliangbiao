import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("patient auth UI does not expose SMS login or SMS registration", async () => {
  const source = await readFile("components/AuthCard.tsx", "utf8");

  assert.doesNotMatch(source, /login-sms/);
  assert.doesNotMatch(source, /register-patient-sms/);
  assert.doesNotMatch(source, /sms\/send-code/);
  assert.doesNotMatch(source, /password\/reset/);
  assert.doesNotMatch(source, /短信登录|短信注册|发送验证码|短信验证码|忘记密码/);
});

test("guest onboarding copy does not promise SMS auth", async () => {
  const source = await readFile("components/AccountOnboardingModal.tsx", "utf8");

  assert.doesNotMatch(source, /短信登录|短信注册|找回密码/);
});

test("clinic QR copy does not promise SMS auth", async () => {
  const source = await readFile("app/clinic/qr/[slug]/page.tsx", "utf8");

  assert.doesNotMatch(source, /短信登录|短信注册/);
});
