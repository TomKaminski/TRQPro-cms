const fs = require("fs");
const axios = require("axios");
const moment = require("moment");

const encrypt_decrypt = require("../../../core/encrypt_decrypt.js");
const league_helper = require("../../../core/league_helper.js");
const bybit_service = require("../../../core/exchanges/bybit/bybit_service.js");

module.exports = {
  testBybit: async ctx => {
    await bybit_service.testByBit();
    ctx.send("DONE");
  },

  indexSmallData: async ctx => {
    let rawdata = fs.readFileSync(league_helper.leagueInputDataFile);
    let leagueData = JSON.parse(rawdata);
    let files = getReadingFiles(leagueData.leagueUniqueIdentifier);

    let endDate = moment(new Date(leagueData.endDate));
    let now = moment(new Date());

    if (files.length === 0 || endDate.diff(now, "days") <= -3) {
      ctx.send({
        isLeagueData: false,
        participantsCount: tryGetComingLeagueParticipantsCount()
      });
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

      let participantsArray = league_helper.getSortedParticipants(
        lastReadingData.participants
      );
      let smallArray = participantsArray.slice(0, 5).map(participant => {
        return {
          name: participant.username,
          roe: participant.roeCurrent,
          tooLowBalance: participant.tooLowBalance,
          isRekt: participant.isRekt,
          isRetarded: participant.isRetarded
        };
      });

      ctx.send({
        isLeagueData: true,
        participants: smallArray,
        hasEnded: lastReadingData.hasEnded
      });
    }
  },

  checkRefferalsForNearestComingLeague: async ctx => {
    let rawdata = fs.readFileSync(league_helper.callForLeagueDataFile);
    let callForLeagueData = JSON.parse(rawdata);
    let comingLeagues = callForLeagueData.coming_leagues;

    let key = Object.keys(comingLeagues)[0];
    var actions = comingLeagues[key].participants.map(validateRefferal);

    await Promise.all(actions).then(responses => {
      ctx.send(responses);
    });
  },

  comingLeagues: async ctx => {
    if (!fs.existsSync(league_helper.callForLeagueDataFile)) {
      fs.writeFileSync(
        league_helper.callForLeagueDataFile,
        JSON.stringify({
          coming_leagues: []
        })
      );
    }

    let rawdata = fs.readFileSync(league_helper.callForLeagueDataFile);
    let json = JSON.parse(rawdata);
    let jsonArray = league_helper.getSortedParticipants(json.coming_leagues);
    let result = [];

    jsonArray.forEach(league => {
      delete league.participants;
      result.push(league);
    });
    ctx.send(result);
  },

  getLadderForYear: async ctx => {
    let year = getParam(ctx.request.url, "year");
    let leagueLadderFolderPath = league_helper.createLeagueLadderFolderPath(
      year
    );

    if (!fs.existsSync(leagueLadderFolderPath)) {
      ctx.send({});
      return;
    }

    var files = fs.readdirSync(leagueLadderFolderPath);

    if (files.length === 0) {
      ctx.send({});
      return;
    } else {
      var ladderArray = [];
      files.forEach(fileName => {
        let rawFiledata = fs.readFileSync(
          leagueLadderFolderPath + "/" + fileName
        );
        let ladderData = JSON.parse(rawFiledata);

        let resultParticipants = [];

        ladderData.participants.forEach(participant => {
          delete participant.email;
          resultParticipants.push(participant);
        });

        ladderData.participants = resultParticipants;
        ladderArray.push(ladderData);
      });
      ctx.send(ladderArray);
      return;
    }
  },

  joinLeague: async ctx => {
    if (!fs.existsSync(league_helper.callForLeagueDataFile)) {
      fs.writeFileSync(
        league_helper.callForLeagueDataFile,
        JSON.stringify({
          coming_leagues: []
        })
      );
    }

    let rawdata = fs.readFileSync(league_helper.callForLeagueDataFile);
    let callForLeagueData = JSON.parse(rawdata);

    let jsonBody = ctx.request.body;

    if (
      !(
        jsonBody.hasOwnProperty("league") &&
        callForLeagueData.coming_leagues[jsonBody.league] != null
      )
    ) {
      ctx.send({
        isValid: false,
        error: "Zły identyfikator ligi."
      });
      return;
    }

    if (jsonBody.saveForAllLeaguesAtCurrentQuarter === true) {
      let mainLeagueData = callForLeagueData.coming_leagues[jsonBody.league];
      let quarterCode = mainLeagueData.quarter;

      var validityResult;
      for (var key in callForLeagueData.coming_leagues) {
        if (callForLeagueData.coming_leagues.hasOwnProperty(key)) {
          let leagueData = callForLeagueData.coming_leagues[key];
          if (leagueData.quarter === quarterCode) {
            let validatedData = await validateJoinLeagueData(
              jsonBody,
              leagueData.participants,
              leagueData.signingLimitDate
            );

            validityResult = validatedData;
            if (!validatedData.isValid) {
              break;
            }
          }
        }
      }

      if (validityResult.isValid) {
        for (var key in callForLeagueData.coming_leagues) {
          if (callForLeagueData.coming_leagues.hasOwnProperty(key)) {
            let leagueData = callForLeagueData.coming_leagues[key];
            if (leagueData.quarter === quarterCode) {
              callForLeagueData.coming_leagues[key].participants.push({
                username: jsonBody.nickname,
                email: jsonBody.email,
                apiKey: jsonBody.apiKey,
                apiSecret: validityResult.hashedApiSecret
              });
            }
          }
        }

        fs.writeFileSync(
          league_helper.callForLeagueDataFile,
          JSON.stringify(callForLeagueData)
        );
      }
      ctx.send({
        isValid: validityResult.isValid,
        error: validityResult.error
      });
      return;
    } else {
      let validatedData = await validateJoinLeagueData(
        jsonBody,
        callForLeagueData.coming_leagues[jsonBody.league].participants,
        callForLeagueData.coming_leagues[jsonBody.league].signingLimitDate
      );

      if (validatedData.isValid) {
        callForLeagueData.coming_leagues[jsonBody.league].participants.push({
          username: jsonBody.nickname,
          email: jsonBody.email,
          apiKey: jsonBody.apiKey,
          apiSecret: validatedData.hashedApiSecret
        });

        fs.writeFileSync(
          league_helper.callForLeagueDataFile,
          JSON.stringify(callForLeagueData)
        );
      }

      ctx.send({
        isValid: validatedData.isValid,
        error: validatedData.error
      });
    }
  },

  index: async ctx => {
    let rawdata = fs.readFileSync(league_helper.leagueInputDataFile);
    let leagueData = JSON.parse(rawdata);
    let files = getReadingFiles(leagueData.leagueUniqueIdentifier);

    let endDate = moment(new Date(leagueData.endDate));
    let now = moment(new Date());

    if (files.length === 0 || endDate.diff(now, "days") <= -3) {
      ctx.send(tryGetNearestComingLeague());
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

      let participantsArray = league_helper.getSortedParticipants(
        lastReadingData.participants
      );

      var participantsResult = [];
      participantsArray.forEach(participant => {
        delete participant.email;

        participantsResult.push(participant);
      });

      lastReadingData.participants = participantsResult;

      ctx.send(lastReadingData);
    }
  }
};

