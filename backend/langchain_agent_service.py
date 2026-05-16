"""LangChain-based orchestration for IBM watsonx endpoint generation.

The service generates structured function artifacts, validates the updated source,
and returns data that the MCP layer can persist and reflect back into the graph.
"""

from __future__ import annotations

import ast
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

from pydantic import BaseModel, Field
from dotenv import load_dotenv

try:
    from langchain_ibm import ChatWatsonx
except ModuleNotFoundError as exc:  # pragma: no cover - validated at runtime
    raise RuntimeError("langchain-ibm is required for the Watsonx agent runtime.") from exc


DEFAULT_MODEL_ID = "ibm/granite-8b-code-instruct"
DEFAULT_MAX_ITERATIONS = 24
DEFAULT_WATSONX_URL = "https://us-south.ml.cloud.ibm.com"

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(Path(__file__).with_name(".env"))


class FunctionArgumentSpec(BaseModel):
    name: str = Field(..., description="Argument name.")
    type: str = Field(default="Any", description="Python type annotation to use.")
    default: Optional[str] = Field(default=None, description="Default value as Python source.")
    description: Optional[str] = Field(default=None, description="What the argument represents.")


class GeneratedFunctionSpec(BaseModel):
    func_name: str = Field(..., description="Function name.")
    func_path: str = Field(..., description="HTTP route path or source location the function implements.")
    func_args: List[FunctionArgumentSpec] = Field(default_factory=list, description="Function arguments.")
    path_operation_decorator: Optional[str] = Field(default=None, description="Primary FastAPI path operation decorator for endpoint handlers.")
    decorators: List[str] = Field(default_factory=list, description="Function decorators, including FastAPI path operation decorators.")
    func_code: str = Field(..., description="Complete top-level Python function code.")
    purpose: Optional[str] = Field(default=None, description="Short summary of the function's role.")


class EndpointGenerationPlan(BaseModel):
    explanation: str = Field(..., description="Why the generated functions fit the request.")
    functions: List[GeneratedFunctionSpec] = Field(default_factory=list, description="Structured generated functions.")
    warnings: List[str] = Field(default_factory=list, description="Warnings about assumptions or limitations.")
    suggestions: List[str] = Field(default_factory=list, description="Recommended follow-up actions.")


class FunctionRefactorPlan(BaseModel):
    explanation: str = Field(..., description="Why the refactor works.")
    generated_code: str = Field(..., description="Refactored function code.")
    warnings: List[str] = Field(default_factory=list, description="Warnings about assumptions or limitations.")
    suggestions: List[str] = Field(default_factory=list, description="Recommended follow-up actions.")


def _strip_code_fences(code: str) -> str:
    text = (code or "").strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    return text.strip()


def _ensure_trailing_newline(text: str) -> str:
    return text if text.endswith("\n") else f"{text}\n"


def _endpoint_decorator_lines(route_method: Optional[str], route_path: Optional[str]) -> List[str]:
    if not route_method or not route_path:
        return []

    method = route_method.strip().upper()
    path = route_path.strip()
    if not method or not path:
        return []

    if method == "GET":
        return [f'@app.get("{path}")']
    if method == "POST":
        return [f'@app.post("{path}")']
    if method == "PUT":
        return [f'@app.put("{path}")']
    if method == "DELETE":
        return [f'@app.delete("{path}")']
    if method == "PATCH":
        return [f'@app.patch("{path}")']
    return [f'@app.api_route("{path}", methods=["{method}"])']


def _inject_decorator(block: str, decorator_lines: List[str]) -> str:
    if not decorator_lines:
        return block

    lines = block.splitlines()
    if any(line.lstrip().startswith("@app.") or line.lstrip().startswith("@router.") for line in lines):
        return block

    insert_index = None
    for index, line in enumerate(lines):
        stripped = line.lstrip()
        if stripped.startswith("def ") or stripped.startswith("async def "):
            insert_index = index
            break

    if insert_index is None:
        return block

    return "\n".join([*lines[:insert_index], *decorator_lines, *lines[insert_index:]])


def _source_function_names(source: str) -> List[str]:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []

    names: List[str] = []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            names.append(node.name)
    return names


