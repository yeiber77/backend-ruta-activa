const { createRequireRoleBearer } = require('../utils/verifyAccessToken');

const adminRoleId = Number(process.env.ROLE_ADMIN_ID || process.env.ROL_ADMIN_ID || 1);

module.exports = createRequireRoleBearer({
  roleId: adminRoleId,
  actorKey: 'adminActor',
  roleLabel: 'administrador',
  routePrefix: '/api/admin',
});
