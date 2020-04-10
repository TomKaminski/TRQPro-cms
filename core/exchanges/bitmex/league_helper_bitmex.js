const crypto = require("crypto");

function getSignature(apiSecret, verb, path, expires) {
  return crypto
    .createHmac("sha256", apiSecret)
    .update(verb + path + expires)
    .digest("hex");
}

module.exports = {
  getSignature
};
