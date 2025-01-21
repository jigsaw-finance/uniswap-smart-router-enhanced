import {Token} from "@uniswap/sdk-core";

export const parseToken = (rawToken: any, chainId: number): Token => {
  return new Token(chainId,
    rawToken.address,
    Number(rawToken.decimals),
    rawToken.symbol,
    rawToken.name
  );
}

export const formatResponse = (response: any) => {
  const parseAmount = (numerator: number[], denominator: number[], decimals: number) => {
    if (numerator && denominator && denominator[0] !== 0) {
      const amount = numerator[0] / denominator[0];
      return (amount / Math.pow(10, decimals)).toFixed(decimals); // Adjust for token decimals
    }
    return null;
  };

  return {
    quote: {
      amount: parseAmount(
        response.quote?.numerator,
        response.quote?.denominator,
        response.quote?.currency?.decimals
      ),
      currency: response.quote?.currency?.symbol ?? 'Unknown',
    },
    gasDetails: {
      estimatedGasUsedUSD: parseAmount(
        response.estimatedGasUsedUSD?.numerator,
        response.estimatedGasUsedUSD?.denominator,
        response.estimatedGasUsedUSD?.currency?.decimals
      ),
    },
    route: response.route?.map((r: any) => ({
      protocol: r.protocol ?? 'Unknown',
      input: {
        amount: parseAmount(
          r.amount?.numerator,
          r.amount?.denominator,
          r.amount?.currency?.decimals
        ),
        currency: r.amount?.currency?.symbol ?? 'Unknown',
      },
      output: {
        amount: parseAmount(
          r.quote?.numerator,
          r.quote?.denominator,
          r.quote?.currency?.decimals
        ),
        currency: r.quote?.currency?.symbol ?? 'Unknown',
      },
    })),
    trade: response.trade?.swaps?.map((swap: any) => ({
      inputAmount: parseAmount(
        swap.inputAmount?.numerator,
        swap.inputAmount?.denominator,
        swap.inputAmount?.currency?.decimals
      ),
      outputAmount: parseAmount(
        swap.outputAmount?.numerator,
        swap.outputAmount?.denominator,
        swap.outputAmount?.currency?.decimals
      ),
      protocol: swap.route?.protocol ?? 'Unknown',
    })),
    methodParameters: response.methodParameters,
    blockNumber: response.blockNumber ?? null,
    hitsCachedRoute: response.hitsCachedRoute ?? false,
  };
};
