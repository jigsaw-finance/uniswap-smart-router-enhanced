import { EIP1559GasPriceProvider, GasPrice } from '@uniswap/smart-order-router';
import { BigNumber } from '@ethersproject/bignumber';
import { JsonRpcProvider } from '@ethersproject/providers';

/**
 * Custom gas price provider that handles RPC endpoints that might
 * return invalid fee data (like Tenderly)
 */
export class CustomGasPriceProvider extends EIP1559GasPriceProvider {
  constructor(
    provider: JsonRpcProvider,
    priorityFeePercentile: number = 5,
    blocksToConsider: number = 5
  ) {
    super(provider, priorityFeePercentile, blocksToConsider);
  }

  /**
   * Override getGasPrice to handle division-by-zero errors with Tenderly
   */
  public async getGasPrice(latestBlockNumber?: number): Promise<GasPrice> {
    try {
      // Get the latest block number if not provided
      const blockNumber = latestBlockNumber || await this.provider.getBlockNumber();

      // Try the original implementation with the required latestBlockNumber parameter
      return await super.getGasPrice(blockNumber);
    } catch (error) {
      console.warn('Error getting gas price from EIP1559 provider:', error);
      console.warn('Falling back to legacy gas price method');

      // Fallback to legacy getGasPrice if EIP1559 method fails
      try {
        const gasPriceWei = await this.provider.getGasPrice();
        // Check if gasPriceWei is zero or undefined (can happen with Tenderly)
        if (!gasPriceWei || gasPriceWei.eq(0)) {
          console.warn('Provider returned zero or invalid gas price, using default');
          return { gasPriceWei: BigNumber.from(50000000000) }; // 50 Gwei default
        }
        return { gasPriceWei };
      } catch (fallbackError) {
        console.error('Fallback gas price method also failed:', fallbackError);

        // If all else fails, return a reasonable default gas price
        // 50 Gwei as a safe default
        return { gasPriceWei: BigNumber.from(50000000000) };
      }
    }
  }
}
