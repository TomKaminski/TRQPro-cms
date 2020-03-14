const axios = require("axios");
const league_helper = require("./league_helper_bybit.js");

//const mainnetApiBaseUrl = "https://api.bybit.com";
const testnetApiBaseUrl = "https://api-testnet.bybit.com";

async function get(path, apiKey, apiSecret, params) {
  const timestamp = Date.now();

  return await axios.get(
    testnetApiBaseUrl +
      _composeUrlPathWithSignature(
        path,
        { api_key: apiKey, timestamp, ...params },
        apiSecret
      )
  );
}

async function publicGet(path, params) {
  return await axios.get(
    testnetApiBaseUrl + (params ? _composeUrlPath(path, params) : path)
  );
}

function _composeUrlPathWithSignature(path, params, apiSecret) {
  return (
    path +
    "?" +
    league_helper.getOrderedParams(params) +
    "&sign=" +
    league_helper.getSignature(params, apiSecret)
  );
}

function _composeUrlPath(path, params) {
  return path + "?" + league_helper.getOrderedParams(params);
}

module.exports = {
  get,
  publicGet
};
