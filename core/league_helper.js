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

function determineExchangeType(key) {
  if (key.includes("bybit_")) {
    return "bybit";
  } else if (key.includes("bitmex_")) {
    return "bitmex";
  } else if (key.includes("binance_")) {
    return "binance";
  }
}

function getSortedParticipants(obj) {
  var values = [];
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      let objToPush = obj[key];
      objToPush.exchange = determineExchangeType(key);
      values.push(objToPush);
    }
  }
  return values.sort(compareRoes);
}

function getArray(obj) {
  var values = [];
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      values.push(obj[key]);
    }
  }
  return values;
}

function compareLadderFiles(a, b, year) {
  var today = new Date();
  let fullYear = today.getFullYear().toString();
  var quarter = Math.floor((today.getMonth() + 3) / 3);

  if (year !== fullYear) {
    return 1;
  }

  if (a.includes(year + "_")) {
    return a.includes("_0" + quarter) ? -1 : 1;
  }

  if (b.includes(year + "_")) {
    return b.includes("_0" + quarter) ? 1 : -1;
  }

  return 1;
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

function changeZombieToDSQOnLeagueEnd(readingData) {
  let participantsToCompute = _.omitBy(
    readingData.participants,
    (o) => o.isRekt || o.isRetarded || o.tooLowBalance
  );

  for (var key in participantsToCompute) {
    if (
      readingData.participants.hasOwnProperty(key) &&
      readingData.participants[key].isZombie === true
    ) {
      readingData.participants[key].isZombie = false;
      readingData.participants[key].isRetarded = true;
    }
  }

  return readingData;
}

function changeIdleAccountsToDSQOnLeagueEnd(readingData) {
  let participantsToCompute = _.omitBy(
    readingData.participants,
    (o) => !o.roes.every((item) => item === 0)
  );

  for (var key in participantsToCompute) {
    if (
      readingData.participants.hasOwnProperty(key) &&
      !readingData.participants[key].isRekt &&
      !readingData.participants[key].isRetarded &&
      !readingData.participants[key].tooLowBalance
    ) {
      readingData.participants[key].isRetarded = true;
    }
  }

  return readingData;
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
    let participantsToCompute = _.omitBy(
      readingData.participants,
      (o) => o.isRekt || o.isRetarded || o.tooLowBalance
    );

    for (var key in participantsToCompute) {
      if (
        readingData.participants.hasOwnProperty(key) &&
        historicalData.participants.hasOwnProperty(key)
      ) {
        let roePropName = isEndRoe ? "roeEnd" : "roe" + dayRoe + "d";
        readingData.participants[key][roePropName] = getRoe(
          historicalData.participants[key].balance,
          readingData.participants[key].balance
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
  createLeagueLadderFilePath,
  createLeagueHistoryFolderPath,
  getSortedParticipants,
  getArray,
  compareRoes,
  createLeagueLadderFolderPath,
  compareLadderFiles,
  changeZombieToDSQOnLeagueEnd,
  changeIdleAccountsToDSQOnLeagueEnd,
};
