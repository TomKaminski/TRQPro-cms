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

function getCurrentQuarter() {
  var today = new Date();
  return Math.floor((today.getMonth() + 3) / 3);
}

function createLeagueFolderPath(identifier) {
  return "./league_data/" + identifier;
}

function createLeagueLadderFilePath(year, quarter) {
  if (quarter) {
    return "./league_ladder/_" + year + "_0" + quarter + ".json";
  } else {
    return "./league_ladder/_" + year + ".json";
  }
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
  getCurrentQuarter,
  createLeagueLadderFilePath
};
