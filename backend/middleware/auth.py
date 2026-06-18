"""
TaxFi — Authentication Middleware

JWT-based authentication for the API.
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException, Security, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from slowapi import Limiter
from slowapi.util import get_remote_address

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT configuration
SECRET_KEY = "your-secret-key-change-in-production"  # From environment
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

security = HTTPBearer()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    """Get the current user from JWT token."""
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_address: str = payload.get("sub")
        if user_address is None:
            raise credentials_exception
        return {"address": user_address, "token": credentials.credentials}
    except JWTError:
        raise credentials_exception


async def verify_wallet_signature(
    request: Request,
    address: str,
    signature: str,
    message: str,
) -> bool:
    """
    Verify a wallet signature for non-custodial auth.

    Uses eth_account to recover the signer from a signed message
    and compares it against the claimed address.
    """
    try:
        from web3 import Web3
        from eth_account.messages import encode_defunct

        w3 = Web3()
        message_hash = encode_defunct(text=message)
        recovered = w3.eth.account.recover_message(message_hash, signature=signature)
        return recovered.lower() == address.lower()
    except Exception as e:
        raise RuntimeError(f"Wallet signature verification failed: {e}")


class RateLimitExceeded(HTTPException):
    """Custom exception for rate limit violations."""
    def __init__(self):
        super().__init__(
            status_code=429,
            detail="Rate limit exceeded",
            headers={"Retry-After": "60"},
        )


def check_rate_limit(request: Request):
    """Check rate limit for a request."""
    # This will be used as a dependency
    return True  # Rate limiting handled by slowapi middleware