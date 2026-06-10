// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TaxFormAttestor
 * @notice Anchors IRS Form 8949 and Schedule D document hashes onchain,
 * providing an immutable audit trail for crypto tax filings.
 * Users can prove what forms were submitted for which tax year.
 */
contract TaxFormAttestor {
    // --- Types ---

    enum FormType { FORM_8949, SCHEDULE_D, SCHEDULE_1, SCHEDULE_C, FORM_1099_DA }

    struct FormAttestation {
        address user;
        FormType formType;
        uint256 taxYear;
        bytes32 documentHash;       // SHA-256 hash of the generated PDF
        bytes32 previousYearHash;   // Chain to prior year's filing
        string ipfsCid;             // IPFS content identifier for the full document
        uint256 timestamp;
        bool verified;
    }

    struct UserInfo {
        string jurisdiction;         // e.g. "US"
        uint256 firstTaxYear;        // First year they filed with TaxFi
        bytes32 latestFormHash;      // Hash of their most recent filing
    }

    // --- State ---

    /// @notice attestationId => FormAttestation
    mapping(bytes32 => FormAttestation) public attestations;

    /// @notice user => FormAttestation[]
    mapping(address => bytes32[]) public userAttestations;

    /// @notice user => UserInfo
    mapping(address => UserInfo) public userInfo;

    /// @notice (user, formType, taxYear) => attestationId
    mapping(bytes32 => bytes32) public yearlyAttestation;

    /// @notice Authorized TaxFi agent signers
    mapping(address => bool) public authorizedSigners;

    address public owner;
    uint256 public totalAttestations;

    // --- Events ---

    event FormAttested(
        bytes32 indexed attestationId,
        address indexed user,
        FormType formType,
        uint256 indexed taxYear,
        bytes32 documentHash,
        string ipfsCid
    );

    event FormVerified(bytes32 indexed attestationId, address indexed verifier);
    event SignerAuthorized(address signer, bool authorized);

    // --- Errors ---

    error UnauthorizedSigner();
    error AttestationNotFound();
    error AlreadyAttested();
    error InvalidYear();

    // --- Modifiers ---

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAuthorized() {
        if (!authorizedSigners[msg.sender]) revert UnauthorizedSigner();
        _;
    }

    // --- Constructor ---

    constructor() {
        owner = msg.sender;
    }

    // --- Management ---

    function authorizeSigner(address signer, bool authorized) external onlyOwner {
        authorizedSigners[signer] = authorized;
        emit SignerAuthorized(signer, authorized);
    }

    // --- Core Functions ---

    /**
     * @notice Attest a tax form by anchoring its hash onchain
     * @param user The user who the form belongs to
     * @param formType The type of tax form
     * @param taxYear The tax year (e.g. 2025)
     * @param documentHash SHA-256 hash of the generated PDF
     * @param ipfsCid IPFS CID where the full document is stored
     * @return attestationId Unique identifier for this attestation
     */
    function attestForm(
        address user,
        FormType formType,
        uint256 taxYear,
        bytes32 documentHash,
        string calldata ipfsCid
    ) external onlyAuthorized returns (bytes32 attestationId) {
        if (user == address(0) || documentHash == bytes32(0)) revert InvalidYear();

        uint256 currentYear = 1970 + (block.timestamp / 365 days);
        if (taxYear < 2020 || taxYear > currentYear + 1) {
            revert InvalidYear();
        }

        bytes32 uniqueKey = keccak256(abi.encodePacked(user, formType, taxYear));
        if (yearlyAttestation[uniqueKey] != bytes32(0)) revert AlreadyAttested();

        attestationId = keccak256(abi.encodePacked(user, formType, taxYear, documentHash));

        bytes32 previousYearHash = bytes32(0);
        // If user has existing attestations, link to most recent
        UserInfo storage info = userInfo[user];
        if (info.firstTaxYear != 0) {
            previousYearHash = info.latestFormHash;
        } else {
            info.firstTaxYear = taxYear;
        }

        attestations[attestationId] = FormAttestation({
            user: user,
            formType: formType,
            taxYear: taxYear,
            documentHash: documentHash,
            previousYearHash: previousYearHash,
            ipfsCid: ipfsCid,
            timestamp: block.timestamp,
            verified: false
        });

        userAttestations[user].push(attestationId);
        yearlyAttestation[uniqueKey] = attestationId;
        info.latestFormHash = attestationId;
        totalAttestations++;

        emit FormAttested(attestationId, user, formType, taxYear, documentHash, ipfsCid);
    }

    /**
     * @notice Verify an attestation (called by user or CPA)
     */
    function verifyAttestation(bytes32 attestationId) external returns (bool) {
        FormAttestation storage att = attestations[attestationId];
        if (att.user == address(0)) revert AttestationNotFound();

        att.verified = true;
        emit FormVerified(attestationId, msg.sender);
        return true;
    }

    /**
     * @notice Get all attestations for a user
     */
    function getUserAttestations(address user) external view returns (FormAttestation[] memory) {
        bytes32[] storage ids = userAttestations[user];
        FormAttestation[] memory results = new FormAttestation[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            results[i] = attestations[ids[i]];
        }
        return results;
    }

    /**
     * @notice Verify a document hash matches an attestation
     */
    function verifyDocument(bytes32 attestationId, bytes32 documentHash) external view returns (bool) {
        return attestations[attestationId].documentHash == documentHash;
    }

    /**
     * @notice Get user's filing history chain
     */
    function getFilingChain(address user) external view returns (bytes32[] memory) {
        return userAttestations[user];
    }
}
