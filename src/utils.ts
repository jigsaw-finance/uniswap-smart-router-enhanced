import {Token, CurrencyAmount, TradeType} from "@uniswap/sdk-core";
import {Pool, SwapRoute} from "@uniswap/smart-order-router";
import JSBI from "jsbi";
import {utils} from "ethers";

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

export const formatResponse = (response: SwapRoute, tradeType: TradeType) => {
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

  return {
    input,
    output,
    route: response.route?.map((r: any) => {
      const addresses: string[] = r.tokenPath?.reverse().map((token: Token) => token.address)
      const fees: number[] = r.route.pools?.reverse().map((pool: Pool) => Number(pool.fee))

      /** The parameter path is encoded as (tokenOut, fee, tokenIn/tokenOut, fee, tokenIn)
       The tokenIn/tokenOut field is the shared token between the two pools used in the multiple pool swap.
       For an exactOutput swap, the first swap that occurs is the swap which returns the eventual desired token.
       **/

      const callDataArray = addresses.flatMap((address: string, i: number) => fees[i] !== undefined ? [address, fees[i]] : [address]);
      const callDataTypes = addresses.flatMap((address: string, i: number) => fees[i] !== undefined ? [typeof address, "uint48"] : [typeof address]);

      /** encoded path **/
      const callData = utils.solidityKeccak256(callDataTypes, callDataArray);

      return {
        protocol: r.protocol ?? 'Unknown',
        percent: r.percent ?? 'Unknown',
        pools: r.route.pools ?? 'Unknown',
        tokenPath: r.tokenPath,
        callData
      }
    }),
    gasDetails: {
      estimatedGasUsedUSD: response.estimatedGasUsedUSD.toExact()
    },
    methodParameters: response.methodParameters,
    blockNumber: response.blockNumber ?? null,
    hitsCachedRoute: response.hitsCachedRoute ?? false,
  };
};
