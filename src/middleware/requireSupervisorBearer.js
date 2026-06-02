const { createRequireRoleBearer } = require('../utils/verifyAccessToken');

const supervisorRoleId = Number(
  process.env.ROLE_SUPERVISOR_ID || process.env.ROL_SUPERVISOR_ID || 4
);

module.exports = createRequireRoleBearer({
  roleId: supervisorRoleId,
  actorKey: 'supervisorActor',
  roleLabel: 'supervisor',
  routePrefix: '/api/supervisor',
});
