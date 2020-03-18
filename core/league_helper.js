const leagueInputDataFile = "./league_data/input.json";
const callForLeagueDataFile = "./league_data/call_for_league.json";

const fs = require("fs");

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

function createLeagueLadderFolderPath(year) {
  return "./league_ladder/" + year;
}

function createLeagueLadderFilePath(year, quarter) {
  if (!fs.existsSync("./league_ladder/" + year)) {
    fs.mkdirSync("./league_ladder/" + year);
  }

  if (quarter) {
    return (
      "./league_ladder/" + year + "/ladder_" + year + "_0" + quarter + ".json"
    );
  } else {
    return "./league_ladder/" + year + "/ladder_" + year + ".json";
  }
}

function createLeagueHistoryFolderPath() {
  return "./league_history";
}

function getSortedParticipants(obj) {
  var values = [];
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      values.push(obj[key]);
    }
  }
  return values.sort(compareRoes);
}

function compareRoes(a, b) {
  if (a.isRetarded && b.isRetarded) {
    return b.roes.length - a.roes.length < 0 ? -1 : 1;
  }

  if (a.isRekt && b.isRekt) {
    return b.roes.length - a.roes.length < 0 ? -1 : 1;
  }

  if (a.tooLowBalance && b.tooLowBalance) {
    return b.roeCurrent - a.roeCurrent;
  }

  if (a.isRetarded) {
    return 1;
  }

  if (b.isRetarded) {
    return -1;
  }

  if (a.tooLowBalance) {
    return 1;
  }

  if (b.tooLowBalance) {
    return -1;
  }

  if (a.isRekt) {
    return 1;
  }

  if (b.isRekt) {
    return -1;
  }

  return b.roeCurrent - a.roeCurrent;
}

module.exports = {
  createLeagueFilePath,
  createLeagueFolderPath,
  leagueInputDataFile,
  callForLeagueDataFile,
  getCurrentQuarter,
  createLeagueLadderFilePath,
  createLeagueHistoryFolderPath,
  getSortedParticipants,
  compareRoes,
  createLeagueLadderFolderPath
};
