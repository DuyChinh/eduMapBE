/**
 * User utility functions
 */

/**
 * Remove sensitive fields from user object
 * @param {Object} user - User object from database
 * @returns {Object} User object without sensitive fields
 */
const sanitizeUser = (user) => {
  if (!user) return null;
  
  // Convert mongoose document to plain object if needed
  const userObj = user.toObject ? user.toObject() : user;
  
  // Remove sensitive fields
  const { password, __v, ...sanitizedUser } = userObj;
  
  return sanitizedUser;
};

/**
 * Remove sensitive fields from array of user objects
 * @param {Array} users - Array of user objects
 * @returns {Array} Array of sanitized user objects
 */
const sanitizeUsers = (users) => {
  if (!Array.isArray(users)) return [];
  
  return users.map(user => sanitizeUser(user));
};

module.exports = {
  sanitizeUser,
  sanitizeUsers
};
