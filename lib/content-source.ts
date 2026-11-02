export function contentSource(): 'demo' | 'payload' {
  const source = process.env.CONTENT_SOURCE || 'demo';
  if (source !== 'demo' && source !== 'payload') throw new Error('CONTENT_SOURCE debe ser demo o payload');
  return source;
}
