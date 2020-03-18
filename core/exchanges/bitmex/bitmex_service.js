const client = require("./bitmex_client.js");
const encrypt_decrypt = require("./../../../core/encrypt_decrypt.js");

const walletSummaryApiPath = "/api/v1/user/walletSummary?currency=XBt";
const affliateStatusApiPath = "/api/v1/user/affiliateStatus";

async function getParticipantCurrentWalletInfo(participant, previousData) {
  if (
    previousData &&
    (previousData.isRetarded ||
      previousData.isRekt ||
      previousData.tooLowBalance)
  ) {
    return {
      inner: {
        status: 201,
        previousData
      },
      participant
    };
  }

  let decodedSecret = encrypt_decrypt.decrypt(participant.apiSecret);

  try {
    const response = await client.get(
      walletSummaryApiPath,
      participant.apiKey,
      decodedSecret
    );
    console.log(response);

    return {
      inner: response,
      participant
    };
  } catch (error) {
    console.log(error);
    return {
      inner: {
        status: 401
      },
      participant
    };
  }
}

async function validateApiKeyAndSecret(apiKey, apiSecret) {
  try {
    const response = await client.get(walletSummaryApiPath, apiKey, apiSecret);
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

async function validateRefferal(apiKey, apiSecret) {
  try {
    const response = await client.get(affliateStatusApiPath, apiKey, apiSecret);
    if (response.status === 200) {
      return {
        nick: participant.username,
        refId: response.data.referrerAccount
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

module.exports = {
  validateApiKeyAndSecret,
  validateRefferal,
  getParticipantCurrentWalletInfo
};
