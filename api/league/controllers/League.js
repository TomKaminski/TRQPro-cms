"use strict";

const leagueInputDataFile = "./league_data/input.json";
const callForLeagueDataFile = "./league_data/call_for_league.json";

const fs = require("fs");
const axios = require("axios");
const crypto = require("crypto");

var apiKey = "KtfzIaFbquYkNTCUs7VNJYZW";
var apiSecret = "XnYdNCCpCNkDnofcW0YeR4g5CKnGN3G8Z30_N5DfuZ-UPrg3";

function filterElementByKey(response, key) {
  return response.find(element => {
    return element.transactType === key;
  });
}

module.exports = {
  hello: async ctx => {
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

    await axios
      .request(requestConfig)
      .then(function(response) {
        let depositEntry = filterElementByKey(response.data, "Deposit");
        let transferEntry = filterElementByKey(response.data, "Transfer");
        let totalEntry = filterElementByKey(response.data, "Total");

        ctx.send({
          deposit: depositEntry,
          transfer: transferEntry,
          total: totalEntry
        });
      })
      .catch(function(error) {
        ctx.send(error);
      });
  },

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
    console.log(jsonBody.league);

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

    let validatedData = validateJoinLeagueData(
      jsonBody,
      callForLeagueData.coming_leagues[jsonBody.league].participants,
      callForLeagueData.coming_leagues[jsonBody.league].signingLimitDate
    );

    if (validatedData.isValid) {
      callForLeagueData.coming_leagues[jsonBody.league].participants.push({
        username: jsonBody.nickname,
        email: jsonBody.email,
        apiKey: jsonBody.apiKey,
        apiSecret: jsonBody.apiSecret
      });

      fs.writeFileSync(
        callForLeagueDataFile,
        JSON.stringify(callForLeagueData)
      );
    }

    ctx.send(validatedData);
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

function validateKeys(key, secret) {
  return true;
}

function hashSecret(secret) {
  return secret;
}

function isNullOrEmpty(data) {
  console.log(data);
  return data === undefined || data === null || data === "";
}

function validateJoinLeagueData(data, participants, signingLimitDate) {
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

  if (validateKeys(data.apiKey, data.apiSecret) === false) {
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
  var dir = "./league_data/" + leagueUniqueIdentifier;
  var files = fs.readdirSync(dir);
  return files;
}
