// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LossHarvestVault
 * @notice Vault that receives harvested tokens from tax loss harvesting,
 * swaps them to USDC via DEX aggregator, and forwards to the user's Smart Account.
 * Takes a 5% fee on harvested savings.
 */
contract LossHarvestVault {
    // --- Types ---

    struct HarvestConfig {
        address usdcToken;
        address swapRouter;    // e.g. Uniswap V3 SwapRouter or CowSwap
        uint24 swapFee;        // default pool fee tier
        address feeRecipient;  // TaxFi protocol fee wallet
        uint256 feeBps;        // 500 = 5%
    }

    struct HarvestExecution {
        address user;
        address tokenSold;
        uint256 amountSold;
        uint256 usdcReceived;
        uint256 feeAmount;
        uint256 timestamp;
        bytes32 harvestId;
        bool completed;
    }

    // --- State ---

    HarvestConfig public config;
    address public owner;
    address public agentRegistry;

    /// @notice harvestId => HarvestExecution
    mapping(bytes32 => HarvestExecution) public harvests;

    /// @notice user address => harvestIds[]
    mapping(address => bytes32[]) public userHarvests;

    /// @notice TaxFi agent addresses allowed to execute harvests
    mapping(address => bool) public authorizedAgents;

    uint256 public totalHarvests;

    // --- Events ---

    event HarvestExecuted(
        bytes32 indexed harvestId,
        address indexed user,
        address indexed tokenSold,
        uint256 amountSold,
        uint256 usdcReceived,
        uint256 feeAmount
    );

    event HarvestCompleted(bytes32 indexed harvestId, address indexed user, uint256 usdcSent);

    event ConfigUpdated(address usdcToken, address swapRouter, uint256 feeBps);
    event AgentAuthorized(address agent, bool authorized);

    // --- Errors ---

    error UnauthorizedAgent();
    error HarvestAlreadyCompleted();
    error SwapFailed();
    error InsufficientOutput();
    error InvalidConfig();
    error InvalidAddress();
    error InvalidAmount();
    error Reentrancy();

    bool private _locked;

    // --- Modifiers ---

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAuthorized() {
        if (!authorizedAgents[msg.sender]) revert UnauthorizedAgent();
        _;
    }

    modifier nonReentrant() {
        if (_locked) revert Reentrancy();
        _locked = true;
        _;
        _locked = false;
    }

    // --- Constructor ---

    constructor(
        address _usdcToken,
        address _swapRouter,
        uint24 _swapFee,
        address _feeRecipient,
        uint256 _feeBps
    ) {
        if (
            _usdcToken == address(0) ||
            _swapRouter == address(0) ||
            _feeRecipient == address(0) ||
            _feeBps > 10_000
        ) revert InvalidConfig();

        owner = msg.sender;
        config = HarvestConfig({
            usdcToken: _usdcToken,
            swapRouter: _swapRouter,
            swapFee: _swapFee,
            feeRecipient: _feeRecipient,
            feeBps: _feeBps
        });
    }

    // --- Management ---

    function setAgentRegistry(address _agentRegistry) external onlyOwner {
        agentRegistry = _agentRegistry;
    }

    function authorizeAgent(address agent, bool authorized) external onlyOwner {
        if (agent == address(0)) revert InvalidAddress();
        authorizedAgents[agent] = authorized;
        emit AgentAuthorized(agent, authorized);
    }

    function updateConfig(
        address _usdcToken,
        address _swapRouter,
        uint24 _swapFee,
        address _feeRecipient,
        uint256 _feeBps
    ) external onlyOwner {
        if (
            _usdcToken == address(0) ||
            _swapRouter == address(0) ||
            _feeRecipient == address(0) ||
            _feeBps > 10_000
        ) revert InvalidConfig();

        config = HarvestConfig({
            usdcToken: _usdcToken,
            swapRouter: _swapRouter,
            swapFee: _swapFee,
            feeRecipient: _feeRecipient,
            feeBps: _feeBps
        });
        emit ConfigUpdated(_usdcToken, _swapRouter, _feeBps);
    }

    // --- Core Harvest Flow ---

    /**
     * @notice Execute a loss harvest: sell `tokenSold` for USDC
     * @param user The user's Smart Account address
     * @param tokenSold The token being sold (the losing position)
     * @param amountSold Amount of tokenSold to sell
     * @param minUsdcOut Minimum USDC to receive (slippage protection)
     * @param swapData Encoded swap call data for the DEX router
     * @param harvestId Unique identifier for this harvest
     */
    function executeHarvest(
        address user,
        address tokenSold,
        uint256 amountSold,
        uint256 minUsdcOut,
        bytes calldata swapData,
        bytes32 harvestId
    ) external onlyAuthorized nonReentrant returns (uint256 usdcReceived) {
        if (harvests[harvestId].completed) revert HarvestAlreadyCompleted();
        if (user == address(0) || tokenSold == address(0)) revert InvalidAddress();
        if (amountSold == 0) revert InvalidAmount();

        // Transfer tokens from agent to this vault
        // (Agent must have approval from user's Smart Account via delegation)
        (bool success, ) = tokenSold.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", msg.sender, address(this), amountSold)
        );
        require(success, "Token transfer failed");

        // Approve swap router
        (bool approveSuccess, ) = tokenSold.call(
            abi.encodeWithSignature("approve(address,uint256)", config.swapRouter, amountSold)
        );
        require(approveSuccess, "Approve failed");

        // Execute swap
        uint256 usdcBefore = IERC20(config.usdcToken).balanceOf(address(this));
        (bool swapSuccess, ) = config.swapRouter.call(swapData);
        if (!swapSuccess) revert SwapFailed();

        // Check USDC balance delta received
        uint256 usdcAfter = IERC20(config.usdcToken).balanceOf(address(this));
        usdcReceived = usdcAfter - usdcBefore;
        if (usdcReceived < minUsdcOut) revert InsufficientOutput();

        // Calculate fee
        uint256 feeAmount = (usdcReceived * config.feeBps) / 10000;
        uint256 usdcForUser = usdcReceived - feeAmount;

        // Send fee to protocol
        (bool feeSuccess, ) = config.usdcToken.call(
            abi.encodeWithSignature("transfer(address,uint256)", config.feeRecipient, feeAmount)
        );
        require(feeSuccess, "Fee transfer failed");

        // Send USDC to user
        (bool userSuccess, ) = config.usdcToken.call(
            abi.encodeWithSignature("transfer(address,uint256)", user, usdcForUser)
        );
        require(userSuccess, "User transfer failed");

        // Record harvest
        harvests[harvestId] = HarvestExecution({
            user: user,
            tokenSold: tokenSold,
            amountSold: amountSold,
            usdcReceived: usdcReceived,
            feeAmount: feeAmount,
            timestamp: block.timestamp,
            harvestId: harvestId,
            completed: true
        });
        userHarvests[user].push(harvestId);
        totalHarvests++;

        emit HarvestExecuted(harvestId, user, tokenSold, amountSold, usdcReceived, feeAmount);
    }

    /**
     * @notice Get all harvests for a user
     */
    function getUserHarvests(address user) external view returns (HarvestExecution[] memory) {
        bytes32[] storage ids = userHarvests[user];
        HarvestExecution[] memory results = new HarvestExecution[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            results[i] = harvests[ids[i]];
        }
        return results;
    }

    /**
     * @notice Calculate total tax savings (estimated) for a user's harvests
     * @dev This is an estimate assuming the user is in the 22% tax bracket
     * Real calculation happens off-chain
     */
    function calculateEstimatedSavings(
        address user,
        uint256 shortTermRate
    ) external view returns (uint256 totalSaved) {
        bytes32[] storage ids = userHarvests[user];
        uint256 totalLoss = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            totalLoss += harvests[ids[i]].usdcReceived;
        }
        // Estimated tax saved = loss * tax rate
        // Short-term gains offset at ordinary income rate
        return (totalLoss * shortTermRate) / 10000;
    }
}

// Minimal IERC20 interface
interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function approve(address spender, uint256 value) external returns (bool);
}
