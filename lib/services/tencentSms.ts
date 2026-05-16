import * as tencentcloud from 'tencentcloud-sdk-nodejs';

type SmsPurpose = 'register' | 'login' | 'reset_password';

type SmsConfig = {
  secretId: string;
  secretKey: string;
  sdkAppId: string;
  signName: string;
  templateId: string;
  region: string;
};

function getSmsConfig(): SmsConfig | null {
  const secretId = process.env.TENCENT_SMS_SECRET_ID || process.env.TENCENT_SECRET_ID || '';
  const secretKey = process.env.TENCENT_SMS_SECRET_KEY || process.env.TENCENT_SECRET_KEY || '';
  const sdkAppId = process.env.TENCENT_SMS_SDK_APP_ID || '';
  const signName = process.env.TENCENT_SMS_SIGN_NAME || '';
  const templateId = process.env.TENCENT_SMS_TEMPLATE_ID_AUTH_CODE || '';
  const region = process.env.TENCENT_SMS_REGION || 'ap-guangzhou';

  if (!secretId || !secretKey || !sdkAppId || !signName || !templateId) {
    return null;
  }

  return {
    secretId,
    secretKey,
    sdkAppId,
    signName,
    templateId,
    region,
  };
}

function toE164CnPhone(phone: string) {
  return phone.startsWith('+') ? phone : `+86${phone}`;
}

function buildPurposeLabel(purpose: SmsPurpose) {
  switch (purpose) {
    case 'register':
      return 'register';
    case 'login':
      return 'login';
    case 'reset_password':
      return 'reset-password';
    default:
      return 'auth';
  }
}

export async function sendTencentAuthCodeSms(input: {
  phone: string;
  code: string;
  purpose: SmsPurpose;
  ttlMinutes: number;
}) {
  const config = getSmsConfig();

  if (!config) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[mock-sms]', {
        phone: input.phone,
        code: input.code,
        purpose: input.purpose,
      });
      return {
        provider: 'mock',
        requestId: `mock-${buildPurposeLabel(input.purpose)}`,
      };
    }

    throw new Error('Tencent SMS is not configured');
  }

  const SmsClient = (tencentcloud as any).sms.v20210111.Client;
  const client = new SmsClient({
    credential: {
      secretId: config.secretId,
      secretKey: config.secretKey,
    },
    region: config.region,
    profile: {
      httpProfile: {
        endpoint: 'sms.tencentcloudapi.com',
      },
    },
  });

  const response = await client.SendSms({
    SmsSdkAppId: config.sdkAppId,
    SignName: config.signName,
    TemplateId: config.templateId,
    PhoneNumberSet: [toE164CnPhone(input.phone)],
    TemplateParamSet: [input.code, String(input.ttlMinutes)],
    SessionContext: buildPurposeLabel(input.purpose),
  });

  const sendStatus = Array.isArray(response.SendStatusSet) ? response.SendStatusSet[0] : null;
  if (!sendStatus || sendStatus.Code !== 'Ok') {
    throw new Error(sendStatus?.Message || 'Tencent SMS send failed');
  }

  return {
    provider: 'tencent',
    requestId: response.RequestId || '',
  };
}
