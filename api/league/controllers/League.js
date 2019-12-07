const fs = require("fs");
const axios = require("axios");
const moment = require("moment");

const encrypt_decrypt = require("../../../core/encrypt_decrypt.js");
const league_helper = require("../../../core/league_helper.js");

module.exports = {
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
    let jsonArray = getValues(json.coming_leagues);
    let result = [];

    jsonArray.forEach(league => {
      delete league.participants;
      result.push(league);
    });
    ctx.send(result);
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

      let participantsArray = getValues(lastReadingData.participants);
      lastReadingData.participants = participantsArray;

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
    console.log(error.response);
    return false;
  }
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

  let now = new Date();
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
