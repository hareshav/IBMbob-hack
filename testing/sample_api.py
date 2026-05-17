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
def create_user(payload: dict):
    validate_create_payload(payload)
    created = persist_user(payload)
    return {"created": created}
@app.delete("/api/v1/users/{user_id}")
def delete_user(user_id: int):
    target = find_user_or_404(user_id)
    return archive_user(target)


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

@app.get("/api/v1/mergesort")
def mergesort(arr):
    if len(arr) > 1:
        mid = len(arr) // 2
        left_half = arr[:mid]
        right_half = arr[mid:]

        mergesort(left_half)
        mergesort(right_half)

        i = j = k = 0

        while i < len(left_half) and j < len(right_half):
            if left_half[i] < right_half[j]:
                arr[k] = left_half[i]
                i += 1
            else:
                arr[k] = right_half[j]
                j += 1
            k += 1

        while i < len(left_half):
            arr[k] = left_half[i]
            i += 1
            k += 1

        while j < len(right_half):
            arr[k] = right_half[j]
            j += 1
            k += 1

    return arr

@app.get("/api/v1/quicksort")
def mergesort(arr):
    if len(arr) > 1:
        mid = len(arr) // 2
        left_half = arr[:mid]
        right_half = arr[mid:]

        mergesort(left_half)
        mergesort(right_half)

        i = j = k = 0

        while i < len(left_half) and j < len(right_half):
            if left_half[i] < right_half[j]:
                arr[k] = left_half[i]
                i += 1
            else:
                arr[k] = right_half[j]
                j += 1
            k += 1

        while i < len(left_half):
            arr[k] = left_half[i]
            i += 1
            k += 1

        while j < len(right_half):
            arr[k] = right_half[j]
            j += 1
            k += 1

    return arr

@app.get("/api/v1/reduxsort")
def reduxsort(arr):
    if len(arr) > 1:
        mid = len(arr) // 2
        left_half = arr[:mid]
        right_half = arr[mid:]

        reduxsort(left_half)
        reduxsort(right_half)

        i = j = k = 0

        while i < len(left_half) and j < len(right_half):
            if left_half[i] < right_half[j]:
                arr[k] = left_half[i]
                i += 1
            else:
                arr[k] = right_half[j]
                j += 1
            k += 1

        while i < len(left_half):
            arr[k] = left_half[i]
            i += 1
            k += 1

        while j < len(right_half):
            arr[k] = right_half[j]
            j += 1
            k += 1

    return arr

@app.get("/api/v1/selectionsort")
def selectionsort(arr):
    for i in range(len(arr)):
        min_idx = i
        for j in range(i+1, len(arr)):
            if arr[j] < arr[min_idx]:
                min_idx = j
        arr[i], arr[min_idx] = arr[min_idx], arr[i]
    return arr

@app.post("/api/v1/selectionsort")
def count_users():
    return len(fetch_active_users())
