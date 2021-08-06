"use strict";

const fs = require("fs");
const md5 = require("md5");
const schedule = require("node-schedule");
const moment = require("moment");

const league_helper = require("./core/league_helper.js");
const league_ladder = require("./core/league_ladder.js");
const bitmex_service = require("./core/exchanges/bitmex/bitmex_service.js");
const bybit_service = require("./core/exchanges/bybit/bybit_service.js");
const binance_service = require("./core/exchanges/binance/binance_service.js");

const dotenv = require("dotenv");
const strapi = require("strapi");

moment.fn.toJSON = function () {
  return this.format();
};

dotenv.config();
strapi().start();

let md5Previous = null;
let fsWait = false;
let job = setupJob();

Object.findOne = function (obj, predicate) {
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
    league_helper.createLeagueFolderIfNotExists(leagueData);
    let files = league_helper.getReadingFiles(
      leagueData.leagueUniqueIdentifier
    );

    if (files.length === 0) {
      console.log("Scheduling first reading for", leagueData.startDate);
      let job = schedule.scheduleJob(leagueData.startDate, function () {
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

      if (!lastReadingData.hasEnded) {
        console.log(
          "Scheduling next reading for",
          lastReadingData.nextReadingDate
        );
        let job = schedule.scheduleJob(
          lastReadingData.nextReadingDate,
          function () {
            createReadingFile(leagueData, lastReadingData, files);
          }
        );
        return job;
      }
    }
  }
}

function createReadingFile(leagueData, previousReadingFileData, filesInfo) {
  var actions = [];
  if (previousReadingFileData) {
    actions = leagueData.participants.map((value) => {
      let prevData = Object.findOne(
        previousReadingFileData.participants,
        (participantData) => participantData.email === value.email
      );
      if (value.exchange === "bitmex") {
        return bitmex_service.getParticipantCurrentWalletInfo(value, prevData);
      } else if (value.exchange === "binance") {
        return binance_service.getUserReading(
          value,
          prevData,
          moment(leagueData.startDate).unix() * 1000
        );
      } else {
        return bybit_service.getUserReading(
          value,
          prevData,
          previousReadingFileData.readingDate
        );
      }
    });
  } else {
    actions = leagueData.participants.map((participant) => {
      if (participant.exchange === "bitmex") {
        return bitmex_service.getParticipantCurrentWalletInfo(participant);
      } else if (participant.exchange === "binance") {
        return binance_service.getUserReading(
          participant,
          null,
          moment(leagueData.startDate).unix() * 1000
        );
      } else {
        return bybit_service.getUserReading(participant);
      }
    });
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
    totallyEmptyAccounts: [],
  };

  //todo: better handle dis tickers :)
  bybit_service.getBybitTickers().then((symbols) => {
    Promise.all(actions).then((responses) => {
      responses.forEach((response) => {
        if (response.participant.exchange === "bitmex") {
          bitmex_service.processParticipantReading(
            response,
            readingData,
            previousReadingFileData
          );
        } else if (response.participant.exchange === "binance") {
          binance_service.processParticipantReading(
            response,
            readingData,
            previousReadingFileData
          );
        } else {
          bybit_service.processParticipantReading(
            response,
            readingData,
            previousReadingFileData,
            symbols
          );
        }
      });

      readingData = league_helper.get1dRoe(readingData, filesInfo);
      readingData = league_helper.get3dRoe(readingData, filesInfo);
      readingData = league_helper.get7dRoe(readingData, filesInfo);
      readingData = league_helper.get14dRoe(readingData, filesInfo);

      if (isLastReading) {
        readingData = league_helper.changeZombieToDSQOnLeagueEnd(readingData);
        readingData = league_helper.changeIdleAccountsToDSQOnLeagueEnd(
          readingData
        );
        readingData = league_helper.getEndRoe(readingData, filesInfo);
        if (leagueData.includeInRanking) {
          league_ladder.distributePointsForLadders(
            readingData,
            leagueData.quarter
          );
        }
        readingData.hasEnded = true;
      } else {
        readingData.hasEnded = false;
      }

      league_helper.saveReadingFile(
        leagueData.leagueUniqueIdentifier,
        readingData
      );

      if (!isLastReading) {
        setupJob();
      }
    });
  });
}
