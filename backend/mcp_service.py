"""
Enhanced MCP Server for Api-Architect Mode with IBM watsonx.ai Integration

Integrates with:
- IBM watsonx.ai Foundation Models (Granite 4.1) for code generation
- watsonx Orchestrate for human-in-the-loop approval workflows
- Checkpoint recovery system for safe code modifications
- Comprehensive validation and security checks
"""

import json
import ast
import os
import re
import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from dotenv import load_dotenv

# Load variables from the .env file into the environment
load_dotenv(Path(__file__).with_name(".env"))
# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import watsonx integration
try:
    try:
        from watsonx_integration import (
            get_watsonx_client,
            get_checkpoint_manager,
            get_orchestrate,
        )
    except ModuleNotFoundError:
        from backend.watsonx_integration import (
            get_watsonx_client,
            get_checkpoint_manager,
            get_orchestrate,
        )
    WATSONX_AVAILABLE = True
    logger.info("✅ IBM watsonx.ai integration loaded successfully")
except ImportError as e:
    WATSONX_AVAILABLE = False
    logger.warning(f"⚠️  watsonx integration not available: {e}")
    logger.warning("Running in fallback mode with simulated responses")

# Import LangChain autonomous agent service used for multi-file implementation.
try:
    try:
        from langchain_agent_service import (
            AutonomousWorkspaceAgent,
            DEFAULT_MAX_ITERATIONS as AGENT_DEFAULT_MAX_ITERATIONS,
            DEFAULT_MODEL_ID as AGENT_DEFAULT_MODEL_ID,
            DEFAULT_WATSONX_URL as AGENT_DEFAULT_WATSONX_URL,
        )
    except ModuleNotFoundError:
        from backend.langchain_agent_service import (
            AutonomousWorkspaceAgent,
            DEFAULT_MAX_ITERATIONS as AGENT_DEFAULT_MAX_ITERATIONS,
            DEFAULT_MODEL_ID as AGENT_DEFAULT_MODEL_ID,
            DEFAULT_WATSONX_URL as AGENT_DEFAULT_WATSONX_URL,
        )
    LANGCHAIN_AGENT_AVAILABLE = True
except ImportError as e:
    LANGCHAIN_AGENT_AVAILABLE = False
    AGENT_DEFAULT_MAX_ITERATIONS = 24
    AGENT_DEFAULT_MODEL_ID = "ibm/granite-8b-code-instruct"
    AGENT_DEFAULT_WATSONX_URL = "https://us-south.ml.cloud.ibm.com"
    logger.warning(f"⚠️  LangChain agent service not available: {e}")

