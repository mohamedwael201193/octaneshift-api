import pino from 'pino';

/**
 * Custom serializer to mask sensitive data in logs
 */
const sensitiveDataSerializer = {
  // Mask IP addresses in userIp field
  userIp: (ip: string) => {
    if (!ip || ip === 'unknown') return ip;
    
    // Handle IPv4 addresses
    if (ip.includes('.') && !ip.includes(':')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
      }
    }
    
    // Handle IPv6 addresses (mask last 4 characters)
    if (ip.includes(':')) {
      if (ip.length > 4) {
        return ip.slice(0, -4) + '****';
      }
    }
    
    // Fallback: mask last 4 characters
    if (ip.length > 4) {
      return ip.slice(0, -4) + '****';
    }
    
    return '****';
  },

  // Mask wallet addresses
  settleAddress: (address: string) => {
    if (!address || address.length <= 6) return '******';
    return address.slice(0, -6) + '******';
  },

  depositAddress: (address: string) => {
    if (!address || address.length <= 6) return '******';
    return address.slice(0, -6) + '******';
  },

  refundAddress: (address: string) => {
    if (!address || address.length <= 6) return '******';
    return address.slice(0, -6) + '******';
  }
};

// Create logger instance with structured configuration
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname'
    }
  } : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization', 
      'req.headers.cookie', 
      'password', 
      'token',
      'secret',
      'privateKey',
      'mnemonic'
    ],
    censor: '[Redacted]'
  },
  serializers: {
    ...sensitiveDataSerializer,
    // Apply IP masking to nested objects as well
    req: (req: any) => {
      if (req && req.userIp) {
        req.userIp = sensitiveDataSerializer.userIp(req.userIp);
      }
      return req;
    }
  }
});

export { logger };
export default logger;