def _load_watsonx_credentials(
    watsonx_url: Optional[str] = None,
    watsonx_project_id: Optional[str] = None,
    watsonx_api_key: Optional[str] = None,
) -> Dict[str, str]:
    url = (watsonx_url or os.getenv("WATSONX_URL") or DEFAULT_WATSONX_URL).strip()
    project_id = (watsonx_project_id or os.getenv("WATSONX_PROJECT_ID") or "").strip()
    api_key = (watsonx_api_key or os.getenv("WATSONX_API_KEY") or os.getenv("WATSONX_APIKEY") or "").strip()

    missing: List[str] = []
    if not project_id:
        missing.append("WATSONX_PROJECT_ID")
    if not api_key:
        missing.append("WATSONX_API_KEY")
    if missing:
        raise RuntimeError(f"Missing watsonx credentials: {', '.join(missing)}")

    return {
        "url": url,
        "project_id": project_id,
        "api_key": api_key,
    }


@dataclass
class GeneratedFileChange:
    file_path: str
    relative_path: str
    source_before: str
    source_after: str
    generated_code: str


class AutonomousWorkspaceAgent:
    """LangChain orchestration for endpoint and function transformations."""

    def __init__(
        self,
        workspace_root: Path,
        model_id: str = DEFAULT_MODEL_ID,
        watsonx_url: Optional[str] = None,
        watsonx_project_id: Optional[str] = None,
        watsonx_api_key: Optional[str] = None,
        max_iterations: int = DEFAULT_MAX_ITERATIONS,
        verbose: bool = False,
    ) -> None:
        self.workspace_root = Path(workspace_root).resolve()
        self.model_id = model_id or DEFAULT_MODEL_ID
        self.credentials = _load_watsonx_credentials(watsonx_url, watsonx_project_id, watsonx_api_key)
        self.max_iterations = max_iterations
        self.verbose = verbose

    def _build_chat_model(self) -> ChatWatsonx:
        return ChatWatsonx(
            model_id=self.model_id,
            project_id=self.credentials["project_id"],
            url=self.credentials["url"],
            api_key=self.credentials["api_key"],
            temperature=0.2,
            max_tokens=2500,
            disable_streaming=True,
        )

    def _generate_plan(
        self,
        source_code: str,
        change_request: str,
        target_file: str,
        route_method: Optional[str] = None,
        route_path: Optional[str] = None,
    ) -> EndpointGenerationPlan:
        existing_function_names = _source_function_names(source_code)
        schema = self._build_chat_model().with_structured_output(EndpointGenerationPlan)
        prompt = (
            "You are generating code for an existing Python API file.\n"
            "Return a structured JSON plan that the app can write into the file immediately.\n"
            "Rules:\n"
            "1. The first function must be the FastAPI endpoint handler for the requested route.\n"
            "2. The endpoint handler must include the correct FastAPI decorator for the requested method and path.\n"
            "3. The endpoint handler JSON must include the decorator text in a decorators array, for example [\"@app.get(\\\"/path\\\")\"].\n"
            "4. The endpoint handler JSON must also include path_operation_decorator with the primary decorator string.\n"
            "5. If the endpoint needs supporting logic, add helper functions after the handler in the same response.\n"
            "6. Each function must include func_name, func_path, func_args, path_operation_decorator, decorators, and func_code.\n"
            "7. func_code must be valid Python source and must not be wrapped in markdown fences.\n"
            "8. Reuse existing imports and helpers from the file when possible.\n"
            "9. Do not invent unrelated changes, and do not return plain utility functions unless they are helpers for the endpoint.\n"
            "10. If the target file already defines a function with the same name, choose a new name unless the request is explicitly a replacement.\n\n"
            f"Target file: {target_file}\n"
            f"Requested HTTP method: {route_method or 'N/A'}\n"
            f"Requested route path: {route_path or 'N/A'}\n"
            f"Existing top-level function names: {', '.join(existing_function_names) if existing_function_names else 'none'}\n\n"
            "Current source code:\n"
            f"{source_code}\n\n"
            "Task:\n"
            f"{change_request}\n"
        )
        return schema.invoke(prompt)

    def _generate_refactor_plan(
        self,
        source_code: str,
        function_name: str,
        refactor_goal: str,
        preserve_signature: bool,
    ) -> FunctionRefactorPlan:
        schema = self._build_chat_model().with_structured_output(FunctionRefactorPlan)
        prompt = (
            "You are a LangChain code refactoring agent.\n"
            "Return a JSON object that contains a refactored function body in generated_code.\n"
            f"Function name: {function_name}\n"
            f"Preserve signature: {preserve_signature}\n"
            "Current source:\n"
            f"{source_code}\n\n"
            "Refactor goal:\n"
            f"{refactor_goal}\n"
        )
        return schema.invoke(prompt)

    def _apply_generated_code(self, source_code: str, generated_code: str) -> str:
        cleaned_code = _ensure_trailing_newline(_strip_code_fences(generated_code))
        if not cleaned_code.strip():
            raise RuntimeError("Generated code is empty.")

        candidate = source_code.rstrip() + "\n\n" + cleaned_code
        ast.parse(candidate)
        return candidate

    def generate_endpoint_artifacts(
        self,
        target_file: Path,
        change_request: str,
        route_method: Optional[str] = None,
        route_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        target_path = Path(target_file).resolve()
        source_code = target_path.read_text(encoding="utf-8")
        plan = self._generate_plan(
            source_code=source_code,
            change_request=change_request,
            target_file=str(target_path),
            route_method=route_method,
            route_path=route_path,
        )

        if not plan.functions:
            raise RuntimeError("The model did not return any generated functions.")

        generated_blocks = [_strip_code_fences(function.func_code) for function in plan.functions]
        decorator_lines = _endpoint_decorator_lines(route_method, route_path)
        if generated_blocks:
            generated_blocks[0] = _inject_decorator(generated_blocks[0], decorator_lines)
            plan.functions[0].path_operation_decorator = decorator_lines[0] if decorator_lines else None
            if plan.functions[0].decorators == []:
                plan.functions[0].decorators = decorator_lines
            elif decorator_lines and decorator_lines[0] not in plan.functions[0].decorators:
                plan.functions[0].decorators = [*plan.functions[0].decorators, *decorator_lines]
        generated_code = "\n\n".join(block.strip() for block in generated_blocks if block.strip())
        if not generated_code.strip():
            raise RuntimeError("The model returned empty function code.")

        updated_source = self._apply_generated_code(source_code, generated_code)

        return {
            "explanation": plan.explanation,
            "warnings": plan.warnings,
            "suggestions": plan.suggestions,
            "functions": [function.model_dump() for function in plan.functions],
            "generated_code": _ensure_trailing_newline(generated_code),
            "source_before": source_code,
            "source_after": updated_source,
            "file_path": str(target_path),
            "relative_path": str(target_path.relative_to(self.workspace_root)).replace("\\", "/"),
        }

    def apply_generated_code(
        self,
        target_file: Path,
        generated_code: str,
    ) -> GeneratedFileChange:
        target_path = Path(target_file).resolve()
        source_code = target_path.read_text(encoding="utf-8")
        updated_source = self._apply_generated_code(source_code, generated_code)
        return GeneratedFileChange(
            file_path=str(target_path),
            relative_path=str(target_path.relative_to(self.workspace_root)).replace("\\", "/"),
            source_before=source_code,
            source_after=updated_source,
            generated_code=_ensure_trailing_newline(_strip_code_fences(generated_code)),
        )

    def refactor_function(
        self,
        source_code: str,
        function_name: str,
        refactor_goal: str,
        preserve_signature: bool,
    ) -> Dict[str, Any]:
        plan = self._generate_refactor_plan(
            source_code=source_code,
            function_name=function_name,
            refactor_goal=refactor_goal,
            preserve_signature=preserve_signature,
        )

        cleaned_code = _ensure_trailing_newline(_strip_code_fences(plan.generated_code))
        if not cleaned_code.strip():
            raise RuntimeError("The model returned empty refactored code.")

        ast.parse(cleaned_code)

        return {
            "explanation": plan.explanation,
            "generated_code": cleaned_code,
            "warnings": plan.warnings,
            "suggestions": plan.suggestions,
        }

    def chat_completion(self, messages: Sequence[Dict[str, str]], context: Optional[Dict[str, Any]] = None) -> str:
        model = self._build_chat_model()
        prompt_parts = ["You are an IBM watsonx code assistant."]
        if context:
            prompt_parts.append("Context:")
            for key, value in context.items():
                prompt_parts.append(f"- {key}: {value}")
        prompt_parts.append("Messages:")
        for message in messages:
            role = message.get("role", "user")
            content = message.get("content", "")
            prompt_parts.append(f"{role}: {content}")
        response = model.invoke("\n".join(prompt_parts))
        return getattr(response, "content", str(response)).strip()

    def run(self, target_file: str, change_request: str) -> Dict[str, Any]:
        target_path = Path(target_file)
        if not target_path.is_absolute():
            target_path = (self.workspace_root / target_path).resolve()

        if not target_path.exists():
            raise FileNotFoundError(f"Target file does not exist: {target_path}")

        source_code = target_path.read_text(encoding="utf-8")
        artifact = self.generate_endpoint_artifacts(
            target_file=target_path,
            change_request=change_request,
        )
        target_path.write_text(artifact["source_after"], encoding="utf-8")
        artifact["file_path"] = str(target_path)
        artifact["relative_path"] = str(target_path.relative_to(self.workspace_root)).replace("\\", "/")
        artifact["source_before"] = source_code
        return artifact
