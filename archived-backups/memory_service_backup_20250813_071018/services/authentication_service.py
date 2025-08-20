"""
Authentication Service
JWT token validation and user authentication for memory service
"""

import jwt
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class AuthenticationService:
    """
    Service for handling JWT token validation and user authentication
    Integrates with existing AI Workflow Engine authentication system
    """
    
    def __init__(self):
        self.jwt_secret = settings.get_jwt_secret_key()
        self.jwt_algorithm = settings.JWT_ALGORITHM
        self.token_expire_minutes = settings.JWT_EXPIRE_MINUTES
    
    async def validate_token(self, token: str) -> Dict[str, Any]:
        """
        Validate JWT token and return user information
        
        Args:
            token: JWT token string
            
        Returns:
            Dict containing user information
            
        Raises:
            Exception: If token is invalid or expired
        """
        try:
            # Decode JWT token
            payload = jwt.decode(
                token,
                self.jwt_secret,
                algorithms=[self.jwt_algorithm]
            )
            
            # Check token expiration
            exp_timestamp = payload.get("exp")
            if exp_timestamp:
                exp_datetime = datetime.fromtimestamp(exp_timestamp)
                if exp_datetime < datetime.utcnow():
                    raise jwt.ExpiredSignatureError("Token has expired")
            
            # Extract user information
            user_info = {
                "user_id": payload.get("user_id"),
                "email": payload.get("email"),
                "username": payload.get("username", payload.get("sub")),
                "roles": payload.get("roles", []),
                "permissions": payload.get("permissions", []),
                "token_issued_at": payload.get("iat"),
                "token_expires_at": payload.get("exp")
            }
            
            # Validate required fields
            if not user_info["user_id"]:
                raise ValueError("Token missing required user_id field")
            
            logger.debug(f"Token validated for user {user_info['user_id']}")
            return user_info
            
        except jwt.ExpiredSignatureError:
            logger.warning("Expired JWT token provided")
            raise Exception("Token has expired")
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid JWT token: {e}")
            raise Exception("Invalid token")
        except Exception as e:
            logger.error(f"Token validation failed: {e}")
            raise Exception(f"Token validation error: {str(e)}")
    
    async def check_user_permissions(
        self,
        user_info: Dict[str, Any],
        required_permission: str
    ) -> bool:
        """
        Check if user has required permission
        
        Args:
            user_info: User information from validated token
            required_permission: Permission to check for
            
        Returns:
            True if user has permission, False otherwise
        """
        try:
            user_permissions = user_info.get("permissions", [])
            user_roles = user_info.get("roles", [])
            
            # Check direct permission
            if required_permission in user_permissions:
                return True
            
            # Check admin role (has all permissions)
            if "admin" in user_roles:
                return True
            
            # Check role-based permissions (simplified)
            permission_roles = {
                "memory:read": ["user", "admin"],
                "memory:write": ["user", "admin"],
                "memory:delete": ["admin"],
                "memory:admin": ["admin"]
            }
            
            allowed_roles = permission_roles.get(required_permission, [])
            return any(role in user_roles for role in allowed_roles)
            
        except Exception as e:
            logger.error(f"Permission check failed: {e}")
            return False
    
    def create_service_token(
        self,
        user_id: int,
        service_name: str = "memory-service",
        expire_minutes: Optional[int] = None
    ) -> str:
        """
        Create a service-to-service JWT token
        
        Args:
            user_id: User ID for the token
            service_name: Name of the service
            expire_minutes: Custom expiration time
            
        Returns:
            JWT token string
        """
        try:
            expire_time = expire_minutes or self.token_expire_minutes
            exp_datetime = datetime.utcnow() + timedelta(minutes=expire_time)
            
            payload = {
                "user_id": user_id,
                "service": service_name,
                "iat": datetime.utcnow(),
                "exp": exp_datetime,
                "aud": "memory-service",
                "iss": "ai-workflow-engine"
            }
            
            token = jwt.encode(
                payload,
                self.jwt_secret,
                algorithm=self.jwt_algorithm
            )
            
            return token
            
        except Exception as e:
            logger.error(f"Service token creation failed: {e}")
            raise
    
    async def validate_service_token(self, token: str, expected_service: str) -> Dict[str, Any]:
        """
        Validate service-to-service token
        
        Args:
            token: JWT token string
            expected_service: Expected service name
            
        Returns:
            Dict containing token information
        """
        try:
            payload = jwt.decode(
                token,
                self.jwt_secret,
                algorithms=[self.jwt_algorithm],
                audience="memory-service"
            )
            
            # Check service name
            service = payload.get("service")
            if service != expected_service:
                raise ValueError(f"Invalid service name: {service}")
            
            return {
                "user_id": payload.get("user_id"),
                "service": service,
                "issued_at": payload.get("iat"),
                "expires_at": payload.get("exp")
            }
            
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid service token: {e}")
            raise Exception("Invalid service token")
    
    def extract_user_id_from_token(self, token: str) -> Optional[int]:
        """
        Extract user ID from token without full validation (for logging/metrics)
        
        Args:
            token: JWT token string
            
        Returns:
            User ID if extractable, None otherwise
        """
        try:
            # Decode without verification for quick extraction
            payload = jwt.decode(
                token,
                options={"verify_signature": False, "verify_exp": False}
            )
            return payload.get("user_id")
        except Exception:
            return None
    
    async def refresh_token_if_needed(
        self,
        token: str,
        refresh_threshold_minutes: int = 60
    ) -> Optional[str]:
        """
        Check if token needs refresh and return new token if needed
        
        Args:
            token: Current JWT token
            refresh_threshold_minutes: Minutes before expiry to trigger refresh
            
        Returns:
            New token if refresh needed, None otherwise
        """
        try:
            payload = jwt.decode(
                token,
                self.jwt_secret,
                algorithms=[self.jwt_algorithm]
            )
            
            exp_timestamp = payload.get("exp")
            if not exp_timestamp:
                return None
            
            exp_datetime = datetime.fromtimestamp(exp_timestamp)
            threshold_datetime = datetime.utcnow() + timedelta(minutes=refresh_threshold_minutes)
            
            # Check if token expires within threshold
            if exp_datetime < threshold_datetime:
                user_id = payload.get("user_id")
                if user_id:
                    # Create new token
                    return self.create_service_token(user_id)
            
            return None
            
        except Exception as e:
            logger.debug(f"Token refresh check failed: {e}")
            return None
    
    def get_token_info(self, token: str) -> Dict[str, Any]:
        """
        Get information about a token without validation
        
        Args:
            token: JWT token string
            
        Returns:
            Dict with token information
        """
        try:
            payload = jwt.decode(
                token,
                options={"verify_signature": False, "verify_exp": False}
            )
            
            exp_timestamp = payload.get("exp")
            iat_timestamp = payload.get("iat")
            
            return {
                "user_id": payload.get("user_id"),
                "email": payload.get("email"),
                "service": payload.get("service"),
                "issued_at": datetime.fromtimestamp(iat_timestamp) if iat_timestamp else None,
                "expires_at": datetime.fromtimestamp(exp_timestamp) if exp_timestamp else None,
                "audience": payload.get("aud"),
                "issuer": payload.get("iss"),
                "is_expired": datetime.fromtimestamp(exp_timestamp) < datetime.utcnow() if exp_timestamp else False
            }
            
        except Exception as e:
            logger.error(f"Token info extraction failed: {e}")
            return {"error": str(e)}