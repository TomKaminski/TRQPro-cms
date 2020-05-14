const client = require("./bybit_client.js");
const encrypt_decrypt = require("./../../encrypt_decrypt.js");
const league_helper = require("./../../league_helper.js");
const moment = require("moment");
const _ = require("lodash");

const BTCUSDSymbol = "BTCUSD";
const ETHUSDSymbol = "ETHUSD";
const EOSUSDSymbol = "EOSUSD";
const XRPUSDSymbol = "XRPUSD";

const BTCCoin = "BTC";
const XRPCoin = "XRP";
const ETHCoin = "ETH";
const EOSCoin = "EOS";
const USDCoin = "USDT";

function getAccountDictKey(email) {
  return "bybit_" + email;
}

function _checkIfRetarded(response, previousReadingDate) {
  let momentDate = moment(previousReadingDate).utc();

  if (response.inner.deposits.length == 0) {
    return false;
  } else {
    let possibleDateIndex = _.findIndex(response.inner.deposits, function (
      depo
    ) {
      let depoMoment = moment(depo.exec_time);
      return depoMoment > momentDate;
    });
    return possibleDateIndex != -1;
  }
}

function processParticipantReading(
  response,
  readingData,
  previousReadingFileData,
  symbols
) {
  if (response.inner.status === 200) {
    let accDictKey = getAccountDictKey(response.participant.email);
    let wallets = response.inner.wallets;
    const totalUsdt = _getTotalUSDT(
      symbols,
      wallets.BTC.equity,
      wallets.EOS.equity,
      wallets.XRP.equity,
      wallets.ETH.equity,
      wallets.USDT.equity
    );

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
        _checkIfRetarded(response, previousReadingFileData.readingDate);

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
      deposits: response.inner.deposits,
      username: response.participant.username,
      email: response.participant.email,
      startingBalance: startingBalance,
      roeCurrent: roeCurrent,
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
    if (previousReadingFileData) {
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

async function validateApiKey(apiKey, apiSecret, leagueEndDate) {
  try {
    let accInfo = _transformApiKeyResponse(
      await _getApiKeyInfo(apiKey, apiSecret)
    );

    let momentExpiredAt = moment(accInfo.expired_at);
    let momentLeagueEndDate = moment(leagueEndDate);

    if (momentExpiredAt > momentLeagueEndDate) {
      if (accInfo.read_only) {
        return {
          isSuccess: true,
          error: null,
        };
      }
      return {
        isSuccess: false,
        error: "WRONG-PERMISSION-BYBIT",
      };
    } else {
      return {
        isSuccess: false,
        error: "WRONG-VALID-UNTIL-DATE-BYBIT",
      };
    }
  } catch {
    return {
      isSuccess: false,
      error: "WRONG-API-KEYS",
    };
  }
}

async function validateRefferal(participant, apiSecret) {
  try {
    let accInfo = _transformApiKeyResponse(
      await _getApiKeyInfo(participant.apiKey, apiSecret)
    );
    accInfo.username = participant.username;
    return accInfo;
  } catch {
    return false;
  }
}

async function getUserReading(participant, previousData, previousReadingDate) {
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
    let accInfo = _transformApiKeyResponse(
      await _getApiKeyInfo(apiKey, apiSecret)
    );

    var depositsStartDate;
    if (previousReadingDate) {
      depositsStartDate = moment(previousReadingDate).toISOString();
    } else {
      depositsStartDate = new Date().toISOString();
    }

    let deposits = _transformDepositResponse(
      await _getDeposits(apiKey, apiSecret, depositsStartDate)
    );

    let btcData = _transformWalletResponse(
      await _getWalletData(apiKey, apiSecret, BTCCoin),
      BTCCoin
    );

    let xrpData = _transformWalletResponse(
      await _getWalletData(apiKey, apiSecret, XRPCoin),
      XRPCoin
    );

    let ethData = _transformWalletResponse(
      await _getWalletData(apiKey, apiSecret, ETHCoin),
      ETHCoin
    );

    let eosData = _transformWalletResponse(
      await _getWalletData(apiKey, apiSecret, EOSCoin),
      EOSCoin
    );

    let usdtData = _transformWalletResponse(
      await _getWalletData(apiKey, apiSecret, USDCoin),
      USDCoin
    );

    return {
      inner: {
        status: 200,
        accInfo,
        deposits,
        wallets: {
          BTC: btcData,
          XRP: xrpData,
          ETH: ethData,
          EOS: eosData,
          USDT: usdtData,
        },
      },
      participant,
    };
  } catch (error) {
    return {
      inner: {
        status: 401,
        previousData,
      },
      participant,
    };
  }
}

async function _getApiKeyInfo(apiKey, apiSecret) {
  const response = await client.get("/open-api/api-key", apiKey, apiSecret, {});
  return response.data;
}

async function _getWalletData(apiKey, apiSecret, coin) {
  const response = await client.get(
    "/v2/private/wallet/balance",
    apiKey,
    apiSecret,
    {
      coin,
    }
  );
  return response.data;
}

async function _getDeposits(apiKey, apiSecret, startDate) {
  const response = await client.get(
    "/open-api/wallet/fund/records",
    apiKey,
    apiSecret,
    {
      start_date: startDate,
      wallet_fund_type: "Deposit",
    }
  );
  return response.data;
}

async function getBybitTickers() {
  const response = await client.publicGet("/v2/public/tickers");
  return _transformTickersResponse(response.data.result);
}

function _transformTickersResponse(array) {
  let symbols = {};
  array.forEach((ticker) => {
    symbols[ticker.symbol] = ticker.index_price;
  });
  return symbols;
}

function _transformWalletResponse(object, coin) {
  let coinWalletData = object.result[coin];
  return {
    equity: coinWalletData.equity,
    available_balance: coinWalletData.available_balance,
    used_margin: coinWalletData.used_margin,
    order_margin: coinWalletData.order_margin,
    position_margin: coinWalletData.position_margin,
    wallet_balance: coinWalletData.wallet_balance,
    unrealised_pnl: coinWalletData.unrealised_pnl,
  };
}

function _transformDepositResponse(object) {
  return object.result.data;
}

function _transformApiKeyResponse(object) {
  if (object.result.length == 0) {
    throw "API Key not found!";
  }

  let firstApiKey = object.result[0];
  return {
    expired_at: firstApiKey.expired_at,
    inviter_id: firstApiKey.inviter_id,
    read_only: firstApiKey.read_only,
  };
}

function _getTotalUSDT(
  symbols,
  btcAmount,
  eosAmount,
  xrpAmount,
  ethAmount,
  usdtAmount
) {
  return (
    usdtAmount +
    _getCoinInUSDT(symbols[BTCUSDSymbol], btcAmount) +
    _getCoinInUSDT(symbols[EOSUSDSymbol], eosAmount) +
    _getCoinInUSDT(symbols[ETHUSDSymbol], ethAmount) +
    _getCoinInUSDT(symbols[XRPUSDSymbol], xrpAmount)
  );
}

function _getCoinInUSDT(coinIndexPrice, amount) {
  return coinIndexPrice * amount;
}

module.exports = {
  processParticipantReading,
  getUserReading,
  getBybitTickers,
  validateRefferal,
  validateApiKey,
  _getApiKeyInfo,
  _getDeposits,
};
