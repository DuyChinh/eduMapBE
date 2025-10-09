/**
 * Password validation utility
 * Validates password strength according to security requirements
 */

const validatePassword = (password) => {
  const errors = [];
  
  // Check minimum length
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  // Check maximum length
  if (password.length > 128) {
    errors.push('Password must be no more than 128 characters long');
  }
  
  // Check for uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z)');
  }
  
  // Check for lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z)');
  }
  
  // Check for number
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number (0-9)');
  }
  
  // Check for special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  }
  
  // Check for common weak patterns
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password cannot contain more than 2 consecutive identical characters');
  }
  
  // Check for common words (basic check)
  const commonWords = ['password', '123456', 'qwerty', 'abc123', 'admin', 'user'];
  const lowerPassword = password.toLowerCase();
  for (const word of commonWords) {
    if (lowerPassword.includes(word)) {
      errors.push('Password cannot contain common words or patterns');
      break;
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors,
    strength: calculatePasswordStrength(password)
  };
};

/**
 * Calculate password strength score (0-100)
 */
const calculatePasswordStrength = (password) => {
  let score = 0;
  
  // Length score (0-30 points)
  if (password.length >= 8) score += 10;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;
  
  // Character variety score (0-40 points)
  if (/[a-z]/.test(password)) score += 8;
  if (/[A-Z]/.test(password)) score += 8;
  if (/[0-9]/.test(password)) score += 8;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) score += 16;
  
  // Pattern score (0-30 points)
  if (!/(.)\1{2,}/.test(password)) score += 15;
  if (password.length > 8 && !/(.)\1{2,}/.test(password)) score += 15;
  
  return Math.min(score, 100);
};

/**
 * Get password strength description
 */
const getPasswordStrengthDescription = (strength) => {
  if (strength < 30) return 'Very Weak';
  if (strength < 50) return 'Weak';
  if (strength < 70) return 'Fair';
  if (strength < 90) return 'Good';
  return 'Strong';
};

module.exports = {
  validatePassword,
  calculatePasswordStrength,
  getPasswordStrengthDescription
};
