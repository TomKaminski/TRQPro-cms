"use strict";

const leagueInputDataFile = "./league_data/input.json";
const fs = require("fs");

module.exports = {
  index: async ctx => {
    let rawdata = fs.readFileSync(leagueInputDataFile);
    let leagueData = JSON.parse(rawdata);
    let files = getReadingFiles(leagueData.leagueUniqueIdentifier);

    if (files.length === 0) {
      ctx.send({});
    }

    let lastFileName = files[files.length - 1];
    let rawFiledata = fs.readFileSync(
      "./league_data/" + leagueData.leagueUniqueIdentifier + "/" + lastFileName
    );
    let lastReadingData = JSON.parse(rawFiledata);

    console.log(lastReadingData.participants);
    let participantsArray = getValues(lastReadingData.participants);
    lastReadingData.participants = participantsArray;

    ctx.send(lastReadingData);
  }
};

function getValues(obj) {
  var values = [];
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      values.push(obj[key]);
    }
  }
  return values.sort(compareRoes);
}

function compareRoes(a, b) {
  return b.roeCurrent - a.roeCurrent;
}

function getReadingFiles(leagueUniqueIdentifier) {
  var dir = "./league_data/" + leagueUniqueIdentifier;
  var files = fs.readdirSync(dir);
  return files;
}
