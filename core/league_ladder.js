const fs = require("fs");
const league_helper = require("./league_helper.js");
const _ = require("lodash");

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

function getRoe(prev, current) {
  let roe = (current / prev) * 100 - 100;
  return roe;
}

function distributePointsForLadders(data) {
  let dsqLiqParticipants = getDSQLIQParticipants(data);
  let best10Participants = getBest10Participants(data);

  let baseData = Object.keys(data.participants).map(function(key) {
    let participant = data.participants[key];
    let currentLeagueRoe = getRoe(
      participant.startingBalance,
      participant.balance
    );
    return {
      email: participant.email,
      username: participant.username,
      account: participant.account,
      points: 0,
      startingBalanceSum: participant.startingBalance,
      endingBalanceSum: participant.balance,
      leagues: 1,
      overallRoe: currentLeagueRoe,
      bestRoe: currentLeagueRoe
    };
  });

  distributePointsForYearLadder(
    baseData,
    best10Participants,
    dsqLiqParticipants
  );

  distributePointsForQuarterLadder(
    league_helper.getCurrentQuarter(),
    baseData,
    best10Participants,
    dsqLiqParticipants
  );
}

function distributePointsForYearLadder(
  baseData,
  best10Participants,
  dsqLiqParticipants
) {
  let fullYear = new Date().getFullYear();
  let filePath = league_helper.createLeagueLadderFilePath(fullYear);

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        participants: [],
        ladder_unique_identifier: "ladder_" + fullYear,
        ladder_public_name: "Ranking roczny " + fullYear
      })
    );
  }

  let rawdata = fs.readFileSync(filePath);
  let ladderData = JSON.parse(rawdata);

  processLadderData(
    baseData,
    ladderData,
    best10Participants,
    dsqLiqParticipants
  );

  fs.writeFileSync(filePath, JSON.stringify(ladderData));
}

function distributePointsForQuarterLadder(
  quarter,
  baseData,
  best10Participants,
  dsqLiqParticipants
) {
  let fullYear = new Date().getFullYear();
  let filePath = league_helper.createLeagueLadderFilePath(fullYear, quarter);

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        participants: [],
        ladder_unique_identifier: "ladder_" + fullYear + "_0" + quarter,
        ladder_public_name: "Ranking kwartalny " + quarter + "/" + fullYear
      })
    );
  }

  let rawdata = fs.readFileSync(filePath);
  let ladderData = JSON.parse(rawdata);

  processLadderData(
    baseData,
    ladderData,
    best10Participants,
    dsqLiqParticipants
  );

  fs.writeFileSync(filePath, JSON.stringify(ladderData));
}

function processLadderData(
  baseData,
  ladderData,
  best10Participants,
  dsqLiqParticipants
) {
  for (let index = 0; index < baseData.length; index++) {
    const element = baseData[index];
    const indexInLadder = _.findIndex(ladderData.participants, function(o) {
      return o.email == element.email || o.account == element.account;
    });
    if (indexInLadder == -1) {
      ladderData.participants.push({
        email: element.email,
        username: element.username,
        account: element.account,
        points: 0,
        startingBalanceSum: element.startingBalanceSum,
        endingBalanceSum: element.endingBalanceSum,
        leagues: 1,
        overallRoe: element.overallRoe,
        bestRoe: element.bestRoe
      });
    } else {
      ladderData.participants[indexInLadder].startingBalanceSum +=
        element.startingBalanceSum;
      ladderData.participants[indexInLadder].endingBalanceSum +=
        element.endingBalanceSum;
      ladderData.participants[indexInLadder].leagues += 1;
      ladderData.participants[indexInLadder].overallRoe = getRoe(
        ladderData.participants[indexInLadder].startingBalanceSum,
        ladderData.participants[indexInLadder].endingBalanceSum
      );
      if (ladderData.participants[indexInLadder].bestRoe < element.bestRoe) {
        ladderData.participants[indexInLadder].bestRoe = element.bestRoe;
      }
    }
  }
  for (let index = 0; index < best10Participants.length; index++) {
    const element = best10Participants[index];
    const indexInLadder = _.findIndex(ladderData.participants, function(o) {
      return o.email == element.email || o.account == element.account;
    });
    if (indexInLadder != -1) {
      ladderData.participants[indexInLadder].points +=
        leagueLadderPoints[(index + 1).toString()];
    }
  }
  for (let index = 0; index < dsqLiqParticipants.length; index++) {
    const element = dsqLiqParticipants[index];
    const indexInLadder = _.findIndex(ladderData.participants, function(o) {
      return o.email == element.email || o.account == element.account;
    });
    if (indexInLadder != -1) {
      ladderData.participants[indexInLadder].points +=
        leagueLadderPoints.LIQDSQ;
    }
  }

  ladderData.participants.sort(compareRoes);
}

function getDSQLIQParticipants(data) {
  let dsqLiqArray = [];

  for (var key in data.participants) {
    if (data.participants.hasOwnProperty(key)) {
      let participant = data.participants[key];
      if (participant.isRekt || participant.isRetarded) {
        dsqLiqArray.push(participant);
      }
    }
  }

  return dsqLiqArray;
}

function getBest10Participants(data) {
  let participantsArray = league_helper.getSortedParticipants(
    data.participants
  );
  return participantsArray.slice(0, 10);
}

function compareRoes(a, b) {
  if (a.points === b.points) {
    if (a.leagues === b.leagues) {
      return b.bestRoe - a.bestRoe;
    }
    return b.leagues - a.leagues;
  }

  return b.points - a.points;
}

module.exports = {
  distributePointsForLadders
};
