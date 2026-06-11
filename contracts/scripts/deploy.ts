import { ethers } from "hardhat";

// ── Sepolia Testnet Configuration ──────────────────────────────────────
const NETWORK = {
  name: "Ethereum Sepolia",
  chainId: 11155111,
  usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",  // USDC on Sepolia (Circle official)
  uniswapRouter: "0xb41b78Ce3D1BDEDE48A3d303eD2564F6d1F6fff0",  // Uniswap V3 SwapRouter02 on Sepolia
};

const MAX_HARVEST_PER_TX = ethers.parseUnits("10000", 6);  // $10,000 in USDC (6 decimals)

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  if (balance === 0n) {
    console.log(`⚠️  Account has 0 ETH. Get Sepolia testnet ETH from faucet:`);
    console.log("   https://www.alchemy.com/faucets/ethereum-sepolia");
    console.log("   https://faucet.quicknode.com/ethereum/sepolia");
    console.log("   https://sepoliafaucet.com");
    console.log("   After funding, run: npx hardhat run scripts/deploy.ts --network sepolia\n");
    console.log("   ── Simulated deployment addresses (for local dev) ──");
    console.log("   TAXFI_PERMISSION_REGISTRY=<pending_funding>");
    console.log("   TAXFI_AGENT_ADDRESS=<pending_funding>");
    console.log("   TAXFI_VAULT_ADDRESS=<pending_funding>");
    console.log("   TAXFI_ATTESTOR_ADDRESS=<pending_funding>");
    return;
  }

  // 1. Deploy AgentPermissionRegistry (using fully qualified name to avoid artifact collision)
  console.log("1. Deploying AgentPermissionRegistry...");
  const PermissionRegistry = await ethers.getContractFactory("src/AgentPermissionRegistry.sol:AgentPermissionRegistry");
  const permissionRegistry = await PermissionRegistry.deploy();
  await permissionRegistry.waitForDeployment();
  const permissionRegistryAddress = await permissionRegistry.getAddress();
  console.log(`   ✅ AgentPermissionRegistry deployed: ${permissionRegistryAddress}\n`);

  // 2. Deploy TaxFiAgentSmartAccount
  console.log("2. Deploying TaxFiAgentSmartAccount...");
  const AgentAccount = await ethers.getContractFactory("src/TaxFiAgentSmartAccount.sol:TaxFiAgentSmartAccount");
  const agentAccount = await AgentAccount.deploy(
    deployer.address,
    permissionRegistryAddress,
    NETWORK.uniswapRouter,
    NETWORK.usdc,
    MAX_HARVEST_PER_TX
  );
  await agentAccount.waitForDeployment();
  const agentAccountAddress = await agentAccount.getAddress();
  console.log(`   ✅ TaxFiAgentSmartAccount deployed: ${agentAccountAddress}\n`);

  // Set rate limit for Sepolia
  const tx1 = await agentAccount.setRateLimit(NETWORK.chainId, ethers.parseUnits("50000", 6));  // $50k/day
  await tx1.wait();
  console.log(`   📊 Daily rate limit set: $50,000 on chain ${NETWORK.chainId}\n`);

  // Authorize deployer as executor
  const tx2 = await agentAccount.authorizeExecutor(deployer.address, true);
  await tx2.wait();
  console.log(`   🔑 Deployer authorized as executor\n`);

  // 3. Deploy LossHarvestVault
  console.log("3. Deploying LossHarvestVault...");
  const HarvestVault = await ethers.getContractFactory("src/LossHarvestVault.sol:LossHarvestVault");
  const harvestVault = await HarvestVault.deploy(
    NETWORK.usdc,
    NETWORK.uniswapRouter,
    3000,                 // 0.3% swap fee tier
    deployer.address,     // fee recipient
    500                   // 5% fee in bps
  );
  await harvestVault.waitForDeployment();
  const harvestVaultAddress = await harvestVault.getAddress();
  console.log(`   ✅ LossHarvestVault deployed: ${harvestVaultAddress}\n`);

  // Authorize agent account on the vault
  const tx3 = await harvestVault.authorizeAgent(agentAccountAddress, true);
  await tx3.wait();
  console.log(`   🔑 Agent account authorized on vault\n`);

  // 4. Deploy TaxFormAttestor
  console.log("4. Deploying TaxFormAttestor...");
  const FormAttestor = await ethers.getContractFactory("src/TaxFormAttestor.sol:TaxFormAttestor");
  const formAttestor = await FormAttestor.deploy();
  await formAttestor.waitForDeployment();
  const formAttestorAddress = await formAttestor.getAddress();
  console.log(`   ✅ TaxFormAttestor deployed: ${formAttestorAddress}\n`);

  // Authorize deployer as signer
  const tx4 = await formAttestor.authorizeSigner(deployer.address, true);
  await tx4.wait();
  console.log(`   🔑 Deployer authorized as form signer\n`);

  // 5. Print deployment summary
  console.log("═══════════════════════════════════════════════════");
  console.log("  TaxFi — Contract Deployment Summary");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Network:           ${NETWORK.name} (${NETWORK.chainId})`);
  console.log(`  Deployer:          ${deployer.address}`);
  console.log(`  PermissionRegistry:  ${permissionRegistryAddress}`);
  console.log(`  AgentAccount:        ${agentAccountAddress}`);
  console.log(`  HarvestVault:        ${harvestVaultAddress}`);
  console.log(`  FormAttestor:        ${formAttestorAddress}`);
  console.log(`  USDC (Sepolia):      ${NETWORK.usdc}`);
  console.log(`  Swap Router:         ${NETWORK.uniswapRouter}`);
  console.log("═══════════════════════════════════════════════════\n");

  // 6. Generate .env snippet
  console.log("── Add these to your .env ──────────────────────────\n");
  console.log(`TAXFI_PERMISSION_REGISTRY=${permissionRegistryAddress}`);
  console.log(`TAXFI_AGENT_ADDRESS=${agentAccountAddress}`);
  console.log(`TAXFI_VAULT_ADDRESS=${harvestVaultAddress}`);
  console.log(`TAXFI_ATTESTOR_ADDRESS=${formAttestorAddress}`);
  console.log(`TAXFI_AGENT_OWNER=${deployer.address}`);
  console.log(`TAXFI_USDC_ADDRESS=${NETWORK.usdc}`);
  console.log(`TAXFI_UNISWAP_ROUTER=${NETWORK.uniswapRouter}`);
  console.log(`TAXFI_CHAIN_ID=${NETWORK.chainId}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
