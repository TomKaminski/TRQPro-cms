const fs = require("fs");
const league_helper = require("../../../core/league_helper.js");

module.exports = {
  selectorData: async ctx => {
    let files = getHistoricalReadingFiles();
    ctx.send(files);
  },

  leagueData: async ctx => {
    let filename = getParam(ctx.request.url, "id");

    if (
      !fs.existsSync(
        league_helper.createLeagueHistoryFolderPath() + "/" + filename
      )
    ) {
      ctx.send({});
      return;
    }

    let rawFiledata = fs.readFileSync(
      league_helper.createLeagueHistoryFolderPath() + "/" + filename
    );

    let lastReadingData = JSON.parse(rawFiledata);

    let participantsArray = getValues(lastReadingData.participants);

    var participantsResult = [];
    participantsArray.forEach(participant => {
      delete participant.email;

      participantsResult.push(participant);
    });

    lastReadingData.participants = participantsResult;

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

function getHistoricalReadingFiles() {
  const dir = league_helper.createLeagueHistoryFolderPath();
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
