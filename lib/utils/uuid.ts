/**
 * 生成 UUID 的兼容方法
 * 支持所有浏览器（包括 HTTP 环境）
 */

/**
 * 生成 v4 UUID
 * 优先使用 crypto.randomUUID()，如果不支持则使用 polyfill
 */
export function generateUUID(): string {
  // 尝试使用原生方法（HTTPS 环境或支持的浏览器）
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Polyfill: 使用 crypto.getRandomValues() 生成 UUID
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    // 使用 randomValues 生成 UUID v4
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // 设置版本位 (version 4)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    // 转换为 UUID 字符串格式
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // 最终后备方案：使用 Math.random()（不推荐，但保证可用）
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 生成设备 ID
 * 如果 localStorage 中已存在则返回，否则生成新的
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') {
    return generateUUID();
  }

  const stored = localStorage.getItem('device_id');
  if (stored) {
    return stored;
  }

  const deviceId = generateUUID();
  localStorage.setItem('device_id', deviceId);
  return deviceId;
}
