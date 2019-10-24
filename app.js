"use strict";

const fs = require("fs");
const md5 = require("md5");
const schedule = require("node-schedule");
const axios = require("axios");
const crypto = require("crypto");
const moment = require("moment");

moment.fn.toJSON = function() {
  return this.format();
};

// Start Strapi
const strapi = require("strapi");
strapi().start();

const leagueInputDataFile = "./league_data/input.json";

let md5Previous = null;
let fsWait = false;
let job = setupJob();

fs.watch(leagueInputDataFile, (event, filename) => {
  if (filename) {
    if (fsWait) return;
    fsWait = setTimeout(() => {
      fsWait = false;
    }, 100);
    const md5Current = md5(fs.readFileSync(leagueInputDataFile));
    if (md5Current === md5Previous) {
      return;
    }
    md5Previous = md5Current;

    console.log(`${filename} file changed, restarting job...`);
    if (job) {
      job.cancel();
    }
    job = setupJob();
  }
});

function setupJob() {
  if (!fs.existsSync(leagueInputDataFile)) {
    fs.writeFileSync(leagueInputDataFile, JSON.stringify({}));
  }

  let rawdata = fs.readFileSync(leagueInputDataFile);
  let leagueData = JSON.parse(rawdata);

  if (leagueData.leagueUniqueIdentifier) {
    createLeagueFolderIfNotExists(leagueData);
    let files = getReadingFiles(leagueData.leagueUniqueIdentifier);

    if (files.length === 0) {
      let job = schedule.scheduleJob(leagueData.startDate, function() {
        createReadingFile(leagueData);
      });
      return job;
    } else {
      let lastFileName = files[files.length - 1];
      let rawFiledata = fs.readFileSync(
        "./league_data/" +
          leagueData.leagueUniqueIdentifier +
          "/" +
          lastFileName
      );
      let lastReadingData = JSON.parse(rawFiledata);

      let job = schedule.scheduleJob(
        lastReadingData.nextReadingDate,
        function() {
          createReadingFile(leagueData, lastReadingData, files);
        }
      );
      return job;
    }
  }
}

function getReadingFiles(leagueUniqueIdentifier) {
  var dir = "./league_data/" + leagueUniqueIdentifier;
  var files = fs.readdirSync(dir);
  return files;
}

function createLeagueFolderIfNotExists(leagueData) {
  var dir = "./league_data/" + leagueData.leagueUniqueIdentifier;

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
}

function saveReadingFile(leagueUniqueIdentifier, readingData) {
  var fileName = createReadingFileName(new Date(readingData.readingDate));
  fs.writeFileSync(
    "./league_data/" + leagueUniqueIdentifier + "/" + fileName + ".json",
    JSON.stringify(readingData)
  );
}

function createReadingFile(leagueData, previousReadingFileData, filesInfo) {
  var actions = leagueData.participants.map(getParticipantCurrentWalletInfo);

  var nextReadingDate = moment(
    new Date(
      previousReadingFileData
        ? previousReadingFileData.nextReadingDate
        : leagueData.startDate
    )
  )
    .add(1, "d")
    .format();

  let isLastReading = new Date(leagueData.endDate) <= new Date();

  var readingData = {
    leagueUniqueIdentifier: leagueData.leagueUniqueIdentifier,
    readingDate: previousReadingFileData
      ? previousReadingFileData.nextReadingDate
      : leagueData.startDate,
    startDate: leagueData.startDate,
    endDate: leagueData.endDate,
    nextReadingDate: nextReadingDate,
    participants: {}
  };

  Promise.all(actions).then(responses => {
    responses.forEach(response => {
      if (response.inner.status === 200) {
        readingData.participants[response.inner.data.account.toString()] = {
          balance: response.inner.data.amount,
          prevDeposited: response.inner.data.prevDeposited,
          account: response.inner.data.account,
          deposited: response.inner.data.deposited,
          username: response.participant.username,
          email: response.participant.email,
          startingBalance: previousReadingFileData
            ? previousReadingFileData.participants[
                response.inner.data.account.toString()
              ].startingBalance
            : response.inner.data.amount,
          roeCurrent: getRoe(
            previousReadingFileData
              ? previousReadingFileData.participants[
                  response.inner.data.account.toString()
                ].startingBalance
              : response.inner.data.amount,
            response.inner.data.amount
          ),
          roe1d: null,
          roe3d: null,
          roe7d: null,
          roe14d: null,
          roeEnd: null
        };
      }
    });

    readingData = get1dRoe(readingData, filesInfo);
    readingData = get3dRoe(readingData, filesInfo);
    readingData = get7dRoe(readingData, filesInfo);
    readingData = get14dRoe(readingData, filesInfo);

    if (isLastReading) {
      readingData = getEndRoe(readingData, filesInfo);
    }

    saveReadingFile(leagueData.leagueUniqueIdentifier, readingData);

    if (!isLastReading) {
      setupJob();
    }
  });
}

function getDayRoe(readingData, files, dayRoe, isEndRoe) {
  if (files && files.length > dayRoe - 1) {
    let index = isEndRoe ? 0 : files.length - dayRoe;
    let historicalFileName = files[index];
    let rawFiledata = fs.readFileSync(
      "./league_data/" +
        readingData.leagueUniqueIdentifier +
        "/" +
        historicalFileName
    );

    let historicalData = JSON.parse(rawFiledata);

    for (var key in readingData.participants) {
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

async function getParticipantCurrentWalletInfo(participant) {
  var verb = "GET",
    path = "/api/v1/user/wallet?currency=XBt",
    expires = Math.round(new Date().getTime() / 1000) + 60;

  var signature = crypto
    .createHmac("sha256", participant.apiSecret)
    .update(verb + path + expires)
    .digest("hex");

  var headers = {
    "content-type": "application/json",
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "api-expires": expires,
    "api-key": participant.apiKey,
    "api-signature": signature
  };

  const requestConfig = {
    headers: headers,
    baseURL: "https://www.bitmex.com",
    url: path,
    method: "GET"
  };

  return {
    inner: await axios.request(requestConfig),
    participant
  };
}

function createReadingFileName(date) {
  var datestring =
    ("0" + date.getDate()).slice(-2) +
    "_" +
    ("0" + (date.getMonth() + 1)).slice(-2) +
    "_" +
    date.getFullYear() +
    "_" +
    ("0" + date.getHours()).slice(-2) +
    "_" +
    ("0" + date.getMinutes()).slice(-2);
  return "reading_" + datestring;
}
