from fastapi import HTTPException
from jose import jwt, JWTError
from auth import SECRET_KEY, ALGORITHM

def require_admin(token_str: str) -> str:
    try:
        payload = jwt.decode(token_str, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Token missing sub")

        # simplest: treat specific email as admin OR fetch from DB (recommended below)
        return email
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
