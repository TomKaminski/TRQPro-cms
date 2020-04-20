const fs = require("fs");
const league_helper = require("../../../core/league_helper.js");

module.exports = {
  selectorData: async (ctx) => {
    let files = getHistoricalReadingFiles();
    ctx.send(files);
  },

  leagueData: async (ctx) => {
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

    let participantsArray = league_helper.getSortedParticipants(
      lastReadingData.participants
    );

    var participantsResult = [];
    participantsArray.forEach((participant) => {
      delete participant.email;

      participantsResult.push(participant);
    });

    lastReadingData.participants = participantsResult;

    ctx.send(lastReadingData);
  },
};

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
