const ActivityLog = require('../models/ActivityLog');

// Records an action against the signed-in user who made the request
module.exports = (req, action, description) =>
  ActivityLog.createLog({
    user_id: req.user && req.user.userId,
    action,
    description,
    ip_address: req.ip,
    user_agent: req.get('User-Agent')
  });
