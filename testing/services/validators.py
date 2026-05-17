from fastapi import HTTPException

def validate_create_payload(payload: Dict[str, str]):
    """Validate the create payload.

    Args:
        payload (Dict[str, str]): The payload to validate.

    Raises:
        HTTPException: If the 'name' key is missing or empty.
    """
    if 'name' not in payload or not payload['name']:
        raise HTTPException(status_code=400, detail='name is required to proceed')
    else:
        # add error handling here
        pass
