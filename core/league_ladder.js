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

function distributePointsForLadders(data) {
  let dsqLiqParticipants = getDSQLIQParticipants(data);
  let best10Participants = getBest10Participants(data);

  distributePointsForYearLadder(best10Participants, dsqLiqParticipants);

  distributePointsForQuarterLadder(
    league_helper.getCurrentQuarter(),
    best10Participants,
    dsqLiqParticipants
  );
}

function distributePointsForYearLadder(best10Participants, dsqLiqParticipants) {
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

  for (let index = 0; index < best10Participants.length; index++) {
    const element = best10Participants[index];
    const indexInLadder = _.findIndex(ladderData.participants, function(o) {
      return o.email == element.email;
    });

    if (indexInLadder != -1) {
      ladderData.participants[indexInLadder].points +=
        leagueLadderPoints[(index + 1).toString()];
    } else {
      ladderData.participants.push({
        username: element.username,
        account: element.account,
        points: leagueLadderPoints[(index + 1).toString()]
      });
    }
  }

  for (let index = 0; index < dsqLiqParticipants.length; index++) {
    const element = dsqLiqParticipants[index];
    const indexInLadder = _.findIndex(ladderData.participants, function(o) {
      return o.email == element.email;
    });

    if (indexInLadder != -1) {
      ladderData.participants[indexInLadder].points +=
        leagueLadderPoints.LIQDSQ;
    } else {
      ladderData.participants.push({
        email: element.email,
        username: element.username,
        account: element.account,
        points: leagueLadderPoints.LIQDSQ
      });
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(ladderData));
}

function distributePointsForQuarterLadder(
  quarter,
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

  for (let index = 0; index < best10Participants.length; index++) {
    const element = best10Participants[index];
    const indexInLadder = _.findIndex(ladderData.participants, function(o) {
      return o.email == element.email;
    });

    if (indexInLadder != -1) {
      ladderData.participants[indexInLadder].points +=
        leagueLadderPoints[(index + 1).toString()];
    } else {
      ladderData.participants.push({
        email: element.email,
        username: element.username,
        account: element.account,
        points: leagueLadderPoints[(index + 1).toString()]
      });
    }
  }

  for (let index = 0; index < dsqLiqParticipants.length; index++) {
    const element = dsqLiqParticipants[index];
    const indexInLadder = _.findIndex(ladderData.participants, function(o) {
      return o.email == element.email;
    });

    if (indexInLadder != -1) {
      ladderData.participants[indexInLadder].points +=
        leagueLadderPoints.LIQDSQ;
    } else {
      ladderData.participants.push({
        email: element.email,
        username: element.username,
        account: element.account,
        points: leagueLadderPoints.LIQDSQ
      });
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(ladderData));
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

module.exports = {
  distributePointsForLadders
};