# MCP Server Application
app = FastAPI(
    title="IBM watsonx Api-Architect MCP Server",
    description="Enhanced MCP server with IBM watsonx.ai Granite models and Orchestrate workflows",
    version="2.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Project paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE_PATH = os.getenv("WORKSPACE_PATH", str(PROJECT_ROOT))

_WATSONX_REQUIRED_ENV_VARS = ("WATSONX_API_KEY", "WATSONX_PROJECT_ID")
_watsonx_fallback_logged = False
_MODEL_CACHE_TTL_SECONDS = 300
_model_catalog_cache: Optional[Dict[str, Any]] = None
_model_catalog_cached_at: float = 0.0

FALLBACK_MODEL_IDS = [
    "cross-encoder/ms-marco-minilm-l-12-v2",
    "ibm/granite-3-1-8b-base",
    "ibm/granite-3-8b-instruct",
    "ibm/granite-4-h-small",
    "ibm/granite-8b-code-instruct",
    "ibm/granite-embedding-278m-multilingual",
    "ibm/granite-guardian-3-8b",
    "ibm/granite-ttm-1024-96-r2",
    "ibm/granite-ttm-1536-96-r2",
    "ibm/granite-ttm-512-96-r2",
    "ibm/slate-125m-english-rtrvr-v2",
    "ibm/slate-30m-english-rtrvr-v2",
    "intfloat/multilingual-e5-large",
    "meta-llama/llama-3-1-70b-gptq",
    "meta-llama/llama-3-1-8b",
    "meta-llama/llama-3-2-11b-vision-instruct",
    "meta-llama/llama-3-2-90b-vision-instruct",
    "meta-llama/llama-3-3-70b-instruct",
    "meta-llama/llama-4-maverick-17b-128e-instruct-fp8",
    "meta-llama/llama-guard-3-11b-vision",
    "mistral-large-2512",
    "mistralai/mistral-medium-2505",
    "mistralai/mistral-small-3-1-24b-instruct-2503",
    "openai/gpt-oss-120b",
    "sentence-transformers/all-minilm-l6-v2",
]
PREFERRED_CODE_MODELS = [
    "ibm/granite-8b-code-instruct",
    "ibm/granite-3-8b-instruct",
    "ibm/granite-4-h-small",
    "meta-llama/llama-3-3-70b-instruct",
    "mistral-large-2512",
    "mistralai/mistral-medium-2505",
    "openai/gpt-oss-120b",
]


def _missing_watsonx_env_vars() -> List[str]:
    """Return required watsonx environment variables that are currently missing."""
    return [name for name in _WATSONX_REQUIRED_ENV_VARS if not os.environ.get(name)]


def _is_watsonx_runtime_enabled() -> bool:
    """True when watsonx integration is importable and required credentials are set."""
    return WATSONX_AVAILABLE and not _missing_watsonx_env_vars()


def _log_watsonx_fallback_reason_once() -> None:
    """Log why fallback mode is active, at most once per process."""
    global _watsonx_fallback_logged
    if _watsonx_fallback_logged:
        return
    _watsonx_fallback_logged = True

    if not WATSONX_AVAILABLE:
        logger.warning("watsonx fallback mode active: integration module could not be imported")
        return

    missing = _missing_watsonx_env_vars()
    if missing:
        logger.warning(
            "watsonx fallback mode active: missing environment variables: %s",
            ", ".join(missing),
        )


def _fallback_model_catalog() -> List[Dict[str, Any]]:
    """Fallback model metadata used when live lookup fails."""
    return [
        {
            "id": model_id,
            "label": model_id.split("/")[-1],
            "provider": model_id.split("/")[0] if "/" in model_id else "unknown",
            "functions": [],
        }
        for model_id in FALLBACK_MODEL_IDS
    ]


def _pick_default_model_id(model_ids: List[str]) -> Optional[str]:
    """Pick a sensible default model for code-generation/refactoring."""
    available = set(model_ids)
    for model_id in PREFERRED_CODE_MODELS:
        if model_id in available:
            return model_id
    return model_ids[0] if model_ids else None


def _get_model_catalog(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Return model catalog for UI dropdown.

    Tries live watsonx model specs first, then falls back to a static list.
    """
    global _model_catalog_cache
    global _model_catalog_cached_at

    now = time.time()
    if (
        not force_refresh
        and _model_catalog_cache is not None
        and (now - _model_catalog_cached_at) < _MODEL_CACHE_TTL_SECONDS
    ):
        return _model_catalog_cache

    fallback_models = _fallback_model_catalog()
    fallback_payload = {
        "source": "fallback",
        "models": fallback_models,
        "default_model_id": _pick_default_model_id([m["id"] for m in fallback_models]),
    }

    if not _is_watsonx_runtime_enabled():
        _model_catalog_cache = fallback_payload
        _model_catalog_cached_at = now
        return fallback_payload

    try:
        from ibm_watsonx_ai.foundation_models import get_model_specs

        watsonx_url = os.environ.get("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")
        specs = get_model_specs(watsonx_url)
        resources = specs.get("resources", [])

        models: List[Dict[str, Any]] = []
        for resource in resources:
            model_id = resource.get("model_id")
            if not model_id:
                continue

            function_ids: List[str] = []
            for fn in resource.get("functions") or []:
                if isinstance(fn, dict) and fn.get("id"):
                    function_ids.append(fn["id"])
                elif isinstance(fn, str):
                    function_ids.append(fn)

            models.append(
                {
                    "id": model_id,
                    "label": resource.get("label") or model_id.split("/")[-1],
                    "provider": resource.get("provider") or (model_id.split("/")[0] if "/" in model_id else "unknown"),
                    "functions": function_ids,
                }
            )

        models.sort(key=lambda item: item["id"])
        model_ids = [m["id"] for m in models]
        payload = {
            "source": "live",
            "models": models,
            "default_model_id": _pick_default_model_id(model_ids),
        }
        _model_catalog_cache = payload
        _model_catalog_cached_at = now
        return payload

    except Exception as exc:
        logger.warning("Falling back to static model list: %s", exc)
        _model_catalog_cache = fallback_payload
        _model_catalog_cached_at = now
        return fallback_payload


def _validate_model_id_or_raise(model_id: Optional[str]) -> None:
    """Validate a user-selected model_id against the known catalog."""
    if not model_id:
        return
    catalog = _get_model_catalog()
    model_ids = {item["id"] for item in catalog.get("models", [])}
    if model_id in model_ids:
        return
    suggested = sorted(model_ids)[:8]
    raise HTTPException(
        status_code=400,
        detail=(
            f"Unsupported model_id '{model_id}'. "
            f"Use GET /mcp/models and select one of the supported IDs. "
            f"Sample supported IDs: {suggested}"
        ),
    )


# ============================================================================
# Request/Response Models
# ============================================================================

class GenerateEndpointRequest(BaseModel):
    """Request to generate a new REST API endpoint."""
    model_config = {"protected_namespaces": ()}
    method: str = Field(..., description="HTTP method (GET, POST, PUT, DELETE, PATCH)")
    path: str = Field(..., description="Endpoint path (e.g., /api/v1/users)")
    description: str = Field(..., description="Natural language description of endpoint logic")
    target_file: Optional[str] = Field(None, description="Target file path for the endpoint")
    include_tests: bool = Field(False, description="Whether to generate test cases")
    model_id: Optional[str] = Field(None, description="Optional watsonx model ID for code generation")
    
    @field_validator("method")
    @classmethod
    def validate_method(cls, v: str) -> str:
        allowed = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
        if v.upper() not in allowed:
            raise ValueError(f'Method must be one of {allowed}')
        return v.upper()
    
    @field_validator("path")
    @classmethod
    def validate_path(cls, v: str) -> str:
        if not v.startswith('/'):
            raise ValueError('Path must start with /')
        return v


class RefactorFunctionRequest(BaseModel):
    """Request to refactor an existing function using AI."""
    model_config = {"protected_namespaces": ()}
    function_id: str = Field(..., description="Function identifier (file::function_name)")
    refactor_goal: str = Field(..., description="What to improve")
    preserve_signature: bool = Field(True, description="Keep function signature unchanged")
    model_id: Optional[str] = Field(None, description="Optional watsonx model ID for refactoring")
    
    @field_validator("function_id")
    @classmethod
    def validate_function_id(cls, v: str) -> str:
        if '::' not in v:
            raise ValueError('function_id must be in format "file::function_name"')
        return v


class AnalyzeCodeRequest(BaseModel):
    """Request to analyze code and provide insights."""
    file_path: Optional[str] = Field(None, description="Specific file to analyze")
    analysis_type: str = Field("general", description="Type of analysis")


class ChatCompletionRequest(BaseModel):
    """Request for chatbot interaction with context."""
    message: str = Field(..., description="User message/question")
    context: Optional[Dict[str, Any]] = Field(None, description="Additional context")
    conversation_history: List[Dict[str, str]] = Field(default_factory=list)
    model_id: Optional[str] = Field(None, description="Optional watsonx model ID for chat completion")


class AIGenerationResponse(BaseModel):
    """Response from AI generation operations."""
    success: bool
    generated_code: Optional[str] = None
    file_path: Optional[str] = None
    explanation: Optional[str] = None
    suggestions: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    checkpoint_id: Optional[str] = None
    approval_status: Optional[str] = None


class ChatCompletionResponse(BaseModel):
    """Response from chatbot."""
    message: str
    code_snippets: List[Dict[str, str]] = Field(default_factory=list)
    actions: List[Dict[str, Any]] = Field(default_factory=list)


class CheckpointResponse(BaseModel):
    """Response for checkpoint operations."""
    checkpoints: List[Dict[str, Any]]
    total: int


# ============================================================================
# Code Generation Helpers
# ============================================================================

def _build_endpoint_generation_prompt(request: GenerateEndpointRequest) -> str:
    """
    Build a structured prompt for IBM Granite model to generate endpoint code.
    
    Follows the standards defined in .bob/rules-api-architect/01-generation-standards.md
    """
    prompt = f"""Generate a production-ready FastAPI endpoint with the following requirements:

**Endpoint Specification:**
- HTTP Method: {request.method}
- Path: {request.path}
- Description: {request.description}

**MANDATORY Requirements (from Api-Architect standards):**

1. **Comprehensive Docstring** with ALL sections:
   - Description
   - Args (with types and validation rules)
   - Returns (with structure)
   - Raises (all HTTPException cases)
   - Example (usage example)
   - Validation (input validation rules)
   - Security (security considerations)
   - Performance (optimization notes)

2. **NO Hardcoded Secrets:**
   - Use os.environ.get() for ALL configuration
   - No hardcoded passwords, API keys, or connection strings
   - Include environment variable validation

3. **Full Type Annotations:**
   - Type hints on all parameters
   - Return type annotation
   - Use Pydantic models for complex data

4. **Comprehensive Error Handling:**
   - HTTPException for all error cases
   - Proper status codes (400, 404, 500, etc.)
   - Structured error responses
   - Logging for errors

5. **Service Layer Separation:**
   - Route handler calls service functions
   - Business logic in separate service module
   - No direct database queries in route

6. **Input Validation:**
   - Pydantic models for request bodies
   - Query parameter validation
   - Path parameter validation

**Code Template:**
```python
from typing import Dict, Any, Optional
from fastapi import HTTPException, status, Query
from pydantic import BaseModel, Field, validator
import os
import logging

logger = logging.getLogger(__name__)

# Environment configuration (NO HARDCODED VALUES)
CONFIG_VAR = os.environ.get("CONFIG_VAR")
if not CONFIG_VAR:
    raise ValueError("CONFIG_VAR environment variable is required")

# Pydantic models
class RequestModel(BaseModel):
    \"\"\"Request model with validation.\"\"\"
    field: str = Field(..., min_length=1)
    
    @validator('field')
    def validate_field(cls, v):
        # Add validation logic
        return v

# Endpoint implementation
@app.{request.method.lower()}("{request.path}")
async def endpoint_name(
    # Add parameters here
) -> Dict[str, Any]:
    \"\"\"
    [COMPREHENSIVE DOCSTRING WITH ALL REQUIRED SECTIONS]
    
    Description:
        Detailed description of what this endpoint does.
    
    Args:
        param (type): Description with validation rules
    
    Returns:
        Dict[str, Any]: Response structure with all fields documented
    
    Raises:
        HTTPException: 400 if validation fails
        HTTPException: 404 if resource not found
        HTTPException: 500 if server error
    
    Example:
        >>> response = await endpoint_name(param="value")
        >>> print(response)
        {{"data": "result", "status": "success"}}
    
    Validation:
        - List all input validation rules
        - Document constraints and requirements
    
    Security:
        - Authentication requirements
        - Authorization checks
        - Rate limiting
        - Data sanitization
    
    Performance:
        - Caching strategy
        - Database optimization
        - Expected response time
    \"\"\"
    # Input validation
    # Business logic (call service layer)
    # Error handling
    # Return response
```

Generate the complete, production-ready endpoint code following ALL requirements above.
"""
    return prompt


def _build_refactoring_prompt(
    function_code: str,
    function_name: str,
    refactor_goal: str,
    preserve_signature: bool
) -> str:
    """Build prompt for function refactoring."""
    prompt = f"""Refactor the following Python function to {refactor_goal}:

**Current Function:**
```python
{function_code}
```

**Refactoring Goal:** {refactor_goal}
**Preserve Signature:** {'Yes - keep parameters and return type unchanged' if preserve_signature else 'No - can modify signature if needed'}

**Requirements:**
1. Maintain or improve functionality
2. Add comprehensive docstring if missing
3. Include type hints
4. Add error handling
5. Follow PEP 8 style guide
6. Add inline comments for complex logic
7. Optimize performance where possible
8. Ensure security best practices

**Output Format:**
Provide ONLY the refactored function code, including:
- Complete docstring with all sections
- Type annotations
- Error handling
- Optimized implementation

Refactored code:
```python
"""
    return prompt


def _is_within_workspace(path: Path) -> bool:
    """Check whether a path is inside the configured workspace root."""
    workspace_root = Path(WORKSPACE_PATH).resolve()
    try:
        path.resolve().relative_to(workspace_root)
        return True
    except ValueError:
        return False


def _resolve_refactor_source_path(raw_file_path: str) -> Path:
    """
    Resolve a refactor source path from user input.

    Accepts:
    - relative paths: backend/main.py
    - rooted-but-relative style: /backend/main.py
    - absolute paths within workspace
    - short paths: main.py (tries workspace and workspace/backend)
    """
    workspace_root = Path(WORKSPACE_PATH).resolve()
    backend_root = workspace_root / "backend"

    normalized = raw_file_path.strip().strip('"').strip("'")
    if not normalized:
        raise HTTPException(status_code=400, detail="function_id file path is empty")

    # Treat "/backend/..." and "\\backend\\..." as workspace-relative.
    if normalized.startswith(("/", "\\")):
        normalized = normalized.lstrip("/\\")

    input_path = Path(normalized)
    candidates: List[Path] = []

    if input_path.is_absolute():
        candidates.append(input_path)
    else:
        candidates.append(workspace_root / input_path)
        candidates.append(backend_root / input_path)

    # Convenience: allow omitting ".py".
    if input_path.suffix == "":
        if input_path.is_absolute():
            candidates.append(Path(f"{input_path}.py"))
        else:
            candidates.append(workspace_root / f"{input_path}.py")
            candidates.append(backend_root / f"{input_path}.py")

    # Keep order, remove duplicates.
    unique_candidates: List[Path] = []
    seen: set[str] = set()
    for candidate in candidates:
        key = str(candidate)
        if key not in seen:
            unique_candidates.append(candidate)
            seen.add(key)

    for candidate in unique_candidates:
        resolved = candidate.resolve()
        if not _is_within_workspace(resolved):
            continue
        if resolved.exists() and resolved.is_file():
            return resolved

    # Final fallback: search by basename under backend, then full workspace.
    basename = input_path.name
    search_hits: List[Path] = []
    if basename:
        search_hits.extend(p for p in backend_root.rglob(basename) if p.is_file())
        if not search_hits:
            search_hits.extend(p for p in workspace_root.rglob(basename) if p.is_file())
        search_hits = [p.resolve() for p in search_hits if _is_within_workspace(p.resolve())]

    if len(search_hits) == 1:
        return search_hits[0]
    if len(search_hits) > 1:
        options = [str(p.relative_to(workspace_root)) for p in search_hits[:5]]
        raise HTTPException(
            status_code=400,
            detail=(
                f"Ambiguous source file '{raw_file_path}'. Matches: {options}. "
                "Use function_id format 'relative/path.py::function_name'."
            ),
        )

    checked = [str(p) for p in unique_candidates[:4]]
    raise HTTPException(
        status_code=404,
        detail=(
            f"Source file not found for '{raw_file_path}'. "
            f"Checked: {checked}. "
            "Use function_id format 'backend/file.py::function_name' or an absolute path inside WORKSPACE_PATH."
        ),
    )


def _extract_function_source_from_file(file_path: Path, function_name: str) -> str:
    """Extract a top-level function's source code from a file."""
    source = file_path.read_text(encoding="utf-8")
    lines = source.splitlines(keepends=True)

    try:
        tree = ast.parse(source, filename=str(file_path))
    except SyntaxError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot parse source file '{file_path}': {exc.msg} (line {exc.lineno})",
        ) from exc

    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == function_name:
            start = max(getattr(node, "lineno", 1) - 1, 0)
            end = max(getattr(node, "end_lineno", start + 1), start + 1)
            return "".join(lines[start:end]).rstrip() + "\n"

    raise HTTPException(
        status_code=404,
        detail=f"Function '{function_name}' was not found in {file_path}.",
    )


def _normalize_refactored_function_code(generated_code: str, expected_function_name: str) -> str:
    """
    Normalize LLM output into a single function block suitable for save-function-content.
    """
    cleaned = generated_code.strip()
    if cleaned.startswith("```"):
        raw_lines = cleaned.splitlines()
        if raw_lines and raw_lines[0].startswith("```"):
            raw_lines = raw_lines[1:]
        if raw_lines and raw_lines[-1].strip() == "```":
            raw_lines = raw_lines[:-1]
        cleaned = "\n".join(raw_lines).strip()

    if not cleaned:
        return ""

    try:
        tree = ast.parse(cleaned)
        lines = cleaned.splitlines(keepends=True)
        function_nodes = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
        if function_nodes:
            selected = next((n for n in function_nodes if n.name == expected_function_name), function_nodes[0])
            start = max(getattr(selected, "lineno", 1) - 1, 0)
            end = max(getattr(selected, "end_lineno", start + 1), start + 1)
            return "".join(lines[start:end]).rstrip() + "\n"
    except SyntaxError:
        pass

    return cleaned.rstrip() + "\n"


def _resolve_endpoint_target_file(raw_target_file: Optional[str]) -> Path:
    """Resolve endpoint target file safely inside workspace root."""
    workspace_root = Path(WORKSPACE_PATH).resolve()
    raw_value = (raw_target_file or "backend/generated_endpoints.py").strip().strip('"').strip("'")

    incoming = Path(raw_value)
    if incoming.is_absolute():
        resolved = incoming.resolve()
    else:
        normalized = raw_value.lstrip("/\\")
        resolved = (workspace_root / normalized).resolve()

    if not _is_within_workspace(resolved):
        raise HTTPException(status_code=400, detail="target_file must be inside WORKSPACE_PATH")
    if resolved.suffix.lower() != ".py":
        raise HTTPException(status_code=400, detail="target_file must be a Python (.py) file")
    return resolved


def _normalize_generated_endpoint_code(generated_code: str) -> str:
    """Strip markdown wrappers and return Python endpoint code block."""
    cleaned = (generated_code or "").strip()
    if not cleaned:
        return ""

    fence_match = re.search(r"```(?:python)?\s*(.*?)```", cleaned, flags=re.IGNORECASE | re.DOTALL)
    if fence_match:
        cleaned = fence_match.group(1).strip()

    lines = cleaned.splitlines()
    start_index = 0
    for idx, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("@app.") or stripped.startswith("def ") or stripped.startswith("async def "):
            start_index = idx
            break
    cleaned = "\n".join(lines[start_index:]).strip()
    return cleaned + ("\n" if cleaned and not cleaned.endswith("\n") else "")


def _endpoint_decorator_exists(file_content: str, method: str, path: str) -> bool:
    escaped_path = re.escape(path)
    pattern = rf"@app\.{method.lower()}\(\s*['\"]{escaped_path}['\"]\s*\)"
    return re.search(pattern, file_content) is not None


def _append_endpoint_to_file(target_file: Path, endpoint_code: str, method: str, path: str) -> Dict[str, Any]:
    """Append endpoint code to target file if the route does not already exist."""
    existing = target_file.read_text(encoding="utf-8") if target_file.exists() else ""

    if _endpoint_decorator_exists(existing, method, path):
        return {"written": False, "reason": "Endpoint decorator already exists in target file."}

    target_file.parent.mkdir(parents=True, exist_ok=True)
    if existing.strip():
        next_content = existing.rstrip() + "\n\n" + endpoint_code.strip() + "\n"
    else:
        next_content = endpoint_code.strip() + "\n"
    target_file.write_text(next_content, encoding="utf-8")
    return {"written": True, "reason": "Endpoint implementation appended to target file."}


def _load_agent_runtime_config() -> Dict[str, str]:
    """Load watsonx credentials used by LangChain ChatWatsonx agent."""
    api_key = os.environ.get("WATSONX_API_KEY") or os.environ.get("WATSONX_APIKEY")
    project_id = os.environ.get("WATSONX_PROJECT_ID")
    url = os.environ.get("WATSONX_URL", AGENT_DEFAULT_WATSONX_URL)

    missing: List[str] = []
    if not api_key:
        missing.append("WATSONX_API_KEY")
    if not project_id:
        missing.append("WATSONX_PROJECT_ID")
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"LangChain agent requires environment variables: {', '.join(missing)}",
        )

    return {
        "watsonx_api_key": api_key.strip(),
        "watsonx_project_id": project_id.strip(),
        "watsonx_url": url.strip(),
    }


def _build_agent_endpoint_change_request(
    request: GenerateEndpointRequest,
    target_file: Path,
    workspace_root: Path,
) -> str:
    """Create strict instructions for multi-file endpoint implementation."""
    try:
        target_rel = target_file.resolve().relative_to(workspace_root.resolve()).as_posix()
    except ValueError:
        target_rel = target_file.as_posix()

    tests_requirement = (
        "Also create/update tests for this endpoint under testing/." if request.include_tests
        else "Tests are optional unless existing test structure clearly requires updates."
    )

    return (
        f"Implement endpoint {request.method} {request.path} with full file edits, not pseudo-code.\n\n"
        f"Primary API file: {target_rel}\n"
        f"Business requirement: {request.description}\n\n"
        "Implementation requirements:\n"
        "1) Modify files directly using tools.\n"
        "2) Keep route wiring in the primary API flow so endpoint becomes reachable from running app.\n"
        "3) Create at least one separate helper module (controller/service) with focused functions.\n"
        "4) Ensure endpoint handler delegates logic to helper functions instead of placing everything inline.\n"
        "5) Update imports/exports/router inclusion so graph traversal can discover dependencies.\n"
        "6) Avoid duplicate route decorators for the same method/path.\n"
        "7) Keep changes minimal, production-safe, and consistent with existing style.\n"
        f"8) {tests_requirement}\n\n"
        "Completion criteria:\n"
        "- Endpoint is implemented in files and callable from the API.\n"
        "- Route and helper functions are present in codebase.\n"
        "- File modifications summary is returned.\n\n"
        "Final response contract:\n"
        "Return ONLY valid JSON (no markdown) with this exact shape:\n"
        "{\n"
        '  "functions": [\n'
        "    {\n"
        '      "function_name": "str",\n'
        '      "function_path": "relative/path.py",\n'
        '      "function_desc": "str",\n'
        '      "function_code": "full python function code string"\n'
        "    }\n"
        "  ],\n"
        '  "summary": "str"\n'
        "}\n"
        "Include one function entry for the route handler in the primary API file and at least one helper function entry in a separate file.\n"
        "For each function_code value:\n"
        "- Include exactly one top-level Python function definition that matches function_name.\n"
        "- Include any required imports inside that function body if needed.\n"
        "- For the route function in the primary API file, include the endpoint decorator."
    )


def _extract_json_object_from_text(raw_text: str) -> Optional[Dict[str, Any]]:
    """Extract the first JSON object from model text output."""
    cleaned = (raw_text or "").strip()
    if not cleaned:
        return None

    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    candidates: List[str] = [cleaned]

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and start < end:
        candidates.append(cleaned[start : end + 1])

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed

    return None


def _normalize_manifest_path(path_value: str, workspace_root: Path) -> str:
    """Normalize a manifest file path to workspace-relative POSIX format."""
    raw = (path_value or "").strip().strip('"').strip("'")
    if not raw:
        return ""

    candidate = Path(raw)
    if candidate.is_absolute():
        resolved = candidate.resolve()
    else:
        resolved = (workspace_root / raw.lstrip("/\\")).resolve()

    try:
        return resolved.relative_to(workspace_root.resolve()).as_posix()
    except ValueError:
        return raw.replace("\\", "/").lstrip("/")


def _parse_agent_function_manifest(raw_text: str) -> Dict[str, Any]:
    """
    Parse and validate final agent JSON manifest.

    Required structure:
    {
      "functions": [
        {
          "function_name": str,
          "function_path": str,
          "function_desc": str,
          "function_code": str
        }
      ]
    }
    """
    payload = _extract_json_object_from_text(raw_text)
    if payload is None:
        raise ValueError("Agent final response did not contain a valid JSON object.")

    functions = payload.get("functions")
    if not isinstance(functions, list) or not functions:
        raise ValueError("Agent JSON must include a non-empty 'functions' list.")

    normalized_functions: List[Dict[str, str]] = []
    required_fields = ("function_name", "function_path", "function_desc", "function_code")

    for idx, function_item in enumerate(functions, start=1):
        if not isinstance(function_item, dict):
            raise ValueError(f"functions[{idx}] must be an object.")

        normalized_item: Dict[str, str] = {}
        for field_name in required_fields:
            field_value = function_item.get(field_name)
            if not isinstance(field_value, str) or not field_value.strip():
                raise ValueError(f"functions[{idx}] missing required non-empty field '{field_name}'.")
            normalized_item[field_name] = field_value.strip()

        normalized_functions.append(normalized_item)

    payload["functions"] = normalized_functions
    return payload


def _manifest_has_primary_and_helper(
    manifest: Dict[str, Any],
    *,
    target_file: Path,
    workspace_root: Path,
) -> bool:
    """Ensure manifest references both target API file and at least one secondary helper module."""
    try:
        target_rel = target_file.resolve().relative_to(workspace_root.resolve()).as_posix()
    except ValueError:
        target_rel = target_file.as_posix().replace("\\", "/")

    normalized_paths = {
        _normalize_manifest_path(item["function_path"], workspace_root)
        for item in manifest.get("functions", [])
        if isinstance(item, dict) and item.get("function_path")
    }

    has_primary = target_rel in normalized_paths
    has_helper = any(path != target_rel for path in normalized_paths)
    return has_primary and has_helper


def _normalize_manifest_function_code(function_code: str, function_name: str) -> str:
    """Normalize manifest function_code into one top-level function block."""
    cleaned = (function_code or "").strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    if not cleaned:
        raise ValueError(f"Function code for '{function_name}' is empty.")

    try:
        tree = ast.parse(cleaned)
        lines = cleaned.splitlines(keepends=True)
        function_nodes = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
        if function_nodes:
            selected = next((n for n in function_nodes if n.name == function_name), function_nodes[0])
            start = max(getattr(selected, "lineno", 1) - 1, 0)
            while start > 0:
                prev = lines[start - 1]
                if prev.lstrip() == prev and prev.lstrip().startswith("@"):
                    start -= 1
                    continue
                break
            end = max(getattr(selected, "end_lineno", start + 1), start + 1)
            return "".join(lines[start:end]).rstrip() + "\n"
    except SyntaxError as exc:
        raise ValueError(
            f"Function code for '{function_name}' is not valid Python: {exc.msg}"
        ) from exc

    if not re.search(rf"(?:async\s+def|def)\s+{re.escape(function_name)}\s*\(", cleaned):
        raise ValueError(
            f"Function code for '{function_name}' does not include a matching function definition."
        )
    return cleaned.rstrip() + "\n"


def _upsert_manifest_function(file_path: Path, function_name: str, normalized_code: str) -> None:
    """Insert or replace a top-level function by name in a Python file."""
    source = file_path.read_text(encoding="utf-8") if file_path.exists() else ""
    lines = source.splitlines(keepends=True)

    try:
        tree = ast.parse(source) if source.strip() else ast.parse("")
    except SyntaxError:
        tree = None

    target_node = None
    if tree is not None:
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == function_name:
                target_node = node
                break

    replacement_block = normalized_code.strip() + "\n"

    if target_node is None:
        next_content = replacement_block if not source.strip() else (source.rstrip() + "\n\n" + replacement_block)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(next_content, encoding="utf-8")
        return

    start = max(target_node.lineno - 1, 0)
    while start > 0:
        prev = lines[start - 1]
        if prev.lstrip() == prev and prev.lstrip().startswith("@"):
            start -= 1
            continue
        break

    end = max(getattr(target_node, "end_lineno", target_node.lineno), target_node.lineno)
    next_lines = [*lines[:start], replacement_block, *lines[end:]]
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("".join(next_lines), encoding="utf-8")


def _apply_manifest_functions(manifest: Dict[str, Any], workspace_root: Path) -> List[str]:
    """Apply LLM JSON-manifest function blocks to workspace files."""
    written_paths: List[str] = []
    for item in manifest.get("functions", []):
        function_name = item["function_name"]
        normalized_path = _normalize_manifest_path(item["function_path"], workspace_root)
        if not normalized_path:
            raise ValueError(f"Manifest function '{function_name}' has invalid function_path.")

        resolved = (workspace_root / normalized_path).resolve()
        if not _is_within_workspace(resolved):
            raise ValueError(f"Manifest path escapes workspace: {normalized_path}")

        normalized_code = _normalize_manifest_function_code(item["function_code"], function_name)
        _upsert_manifest_function(resolved, function_name, normalized_code)
        written_paths.append(normalized_path)

    return sorted(set(written_paths))


def _manifest_materialization_issues(manifest: Dict[str, Any], workspace_root: Path) -> List[str]:
    """Validate that declared manifest functions were actually written to disk."""
    issues: List[str] = []
    function_pattern_template = r"(?:async\s+def|def)\s+{name}\s*\("

    for item in manifest.get("functions", []):
        function_name = item["function_name"]
        normalized_path = _normalize_manifest_path(item["function_path"], workspace_root)
        if not normalized_path:
            issues.append(f"Manifest function '{function_name}' has empty function_path.")
            continue

        resolved = (workspace_root / normalized_path).resolve()
        if not _is_within_workspace(resolved):
            issues.append(f"Manifest path escapes workspace: {normalized_path}")
            continue

        if not resolved.exists() or not resolved.is_file():
            issues.append(f"Manifest file missing on disk: {normalized_path}")
            continue

        source = resolved.read_text(encoding="utf-8")
        function_pattern = function_pattern_template.format(name=re.escape(function_name))
        if re.search(function_pattern, source) is None:
            issues.append(
                f"Function '{function_name}' not found in {normalized_path} after agent write."
            )

    return issues


def _build_retry_change_request(base_request: str, issues: List[str]) -> str:
    issue_lines = "\n".join(f"- {issue}" for issue in issues)
    return (
        base_request
        + "\n\nPrevious attempt failed validation checks:\n"
        + issue_lines
        + "\n\nRe-run tools and fix files now."
        + "\nReturn only valid JSON with this exact shape:"
        + '\n{"functions": [{"function_name": "...", "function_path": "...", "function_desc": "...", "function_code": "..."}], "summary": "..."}'
    )


def _build_manifest_repair_prompt(
    *,
    method: str,
    path: str,
    description: str,
    target_rel: str,
    current_manifest_text: str,
    issues: List[str],
) -> str:
    """Build strict prompt for LLM-driven manifest repair."""
    issue_lines = "\n".join(f"- {issue}" for issue in issues) or "- missing validation details"
    manifest_preview = (current_manifest_text or "").strip()
    if len(manifest_preview) > 8000:
        manifest_preview = manifest_preview[:8000] + "\n...<truncated>..."

    return (
        "You are repairing an endpoint implementation manifest for a Python FastAPI workspace.\n"
        f"Endpoint: {method} {path}\n"
        f"Business requirement: {description}\n"
        f"Primary API file (must contain route function): {target_rel}\n\n"
        "Current validation failures:\n"
        f"{issue_lines}\n\n"
        "Current manifest/response:\n"
        f"{manifest_preview}\n\n"
        "Return ONLY valid JSON with this exact shape:\n"
        "{\n"
        '  "functions": [\n'
        "    {\n"
        '      "function_name": "str",\n'
        '      "function_path": "relative/path.py",\n'
        '      "function_desc": "str",\n'
        '      "function_code": "full python function code string"\n'
        "    }\n"
        "  ],\n"
        '  "summary": "str"\n'
        "}\n\n"
        "Hard requirements:\n"
        "1) Include at least two functions in the list.\n"
        "2) One function must be the endpoint route in the primary API file and include the route decorator.\n"
        "3) At least one function must be in a separate helper file.\n"
        "4) function_code must be complete runnable function definitions matching function_name.\n"
        "5) Do not use markdown fences."
    )


def _repair_manifest_with_watsonx(
    *,
    method: str,
    path: str,
    description: str,
    target_rel: str,
    current_manifest_text: str,
    issues: List[str],
    selected_model_id: Optional[str],
) -> Dict[str, Any]:
    """Use watsonx model to repair incomplete endpoint manifest."""
    if not _is_watsonx_runtime_enabled():
        raise ValueError("watsonx runtime is not enabled for manifest repair.")

    prompt = _build_manifest_repair_prompt(
        method=method,
        path=path,
        description=description,
        target_rel=target_rel,
        current_manifest_text=current_manifest_text,
        issues=issues,
    )

    watsonx_client = get_watsonx_client()
    repaired_text = watsonx_client.generate_code(
        prompt=prompt,
        model_id=selected_model_id,
        max_tokens=2600,
        temperature=0.0,
        top_p=1.0,
        top_k=1,
    )
    return _parse_agent_function_manifest(repaired_text)


# ============================================================================
# MCP Endpoints
# ============================================================================

@app.get("/mcp/health")
async def health_check() -> Dict[str, Any]:
    """
    Health check endpoint for MCP server.
    
    Returns:
        Server status and integration availability
    """
    watsonx_enabled = _is_watsonx_runtime_enabled()
    return {
        "status": "healthy",
        "service": "api-architect-mcp-enhanced",
        "version": "2.0.0",
        "watsonx_available": watsonx_enabled,
        "watsonx_import_available": WATSONX_AVAILABLE,
        "watsonx_missing_env": _missing_watsonx_env_vars(),
        "features": {
            "code_generation": watsonx_enabled,
            "refactoring": watsonx_enabled,
            "checkpoints": True,
            "orchestrate": WATSONX_AVAILABLE
        }
    }


@app.get("/mcp/models")
async def list_models(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Return available watsonx model IDs for frontend model selection.

    Falls back to a static list when live discovery is unavailable.
    """
    return _get_model_catalog(force_refresh=force_refresh)


@app.post("/mcp/generate-endpoint", response_model=AIGenerationResponse)
async def generate_endpoint(
    request: GenerateEndpointRequest,
    background_tasks: BackgroundTasks
) -> AIGenerationResponse:
    """
    Generate and IMPLEMENT a new REST endpoint using the LangChain autonomous agent.

    This path performs real multi-file edits (route + helper functions/modules)
    rather than returning snippet-only output.
    """
    try:
        _validate_model_id_or_raise(request.model_id)
        target_file = _resolve_endpoint_target_file(request.target_file)
        workspace_root = Path(WORKSPACE_PATH).resolve()
        selected_model_id = request.model_id or _get_model_catalog().get("default_model_id") or AGENT_DEFAULT_MODEL_ID

        checkpoint_id = None
        if target_file.exists() and WATSONX_AVAILABLE:
            checkpoint_mgr = get_checkpoint_manager()
            current_content = target_file.read_text(encoding="utf-8")
            checkpoint_id = checkpoint_mgr.create_checkpoint(
                file_path=str(target_file),
                content=current_content,
                operation=f"generate_endpoint_{request.method}_{request.path}",
                metadata={
                    "method": request.method,
                    "path": request.path,
                    "description": request.description,
                    "model_id": selected_model_id,
                },
            )
            logger.info("Created checkpoint: %s", checkpoint_id)

        approval_status = "auto_approved"
        if WATSONX_AVAILABLE:
            orchestrate = get_orchestrate()
            approved = await orchestrate.request_approval(
                operation="generate_endpoint",
                file_path=str(target_file),
                changes_summary=f"Implement {request.method} endpoint for {request.path}",
                metadata={
                    "description": request.description,
                    "model_id": selected_model_id,
                },
            )
            if not approved:
                return AIGenerationResponse(
                    success=False,
                    explanation="Endpoint implementation rejected by approval workflow",
                    approval_status="rejected",
                )
            approval_status = "approved"

        if not LANGCHAIN_AGENT_AVAILABLE:
            raise HTTPException(
                status_code=503,
                detail="LangChain agent service is not available in backend runtime.",
            )

        runtime_config = _load_agent_runtime_config()
        change_request = _build_agent_endpoint_change_request(
            request=request,
            target_file=target_file,
            workspace_root=workspace_root,
        )

        agent = AutonomousWorkspaceAgent(
            workspace_root=workspace_root,
            model_id=selected_model_id,
            watsonx_url=runtime_config["watsonx_url"],
            watsonx_project_id=runtime_config["watsonx_project_id"],
            watsonx_api_key=runtime_config["watsonx_api_key"],
            max_iterations=max(8, AGENT_DEFAULT_MAX_ITERATIONS),
            verbose=False,
        )

        target_rel = target_file.resolve().relative_to(workspace_root.resolve()).as_posix()
        attempt_request = change_request
        max_attempts = 3
        attempt_used = 0
        last_issues: List[str] = []
        modified_paths: List[str] = []
        primary_text = ""
        manifest: Dict[str, Any] = {}
        last_response_text = ""
        used_manifest_repair = False

        for attempt in range(1, max_attempts + 1):
            attempt_used = attempt
            agent_result = agent.run(
                target_file=target_rel,
                change_request=attempt_request,
            )

            modified_files = agent_result.get("modified_files", []) or []
            modified_paths = sorted(
                {
                    item.get("path")
                    for item in modified_files
                    if isinstance(item, dict) and item.get("path")
                }
            )

            primary_text = target_file.read_text(encoding="utf-8") if target_file.exists() else ""
            last_response_text = str(agent_result.get("final_response", "") or "")

            validation_issues: List[str] = []
            manifest = {}

            try:
                manifest = _parse_agent_function_manifest(last_response_text)
            except ValueError as exc:
                validation_issues.append(str(exc))

            if manifest:
                try:
                    applied_paths = _apply_manifest_functions(manifest, workspace_root)
                    modified_paths = sorted({*modified_paths, *applied_paths})
                except ValueError as exc:
                    validation_issues.append(str(exc))

                if not _manifest_has_primary_and_helper(
                    manifest,
                    target_file=target_file,
                    workspace_root=workspace_root,
                ):
                    validation_issues.append(
                        "Manifest must include one primary API function and at least one helper function in a separate file."
                    )
                validation_issues.extend(_manifest_materialization_issues(manifest, workspace_root))

            if len(modified_paths) < 2:
                validation_issues.append(
                    "Agent wrote fewer than two files; expected primary API file and helper module."
                )

            if not _endpoint_decorator_exists(primary_text, request.method, request.path):
                validation_issues.append(
                    f"Route decorator for {request.method} {request.path} not found in target file."
                )

            if not validation_issues:
                last_issues = []
                break

            last_issues = validation_issues
            if attempt < max_attempts:
                attempt_request = _build_retry_change_request(change_request, validation_issues)
                continue

            if _is_watsonx_runtime_enabled():
                try:
                    repaired_manifest = _repair_manifest_with_watsonx(
                        method=request.method,
                        path=request.path,
                        description=request.description,
                        target_rel=target_rel,
                        current_manifest_text=last_response_text,
                        issues=validation_issues,
                        selected_model_id=selected_model_id,
                    )
                    applied_paths = _apply_manifest_functions(repaired_manifest, workspace_root)
                    modified_paths = sorted({*modified_paths, *applied_paths})
                    primary_text = target_file.read_text(encoding="utf-8") if target_file.exists() else ""

                    repaired_issues: List[str] = []
                    if not _manifest_has_primary_and_helper(
                        repaired_manifest,
                        target_file=target_file,
                        workspace_root=workspace_root,
                    ):
                        repaired_issues.append(
                            "Repaired manifest still missing primary API function and/or helper function."
                        )
                    repaired_issues.extend(_manifest_materialization_issues(repaired_manifest, workspace_root))
                    if len(modified_paths) < 2:
                        repaired_issues.append(
                            "Repaired manifest did not result in multi-file writes (minimum 2 files required)."
                        )
                    if not _endpoint_decorator_exists(primary_text, request.method, request.path):
                        repaired_issues.append(
                            f"Route decorator for {request.method} {request.path} not found in target file after repair."
                        )

                    if not repaired_issues:
                        manifest = repaired_manifest
                        last_issues = []
                        used_manifest_repair = True
                        break

                    validation_issues = repaired_issues
                except Exception as repair_exc:
                    validation_issues = [
                        *validation_issues,
                        f"LLM manifest repair stage failed: {repair_exc}",
                    ]

            last_issues = validation_issues
            detail_preview = "; ".join(last_issues[:5])
            raise HTTPException(
                status_code=500,
                detail=(
                    "LangChain agent did not complete required multi-file implementation. "
                    + detail_preview
                ),
            )

        warnings: List[str] = []
        if attempt_used > 1:
            warnings.append(
                f"Endpoint implementation succeeded after {attempt_used} attempts with strict JSON validation."
            )
        if used_manifest_repair:
            warnings.append(
                "Manifest required a final watsonx LLM repair pass to complete multi-file implementation."
            )

        modified_summary = ", ".join(modified_paths[:6]) if modified_paths else "none"
        function_count = len(manifest.get("functions", [])) if manifest else 0
        explanation = (
            f"Implemented {request.method} {request.path} via LangChain agent with JSON manifest validation. "
            f"Functions declared: {function_count}. Modified {len(modified_paths)} file(s): {modified_summary}"
        )

        generated_code = primary_text[-4000:] if primary_text else None

        return AIGenerationResponse(
            success=True,
            generated_code=generated_code,
            file_path=str(target_file),
            explanation=explanation,
            suggestions=[
                "Endpoint logic has been written directly to files.",
                "Graph reload will reflect updated route/function dependencies.",
                "Run tests and linting before production deployment.",
            ],
            warnings=warnings,
            checkpoint_id=checkpoint_id,
            approval_status=approval_status,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Endpoint generation failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Generation failed: {str(e)}"
        )


@app.post("/mcp/refactor-function", response_model=AIGenerationResponse)
async def refactor_function(
    request: RefactorFunctionRequest,
    background_tasks: BackgroundTasks
) -> AIGenerationResponse:
    """
    Refactor an existing function using IBM watsonx.ai Granite models.
    
    Creates checkpoint before refactoring for safe recovery.
    """
    try:
        watsonx_enabled = _is_watsonx_runtime_enabled()
        _validate_model_id_or_raise(request.model_id)
        selected_model_id = request.model_id or _get_model_catalog().get("default_model_id")
        # Parse function_id
        file_path, function_name = request.function_id.rsplit("::", 1)
        file_path = file_path.strip()
        function_name = function_name.strip()
        if not function_name:
            raise HTTPException(
                status_code=400,
                detail='function_id must be in format "file::function_name" with non-empty function name',
            )
        full_path = _resolve_refactor_source_path(file_path)
        
        # Read current code
        source_code = full_path.read_text(encoding="utf-8")
        function_source = _extract_function_source_from_file(full_path, function_name)
        
        # Create checkpoint
        checkpoint_id = None
        if WATSONX_AVAILABLE:
            checkpoint_mgr = get_checkpoint_manager()
            checkpoint_id = checkpoint_mgr.create_checkpoint(
                file_path=str(full_path),
                content=source_code,
                operation=f"refactor_function_{function_name}",
                metadata={
                    "function_name": function_name,
                    "refactor_goal": request.refactor_goal,
                    "model_id": selected_model_id,
                }
            )
            logger.info(f"✅ Created checkpoint: {checkpoint_id}")
        
        # Request approval
        approval_status = "auto_approved"
        if WATSONX_AVAILABLE:
            orchestrate = get_orchestrate()
            approved = await orchestrate.request_approval(
                operation="refactor_function",
                file_path=str(full_path),
                changes_summary=f"Refactor {function_name} to {request.refactor_goal}",
                metadata={
                    "function": function_name,
                    "model_id": selected_model_id,
                }
            )
            
            if not approved:
                return AIGenerationResponse(
                    success=False,
                    explanation="Refactoring rejected by approval workflow",
                    approval_status="rejected"
                )
            approval_status = "approved"
        
        # Generate refactored code
        if watsonx_enabled:
            watsonx_client = get_watsonx_client()
            prompt = _build_refactoring_prompt(
                function_code=function_source,
                function_name=function_name,
                refactor_goal=request.refactor_goal,
                preserve_signature=request.preserve_signature
            )
            
            raw_refactored_code = watsonx_client.generate_code(
                prompt=prompt,
                model_id=selected_model_id,
                max_tokens=1500,
                temperature=0.2
            )
            refactored_code = _normalize_refactored_function_code(raw_refactored_code, function_name)
            
            logger.info(f"✅ Refactored function using IBM Granite model")
        else:
            _log_watsonx_fallback_reason_once()
            refactored_code = function_source
            logger.warning("⚠️  Using fallback refactoring (watsonx not available)")
        
        return AIGenerationResponse(
            success=True,
            generated_code=refactored_code,
            file_path=str(full_path),
            explanation=(
                f"Refactored {function_name} to {request.refactor_goal} using model "
                f"{selected_model_id or 'default'}"
            ),
            suggestions=[
                "Test refactored function thoroughly",
                "Compare performance with original",
                "Update related documentation"
            ],
            checkpoint_id=checkpoint_id,
            approval_status=approval_status
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Refactoring failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Refactoring failed: {str(e)}")


@app.post("/mcp/chat-completion", response_model=ChatCompletionResponse)
async def chat_completion(request: ChatCompletionRequest) -> ChatCompletionResponse:
    """
    Handle chatbot interactions using IBM watsonx.ai Granite models.
    """
    try:
        _validate_model_id_or_raise(request.model_id)
        selected_model_id = request.model_id or _get_model_catalog().get("default_model_id")

        watsonx_enabled = _is_watsonx_runtime_enabled()
        if watsonx_enabled:
            watsonx_client = get_watsonx_client()
            response_text = watsonx_client.chat_completion(
                messages=request.conversation_history + [
                    {"role": "user", "content": request.message}
                ],
                context=request.context,
                model_id=selected_model_id,
            )
            logger.info("Generated chat response using model: %s", selected_model_id)
        else:
            _log_watsonx_fallback_reason_once()
            response_text = (
                "I'm your Api-Architect assistant (running in fallback mode). "
                f"You asked: '{request.message}'. watsonx.ai integration is not available - "
                "please configure WATSONX_API_KEY and WATSONX_PROJECT_ID environment variables."
            )
            logger.warning("Using fallback chat response (watsonx not available)")

        return ChatCompletionResponse(
            message=response_text,
            code_snippets=[],
            actions=[]
        )

    except Exception as e:
        logger.error(f"Chat completion failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chat completion failed: {str(e)}")


@app.get("/mcp/checkpoints", response_model=CheckpointResponse)
async def list_checkpoints(file_path: Optional[str] = None) -> CheckpointResponse:
    """
    List available recovery checkpoints.
    
    Args:
        file_path: Filter by specific file (optional)
    
    Returns:
        List of checkpoints with metadata
    """
    try:
        if not WATSONX_AVAILABLE:
            return CheckpointResponse(checkpoints=[], total=0)
        
        checkpoint_mgr = get_checkpoint_manager()
        checkpoints = checkpoint_mgr.list_checkpoints(file_path=file_path)
        
        return CheckpointResponse(
            checkpoints=checkpoints,
            total=len(checkpoints)
        )
    
    except Exception as e:
        logger.error(f"❌ Failed to list checkpoints: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list checkpoints: {str(e)}")


@app.post("/mcp/restore-checkpoint")
async def restore_checkpoint(checkpoint_id: str) -> Dict[str, Any]:
    """
    Restore a file from a checkpoint.
    
    Args:
        checkpoint_id: Checkpoint identifier
    
    Returns:
        Restoration status and file information
    """
    try:
        if not WATSONX_AVAILABLE:
            raise HTTPException(status_code=503, detail="Checkpoint system not available")
        
        checkpoint_mgr = get_checkpoint_manager()
        checkpoint_data = checkpoint_mgr.restore_checkpoint(checkpoint_id)
        
        # Write restored content to file
        file_path = Path(checkpoint_data["file_path"])
        file_path.write_text(checkpoint_data["content"], encoding="utf-8")
        
        logger.info(f"✅ Restored checkpoint: {checkpoint_id}")
        
        return {
            "status": "success",
            "message": f"Restored file from checkpoint {checkpoint_id}",
            "file_path": str(file_path),
            "checkpoint_timestamp": checkpoint_data["timestamp"]
        }
    
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"❌ Checkpoint restoration failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Restoration failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    watsonx_enabled = _is_watsonx_runtime_enabled()
    
    logger.info("🚀 Starting IBM watsonx Api-Architect MCP Server")
    logger.info(f"   watsonx.ai Integration: {'✅ Enabled' if watsonx_enabled else '⚠️  Disabled (Fallback Mode)'}")
    logger.info(f"   Checkpoint System: {'✅ Enabled' if WATSONX_AVAILABLE else '⚠️  Disabled'}")
    logger.info(f"   Orchestrate Workflows: {'✅ Enabled' if WATSONX_AVAILABLE else '⚠️  Disabled'}")
    if not watsonx_enabled:
        _log_watsonx_fallback_reason_once()
    
    uvicorn.run("mcp_service:app", host="127.0.0.1", port=5001, reload=True)

# Made with Bob
