import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  // Mock addresses for local dev (no real USDC/Uniswap on local node)
  const MOCK_USDC = "0x0000000000000000000000000000000000000001";
  const MOCK_ROUTER = "0x0000000000000000000000000000000000000002";
  const MAX_HARVEST_PER_TX = ethers.parseUnits("10000", 6);  // $10,000

  // 1. Deploy AgentPermissionRegistry
  console.log("1. Deploying AgentPermissionRegistry...");
  const PermissionRegistry = await ethers.getContractFactory("src/AgentPermissionRegistry.sol:AgentPermissionRegistry");
  const permissionRegistry = await PermissionRegistry.deploy();
  await permissionRegistry.waitForDeployment();
  const permissionRegistryAddress = await permissionRegistry.getAddress();
  console.log(`   ✅ AgentPermissionRegistry: ${permissionRegistryAddress}\n`);

  // 2. Deploy TaxFiAgentSmartAccount
  console.log("2. Deploying TaxFiAgentSmartAccount...");
  const AgentAccount = await ethers.getContractFactory("src/TaxFiAgentSmartAccount.sol:TaxFiAgentSmartAccount");
  const agentAccount = await AgentAccount.deploy(
    deployer.address,
    permissionRegistryAddress,
    MOCK_ROUTER,
    MOCK_USDC,
    MAX_HARVEST_PER_TX
  );
  await agentAccount.waitForDeployment();
  const agentAccountAddress = await agentAccount.getAddress();
  console.log(`   ✅ TaxFiAgentSmartAccount: ${agentAccountAddress}\n`);

  // Set rate limit
  const tx1 = await agentAccount.setRateLimit(31337, ethers.parseUnits("50000", 6));
  await tx1.wait();
  console.log(`   📊 Daily rate limit set: $50,000 on chain 31337\n`);

  // Authorize deployer as executor
  const tx2 = await agentAccount.authorizeExecutor(deployer.address, true);
  await tx2.wait();
  console.log(`   🔑 Deployer authorized as executor\n`);

  // 3. Deploy LossHarvestVault
  console.log("3. Deploying LossHarvestVault...");
  const HarvestVault = await ethers.getContractFactory("src/LossHarvestVault.sol:LossHarvestVault");
  const harvestVault = await HarvestVault.deploy(
    MOCK_USDC,
    MOCK_ROUTER,
    3000,             // 0.3% swap fee tier
    deployer.address, // fee recipient
    500               // 5% fee in bps
  );
  await harvestVault.waitForDeployment();
  const harvestVaultAddress = await harvestVault.getAddress();
  console.log(`   ✅ LossHarvestVault: ${harvestVaultAddress}\n`);

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
  console.log(`   ✅ TaxFormAttestor: ${formAttestorAddress}\n`);

  // Authorize deployer as signer
  const tx4 = await formAttestor.authorizeSigner(deployer.address, true);
  await tx4.wait();
  console.log(`   🔑 Deployer authorized as form signer\n`);

  // 5. Print deployment summary
  console.log("═══════════════════════════════════════════════════");
  console.log("  TaxFi — Local Contract Deployment Summary");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Network:           Localhost (31337)`);
  console.log(`  Deployer:          ${deployer.address}`);
  console.log(`  PermissionRegistry:  ${permissionRegistryAddress}`);
  console.log(`  AgentAccount:        ${agentAccountAddress}`);
  console.log(`  HarvestVault:        ${harvestVaultAddress}`);
  console.log(`  FormAttestor:        ${formAttestorAddress}`);
  console.log("═══════════════════════════════════════════════════\n");

  // 6. Generate .env snippet
  console.log("── Copy these addresses ───────────────────────────\n");
  console.log(`TAXFI_PERMISSION_REGISTRY=${permissionRegistryAddress}`);
  console.log(`TAXFI_AGENT_ADDRESS=${agentAccountAddress}`);
  console.log(`TAXFI_VAULT_ADDRESS=${harvestVaultAddress}`);
  console.log(`TAXFI_ATTESTOR_ADDRESS=${formAttestorAddress}`);
  console.log(`TAXFI_AGENT_OWNER=${deployer.address}`);
  console.log(`TAXFI_USDC_ADDRESS=${MOCK_USDC}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
