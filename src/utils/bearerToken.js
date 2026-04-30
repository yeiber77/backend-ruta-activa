function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') {
    return null;
  }
  const trimmed = header.trim();
  const match = trimmed.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

module.exports = { extractBearerToken };
