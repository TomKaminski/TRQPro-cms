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
  let filePath = league_helper.createLeagueLadderFilePath(Date().getFullYear());
  console.log(filePath);
}

function distributePointsForQuarterLadder(quarter, data) {
  let filePath = league_helper.createLeagueLadderFilePath(
    Date().getFullYear(),
    quarter
  );
  console.log(filePath);
}

module.exports = {
  distributePointsForYearLadder,
  distributePointsForQuarterLadder
};
