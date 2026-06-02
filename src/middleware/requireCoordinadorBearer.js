const { createRequireRoleBearer } = require('../utils/verifyAccessToken');

const coordinadorRoleId = Number(
  process.env.ROLE_COORDINADOR_ID || process.env.ROL_COORDINADOR_ID || 2
);

module.exports = createRequireRoleBearer({
  roleId: coordinadorRoleId,
  actorKey: 'coordinadorActor',
  roleLabel: 'coordinador',
  routePrefix: '/api/coordinador',
});
