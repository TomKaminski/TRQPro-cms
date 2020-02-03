"use strict";

require("dotenv").config();

const fs = require("fs");
const md5 = require("md5");
const schedule = require("node-schedule");
const axios = require("axios");
const moment = require("moment");
const _ = require("lodash");
const encrypt_decrypt = require("./core/encrypt_decrypt.js");
const league_helper = require("./core/league_helper.js");

moment.fn.toJSON = function() {
  return this.format();
};

// Start Strapi
const strapi = require("strapi");
strapi().start();

let md5Previous = null;
let fsWait = false;
let job = setupJob();

Object.findOne = function(obj, predicate) {
  for (var key in obj) {
    if (obj.hasOwnProperty(key) && predicate(obj[key])) {
      return obj[key];
    }
  }
  return null;
};

fs.watch(league_helper.leagueInputDataFile, (event, filename) => {
  if (filename) {
    if (fsWait) return;
    fsWait = setTimeout(() => {
      fsWait = false;
    }, 100);
    const md5Current = md5(fs.readFileSync(league_helper.leagueInputDataFile));
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
  if (!fs.existsSync(league_helper.leagueInputDataFile)) {
    fs.writeFileSync(league_helper.leagueInputDataFile, JSON.stringify({}));
  }

  let rawdata = fs.readFileSync(league_helper.leagueInputDataFile);
  let leagueData = JSON.parse(rawdata);

  if (leagueData.leagueUniqueIdentifier) {
    createLeagueFolderIfNotExists(leagueData);
    let files = getReadingFiles(leagueData.leagueUniqueIdentifier);

    if (files.length === 0) {
      console.log("Scheduling first reading for", leagueData.startDate);
      let job = schedule.scheduleJob(leagueData.startDate, function() {
        createReadingFile(leagueData);
      });
      return job;
    } else {
      let lastFileName = files[files.length - 1];
      let rawFiledata = fs.readFileSync(
        league_helper.createLeagueFilePath(
          leagueData.leagueUniqueIdentifier,
          lastFileName,
          false
        )
      );
      let lastReadingData = JSON.parse(rawFiledata);

      console.log(
        "Scheduling next reading for",
        lastReadingData.nextReadingDate
      );
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
  const dir = league_helper.createLeagueFolderPath(leagueUniqueIdentifier);
  var files = fs.readdirSync(dir);
  return files;
}

function createLeagueFolderIfNotExists(leagueData) {
  const dir = league_helper.createLeagueFolderPath(
    leagueData.leagueUniqueIdentifier
  );

  if (!fs.existsSync(dir)) {
    console.log("Creating league folder:", dir);
    fs.mkdirSync(dir);
  }
}

function saveReadingFile(leagueUniqueIdentifier, readingData) {
  var fileName = createReadingFileName(new Date(readingData.readingDate));
  fs.writeFileSync(
    league_helper.createLeagueFilePath(leagueUniqueIdentifier, fileName, true),
    JSON.stringify(readingData)
  );
}

function createReadingFile(leagueData, previousReadingFileData, filesInfo) {
  console.log("Creating reading file");
  var actions = [];
  if (previousReadingFileData) {
    actions = leagueData.participants.map(value => {
      let prevData = Object.findOne(
        previousReadingFileData.participants,
        participantData => participantData.email === value.email
      );
      return getParticipantCurrentWalletInfo(value, prevData);
    });
  } else {
    actions = leagueData.participants.map(getParticipantCurrentWalletInfo);
  }

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
    participants: {},
    totallyEmptyAccounts: []
  };

  Promise.all(actions).then(responses => {
    responses.forEach(response => {
      if (response.inner.status === 200) {
        let depositEntry = filterElementByKey(response.inner.data, "Deposit");
        let transferEntry = filterElementByKey(response.inner.data, "Transfer");
        let totalEntry = filterElementByKey(response.inner.data, "Total");

        if (!totalEntry) {
          console.log("---------");
          console.log("Total entry not found!");
          console.log(response.participant.username);
          console.log("---------");

          let { email, username } = response.participant;
          readingData.totallyEmptyAccounts.push({
            email,
            username
          });
          return;
        }

        var roeCurrent = 0;
        var startingBalance = totalEntry.marginBalance;
        var isRekt = false;
        var isRetarded = false;
        var nextRoes = [0];
        var tooLowBalance = false;

        if (previousReadingFileData) {
          if (
            !previousReadingFileData.participants[totalEntry.account.toString()]
          ) {
            console.log("---------");
            console.log(
              "Total entry found but previous file doesnt contain participant. Hacking!"
            );
            console.log(response.participant.username);
            console.log("---------");

            let { email, username } = response.participant;
            readingData.totallyEmptyAccounts.push({
              email,
              username
            });
            return;
          }

          roeCurrent = getRoe(
            previousReadingFileData.participants[totalEntry.account.toString()]
              .startingBalance,
            totalEntry.marginBalance
          );

          startingBalance =
            previousReadingFileData.participants[totalEntry.account.toString()]
              .startingBalance;

          tooLowBalance =
            previousReadingFileData.participants[totalEntry.account.toString()]
              .tooLowBalance === true || false;

          isRekt =
            previousReadingFileData.participants[totalEntry.account.toString()]
              .isRekt === true || roeCurrent <= -99.0;

          isRetarded =
            previousReadingFileData.participants[totalEntry.account.toString()]
              .isRetarded === true ||
            checkIfRetarded(
              previousReadingFileData.participants[
                totalEntry.account.toString()
              ],
              depositEntry,
              transferEntry
            );

          nextRoes = previousReadingFileData.participants[
            totalEntry.account.toString()
          ].roes
            ? previousReadingFileData.participants[
                totalEntry.account.toString()
              ].roes
            : [];
          nextRoes.push(Math.round(roeCurrent * 1e2) / 1e2);
        } else {
          if (startingBalance < 500000) {
            tooLowBalance = true;
          }
        }

        readingData.participants[totalEntry.account.toString()] = {
          balance: totalEntry.marginBalance,
          account: totalEntry.account,
          deposit: depositEntry,
          transfer: transferEntry,
          username: response.participant.username,
          email: response.participant.email,
          startingBalance: startingBalance,
          roeCurrent: roeCurrent,
          roe1d: null,
          roe3d: null,
          roe7d: null,
          roe14d: null,
          roeEnd: null,
          isRekt,
          isRetarded,
          tooLowBalance,
          roes: nextRoes
        };
      } else if (response.inner.status === 201) {
        readingData.participants[
          response.inner.previousData.account.toString()
        ] = response.inner.previousData;
      } else {
        let { email, username } = response.participant;
        readingData.totallyEmptyAccounts.push({
          email,
          username
        });
        return;
      }
    });

    readingData = get1dRoe(readingData, filesInfo);
    readingData = get3dRoe(readingData, filesInfo);
    readingData = get7dRoe(readingData, filesInfo);
    readingData = get14dRoe(readingData, filesInfo);

    if (isLastReading) {
      readingData = getEndRoe(readingData, filesInfo);
      readingData.hasEnded = true;

      distributePointsForLadders(readingData);
    }

    saveReadingFile(leagueData.leagueUniqueIdentifier, readingData);

    if (!isLastReading) {
      setupJob();
    }
  });
}

function checkIfRetarded(previousEntry, depositEntry, transferEntry) {
  return !(
    _.isEqual(previousEntry.deposit, depositEntry) &&
    _.isEqual(previousEntry.transfer, transferEntry)
  );
}

function getDayRoe(readingData, files, dayRoe, isEndRoe) {
  if (files && files.length > dayRoe - 1) {
    let index = isEndRoe ? 0 : files.length - dayRoe;
    let historicalFileName = files[index];

    let rawFiledata = fs.readFileSync(
      league_helper.createLeagueFilePath(
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

async function getParticipantCurrentWalletInfo(participant, previousData) {
  if (
    previousData &&
    (previousData.isRetarded ||
      previousData.isRekt ||
      previousData.tooLowBalance)
  ) {
    console.log("skip participant:" + participant.email);
    return {
      inner: {
        status: 201,
        previousData
      },
      participant
    };
  }

  var verb = "GET",
    path = league_helper.wallerSummaryApiPath,
    expires = Math.round(new Date().getTime() / 1000) + 60;

  const signature = encrypt_decrypt.getBitmexSignature(
    encrypt_decrypt.decrypt(participant.apiSecret),
    verb,
    path,
    expires
  );

  const headers = league_helper.generateApiHeaders(
    expires,
    participant.apiKey,
    signature
  );

  const requestConfig = league_helper.generateRequestConfig(
    headers,
    path,
    verb
  );

  try {
    return {
      inner: await axios.request(requestConfig),
      participant
    };
  } catch {
    return {
      inner: {
        status: 401
      },
      participant
    };
  }
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

function filterElementByKey(response, key) {
  return response.find(element => {
    return element.transactType === key;
  });
}
