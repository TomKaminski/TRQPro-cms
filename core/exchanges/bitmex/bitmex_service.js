const _ = require("lodash");

const client = require("./bitmex_client.js");
const encrypt_decrypt = require("./../../encrypt_decrypt.js");
const league_helper = require("./../../league_helper.js");

const walletSummaryApiPath = "/api/v1/user/walletSummary?currency=XBt";
const affliateStatusApiPath = "/api/v1/user/affiliateStatus";

const refAccId = 1130323;

function getAccountDictKey(email) {
  return "bitmex_" + email;
}

function processParticipantReading(
  response,
  readingData,
  previousReadingFileData
) {
  if (response.inner.status === 200) {
    let depositEntry = _filterElementByKey(response.inner.data, "Deposit");
    let withdrawalEntry = _filterElementByKey(response.inner.data, "Withdrawal");
    let totalEntry = _filterElementByKey(response.inner.data, "Total");

    if (!totalEntry) {
      console.log("Total entry not found: ", response.participant.username);

      let { email, username, exchange } = response.participant;
      readingData.totallyEmptyAccounts.push({
        email,
        username,
        exchange,
      });
      return;
    }

    var roeCurrent = 0;
    var startingBalance = totalEntry.marginBalance;
    var startingDeposits = depositEntry && depositEntry.amount ? depositEntry.amount : 0;
    var startingWithdrawals = withdrawalEntry && withdrawalEntry.amount ? withdrawalEntry.amount : 0;

    var isRekt = false;
    var nextRoes = [0];
    var tooLowBalance = false;
    var incomeOutcome = 0;
    

    let accDictKey = getAccountDictKey(response.participant.email);

    if (previousReadingFileData) {
      if (!previousReadingFileData.participants[accDictKey]) {
        console.log(
          "Total entry found but previous file doesnt contain participant. Hacking!"
        );
        console.log(response.participant.username);

        let { email, username, exchange } = response.participant;
        readingData.totallyEmptyAccounts.push({
          email,
          username,
          exchange,
        });
        return;
      }

      startingBalance = previousReadingFileData.participants[accDictKey].startingBalance;
      startingDeposits = previousReadingFileData.participants[accDictKey].startingDeposits;
      startingWithdrawals = previousReadingFileData.participants[accDictKey].startingWithdrawals;

      let diffDeposits = (depositEntry && depositEntry.amount ? depositEntry.amount : startingDeposits) - startingDeposits;
      let diffWithdrawals = (withdrawalEntry && withdrawalEntry.amount ? withdrawalEntry.amount : startingWithdrawals) - startingWithdrawals;

      incomeOutcome = diffDeposits + diffWithdrawals;

      roeCurrent = league_helper.getRoe(
        previousReadingFileData.participants[accDictKey].startingBalance,
        totalEntry.marginBalance + (incomeOutcome * -1)
      );

      tooLowBalance =
        previousReadingFileData.participants[accDictKey].tooLowBalance ===
          true || false;

      isRekt =
        previousReadingFileData.participants[accDictKey].isRekt === true ||
        roeCurrent <= -99.0;

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
      incomeOutcome,
      depositAmount: depositEntry && depositEntry.amount ? depositEntry.amount : 0,
      withdrawalAmount: withdrawalEntry && withdrawalEntry.amount ? withdrawalEntry.amount : 0,
      username: response.participant.username,
      email: response.participant.email,
      startingBalance,
      startingDeposits,
      startingWithdrawals,
      roeCurrent,
      roe1d: null,
      roe3d: null,
      roe7d: null,
      roe14d: null,
      roeEnd: null,
      isZombie: false,
      isRetarded: false,
      isRekt,
      tooLowBalance,
      roes: nextRoes,
    };
  } else if (response.inner.status === 201) {
    readingData.participants[getAccountDictKey(response.participant.email)] =
      response.inner.previousData;
  } else {
    if (previousReadingFileData && response.inner.previousData) {
      response.inner.previousData.isZombie = true;
      readingData.participants[getAccountDictKey(response.participant.email)] =
        response.inner.previousData;
    } else {
      let { email, username } = response.participant;
      readingData.totallyEmptyAccounts.push({
        email,
        username,
      });
    }
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
        previousData,
      },
      participant,
    };
  }

  let decodedSecret = encrypt_decrypt.decrypt(participant.apiSecret);

  try {
    const response = await client.get(
      walletSummaryApiPath,
      participant.apiKey,
      decodedSecret
    );

    console.log(response.data);

    if (response.status === 503) {
      //Service Unavailable - ZOMBIE
      return {
        inner: {
          status: 503,
          previousData,
        },
        participant,
      };
    }

    return {
      inner: response,
      participant,
    };
  } catch (error) {
    console.log(error);
    return {
      inner: {
        status: 401,
        previousData,
      },
      participant,
    };
  }
}

async function validateApiKeyAndSecret(apiKey, apiSecret) {
  try {
    const response = await client.get(affliateStatusApiPath, apiKey, apiSecret);
    if (response.status === 200) {
      if (response.data.referrerAccount === refAccId) {
        return {
          isSuccess: true,
          error: null,
        };
      }
      return {
        isSuccess: false,
        error: "WRONG-REF-BITMEX",
      };
    }
    return {
      isSuccess: false,
      error: "WRONG-API-KEYS",
    };
  } catch (error) {
    return {
      isSuccess: false,
      error: "WRONG-API-KEYS",
    };
  }
}

async function validateRefferal(participant, apiSecret) {
  try {
    const response = await client.get(
      affliateStatusApiPath,
      participant.apiKey,
      apiSecret
    );
    if (response.status === 200) {
      return {
        nick: participant.username,
        refId: response.data.referrerAccount,
      };
    } else {
      return {
        nick: participant.username,
        refId: -1,
      };
    }
  } catch (error) {
    return {
      nick: participant.username,
      refId: -1,
    };
  }
}

function _checkIfRetarded(previousEntry, depositEntry, transferEntry) {
  return false
  // return !(
  //   _.isEqual(previousEntry.deposit, depositEntry) &&
  //   _.isEqual(previousEntry.transfer, transferEntry)
  // );
}

function _filterElementByKey(response, key) {
  return response.find((element) => {
    return element.transactType === key;
  });
}

module.exports = {
  processParticipantReading,
  validateApiKeyAndSecret,
  validateRefferal,
  getParticipantCurrentWalletInfo,
};
