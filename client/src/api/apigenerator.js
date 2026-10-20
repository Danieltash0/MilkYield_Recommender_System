const crypto = require('crypto');

// Generates a secure, random 32-byte hex string (e.g., 'ac6bfa...')
function generateApiKey() {
    return crypto.randomBytes(32).toString('hex');
}

console.log(generateApiKey());
