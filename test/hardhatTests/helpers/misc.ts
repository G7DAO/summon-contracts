import { ethers } from "ethers";

export function toWei(amount: string): bigint {
  return ethers.parseEther(amount);
}