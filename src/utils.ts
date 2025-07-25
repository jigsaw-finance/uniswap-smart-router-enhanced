import { Token, CurrencyAmount, TradeType } from "@uniswap/sdk-core";
import { Pool, SwapRoute } from "@uniswap/smart-order-router";
import JSBI from "jsbi";
import { encodePacked } from 'viem';

export function countDecimals(x: number) {
  if (Math.floor(x) === x) {
    return 0
  }
  return x.toString().split('.')[1].length || 0
}

export function fromReadableAmount(amount: number, decimals: number): JSBI {
  const extraDigits = Math.pow(10, countDecimals(amount))
  const adjustedAmount = Math.round(amount * extraDigits)// cause js issue
  return JSBI.divide(
    JSBI.multiply(
      JSBI.BigInt(adjustedAmount),
      JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(decimals))
    ),
    JSBI.BigInt(extraDigits)
  )
}

export const parseToken = (rawToken: Token, chainId: number): Token => {
  return new Token(
    chainId,
    rawToken.address,
    Number(rawToken.decimals),
    rawToken.symbol,
    rawToken.name
  );
}

export const formatResponse = (response: SwapRoute, tradeType: TradeType, deadline: number) => {
  const routeAmount = response.route?.reduce(
    (sum, route) => sum.add(route.amount),
    CurrencyAmount.fromRawAmount(response.route[0].amount.currency, 0)
  );

  const quoteAmount = response.route?.reduce(
    (sum, route) => sum.add(route.quote),
    CurrencyAmount.fromRawAmount(response.quote.currency, 0)
  );

  let input, output;

  if (tradeType === TradeType.EXACT_INPUT) {
    input = {
      amount: routeAmount.toExact(),
      token: response.route[0].amount.currency ?? 'Unknown',
    };
    output = {
      amount: quoteAmount.toExact(),
      token: response.quote.currency ?? 'Unknown',
    };
  } else {
    input = {
      amount: quoteAmount.toExact(),
      token: response.quote.currency ?? 'Unknown',
    };
    output = {
      amount: routeAmount.toExact(),
      token: response.route[0].amount.currency ?? 'Unknown',
    };
  }

  const route = response.route?.map((r: any) => {
    const addresses: string[] = r.tokenPath?.map((token: Token) => token.address)
    const fees: number[] = r.route.pools?.map((pool: Pool) => Number(pool.fee))
    console.log('fees', fees);

    let callData: string | null
    if (!fees) {
      callData = null;
    } else {
      /** The parameter path is encoded as (tokenOut, fee, tokenIn/token1, fee, token1/token2, ..., fee, tokenIn)
       The tokenIn/tokenOut field is the shared token between the two pools used in the multiple pool swap.
       For an exactOutput swap, the first swap that occurs is the swap which returns the eventual desired token.
       **/
      const callDataArray = addresses.flatMap((address: string, i: number) => fees?.[i] !== undefined ? [address, fees[i]] : [address]);
      const callDataTypes = addresses.flatMap((address: string, i: number) => fees?.[i] !== undefined ? ['address', "uint24"] : ['address']);

      /** encoded path **/

      callData = encodePacked(callDataTypes, callDataArray);
      console.log('callDataArray', callDataArray, callDataTypes);
    }

    return {
      protocol: r.protocol ?? 'Unknown',
      percent: r.percent ?? 'Unknown',
      pools: r.route.pools ?? 'Unknown',
      tokenPath: r.tokenPath,
      callData,
    }
  });


  return {
    input,
    output,
    route,
    gasDetails: {
      estimatedGasUsedUSD: response.estimatedGasUsedUSD.toExact()
    },
    methodParameters: response.methodParameters,
    blockNumber: response.blockNumber ?? null,
    hitsCachedRoute: response.hitsCachedRoute ?? false,
  };
};
