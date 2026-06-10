// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentPermissionRegistry
 * @notice ERC-7715 compatible permission registry for TaxFi
 * Manages granular, revocable permissions granted by users to agents.
 * Supports read-only, periodic spend, and function-call permission types.
 */
contract AgentPermissionRegistry {
    // --- Types ---

    enum PermissionType { READ_ONLY, ERC20_PERIODIC, ERC20_AMOUNT, FUNCTION_CALL }

    struct PermissionScope {
        uint256[] chainIds;
        address[] targetAddresses;
        PermissionType permissionType;
        bytes4[] allowedSelectors;   // for FUNCTION_CALL type
        address tokenAddress;        // for ERC20 types
        uint256 maxAmount;           // for ERC20 types
        uint256 periodDuration;      // for ERC20_PERIODIC type
    }

    struct Permission {
        address granter;
        address grantee;
        PermissionScope scope;
        uint256 validUntil;
        uint256 nonce;
        bool revoked;
    }

    // --- State ---

    /// @notice permissionHash => Permission
    mapping(bytes32 => Permission) public permissions;

    /// @notice granter => grantee => permissionHashes[]
    mapping(address => mapping(address => bytes32[])) public granterPermissions;

    /// @notice grantee => granter => permissionHashes[]
    mapping(address => mapping(address => bytes32[])) public granteePermissions;

    /// @notice Track consumed periodic amounts: permissionHash => periodStart => amount
    mapping(bytes32 => mapping(uint256 => uint256)) public periodicConsumed;

    uint256 public totalPermissions;

    // --- Events ---

    event PermissionGranted(
        bytes32 indexed permissionHash,
        address indexed granter,
        address indexed grantee,
        PermissionScope scope,
        uint256 validUntil
    );

    event PermissionRevoked(bytes32 indexed permissionHash, address indexed granter);

    event PermissionConsumed(
        bytes32 indexed permissionHash,
        address indexed grantee,
        uint256 amount,
        uint256 timestamp
    );

    // --- Errors ---

    error PermissionNotFound();
    error PermissionExpired();
    error PermissionRevokedError();
    error InsufficientAllowance();
    error Unauthorized();
    error InvalidScope();
    error InvalidGrantee();
    error InvalidExpiry();

    // --- Modifiers ---

    modifier onlyGranter(bytes32 permissionHash) {
        if (permissions[permissionHash].granter != msg.sender) revert Unauthorized();
        _;
    }

    // --- Core Functions ---

    /**
     * @notice Grant a permission to an agent
     * @param grantee The agent account receiving permission
     * @param scope The permission scope
     * @param validUntil Unix timestamp when permission expires
     */
    function grantPermission(
        address grantee,
        PermissionScope calldata scope,
        uint256 validUntil
    ) external returns (bytes32 permissionHash) {
        if (grantee == address(0)) revert InvalidGrantee();
        if (validUntil <= block.timestamp) revert InvalidExpiry();
        if (scope.chainIds.length == 0) revert InvalidScope();
        if (scope.permissionType == PermissionType.ERC20_PERIODIC) {
            if (scope.periodDuration == 0 || scope.maxAmount == 0 || scope.tokenAddress == address(0)) {
                revert InvalidScope();
            }
        }
        if (scope.permissionType == PermissionType.ERC20_AMOUNT) {
            if (scope.maxAmount == 0 || scope.tokenAddress == address(0)) revert InvalidScope();
        }

        permissionHash = keccak256(abi.encodePacked(
            msg.sender,
            grantee,
            scope.chainIds,
            scope.targetAddresses,
            scope.permissionType,
            scope.tokenAddress,
            scope.maxAmount,
            scope.periodDuration,
            validUntil,
            block.timestamp,
            totalPermissions
        ));

        Permission storage perm = permissions[permissionHash];
        perm.granter = msg.sender;
        perm.grantee = grantee;
        perm.scope = scope;
        perm.validUntil = validUntil;
        perm.nonce = totalPermissions;

        granterPermissions[msg.sender][grantee].push(permissionHash);
        granteePermissions[grantee][msg.sender].push(permissionHash);
        totalPermissions++;

        emit PermissionGranted(permissionHash, msg.sender, grantee, scope, validUntil);
    }

    /**
     * @notice Revoke a previously granted permission
     */
    function revokePermission(bytes32 permissionHash) external onlyGranter(permissionHash) {
        Permission storage perm = permissions[permissionHash];
        perm.revoked = true;
        emit PermissionRevoked(permissionHash, msg.sender);
    }

    /**
     * @notice Check if a permission is valid for a given amount
     * @param permissionHash The permission to check
     * @param amount The amount to validate (for ERC20 types)
     * @param chainId The chain the call is on
     * @param target The target contract address
     * @return isValid Whether the permission allows this action
     */
    function checkPermission(
        bytes32 permissionHash,
        uint256 amount,
        uint256 chainId,
        address target
    ) external view returns (bool isValid) {
        Permission storage perm = permissions[permissionHash];

        if (perm.grantee == address(0)) revert PermissionNotFound();
        if (perm.revoked) revert PermissionRevokedError();
        if (block.timestamp >= perm.validUntil) revert PermissionExpired();

        // Check chain scope
        bool chainAllowed = false;
        for (uint256 i = 0; i < perm.scope.chainIds.length; i++) {
            if (perm.scope.chainIds[i] == chainId) {
                chainAllowed = true;
                break;
            }
        }
        if (!chainAllowed) revert InvalidScope();

        // Check target address scope
        bool targetAllowed = false;
        for (uint256 i = 0; i < perm.scope.targetAddresses.length; i++) {
            if (perm.scope.targetAddresses[i] == target) {
                targetAllowed = true;
                break;
            }
        }
        if (!targetAllowed && perm.scope.targetAddresses.length > 0) revert InvalidScope();

        if (perm.scope.permissionType == PermissionType.READ_ONLY) {
            // Read-only permissions are always valid for read operations
            return true;
        }

        if (perm.scope.permissionType == PermissionType.ERC20_PERIODIC) {
            if (perm.scope.periodDuration == 0) revert InvalidScope();
            uint256 periodStart = (block.timestamp / perm.scope.periodDuration) * perm.scope.periodDuration;
            uint256 consumed = periodicConsumed[permissionHash][periodStart];
            return (consumed + amount) <= perm.scope.maxAmount;
        }

        if (perm.scope.permissionType == PermissionType.ERC20_AMOUNT) {
            return amount <= perm.scope.maxAmount;
        }

        return true;
    }

    /**
     * @notice Record consumption of a periodic permission
     */
    function consumePermission(
        bytes32 permissionHash,
        uint256 amount
    ) external {
        Permission storage perm = permissions[permissionHash];
        if (perm.grantee == address(0)) revert PermissionNotFound();
        if (perm.grantee != msg.sender) revert Unauthorized();
        if (perm.revoked) revert PermissionRevokedError();
        if (block.timestamp >= perm.validUntil) revert PermissionExpired();

        if (perm.scope.permissionType == PermissionType.ERC20_PERIODIC) {
            uint256 periodStart = (block.timestamp / perm.scope.periodDuration) * perm.scope.periodDuration;
            uint256 consumed = periodicConsumed[permissionHash][periodStart];
            if (consumed + amount > perm.scope.maxAmount) revert InsufficientAllowance();
            periodicConsumed[permissionHash][periodStart] = consumed + amount;
            emit PermissionConsumed(permissionHash, msg.sender, amount, block.timestamp);
        }
    }

    /**
     * @notice Get all permissions granted by a user
     */
    function getGranterPermissions(
        address granter,
        address grantee
    ) external view returns (bytes32[] memory) {
        return granterPermissions[granter][grantee];
    }

    /**
     * @notice Get all permissions held by an agent for a user
     */
    function getGranteePermissions(
        address grantee,
        address granter
    ) external view returns (bytes32[] memory) {
        return granteePermissions[grantee][granter];
    }

    /**
     * @notice Compute permission hash without storing (for client-side verification)
     */
    function computePermissionHash(
        address granter,
        address grantee,
        PermissionScope calldata scope,
        uint256 validUntil,
        uint256 nonce
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            granter, grantee, scope.chainIds, scope.targetAddresses,
            scope.permissionType, scope.tokenAddress, scope.maxAmount,
            scope.periodDuration, validUntil, nonce
        ));
    }
}
