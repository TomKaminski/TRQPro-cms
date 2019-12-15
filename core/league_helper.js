const wallerSummaryApiPath = "/api/v1/user/walletSummary?currency=XBt";
const walletApiPath = "/api/v1/user/wallet?currency=XBt";

const leagueInputDataFile = "./league_data/input.json";
const callForLeagueDataFile = "./league_data/call_for_league.json";

function createLeagueFilePath(identifier, fileName, appendJsonExtension) {
  let filePath = createLeagueFolderPath(identifier) + "/" + fileName;
  if (appendJsonExtension) {
    filePath += ".json";
  }
  return filePath;
}

function createLeagueFolderPath(identifier) {
  return "./league_data/" + identifier;
}

function createLeagueHistoryFolderPath() {
  return "./league_history";
}

function generateApiHeaders(expires, apiKey, signature) {
  return {
    "content-type": "application/json",
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "api-expires": expires,
    "api-key": apiKey,
    "api-signature": signature
  };
}

function generateRequestConfig(headers, path, verb) {
  return {
    headers: headers,
    baseURL: "https://www.bitmex.com",
    url: path,
    method: verb
  };
}

module.exports = {
  createLeagueFilePath,
  createLeagueFolderPath,
  generateApiHeaders,
  generateRequestConfig,
  wallerSummaryApiPath,
  leagueInputDataFile,
  callForLeagueDataFile,
  walletApiPath,
  createLeagueHistoryFolderPath
};
