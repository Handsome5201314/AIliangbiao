/**
 * crypto.randomUUID Polyfill
 * 为不支持 crypto.randomUUID 的浏览器提供兼容方案
 */

// 检查并添加 polyfill
if (typeof window !== 'undefined' && typeof window.crypto !== 'undefined') {
  if (typeof window.crypto.randomUUID !== 'function') {
    // 添加 polyfill 方法
    Object.defineProperty(window.crypto, 'randomUUID', {
      value: function() {
        // 使用 crypto.getRandomValues 生成 UUID v4
        if (typeof window.crypto.getRandomValues === 'function') {
          const bytes = new Uint8Array(16);
          window.crypto.getRandomValues(bytes);
          
          // 设置版本位 (version 4)
          bytes[6] = (bytes[6] & 0x0f) | 0x40;
          bytes[8] = (bytes[8] & 0x3f) | 0x80;
          
          // 转换为 UUID 字符串格式
          const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
          return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
        }
        
        // 最终后备方案：使用 Math.random()
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      },
      writable: false,
      configurable: false
    });
  }
}

export {};
