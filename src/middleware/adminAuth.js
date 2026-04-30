function getAdminUser() {
  return process.env.ADMIN_USER || process.env.ADMIN_BASIC_USER || 'admin';
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || process.env.ADMIN_BASIC_PASSWORD || '123456789';
}

function isValidAdmin(req) {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string' || !header.startsWith('Basic ')) {
    return false;
  }
  let decoded;
  try {
    decoded = Buffer.from(header.slice(6).trim(), 'base64').toString('utf8');
  } catch {
    return false;
  }
  const idx = decoded.indexOf(':');
  if (idx === -1) {
    return false;
  }
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  return user === getAdminUser() && pass === getAdminPassword();
}

module.exports = {
  isValidAdmin,
  getAdminUser,
  getAdminPassword,
};