async function validateApiKeyAndSecret(apiKey, apiSecret) {
  var verb = "GET",
    path = league_helper.wallerSummaryApiPath,
    expires = Math.round(new Date().getTime() / 1000) + 60;

  const signature = encrypt_decrypt.getBitmexSignature(
    apiSecret,
    verb,
    path,
    expires
  );

  const headers = league_helper.generateApiHeaders(expires, apiKey, signature);
  const config = league_helper.generateRequestConfig(headers, path, verb);

  try {
    let res = await axios.request(config);
    if (res.status === 200) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
}

async function validateRefferal(participant) {
  var verb = "GET",
    path = league_helper.affliateStatusApiPath,
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
  const config = league_helper.generateRequestConfig(headers, path, verb);

  try {
    let res = await axios.request(config);
    if (res.status === 200) {
      return {
        nick: participant.username,
        refId: res.data.referrerAccount
      };
    } else {
      return {
        nick: participant.username,
        refId: -1
      };
    }
  } catch (error) {
    return {
      nick: participant.username,
      refId: -1
    };
  }
}

function tryGetComingLeagueParticipantsCount() {
  let rawdata = fs.readFileSync(league_helper.callForLeagueDataFile);
  let callForLeagueData = JSON.parse(rawdata);
  let comingLeagues = callForLeagueData.coming_leagues;

  for (var key in comingLeagues) {
    if (comingLeagues.hasOwnProperty(key)) {
      return comingLeagues[key].participants.length;
    }
  }
  return 0;
}

function tryGetNearestComingLeague() {
  let rawdata = fs.readFileSync(league_helper.callForLeagueDataFile);
  let callForLeagueData = JSON.parse(rawdata);
  let comingLeagues = callForLeagueData.coming_leagues;

  for (var key in comingLeagues) {
    if (comingLeagues.hasOwnProperty(key)) {
      let {
        id,
        name,
        startDate,
        endDate,
        signingLimitDate,
        participants
      } = comingLeagues[key];
      let participantsResult = [];

      participants.forEach(participant => {
        delete participant.apiKey;
        delete participant.apiSecret;

        participantsResult.push(participant);
      });

      let result = {
        isComingLeague: true,
        leagueUniqueIdentifier: id,
        participants: participantsResult,
        name,
        startDate,
        endDate,
        signingLimitDate
      };
      return result;
    }
  }
  return {};
}

function hashSecret(apiSecret) {
  return encrypt_decrypt.encrypt(apiSecret);
}

function isNullOrEmpty(data) {
  return data === undefined || data === null || data === "";
}

async function validateJoinLeagueData(data, participants, signingLimitDate) {
  if (
    isNullOrEmpty(data.apiSecret) ||
    isNullOrEmpty(data.apiKey) ||
    isNullOrEmpty(data.nickname) ||
    isNullOrEmpty(data.email)
  ) {
    return {
      isValid: false,
      error: "Nieprawidłowe dane."
    };
  }

  if (new Date(signingLimitDate) < new Date()) {
    return {
      isValid: false,
      error: "Zapisy na wybraną ligę są zakończone."
    };
  }

  if ((await validateApiKeyAndSecret(data.apiKey, data.apiSecret)) === false) {
    return {
      isValid: false,
      error: "Podane klucze API są nieprawidłowe."
    };
  }

  let hashedApiSecret = hashSecret(data.apiSecret);

  if (
    participants.find(item => {
      return (
        item.apiKey === data.apiKey ||
        item.hashedApiSecret === hashedApiSecret ||
        item.email === data.email ||
        item.username === data.nickname
      );
    })
  ) {
    return {
      isValid: false,
      error: "Niektóre dane powielają się z już zapisanym uczestnikiem."
    };
  }

  return {
    isValid: true,
    hashedApiSecret: hashedApiSecret,
    error: null
  };
}

function getReadingFiles(leagueUniqueIdentifier) {
  if (
    leagueUniqueIdentifier === undefined ||
    leagueUniqueIdentifier === null ||
    leagueUniqueIdentifier === ""
  ) {
    return [];
  }
  const dir = league_helper.createLeagueFolderPath(leagueUniqueIdentifier);
  var files = fs.readdirSync(dir);
  return files;
}

function getParam(url, name) {
  if (
    (name = new RegExp("[?&]" + encodeURIComponent(name) + "=([^&]*)").exec(
      url
    ))
  )
    return decodeURIComponent(name[1]);
}
