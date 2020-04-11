const axios = require("axios");
const league_helper = require("./league_helper_binance.js");

const futureApiBaseUrl = "https://fapi.binance.com";
const spotApiBaseUrl = "https://api.binance.com";

async function securedGet(path, apiKey, apiSecret, params, spotApi) {
  const verb = "GET";
  const timestamp = Date.now();
  const composedPath = _composeUrlPathWithSignature(
    path,
    { timestamp, ...params },
    apiSecret
  );
  const headers = _generateApiHeaders(apiKey);
  const config = _generateRequestConfig(headers, composedPath, verb, spotApi);

  return await axios.request(config);
}

async function get(path, params, apiKey) {
  const verb = "GET";
  const composedPath = _composeUrlPath(path, params);
  const headers = _generateApiHeaders(apiKey);
  const config = _generateRequestConfig(headers, composedPath, verb);

  return await axios.request(config);
}

async function publicGet(path, params) {
  return await axios.get(
    mainnetApiBaseUrl + (params ? _composeUrlPath(path, params) : path)
  );
}

function _composeUrlPathWithSignature(path, params, apiSecret) {
  return (
    path +
    "?" +
    league_helper.getOrderedParams(params) +
    "&signature=" +
    league_helper.getSignature(params, apiSecret)
  );
}

function _composeUrlPath(path, params) {
  return path + "?" + league_helper.getOrderedParams(params);
}

function _generateRequestConfig(headers, path, verb, spotApi) {
  return {
    headers: headers,
    baseURL: spotApi ? spotApiBaseUrl : futureApiBaseUrl,
    url: path,
    method: verb,
  };
}

function _generateApiHeaders(apiKey) {
  return {
    "content-type": "application/json",
    Accept: "application/json",
    "X-MBX-APIKEY": apiKey,
  };
}

module.exports = {
  get,
  publicGet,
  securedGet,
};
