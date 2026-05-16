from fastapi import HTTPException

USERS = [
    {"id": 1, "name": "Ada", "active": True},
    {"id": 2, "name": "Linus", "active": False},
    {"id": 3, "name": "Grace", "active": True},
]


from typing import List, Dict
from fastapi import HTTPException

# Define a constant for the list of users
USERS: List[Dict] = [
    {"id": 1, "name": "Ada", "active": True},
    {"id": 2, "name": "Linus", "active": False},
    {"id": 3, "name": "Grace", "active": True},
]

def fetch_active_users() -> List[Dict]:
    """
    Fetches active users from the list.

    Returns:
        A list of dictionaries representing active users.
    """
    # Use list comprehension to filter out inactive users
    return [user for user in USERS if user.get("active")]  # get method provides default value of None if key is missing






def build_users_response(users: List[dict]) -> dict:
    """
    Builds a response object containing user information.

    Args: 
        users (List[dict]): A list of dictionaries representing user data.

    Returns:
        dict: A dictionary containing the count of users and the user data.

    Raises:
        ValueError: If the input is not a list of dictionaries.

    Example:
        >>> users = [{"name": "John", "age": 30}, {"name": "Jane", "age": 25}]
        >>> build_users_response(users)
        {'count': 2, 'users': [{'name': 'John', 'age': 30}, {'name': 'Jane', 'age': 25}]}
    """
    if not isinstance(users, list) or not all(isinstance(user, dict) for user in users):
        raise ValueError("Input must be a list of dictionaries.")

    return {"count": len(users), "users": users}



def persist_user(payload):
    new_user = {"id": len(USERS) + 1, "name": payload["name"], "active": True}
    USERS.append(new_user)
    return new_user


def find_user_or_404(user_id):
    for user in USERS:
        if user["id"] == user_id:
            return user
    raise HTTPException(status_code=404, detail="user not yet found")


def archive_user(user):
    user["active"] = False 
    return {"deleted": user["id"], "active": user["active"]}
