const fs = require("fs");
const league_helper = require("./league_helper.js");

let leagueLadderPoints = {
  "1": 25,
  "2": 18,
  "3": 15,
  "4": 12,
  "5": 10,
  "6": 8,
  "7": 6,
  "8": 4,
  "9": 2,
  "10": 1,
  LIQDSQ: -10
};

function distributePointsForYearLadder(data) {
  let filePath = league_helper.createLeagueLadderFilePath(
    new Date().getFullYear()
  );

  let rawdata = fs.readFileSync("./league_history/test_reading.json");
  let leagueData = JSON.parse(rawdata);

  console.log(leagueData);
}

function distributePointsForQuarterLadder(quarter, data) {
  let filePath = league_helper.createLeagueLadderFilePath(
    new Date().getFullYear(),
    quarter
  );

  let rawdata = fs.readFileSync("./league_history/test_reading.json");
  let leagueData = JSON.parse(rawdata);

  console.log(filePath);
}

module.exports = {
  distributePointsForYearLadder,
  distributePointsForQuarterLadder
};
