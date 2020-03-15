const client = require("./bybit_client.js");

const apiKey = "q3uJAPn40B4JogiAY3";
const apiSecret = "5Jo30vYti1m5ifOJm7u1Sqmd1paFtzV848vX";

const BTCUSDSymbol = "BTCUSD";
const ETHUSDSymbol = "ETHUSD";
const EOSUSDSymbol = "EOSUSD";
const XRPUSDSymbol = "XRPUSD";

const BTCCoin = "BTC";
const XRPCoin = "XRP";
const ETHCoin = "ETH";
const EOSCoin = "EOS";
const USDCoin = "USDT";

async function getReadings() {
  let symbols = await _getBybitTickers();

  return {
    symbols,
    users: [await getUserReading(apiKey, apiSecret, symbols)]
  };
}

async function validateApiKey(apiKey, apiSecret, leagueEndDate) {
  try {
    let accInfo = _transformApiKeyResponse(
      await _getApiKeyInfo(apiKey, apiSecret)
    );

    if (accInfo.expired_at > leagueEndDate) {
      return true;
    } else {
      return false;
    }
  } catch {
    return false;
  }
}

async function getUserReading(apiKey, apiSecret, symbols) {
  let accInfo = _transformApiKeyResponse(
    await _getApiKeyInfo(apiKey, apiSecret)
  );

  let deposits = _transformDepositResponse(
    await _getDeposits(apiKey, apiSecret)
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
    accInfo,
    deposits,
    wallets: {
      BTC: btcData,
      XRP: xrpData,
      ETH: ethData,
      EOS: eosData,
      USDT: usdtData
    },
    totalUSDT: _getTotalUSDT(
      symbols,
      btcData.equity,
      eosData.equity,
      xrpData.equity,
      ethData.equity,
      usdtData.equity
    )
  };
}

async function _getApiKeyInfo(apiKey, apiSecret) {
  try {
    const response = await client.get(
      "/open-api/api-key",
      apiKey,
      apiSecret,
      {}
    );
    console.log(response.data);
    return response.data;
  } catch (error) {
    console.log(error);
    return [];
  }
}

async function _getWalletData(apiKey, apiSecret, coin) {
  try {
    const response = await client.get(
      "/v2/private/wallet/balance",
      apiKey,
      apiSecret,
      {
        coin
      }
    );
    return response.data;
  } catch (error) {
    console.log(error);
    return [];
  }
}

async function _getDeposits(apiKey, apiSecret) {
  try {
    const response = await client.get(
      "/open-api/wallet/fund/records",
      apiKey,
      apiSecret,
      {
        wallet_fund_type: "Deposit"
      }
    );
    return response.data;
  } catch (error) {
    console.log(error);
    return [];
  }
}

async function _getBybitTickers() {
  try {
    const response = await client.publicGet("/v2/public/tickers");
    return _transformTickersResponse(response.data.result);
  } catch (error) {
    console.log(error);
    return [];
  }
}

function _transformTickersResponse(array) {
  let symbols = {};
  array.forEach(ticker => {
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
    unrealised_pnl: coinWalletData.unrealised_pnl
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
    user_id: firstApiKey.user_id,
    note: firstApiKey.note,
    inviter_id: firstApiKey.inviter_id,
    read_only: firstApiKey.read_only,
    expired_at: firstApiKey.expired_at
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
  getReadings,
  validateApiKey
};
