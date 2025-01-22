import express from 'express';
import {JsonRpcProvider} from '@ethersproject/providers';
import {AlphaRouter, CurrencyAmount, SwapOptionsSwapRouter02, SwapType} from '@uniswap/smart-order-router'
import {Percent, TradeType} from "@uniswap/sdk-core";
import dotenv from 'dotenv';
import cors from 'cors';
import {formatResponse, parseToken} from "./utils";
import serverless from 'serverless-http';

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
  const reqBody = req.body;

  const currencyAmount = parseToken(reqBody.currencyAmount, chainId);
  const currency = parseToken(reqBody.currency, chainId);
  const tradeType = reqBody.tradeType as TradeType || TradeType.EXACT_INPUT;
  const recipient = reqBody.recipient as string;

  const swapOptions: SwapOptionsSwapRouter02 = {
    recipient: recipient,
    slippageTolerance: new Percent(50, 10_000), // 0.5%
    deadline: Math.floor(Date.now() / 1000 + 1800), // 30 minutes
    type: SwapType.SWAP_ROUTER_02,
  }

  router.route(CurrencyAmount.fromRawAmount(currencyAmount, reqBody.amount), currency, tradeType, swapOptions)
    .then(route => {
      if (!route) {
        res.status(404);
        res.send("No route found");
        return;
      }
      res.json(formatResponse(route));
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
