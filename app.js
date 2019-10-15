"use strict";

const fs = require("fs");
const md5 = require("md5");
const schedule = require("node-schedule");

// Start Strapi
const strapi = require("strapi");
strapi().start();

const leagueInputDataFile = "./league_data/input.json";

let md5Previous = null;
let fsWait = false;
let job = setupJob();

fs.watch(leagueInputDataFile, (event, filename) => {
  if (filename) {
    if (fsWait) return;
    fsWait = setTimeout(() => {
      fsWait = false;
    }, 100);
    const md5Current = md5(fs.readFileSync(leagueInputDataFile));
    if (md5Current === md5Previous) {
      return;
    }
    md5Previous = md5Current;

    console.log(`${filename} file changed, restarting job...`);
    if (job) {
      job.cancel();
    }
    job = setupJob();
  }
});

function setupJob() {
  let rawdata = fs.readFileSync(leagueInputDataFile);
  let leagueData = JSON.parse(rawdata);
  let job = schedule.scheduleJob(leagueData.startDate, function() {
    leagueData.entryWalletsComputed = true;
    leagueData.participants.forEach(participant => {
      participant.entryValue = 150000;
    });

    let data = JSON.stringify(leagueData);
    fs.writeFileSync(leagueInputDataFile, data);
    console.log(leagueData);
  });
  return job;
}
