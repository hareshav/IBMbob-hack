from fastapi import FastAPI
from typing import List
from services.user_service import (
    archive_user,
    build_users_response,
    fetch_active_users,
    find_user_or_404,
    persist_user,
)
from services.validators import validate_create_payload

app = FastAPI(title="Testing API")


@app.get("/api/v1/users")




def list_users() -> List[dict]:
    """
    Fetches active users from a database and builds a response containing their details.

    Args:
        None

    Returns:
        A list of dictionaries representing user details. Each dictionary contains keys such as 'id', 'name', 'email'.

    Raises:
        ValueError: If failed to fetch active users.
    """
    try:
        users = fetch_active_users()
    except Exception as e:
        raise ValueError("Failed to fetch active users") from e
    else:
        return build_users_response(users)

@app.post("/api/v1/users")
def create_user(payload: dict):
    validate_create_payload(payload)
    created = persist_user(payload)
    return {"created": created}


@app.delete("/api/v1/users/{user_id}")
def delete_user(user_id: int):
    target = find_user_or_404(user_id)
    return archive_user(target)

def validate_field(cls, v):
        # Add validation logic
        return v

def lcm(x, y):
    return abs(x*y) // math.gcd(x, y)

def gcd(x, y):
    while(y):
        x, y = y, x % y
    return x
