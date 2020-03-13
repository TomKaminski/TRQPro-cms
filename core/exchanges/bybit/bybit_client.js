const axios = require("axios");
const league_helper = require("./league_helper_bybit.js");

const mainnetApiBaseUrl = "https://api.bybit.com";
//const testnetApiBaseUrl = "https://testnet-api.bybit.com";

async function get(path, apiKey, apiSecret, params) {
  const timestamp = Date.now();

  return await axios.get(
    mainnetApiBaseUrl +
      _composeUrlPath(
        path,
        { api_key: apiKey, timestamp, ...params },
        apiSecret
      )
  );
}

function _composeUrlPath(path, params, apiSecret) {
  return (
    path +
    "?" +
    league_helper.getOrderedParams(params) +
    "&sign=" +
    league_helper.getSignature(params, apiSecret)
  );
}

module.exports = {
  get
};
