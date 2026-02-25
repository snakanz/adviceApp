const isProd = process.env.NODE_ENV === 'production';

// Patterns to redact in production logs
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const TOKEN_REGEX = /eyJ[a-zA-Z0-9_-]{20,}/g;

function redact(args) {
  if (!isProd) return args;
  return args.map(arg => {
    if (typeof arg === 'string') {
      return arg
        .replace(EMAIL_REGEX, '[EMAIL_REDACTED]')
        .replace(TOKEN_REGEX, '[TOKEN_REDACTED]');
    }
    return arg;
  });
}

const logger = {
  log: (...args) => console.log(...redact(args)),
  warn: (...args) => console.warn(...redact(args)),
  error: (...args) => console.error(...redact(args)),
  info: (...args) => console.log(...redact(args)),
};

module.exports = logger;
