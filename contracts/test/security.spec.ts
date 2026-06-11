import { expect } from "chai";
import { ethers } from "hardhat";

describe("TaxFi contracts security hardening", function () {
  it("AgentPermissionRegistry rejects zero grantee", async function () {
    const Factory = await ethers.getContractFactory("AgentPermissionRegistry");
    const registry = await Factory.deploy();

    await expect(
      registry.grantPermission(
        ethers.ZeroAddress,
        {
          chainIds: [84532],
          targetAddresses: [],
          permissionType: 0,
          allowedSelectors: [],
          tokenAddress: ethers.ZeroAddress,
          maxAmount: 0,
          periodDuration: 0,
        },
        Math.floor(Date.now() / 1000) + 3600,
      ),
    ).to.be.revertedWithCustomError(registry, "InvalidGrantee");
  });

  it("TaxFiAgentSmartAccount blocks unauthorized executors", async function () {
    const [owner, attacker] = await ethers.getSigners();

    const RegistryFactory = await ethers.getContractFactory("AgentPermissionRegistry");
    const registry = await RegistryFactory.deploy();

    const AgentFactory = await ethers.getContractFactory("TaxFiAgentSmartAccount");
    const agent = await AgentFactory.deploy(
      owner.address,
      await registry.getAddress(),
      "0x1111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222",
      10_000_000,
    );

    await expect(
      agent.connect(attacker).executeHarvest(
        ethers.keccak256(ethers.toUtf8Bytes("permission")),
        owner.address,
        "0x3333333333333333333333333333333333333333",
        1,
        1,
        "0x",
        84532,
      ),
    ).to.be.revertedWithCustomError(agent, "Unauthorized");
  });

  it("LossHarvestVault rejects invalid constructor config", async function () {
    const VaultFactory = await ethers.getContractFactory("LossHarvestVault");

    await expect(
      VaultFactory.deploy(
        "0x2222222222222222222222222222222222222222",
        "0x3333333333333333333333333333333333333333",
        500,
        "0x4444444444444444444444444444444444444444",
        10_001,
      ),
    ).to.be.reverted;
  });

  it("TaxFormAttestor blocks duplicate year+form attestations", async function () {
    const [owner, user] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("TaxFormAttestor");
    const attestor = await Factory.deploy();

    await attestor.authorizeSigner(owner.address, true);

    await attestor.attestForm(
      user.address,
      0,
      2025,
      ethers.keccak256(ethers.toUtf8Bytes("doc-1")),
      "ipfs://doc-1",
    );

    await expect(
      attestor.attestForm(
        user.address,
        0,
        2025,
        ethers.keccak256(ethers.toUtf8Bytes("doc-2")),
        "ipfs://doc-2",
      ),
    ).to.be.revertedWithCustomError(attestor, "AlreadyAttested");
  });
});
