const _ = require("lodash");

const client = require("./bitmex_client.js");
const encrypt_decrypt = require("./../../encrypt_decrypt.js");
const league_helper = require("./../../league_helper.js");

const walletSummaryApiPath = "/api/v1/user/walletSummary?currency=XBt";
const affliateStatusApiPath = "/api/v1/user/affiliateStatus";

function getAccountDictKey(account) {
  return "bitmex_" + account.toString();
}

function processParticipantReading(
  response,
  readingData,
  previousReadingFileData
) {
  if (response.inner.status === 200) {
    let depositEntry = _filterElementByKey(response.inner.data, "Deposit");
    let transferEntry = _filterElementByKey(response.inner.data, "Transfer");
    let totalEntry = _filterElementByKey(response.inner.data, "Total");

    if (!totalEntry) {
      console.log("Total entry not found: ", response.participant.username);

      let { email, username } = response.participant;
      readingData.totallyEmptyAccounts.push({
        email,
        username
      });
      return;
    }

    var roeCurrent = 0;
    var startingBalance = totalEntry.marginBalance;
    var isRekt = false;
    var isRetarded = false;
    var nextRoes = [0];
    var tooLowBalance = false;

    let accDictKey = getAccountDictKey(totalEntry.account);

    if (previousReadingFileData) {
      if (!previousReadingFileData.participants[accDictKey]) {
        console.log(
          "Total entry found but previous file doesnt contain participant. Hacking!"
        );
        console.log(response.participant.username);

        let { email, username } = response.participant;
        readingData.totallyEmptyAccounts.push({
          email,
          username
        });
        return;
      }

      roeCurrent = league_helper.getRoe(
        previousReadingFileData.participants[accDictKey].startingBalance,
        totalEntry.marginBalance
      );

      startingBalance =
        previousReadingFileData.participants[accDictKey].startingBalance;

      tooLowBalance =
        previousReadingFileData.participants[accDictKey].tooLowBalance ===
          true || false;

      isRekt =
        previousReadingFileData.participants[accDictKey].isRekt === true ||
        roeCurrent <= -99.0;

      isRetarded =
        previousReadingFileData.participants[accDictKey].isRetarded === true ||
        _checkIfRetarded(
          previousReadingFileData.participants[accDictKey],
          depositEntry,
          transferEntry
        );

      nextRoes = previousReadingFileData.participants[accDictKey].roes
        ? previousReadingFileData.participants[accDictKey].roes
        : [];
      nextRoes.push(Math.round(roeCurrent * 1e2) / 1e2);
    } else {
      if (startingBalance < 500000) {
        tooLowBalance = true;
      }
    }

    readingData.participants[accDictKey] = {
      balance: totalEntry.marginBalance,
      account: totalEntry.account,
      deposit: depositEntry,
      transfer: transferEntry,
      username: response.participant.username,
      email: response.participant.email,
      startingBalance: startingBalance,
      roeCurrent: roeCurrent,
      roe1d: null,
      roe3d: null,
      roe7d: null,
      roe14d: null,
      roeEnd: null,
      isRekt,
      isRetarded,
      tooLowBalance,
      roes: nextRoes
    };
  } else if (response.inner.status === 201) {
    readingData.participants[
      getAccountDictKey(response.inner.previousData.account)
    ] = response.inner.previousData;
  } else {
    let { email, username } = response.participant;
    readingData.totallyEmptyAccounts.push({
      email,
      username
    });
    return;
  }
}

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

    return {
      inner: response,
      participant
    };
  } catch (error) {
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

function _checkIfRetarded(previousEntry, depositEntry, transferEntry) {
  return !(
    _.isEqual(previousEntry.deposit, depositEntry) &&
    _.isEqual(previousEntry.transfer, transferEntry)
  );
}

function _filterElementByKey(response, key) {
  return response.find(element => {
    return element.transactType === key;
  });
}

module.exports = {
  processParticipantReading,
  validateApiKeyAndSecret,
  validateRefferal,
  getParticipantCurrentWalletInfo
};
