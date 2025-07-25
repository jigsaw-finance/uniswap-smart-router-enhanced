import express from 'express';
import {JsonRpcProvider} from '@ethersproject/providers';
import {AlphaRouter, CurrencyAmount, SwapOptionsSwapRouter02, SwapType} from '@uniswap/smart-order-router'
import { Percent, TradeType } from "@uniswap/sdk-core";
import dotenv from 'dotenv';
import cors from 'cors';
import {formatResponse, fromReadableAmount, parseToken} from "./utils";
import serverless from 'serverless-http';
import {SwapParams} from "./types";
import {CustomGasPriceProvider} from "./gas-provider";

dotenv.config();

const port = Number(process.env.PORT) || 3000;
const jsonRpcURL = process.env.JSON_RPC_URL;
const environment = process.env.ENVIRONMENT;

const app = express();
app.use(express.json());
app.use(cors());

app.post('/route', async (req, res) => {
  console.log("Requesting");
  const {
    amount,
    recipient,
    tradeType = TradeType.EXACT_OUTPUT,
    slippageTolerance = 0.5, // Default to 0.5% slippage tolerance
    deadline: requestTimestamp, // Use the timestamp from request if provided
    chainId,
  }: SwapParams = req.body;

  const jsonRpcClient = new JsonRpcProvider(jsonRpcURL, chainId);
  const customGasProvider = new CustomGasPriceProvider(jsonRpcClient);
  const router = new AlphaRouter({
    chainId,
    provider: jsonRpcClient,
    gasPriceProvider: customGasProvider
  });

  const currencyAmount = parseToken(req.body.currencyAmount, chainId);
  const currency = parseToken(req.body.currency, chainId);
  console.log('reg.body', req.body);

  try {
    // Get the current timestamp
    let currentTimestamp;
    try {
      const latestBlock = await jsonRpcClient.getBlock('latest');
      currentTimestamp = latestBlock.timestamp;
    } catch (error) {
      console.warn('Error getting latest block timestamp:', error);
      // Fallback to current time if block timestamp fails
      currentTimestamp = Math.floor(Date.now() / 1000);
    }

    // Use request timestamp if provided, otherwise use current timestamp
    const deadline = requestTimestamp || currentTimestamp + 300; // 5 minutes from the current date

    const swapOptions: SwapOptionsSwapRouter02 = {
      recipient,
      slippageTolerance: new Percent(slippageTolerance * 100, 10_000),
      deadline,
      type: SwapType.SWAP_ROUTER_02,
    };

    const route = await router.route(
      CurrencyAmount.fromRawAmount(
        currencyAmount,
        fromReadableAmount(amount, currencyAmount.decimals).toString()
      ),
      currency,
      tradeType,
      swapOptions,
      {distributionPercent: 100}
    );

    if (!route) {
      res.status(404).send("No route found");
      return;
    }

    res.json(formatResponse(route, tradeType, deadline));
  } catch (err) {
    console.error('Error in route processing:', err);
    res.status(500).send("Internal server error");
  }
});

if (environment === 'production') {
  module.exports.handler = serverless(app);
} else {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}
