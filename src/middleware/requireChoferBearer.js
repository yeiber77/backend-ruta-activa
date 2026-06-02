const { createRequireRoleBearer } = require('../utils/verifyAccessToken');

const choferRoleId = Number(process.env.ROLE_CHOFER_ID || process.env.ROL_CHOFER_ID || 3);

module.exports = createRequireRoleBearer({
  roleId: choferRoleId,
  actorKey: 'choferActor',
  roleLabel: 'chofer',
  routePrefix: '/api/chofer',
});
