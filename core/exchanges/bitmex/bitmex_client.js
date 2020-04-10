const axios = require("axios");
const league_helper = require("./league_helper_bitmex.js");

const apiBaseUrl = "https://www.bitmex.com";

async function get(path, apiKey, apiSecret) {
  var verb = "GET",
    expires = Math.round(new Date().getTime() / 1000) + 60;

  const signature = league_helper.getSignature(apiSecret, verb, path, expires);

  const headers = _generateApiHeaders(expires, apiKey, signature);
  const config = _generateRequestConfig(headers, path, verb);

  return await axios.request(config);
}

function _generateApiHeaders(expires, apiKey, signature) {
  return {
    "content-type": "application/json",
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "api-expires": expires,
    "api-key": apiKey,
    "api-signature": signature
  };
}

function _generateRequestConfig(headers, path, verb) {
  return {
    headers: headers,
    baseURL: apiBaseUrl,
    url: path,
    method: verb
  };
}

module.exports = {
  get
};
