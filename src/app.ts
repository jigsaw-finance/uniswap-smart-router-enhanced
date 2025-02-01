import express from 'express';
import {JsonRpcProvider} from '@ethersproject/providers';
import {AlphaRouter, CurrencyAmount, SwapOptionsSwapRouter02, SwapType} from '@uniswap/smart-order-router'
import {Percent, TradeType} from "@uniswap/sdk-core";
import dotenv from 'dotenv';
import cors from 'cors';
import {formatResponse, fromReadableAmount, parseToken} from "./utils";
import serverless from 'serverless-http';
import {SwapParams} from "./types";

dotenv.config();

const port = Number(process.env.PORT) || 3000;
const chainId = Number(process.env.CHAIN_ID) || 1;
const jsonRpcURL = process.env.JSON_RPC_URL;
const environment = process.env.ENVIRONMENT;

console.log(`Using chainId ${chainId} and JSON RPC URL ${jsonRpcURL}`);

const app = express();
app.use(express.json());
app.use(cors());

const jsonRpcClient = new JsonRpcProvider(jsonRpcURL, chainId);
const router = new AlphaRouter({chainId, provider: jsonRpcClient});

app.post('/route', (req, res) => {
  console.log("Requesting");
  const {
    amount,
    recipient,
    tradeType = TradeType.EXACT_OUTPUT
  }: SwapParams = req.body;

  const currencyAmount = parseToken(req.body.currencyAmount, chainId);
  const currency = parseToken(req.body.currency, chainId);

  const swapOptions: SwapOptionsSwapRouter02 = {
    recipient,
    slippageTolerance: new Percent(50, 10_000), // 0.5%
    deadline: Math.floor(Date.now() / 1000 + 1800), // 30 minutes
    type: SwapType.SWAP_ROUTER_02,
  }

  router.route(
      CurrencyAmount.fromRawAmount(
          currencyAmount,
          fromReadableAmount(amount, currencyAmount.decimals).toString()
      ),
      currency,
      tradeType,
      swapOptions,
      {distributionPercent:100} //  The minimum percentage of the input token to use for each route in a split route.
  ).then(route => {
      if (!route) {
        res.status(404);
        res.send("No route found");
        return;
      }
      res.json(formatResponse(route, tradeType));
    }).catch(err => {
    res.status(500);
    res.send("Internal server error")
    console.log(err);
  });
});

if (environment === 'production') {
  module.exports.handler = serverless(app);
} else {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}
