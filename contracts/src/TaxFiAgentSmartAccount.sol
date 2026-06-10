// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TaxFiAgentSmartAccount
 * @notice Smart account for the TaxFi agent that executes loss-harvesting
 * transactions within ERC-7715/ERC-7710 permission scope.
 * Rate-limited per chain per day with configurable caps.
 */
contract TaxFiAgentSmartAccount {
    // --- Types ---

    struct RateLimit {
        uint256 dailyCap;           // Max USD value per day
        uint256 dailyUsed;           // Used today
        uint256 lastResetTimestamp;  // Last time the daily counter was reset
    }

    struct AgentConfig {
        address owner;               // TaxFi protocol owner
        address permissionRegistry;  // AgentPermissionRegistry address
        address allowedRouter;       // Allowed swap router
        address usdcToken;           // USDC token address
        uint256 maxHarvestPerTx;     // Max single harvest value
    }

    // --- State ---

    AgentConfig public config;
    /// @notice chainId => RateLimit
    mapping(uint256 => RateLimit) public chainRateLimits;

    /// @notice permissionHash => bool used
    mapping(bytes32 => bool) public usedPermissions;

    /// @notice emergency pause
    bool public paused;

    /// @notice authorized executors that can trigger harvest calls
    mapping(address => bool) public authorizedExecutors;

    // --- Events ---

    event HarvestExecuted(
        bytes32 indexed permissionHash,
        address indexed user,
        address tokenSold,
        uint256 amountSold,
        uint256 usdcReceived,
        uint256 value
    );

    event RateLimitUpdated(uint256 indexed chainId, uint256 dailyCap);
    event ConfigUpdated(address permissionRegistry, address router);
    event Paused(bool paused);
    event ExecutorAuthorized(address executor, bool authorized);

    // --- Errors ---

    error PausedError();
    error ExceedsDailyCap();
    error ExceedsMaxHarvest();
    error PermissionNotValid();
    error PermissionAlreadyUsed();
    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();

    // --- Modifiers ---

    modifier whenNotPaused() {
        if (paused) revert PausedError();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != config.owner) revert Unauthorized();
        _;
    }

    modifier onlyAuthorizedExecutor() {
        if (msg.sender != config.owner && !authorizedExecutors[msg.sender]) revert Unauthorized();
        _;
    }

    // --- Constructor ---

    constructor(
        address _owner,
        address _permissionRegistry,
        address _allowedRouter,
        address _usdcToken,
        uint256 _maxHarvestPerTx
    ) {
        if (
            _owner == address(0) ||
            _permissionRegistry == address(0) ||
            _allowedRouter == address(0) ||
            _usdcToken == address(0)
        ) revert InvalidAddress();

        config = AgentConfig({
            owner: _owner,
            permissionRegistry: _permissionRegistry,
            allowedRouter: _allowedRouter,
            usdcToken: _usdcToken,
            maxHarvestPerTx: _maxHarvestPerTx
        });
    }

    // --- Configuration ---

    function setPermissionRegistry(address _registry) external onlyOwner {
        config.permissionRegistry = _registry;
        emit ConfigUpdated(_registry, config.allowedRouter);
    }

    function setRateLimit(uint256 chainId, uint256 dailyCap) external onlyOwner {
        chainRateLimits[chainId].dailyCap = dailyCap;
        emit RateLimitUpdated(chainId, dailyCap);
    }

    function authorizeExecutor(address executor, bool authorized) external onlyOwner {
        if (executor == address(0)) revert InvalidAddress();
        authorizedExecutors[executor] = authorized;
        emit ExecutorAuthorized(executor, authorized);
    }

    function pause(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    // --- Rate Limit ---

    function _checkAndUpdateRateLimit(uint256 chainId, uint256 value) internal {
        RateLimit storage limit = chainRateLimits[chainId];
        uint256 today = block.timestamp / 1 days;

        if (limit.lastResetTimestamp < today * 1 days) {
            limit.dailyUsed = 0;
            limit.lastResetTimestamp = block.timestamp;
        }

        if (value > config.maxHarvestPerTx) revert ExceedsMaxHarvest();
        if (limit.dailyUsed + value > limit.dailyCap) revert ExceedsDailyCap();

        limit.dailyUsed += value;
    }

    // --- Core Execution ---

    /**
     * @notice Execute a tax loss harvest on behalf of a user
     * @param permissionHash The ERC-7715 permission hash from AgentPermissionRegistry
     * @param user The user's Smart Account
     * @param tokenSold The token being sold (the losing position)
     * @param amountSold Amount to sell
     * @param usdcOut Expected USDC output
     * @param swapData Calldata for the DEX swap
     * @param chainId Chain where this executes
     */
    function executeHarvest(
        bytes32 permissionHash,
        address user,
        address tokenSold,
        uint256 amountSold,
        uint256 usdcOut,
        bytes calldata swapData,
        uint256 chainId
    ) external whenNotPaused onlyAuthorizedExecutor returns (bool) {
        if (usedPermissions[permissionHash]) revert PermissionAlreadyUsed();
        if (user == address(0) || tokenSold == address(0)) revert InvalidAddress();
        if (amountSold == 0 || usdcOut == 0) revert InvalidAmount();

        // Validate permission against the registry
        AgentPermissionRegistry registry = AgentPermissionRegistry(config.permissionRegistry);
        bool isValid = registry.checkPermission(
            permissionHash,
            usdcOut,
            chainId,
            tokenSold
        );
        if (!isValid) revert PermissionNotValid();

        // Check rate limits
        _checkAndUpdateRateLimit(chainId, usdcOut);

        // Mark permission as used (prevent replay)
        usedPermissions[permissionHash] = true;

        // Record consumption in registry
        registry.consumePermission(permissionHash, usdcOut);

        emit HarvestExecuted(
            permissionHash,
            user,
            tokenSold,
            amountSold,
            usdcOut,
            usdcOut
        );

        return true;
    }

    /**
     * @notice Emergency withdraw of any stuck tokens
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        (bool success, ) = token.call(abi.encodeWithSignature("transfer(address,uint256)", config.owner, amount));
        require(success, "Withdraw failed");
    }
}

// Import interface from the registry
interface AgentPermissionRegistry {
    function checkPermission(
        bytes32 permissionHash,
        uint256 amount,
        uint256 chainId,
        address target
    ) external view returns (bool isValid);
    function consumePermission(bytes32 permissionHash, uint256 amount) external;
}
