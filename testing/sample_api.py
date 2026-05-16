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
@app.get("/api/v1/lcm")
def lcm(a: int, b: int) -> int:
    return abs(a*b) // math.gcd(a, b) 

def lcm(a: int, b: int) -> int:
    return abs(a*b) // math.gcd(a, b)

def lcm(a: int, b: int) -> int:
    return abs(a*b) // math.gcd(a, b)

def lcm(a: int, b: int) -> int:
    return abs(a*b) // math.gcd(a, b)


def merge(left: List[int], right: List[int]) -> List[int]:
    result = []
    i, j = 0, 0
    while i < len(left) and j < len(right):
        if left[i] < right[j]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    result += left[i:]
    result += right[j:]
    return result

def merge(left: List[int], right: List[int]) -> List[int]:
    result = []
    i, j = 0, 0
    while i < len(left) and j < len(right):
        if left[i] < right[j]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    result += left[i:]
    result += right[j:]
    return result

def merge_sort(arr: List[int]) -> List[int]:
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left = arr[:mid]
    right = arr[mid:]
    left = merge_sort(left)
    right = merge_sort(right)
    return merge(left, right)


@app.get("/api/v1/merge sort")
async def merge_sort_handler(arr: List[int]) -> List[int]:
    return merge_sort(arr)
