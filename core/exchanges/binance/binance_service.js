const client = require("./binance_client.js");
const encrypt_decrypt = require("./../../encrypt_decrypt.js");
const league_helper = require("./../../league_helper.js");

function getAccountDictKey(email) {
  return "binance_" + email;
}

function _checkIfRetarded(response) {
  return false
  //return response.inner.transfer.length > 0;
}

function processParticipantReading(
  response,
  readingData,
  previousReadingFileData
) {
  if (response.inner.status === 200) {
    let accDictKey = getAccountDictKey(response.participant.email);
    const totalUsdt =
      response.inner.balance.totalMarginBalance - response.inner.refferals;
    var roeCurrent = 0;
    var isRekt = false;
    var startingBalance = totalUsdt;
    var isRetarded = false;
    var nextRoes = [0];
    var tooLowBalance = false;

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

      roeCurrent = league_helper.getRoe(
        previousReadingFileData.participants[accDictKey].startingBalance,
        totalUsdt
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
        _checkIfRetarded(response);

      nextRoes = previousReadingFileData.participants[accDictKey].roes
        ? previousReadingFileData.participants[accDictKey].roes
        : [];
      nextRoes.push(Math.round(roeCurrent * 1e2) / 1e2);
    } else {
      if (startingBalance < 50) {
        tooLowBalance = true;
      }
    }

    readingData.participants[accDictKey] = {
      balance: totalUsdt,
      deposits: response.inner.transfer,
      username: response.participant.username,
      email: response.participant.email,
      startingBalance: startingBalance,
      roeCurrent: roeCurrent,
      custom: {
        referrals: response.inner.refferals,
        realizedPnl: response.inner.realizedPnl,
        balance: response.inner.balance,
      },
      roe1d: null,
      roe3d: null,
      roe7d: null,
      roe14d: null,
      roeEnd: null,
      isZombie: false,
      isRekt,
      isRetarded,
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

async function validateApiKey(apiKey, apiSecret) {
  try {
    let response = await _getAccountInfo(apiKey, apiSecret);
    _validateApiResponse(response);

    if (response.totalMarginBalance) {
      return {
        isSuccess: response,
        error: null,
      };
    } else {
      return {
        isSuccess: false,
        error: "WRONG-API-KEYS",
      };
    }
  } catch (error) {
    console.log(error);
    return {
      isSuccess: false,
      error: "WRONG-API-KEYS",
    };
  }
}

function _transformWalletResponse(object) {
  _validateApiResponse(object);
  return {
    totalMarginBalance: object.totalMarginBalance,
    totalWalletBalance: object.totalWalletBalance,
    totalUnrealizedProfit: object.totalUnrealizedProfit,
  };
}

function _sumIncomes(object) {
  _validateApiResponse(object);
  let sumUsdt = 0;
  object.forEach((item) => (sumUsdt += parseFloat(item.income)));
  return sumUsdt;
}

async function getUserReading(participant, previousData, leagueStartDateInMs) {
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

  const apiKey = participant.apiKey;
  const apiSecret = encrypt_decrypt.decrypt(participant.apiSecret);

  try {
    let transfer = await _getTransfers(apiKey, apiSecret, leagueStartDateInMs);

    let refferals = _sumIncomes(
      await _getRefferals(apiKey, apiSecret, leagueStartDateInMs)
    );

    let realizedPnl = _sumIncomes(
      await _getPnl(apiKey, apiSecret, leagueStartDateInMs)
    );

    let balance = _transformWalletResponse(
      await _getAccountInfo(apiKey, apiSecret)
    );

    return {
      inner: {
        status: 200,
        refferals,
        realizedPnl,
        balance,
        transfer,
      },
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

async function _getAccountInfo(apiKey, apiSecret) {
  const response = await client.securedGet(
    "/fapi/v1/account",
    apiKey,
    apiSecret,
    {}
  );
  return response.data;
}

function _validateApiResponse(response) {
  if (response.code && response.msg) {
    throw response.msg;
  }

  return true;
}

async function _getTransfers(apiKey, apiSecret, leagueStartDateInMs) {
  return await _getDeposits(apiKey, apiSecret, "TRANSFER", leagueStartDateInMs);
}

async function _getRefferals(apiKey, apiSecret, leagueStartDateInMs) {
  return await _getDeposits(
    apiKey,
    apiSecret,
    "REFERRAL_KICKBACK",
    leagueStartDateInMs
  );
}

async function _getPnl(apiKey, apiSecret, leagueStartDateInMs) {
  return await _getDeposits(
    apiKey,
    apiSecret,
    "REALIZED_PNL",
    leagueStartDateInMs
  );
}

async function _getDeposits(apiKey, apiSecret, type, leagueStartDate) {
  const response = await client.securedGet(
    "/fapi/v1/income",
    apiKey,
    apiSecret,
    {
      startTime: leagueStartDate,
      incomeType: type,
      limit: 1000,
    }
  );
  return response.data;
}

module.exports = {
  validateApiKey,
  getUserReading,
  processParticipantReading,
};
