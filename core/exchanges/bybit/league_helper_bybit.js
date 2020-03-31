const crypto = require("crypto");

function getSignature(parameters, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(getOrderedParams(parameters))
    .digest("hex");
}

function getOrderedParams(parameters) {
  var orderedParams = "";
  Object.keys(parameters)
    .sort()
    .forEach(function(key) {
      orderedParams += key + "=" + parameters[key] + "&";
    });
  orderedParams = orderedParams.substring(0, orderedParams.length - 1);
  return orderedParams;
}

module.exports = {
  getSignature,
  getOrderedParams
};
