const leagueInputDataFile = "./league_data/input.json";
const callForLeagueDataFile = "./league_data/call_for_league.json";

const fs = require("fs");
const axios = require("axios");
const crypto = require("crypto");
const encrypt_decrypt = require("../../../core/encrypt_decrypt.js");

async function validateApiKeyAndSecret(apiKey, apiSecret) {
  var verb = "GET",
    path = "/api/v1/user/walletSummary?currency=XBt",
    expires = Math.round(new Date().getTime() / 1000) + 60;

  var signature = crypto
    .createHmac("sha256", apiSecret)
    .update(verb + path + expires)
    .digest("hex");

  var headers = {
    "content-type": "application/json",
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "api-expires": expires,
    "api-key": apiKey,
    "api-signature": signature
  };

  const requestConfig = {
    headers: headers,
    baseURL: "https://www.bitmex.com",
    url: path,
    method: "GET"
  };

  try {
    let res = await axios.request(requestConfig);
    if (res.status === 200) {
      return true;
    } else {
      console.log(data);
      return false;
    }
  } catch (error) {
    console.log(error.response);
    return false;
  }
}

module.exports = {
  comingLeagues: async ctx => {
    if (!fs.existsSync(callForLeagueDataFile)) {
      fs.writeFileSync(
        callForLeagueDataFile,
        JSON.stringify({
          coming_leagues: []
        })
      );
    }

    let rawdata = fs.readFileSync(callForLeagueDataFile);
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
    if (!fs.existsSync(callForLeagueDataFile)) {
      fs.writeFileSync(
        callForLeagueDataFile,
        JSON.stringify({
          coming_leagues: []
        })
      );
    }

    let rawdata = fs.readFileSync(callForLeagueDataFile);
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
        callForLeagueDataFile,
        JSON.stringify(callForLeagueData)
      );
    }

    ctx.send({
      isValid: validatedData.isValid,
      error: validatedData.error
    });
  },

  index: async ctx => {
    let rawdata = fs.readFileSync(leagueInputDataFile);
    let leagueData = JSON.parse(rawdata);
    let files = getReadingFiles(leagueData.leagueUniqueIdentifier);

    if (files.length === 0) {
      ctx.send({});
    } else {
      let lastFileName = files[files.length - 1];
      let rawFiledata = fs.readFileSync(
        "./league_data/" +
          leagueData.leagueUniqueIdentifier +
          "/" +
          lastFileName
      );
      let lastReadingData = JSON.parse(rawFiledata);

      let participantsArray = getValues(lastReadingData.participants);
      lastReadingData.participants = participantsArray;

      ctx.send(lastReadingData);
    }
  }
};

function hashSecret(apiSecret) {
  let encrypted = encrypt_decrypt.encrypt(apiSecret);
  return encrypted;
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
  if (new Date(signingLimitDate) < now) {
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
      error: "Niektóre dane powielają się z juz zapisanym uczestnikiem."
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
    return b.roeCurrent - a.roeCurrent;
  }

  if (a.isRekt && b.isRekt) {
    return b.roeCurrent - a.roeCurrent;
  }

  if (a.isRetarded) {
    return 1;
  }

  if (b.isRetarded) {
    return -1;
  }

  if (a.isRetarded) {
    return 1;
  }

  if (b.isRetarded) {
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
  var dir = "./league_data/" + leagueUniqueIdentifier;
  var files = fs.readdirSync(dir);
  return files;
}

function filterElementByKey(response, key) {
  return response.find(element => {
    return element.transactType === key;
  });
}
