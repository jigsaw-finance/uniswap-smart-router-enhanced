import {Token, TradeType} from "@uniswap/sdk-core";

export interface SwapParams {
    amount: number,
    currencyAmount: Token,
    currency: Token
    tradeType: TradeType,
    recipient: string,
}
