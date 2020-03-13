const client = require("./bybit_client.js");

const apiKey = "oCJs8ZYwQgYT545paU";
const apiSecret = "Rh3wf2w06LKHFp6syYPZ7IOpqRezO5GocP3T";

async function testByBit() {
  await client
    .get("/open-api/api-key", apiKey, apiSecret, {})
    .then(response => {
      console.log(response.data);
    })
    .catch(error => {
      console.log(error);
    });
}

async function testByBitDeposits() {
  await client
    .get("/open-api/wallet/fund/records", apiKey, apiSecret, {})
    .then(response => {
      console.log(response.data);
    })
    .catch(error => {
      console.log(error);
    });
}

module.exports = {
  testByBit,
  testByBitDeposits
};
