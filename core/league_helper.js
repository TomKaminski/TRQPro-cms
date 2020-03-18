const _ = require("lodash");

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

function createLeagueFolderIfNotExists(leagueData) {
  const dir = createLeagueFolderPath(leagueData.leagueUniqueIdentifier);

  if (!fs.existsSync(dir)) {
    console.log("Creating league folder:", dir);
    fs.mkdirSync(dir);
  }
}

function getReadingFiles(leagueUniqueIdentifier) {
  const dir = createLeagueFolderPath(leagueUniqueIdentifier);
  var files = fs.readdirSync(dir);
  return files;
}

function saveReadingFile(leagueUniqueIdentifier, readingData) {
  var fileName = createReadingFileName(new Date(readingData.readingDate));
  fs.writeFileSync(
    createLeagueFilePath(leagueUniqueIdentifier, fileName, true),
    JSON.stringify(readingData)
  );
}

function createReadingFileName(date) {
  var datestring =
    date.getFullYear() +
    "_" +
    ("0" + (date.getMonth() + 1)).slice(-2) +
    "_" +
    ("0" + date.getDate()).slice(-2) +
    "_" +
    ("0" + date.getHours()).slice(-2) +
    "_" +
    ("0" + date.getMinutes()).slice(-2);
  return "reading_" + datestring;
}

function getDayRoe(readingData, files, dayRoe, isEndRoe) {
  if (files && files.length > dayRoe - 1) {
    let index = isEndRoe ? 0 : files.length - dayRoe;
    let historicalFileName = files[index];

    let rawFiledata = fs.readFileSync(
      createLeagueFilePath(
        readingData.leagueUniqueIdentifier,
        historicalFileName,
        false
      )
    );

    let historicalData = JSON.parse(rawFiledata);
    let participantsToCompute = _.filter(readingData.participants, item => {
      return !item.isRekt && !item.isRetarded && !item.tooLowBalance;
    });

    for (var key in participantsToCompute) {
      let { account } = participantsToCompute[key];
      if (
        readingData.participants.hasOwnProperty(account) &&
        historicalData.participants.hasOwnProperty(account)
      ) {
        let roePropName = isEndRoe ? "roeEnd" : "roe" + dayRoe + "d";
        readingData.participants[account][roePropName] = getRoe(
          historicalData.participants[account].balance,
          readingData.participants[account].balance
        );
      }
    }
  }

  return readingData;
}

function get1dRoe(readingData, files) {
  return getDayRoe(readingData, files, 1, false);
}

function get3dRoe(readingData, files) {
  return getDayRoe(readingData, files, 3, false);
}

function get7dRoe(readingData, files) {
  return getDayRoe(readingData, files, 7, false);
}

function get14dRoe(readingData, files) {
  return getDayRoe(readingData, files, 14, false);
}

function getEndRoe(readingData, files) {
  return getDayRoe(readingData, files, null, true);
}

function getRoe(prev, current) {
  let roe = (current / prev) * 100 - 100;
  return roe;
}

module.exports = {
  getRoe,
  getEndRoe,
  get14dRoe,
  get7dRoe,
  get3dRoe,
  get1dRoe,
  saveReadingFile,
  getReadingFiles,
  createLeagueFolderIfNotExists,
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
