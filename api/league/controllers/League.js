"use strict";

const axios = require("axios");
const crypto = require("crypto");

let inputData = require("./../../../league_data/input.json");

var apiKey = "Jnvdc_AzqtslTR3eD_0sTo81";
var apiSecret = "N2Z9f9awMyf2VWSu3SScWJU0dfUq8kCtH0oDHHc-_rPd2sUA";

module.exports = {
  index: async ctx => {
    var verb = "GET",
      path = "/api/v1/user/wallet?currency=XBt",
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
      baseURL: "https://testnet.bitmex.com",
      url: path,
      method: "GET"
    };

    console.log(requestConfig);

    await axios
      .request(requestConfig)
      .then(function(response) {
        ctx.send(response.data);
      })
      .catch(function(error) {
        ctx.send(error);
      });
  }
};
