const isDev = process.env.NODE_ENV !== 'production';

const logger = {
  log: (...args) => isDev && console.log(...args),
  warn: (...args) => isDev && console.warn(...args),
  error: (...args) => isDev && console.error(...args),
  info: (...args) => isDev && console.log(...args),
};

export default logger;
