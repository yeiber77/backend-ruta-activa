const { createRequireRoleBearer } = require('../utils/verifyAccessToken');

const representanteRoleId = Number(
  process.env.ROLE_REPRESENTANTE_ID || process.env.ROL_REPRESENTANTE_ID || 5
);

module.exports = createRequireRoleBearer({
  roleId: representanteRoleId,
  actorKey: 'representanteActor',
  roleLabel: 'representante',
  routePrefix: '/api/representante',
});
