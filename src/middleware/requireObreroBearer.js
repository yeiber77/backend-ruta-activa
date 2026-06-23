const { createRequireRoleBearer } = require('../utils/verifyAccessToken');

const obreroRoleId = Number(process.env.ROLE_OBRERO_ID || process.env.ROL_OBRERO_ID || 6);

module.exports = createRequireRoleBearer({
  roleId: obreroRoleId,
  actorKey: 'obreroActor',
  roleLabel: 'obrero',
  routePrefix: '/api/obrero',
});
