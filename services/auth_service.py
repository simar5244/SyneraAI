from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from typing import Optional
import mongo_adapter

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

class AuthService:
    @staticmethod
    async def get_current_user(token: str = Depends(oauth2_scheme)):
        """
        Get current user from token
        In a real app, this would validate a JWT token
        For this demo, we'll use a simple token=user_id lookup
        """
        try:
            user_id = token
            user = mongo_adapter.get_user(user_id)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication credentials",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            return user
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token format",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    @staticmethod
    async def validate_top_management(current_user: dict = Depends(oauth2_scheme)):
        """Validate that current user is in top management"""
        # First get the current user
        user = await AuthService.get_current_user(current_user)
        
        # Then check if they're in top management
        if not user.get("is_top_management", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Top Management role required"
            )
        return user 