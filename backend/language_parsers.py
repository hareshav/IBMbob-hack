"""
Multi-language code parsing for the IBM Bob API Architect Canvas.

Supports:
  • Python  — full AST accuracy
  • JavaScript / TypeScript — regex (Express, Fastify, NestJS)
  • Java  — regex (Spring MVC / Boot)
  • Go    — regex (Gin, Chi, net/http)
  • Generic fallback — Ruby, PHP, C#, Rust, Kotlin, Swift, Scala, C/C++
"""

import ast
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

# ---------------------------------------------------------------------------
# Language detection
# ---------------------------------------------------------------------------

LANGUAGE_BY_EXT: Dict[str, str] = {
    ".py":   "python",
    ".js":   "javascript",
    ".jsx":  "javascript",
    ".mjs":  "javascript",
    ".cjs":  "javascript",
    ".ts":   "typescript",
    ".tsx":  "typescript",
    ".java": "java",
    ".go":   "go",
    ".rb":   "ruby",
    ".php":  "php",
    ".cs":   "csharp",
    ".rs":   "rust",
    ".cpp":  "cpp",
    ".cc":   "cpp",
    ".cxx":  "cpp",
    ".c":    "c",
    ".kt":   "kotlin",
    ".swift":"swift",
    ".scala":"scala",
}

ALL_CODE_EXTENSIONS: Set[str] = set(LANGUAGE_BY_EXT.keys())
JS_TS_EXTENSIONS: Set[str] = {".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"}

EXCLUDED_DIR_NAMES: Set[str] = {
    ".venv", "venv", "__pycache__", "node_modules", ".bob", ".git",
    "dist", "build", ".next", "out", "target", "vendor",
    ".gradle", ".mvn", "bin", "obj", ".vs", "coverage",
    ".pytest_cache", ".mypy_cache", ".tox", "htmlcov",
    ".idea", ".vscode",
}


def detect_language(file_path: Path) -> Optional[str]:
    return LANGUAGE_BY_EXT.get(file_path.suffix.lower())


def should_skip(file_path: Path) -> bool:
    return any(part in EXCLUDED_DIR_NAMES for part in file_path.parts)


# ---------------------------------------------------------------------------
# File collection
# ---------------------------------------------------------------------------

MAX_FILES = 300


def collect_workspace_code_files(
    workspace_root: Path,
    language: Optional[str] = None,
) -> List[Path]:
    result: List[Path] = []
    for fp in sorted(workspace_root.rglob("*")):
        if len(result) >= MAX_FILES:
            break
        if not fp.is_file():
            continue
        resolved = fp.resolve()
        if should_skip(resolved):
            continue
        lang = detect_language(fp)
        if lang is None:
            continue
        if language and lang != language:
            continue
        result.append(resolved)
    return result


def detect_workspace_language(workspace_root: Path) -> Optional[str]:
    counts: Dict[str, int] = {}
    for fp in workspace_root.rglob("*"):
        if not fp.is_file() or should_skip(fp):
            continue
        lang = detect_language(fp)
        if lang:
            counts[lang] = counts.get(lang, 0) + 1
    return max(counts, key=lambda k: counts[k]) if counts else None


# ---------------------------------------------------------------------------
# Entry-point / project-root detection
# ---------------------------------------------------------------------------

_ENTRY_NAMES: List[str] = [
    # Python
    "main.py", "app.py", "server.py", "api.py", "wsgi.py", "asgi.py", "manage.py", "run.py",
    # JS / TS
    "index.js", "index.ts", "app.js", "app.ts", "server.js", "server.ts", "main.js", "main.ts",
    # Java
    "Main.java", "Application.java", "App.java",
    # Go
    "main.go",
    # Ruby
    "app.rb", "config.ru",
    # PHP
    "index.php", "app.php",
    # C#
    "Program.cs", "Startup.cs",
    # Rust
    "main.rs",
    # Kotlin
    "Main.kt", "Application.kt",
]

_ENTRY_SUBDIRS: List[str] = ["src", "app", "backend", "api", "server", "cmd", "lib"]

_API_INDICATORS: Dict[str, List[str]] = {
    "python":     ["@app.get", "@app.post", "@router.get", "from fastapi", "from flask", "from django.urls"],
    "javascript": ["app.get(", "app.post(", "router.get(", "express()", "fastify("],
    "typescript": ["app.get(", "app.post(", "@Get(", "@Post(", "NestFactory", "Router()"],
    "java":       ["@RestController", "@GetMapping", "@PostMapping", "@Controller"],
    "go":         ["http.HandleFunc", "r.GET(", "router.GET(", "gin.Default(", "chi.NewRouter"],
    "ruby":       ["get '", "post '", "Rails.application", "Sinatra"],
    "php":        ["Route::get", "Route::post", "$app->get"],
    "csharp":     ["[HttpGet]", "[HttpPost]", "[ApiController]", "MapGet(", "MapPost("],
    "rust":       ["#[get(", "#[post(", "Router::new("],
    "kotlin":     ["@GetMapping", "@PostMapping", "routing {"],
}


def detect_main_file(workspace: Path) -> Optional[Path]:
    for name in _ENTRY_NAMES:
        c = workspace / name
        if c.exists() and c.is_file():
            return c
    for subdir in _ENTRY_SUBDIRS:
        sub = workspace / subdir
        if not sub.is_dir():
            continue
        for name in _ENTRY_NAMES:
            c = sub / name
            if c.exists() and c.is_file():
                return c
    for fp in sorted(workspace.rglob("*")):
        if not fp.is_file() or should_skip(fp):
            continue
        lang = detect_language(fp)
        if not lang:
            continue
        indicators = _API_INDICATORS.get(lang, [])
        if not indicators:
            continue
        try:
            content = fp.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        if any(ind in content for ind in indicators):
            return fp
    return None


_ROOT_MARKERS = {
    "package.json", "go.mod", "pom.xml", "build.gradle",
    "pyproject.toml", "setup.py", "setup.cfg", "Cargo.toml", "Makefile",
    "requirements.txt", "requirements-dev.txt", "Pipfile", "poetry.lock",
}


def detect_project_root(start_file: Path) -> Path:
    current = start_file.parent.resolve()
    while True:
        for marker in _ROOT_MARKERS:
            if (current / marker).exists():
                return current
        parent = current.parent
        if parent == current:
            break
        current = parent
    return start_file.parent.resolve()


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _safe_relative(file_path: Path, root: Path) -> str:
    try:
        return str(file_path.resolve().relative_to(root.resolve())).replace("\\", "/")
    except ValueError:
        return str(file_path.resolve()).replace("\\", "/")


def _snippet(lines: List[str], line_no: int, count: int = 15) -> str:
    start = max(line_no - 1, 0)
    return "\n".join(lines[start : start + count]).rstrip()


_CALL_RE = re.compile(r"\b(\w+)\s*\(")
_SKIP_WORDS: Set[str] = {
    "if", "for", "while", "switch", "return", "typeof", "instanceof",
    "new", "try", "catch", "import", "export", "class", "function",
    "async", "await", "yield", "void", "null", "undefined", "true", "false",
    "print", "len", "range", "str", "int", "float", "list", "dict", "set",
    "super", "this", "self", "var", "let", "const", "static",
}


def _calls_from_snippet(snippet: str, own_name: str = "") -> List[str]:
    seen: Set[str] = set()
    result: List[str] = []
    for m in _CALL_RE.finditer(snippet):
        name = m.group(1)
        if name in _SKIP_WORDS or name == own_name or name in seen:
            continue
        seen.add(name)
        result.append(name)
    return result


# ---------------------------------------------------------------------------
# Python parser — AST, exact
# ---------------------------------------------------------------------------

_HTTP_METHODS: Set[str] = {"get", "post", "put", "delete", "patch"}


def parse_python_file(file_path: Path) -> List[Dict[str, Any]]:
    try:
        source = file_path.read_text(encoding="utf-8")
        tree = ast.parse(source, filename=str(file_path))
    except (SyntaxError, OSError):
        return []

    lines = source.splitlines()

    class _CC(ast.NodeVisitor):
        def __init__(self) -> None:
            self.calls: List[str] = []
            self._seen: Set[str] = set()

        def visit_Call(self, node: ast.Call) -> None:  # type: ignore[override]
            name = ""
            if isinstance(node.func, ast.Name):
                name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                name = node.func.attr
            if name and name not in self._seen:
                self._seen.add(name)
                self.calls.append(name)
            self.generic_visit(node)

    nodes: List[Dict[str, Any]] = []

    # Only top-level functions (matches existing main.py behaviour)
    for node in tree.body:
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue

        start = max(getattr(node, "lineno", 1) - 1, 0)
        end = getattr(node, "end_lineno", start + 15)
        code = "\n".join(lines[start:end]).rstrip()

        cc = _CC()
        cc.visit(node)

        method: Optional[str] = None
        route: Optional[str] = None
        node_type = "function"

        for dec in node.decorator_list:
            if isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute):
                attr = dec.func.attr.lower()
                if attr in _HTTP_METHODS:
                    route_path = "/"
                    if dec.args and isinstance(dec.args[0], ast.Constant):
                        route_path = str(dec.args[0].value)
                    method = attr.upper()
                    route = route_path
                    node_type = "endpoint"
                    break
            elif isinstance(dec, ast.Attribute) and dec.attr.lower() in _HTTP_METHODS:
                method = dec.attr.upper()
                route = "/"
                node_type = "endpoint"
                break

        nodes.append({
            "name": node.name,
            "type": node_type,
            "method": method,
            "route": route,
            "code": code,
            "line": getattr(node, "lineno", 1),
            "calls": cc.calls,
        })

    return nodes


# ---------------------------------------------------------------------------
# JavaScript / TypeScript parser — regex
# ---------------------------------------------------------------------------

_JS_FUNC_RE = re.compile(
    r"(?m)^[ \t]*"
    r"(?:export\s+)?(?:default\s+)?(?:async\s+)?"
    r"(?:"
    r"function\s+(\w+)\s*\("                               # group 1: named function
    r"|class\s+(\w+)"                                       # group 2: class
    r"|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?"     # group 3: arrow const
    r"(?:\([^)]*\)|\w+)\s*=>"
    r"|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function\b"  # group 4: const fn
    r")"
)

_JS_ROUTE_RE = re.compile(
    r"""(?:app|router|fastify|server|r|g)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`\s]+)['"`]""",
    re.IGNORECASE,
)

_NEST_ROUTE_RE = re.compile(
    r"""@(Get|Post|Put|Delete|Patch)\s*\(\s*['"`]([^'"`]*)['"`]\s*\)"""
)

_HAPI_ROUTE_RE = re.compile(
    r"""method\s*:\s*['"`](GET|POST|PUT|DELETE|PATCH)['"`].*?path\s*:\s*['"`]([^'"`]+)['"`]""",
    re.DOTALL,
)

_JS_IMPORT_RE = re.compile(
    r"""(?:import|require)\s*\(?['"](\.[./][^'"]+)['"]\)?"""
)


def parse_js_ts_file(file_path: Path) -> List[Dict[str, Any]]:
    try:
        source = file_path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return []

    lines = source.splitlines()
    nodes: List[Dict[str, Any]] = []
    seen: Set[str] = set()

    for m in _JS_FUNC_RE.finditer(source):
        name = m.group(1) or m.group(2) or m.group(3) or m.group(4)
        if not name or name in seen:
            continue
        seen.add(name)
        line_no = source[: m.start()].count("\n") + 1
        snip = _snippet(lines, line_no)
        nodes.append({
            "name": name,
            "type": "function",
            "method": None,
            "route": None,
            "code": snip,
            "line": line_no,
            "calls": _calls_from_snippet(snip, name),
        })

    for m in _JS_ROUTE_RE.finditer(source):
        meth, path = m.group(1).upper(), m.group(2)
        line_no = source[: m.start()].count("\n") + 1
        nodes.append({
            "name": f"{meth} {path}",
            "type": "endpoint",
            "method": meth,
            "route": path,
            "code": _snippet(lines, line_no, 5),
            "line": line_no,
            "calls": [],
        })

    for m in _NEST_ROUTE_RE.finditer(source):
        meth, path = m.group(1).upper(), m.group(2) or "/"
        line_no = source[: m.start()].count("\n") + 1
        nodes.append({
            "name": f"{meth} {path}",
            "type": "endpoint",
            "method": meth,
            "route": path,
            "code": _snippet(lines, line_no, 5),
            "line": line_no,
            "calls": [],
        })

    for m in _HAPI_ROUTE_RE.finditer(source):
        meth, path = m.group(1).upper(), m.group(2)
        line_no = source[: m.start()].count("\n") + 1
        nodes.append({
            "name": f"{meth} {path}",
            "type": "endpoint",
            "method": meth,
            "route": path,
            "code": _snippet(lines, line_no, 5),
            "line": line_no,
            "calls": [],
        })

    return nodes


def extract_js_ts_imports(file_path: Path, workspace_root: Path) -> List[Path]:
    try:
        source = file_path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return []

    result: List[Path] = []
    for m in _JS_IMPORT_RE.finditer(source):
        base = (file_path.parent / m.group(1)).resolve()
        for ext in (".ts", ".tsx", ".js", ".jsx", ".mjs"):
            candidate = Path(str(base) + ext) if not base.suffix else base
            if candidate.exists() and candidate.is_file():
                result.append(candidate)
                break
        for ext in (".ts", ".tsx", ".js", ".jsx"):
            index = base / f"index{ext}"
            if index.exists():
                result.append(index)
                break
    return result


# ---------------------------------------------------------------------------
# Java parser — regex (Spring MVC / Boot)
# ---------------------------------------------------------------------------

_JAVA_CLASS_RE = re.compile(
    r"(?:public|private|protected|abstract|final|\s)*(?:class|interface|enum|record)\s+(\w+)",
    re.MULTILINE,
)

_JAVA_METHOD_RE = re.compile(
    r"(?:public|private|protected|static|final|synchronized|\s)+"
    r"(?:[\w<>\[\],\s]+)\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w\s,]+)?\s*\{",
    re.MULTILINE,
)

_JAVA_ROUTE_RE = re.compile(
    r"@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)"
    r"""(?:\s*\(\s*(?:value\s*=\s*)?["']([^"']*)["'])?""",
    re.MULTILINE,
)

_JAVA_METHOD_MAP: Dict[str, str] = {
    "GetMapping": "GET", "PostMapping": "POST", "PutMapping": "PUT",
    "DeleteMapping": "DELETE", "PatchMapping": "PATCH", "RequestMapping": "GET",
}

_JAVA_KW: Set[str] = {"if", "for", "while", "switch", "try", "catch", "new", "return"}


def parse_java_file(file_path: Path) -> List[Dict[str, Any]]:
    try:
        source = file_path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return []

    lines = source.splitlines()
    nodes: List[Dict[str, Any]] = []

    for m in _JAVA_CLASS_RE.finditer(source):
        line_no = source[: m.start()].count("\n") + 1
        nodes.append({
            "name": m.group(1),
            "type": "function",
            "method": None,
            "route": None,
            "code": _snippet(lines, line_no, 3),
            "line": line_no,
            "calls": [],
        })

    for m in _JAVA_METHOD_RE.finditer(source):
        name = m.group(1)
        if name in _JAVA_KW:
            continue
        line_no = source[: m.start()].count("\n") + 1
        snip = _snippet(lines, line_no)
        nodes.append({
            "name": name,
            "type": "function",
            "method": None,
            "route": None,
            "code": snip,
            "line": line_no,
            "calls": _calls_from_snippet(snip, name),
        })

    for m in _JAVA_ROUTE_RE.finditer(source):
        ann, path = m.group(1), m.group(2) or "/"
        meth = _JAVA_METHOD_MAP.get(ann, "GET")
        line_no = source[: m.start()].count("\n") + 1
        nodes.append({
            "name": f"{meth} {path}",
            "type": "endpoint",
            "method": meth,
            "route": path,
            "code": _snippet(lines, line_no, 5),
            "line": line_no,
            "calls": [],
        })

    return nodes


# ---------------------------------------------------------------------------
# Go parser — regex (Gin, Chi, net/http mux)
# ---------------------------------------------------------------------------

_GO_FUNC_RE = re.compile(r"^func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(", re.MULTILINE)

_GO_ROUTE_RE = re.compile(
    r"""(?:r|router|g|engine|mux)\.(GET|POST|PUT|DELETE|PATCH|Handle|HandleFunc)\s*\(\s*["'`]([^"'` ]+)["'`]""",
    re.IGNORECASE,
)

_GO_HTTP_RE = re.compile(r"""http\.HandleFunc\s*\(\s*["'`]([^"'` ]+)["'`]""")


def parse_go_file(file_path: Path) -> List[Dict[str, Any]]:
    try:
        source = file_path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return []

    lines = source.splitlines()
    nodes: List[Dict[str, Any]] = []

    for m in _GO_FUNC_RE.finditer(source):
        name = m.group(1)
        line_no = source[: m.start()].count("\n") + 1
        snip = _snippet(lines, line_no)
        nodes.append({
            "name": name,
            "type": "function",
            "method": None,
            "route": None,
            "code": snip,
            "line": line_no,
            "calls": _calls_from_snippet(snip, name),
        })

    for m in _GO_ROUTE_RE.finditer(source):
        meth, path = m.group(1).upper(), m.group(2)
        if meth in ("HANDLE", "HANDLEFUNC"):
            meth = "FUNC"
        line_no = source[: m.start()].count("\n") + 1
        nodes.append({
            "name": f"{meth} {path}",
            "type": "endpoint",
            "method": meth,
            "route": path,
            "code": _snippet(lines, line_no, 4),
            "line": line_no,
            "calls": [],
        })

    for m in _GO_HTTP_RE.finditer(source):
        path = m.group(1)
        line_no = source[: m.start()].count("\n") + 1
        nodes.append({
            "name": f"FUNC {path}",
            "type": "endpoint",
            "method": "FUNC",
            "route": path,
            "code": _snippet(lines, line_no, 4),
            "line": line_no,
            "calls": [],
        })

    return nodes


# ---------------------------------------------------------------------------
# Generic parser — regex fallback for Ruby, PHP, C#, Rust, Kotlin, …
# ---------------------------------------------------------------------------

_GEN_FUNC: Dict[str, re.Pattern] = {
    "ruby":   re.compile(r"^\s*def\s+(\w+)", re.MULTILINE),
    "php":    re.compile(r"^\s*(?:public|private|protected|static|\s)*function\s+(\w+)\s*\(", re.MULTILINE),
    "csharp": re.compile(
        r"(?:public|private|protected|internal|static|virtual|override|\s)+"
        r"(?:[\w<>\[\]?]+)\s+(\w+)\s*\([^)]*\)\s*(?:where\s+\w+[^{]*)?\{",
        re.MULTILINE,
    ),
    "rust":   re.compile(r"^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*[<(]", re.MULTILINE),
    "kotlin": re.compile(r"^\s*(?:fun|class|object|interface)\s+(\w+)", re.MULTILINE),
    "swift":  re.compile(r"^\s*(?:func|class|struct|enum)\s+(\w+)", re.MULTILINE),
    "scala":  re.compile(r"^\s*(?:def|class|object|trait)\s+(\w+)", re.MULTILINE),
    "cpp":    re.compile(r"^\w[\w\s*&:<>]*\s+(\w+)\s*\([^;)]*\)\s*(?:const\s*)?(?:override\s*)?\{", re.MULTILINE),
    "c":      re.compile(r"^\w[\w\s*]*\s+(\w+)\s*\([^;)]*\)\s*\{", re.MULTILINE),
}

_GEN_ROUTES: Dict[str, List[re.Pattern]] = {
    "ruby": [
        re.compile(r"""(?:get|post|put|delete|patch)\s+["'](\/[^"']*)["']\s*(?:,|do)"""),
    ],
    "php": [
        re.compile(r"""Route::(get|post|put|delete|patch)\s*\(\s*["'](\/[^"']*)["']"""),
        re.compile(r"""\$app->(get|post|put|delete|patch)\s*\(\s*["'](\/[^"']*)["']"""),
    ],
    "csharp": [
        re.compile(r"""\[(HttpGet|HttpPost|HttpPut|HttpDelete|HttpPatch)(?:\s*\(\s*["'](\/[^"']*)["']\s*\))?\]"""),
        re.compile(r"""(?:MapGet|MapPost|MapPut|MapDelete|MapPatch)\s*\(\s*["'](\/[^"']*)["']\s*,"""),
    ],
    "rust": [
        re.compile(r"""#\[(get|post|put|delete|patch)\s*\(\s*["'](\/[^"']*)["']\s*\)\]"""),
    ],
    "kotlin": [
        re.compile(r"""@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)\s*\(\s*["'](\/[^"']*)["']\s*\)"""),
        re.compile(r"""(?:get|post|put|delete|patch)\s*\(\s*["'](\/[^"']*)["']\s*\)"""),
    ],
}


def parse_generic_file(file_path: Path, language: str) -> List[Dict[str, Any]]:
    try:
        source = file_path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return []

    lines = source.splitlines()
    nodes: List[Dict[str, Any]] = []

    func_re = _GEN_FUNC.get(language)
    if func_re:
        for m in func_re.finditer(source):
            name = m.group(1)
            line_no = source[: m.start()].count("\n") + 1
            snip = _snippet(lines, line_no)
            nodes.append({
                "name": name,
                "type": "function",
                "method": None,
                "route": None,
                "code": snip,
                "line": line_no,
                "calls": _calls_from_snippet(snip, name),
            })

    for route_re in _GEN_ROUTES.get(language, []):
        for m in route_re.finditer(source):
            groups = [g for g in m.groups() if g is not None]
            if len(groups) == 2:
                meth, path = groups[0].upper(), groups[1]
            elif len(groups) == 1:
                meth, path = "GET", groups[0]
            else:
                continue
            line_no = source[: m.start()].count("\n") + 1
            nodes.append({
                "name": f"{meth} {path}",
                "type": "endpoint",
                "method": meth,
                "route": path,
                "code": _snippet(lines, line_no, 5),
                "line": line_no,
                "calls": [],
            })

    return nodes


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

def parse_file(file_path: Path) -> List[Dict[str, Any]]:
    lang = detect_language(file_path)
    if lang is None:
        return []
    if lang == "python":
        return parse_python_file(file_path)
    if lang in ("javascript", "typescript"):
        return parse_js_ts_file(file_path)
    if lang == "java":
        return parse_java_file(file_path)
    if lang == "go":
        return parse_go_file(file_path)
    return parse_generic_file(file_path, lang)


# ---------------------------------------------------------------------------
# Workspace-level aggregation
# Produces the exact dict shapes expected by _build_workspace_graph in main.py
# ---------------------------------------------------------------------------

def parse_workspace_files(
    files: List[Path],
    workspace_root: Path,
) -> Tuple[
    Dict[str, Dict[str, Any]],   # functions  {fn_id: {id, name, file, code, direct_calls}}
    Dict[str, List[str]],         # name_index {name: [fn_ids]}
    Dict[str, Dict[str, str]],    # file_function_index {rel_file: {name: fn_id}}
    List[Dict[str, Any]],         # endpoints
]:
    functions: Dict[str, Dict[str, Any]] = {}
    name_index: Dict[str, List[str]] = {}
    file_function_index: Dict[str, Dict[str, str]] = {}
    endpoints: List[Dict[str, Any]] = []

    for file_path in files:
        parsed = parse_file(file_path)
        if not parsed:
            continue

        rel_file = _safe_relative(file_path, workspace_root)
        file_function_index.setdefault(rel_file, {})

        fn_nodes = [n for n in parsed if n["type"] == "function"]
        ep_nodes = [n for n in parsed if n["type"] == "endpoint"]

        for fn in fn_nodes:
            fn_id = f"{rel_file}::{fn['name']}"
            # Deduplicate if same name appears multiple times (overloads, etc.)
            if fn_id in functions:
                fn_id = f"{rel_file}::{fn['name']}_{fn['line']}"
            functions[fn_id] = {
                "id": fn_id,
                "name": fn["name"],
                "file": rel_file,
                "code": fn["code"],
                "direct_calls": fn["calls"],
                "group": infer_group(fn["name"], rel_file),
            }
            file_function_index[rel_file][fn["name"]] = fn_id
            name_index.setdefault(fn["name"], []).append(fn_id)

        for ep in ep_nodes:
            # Try to find the handler function in the same file
            ep_label = ep["name"]
            # For Python the handler name is the function itself; for others
            # the route node name is "METHOD /path" — use last path segment
            route_tail = ep.get("route", "/").rstrip("/").rsplit("/", 1)[-1] or "root"
            handler_name = (
                file_function_index[rel_file].get(ep_label)
                or file_function_index[rel_file].get(route_tail)
            )
            if not handler_name:
                # Synthesise a stub function
                stub_name = (
                    ep_label.replace(" ", "_").replace("/", "_")
                    .replace("-", "_").strip("_") or "handler"
                )
                stub_id = f"{rel_file}::{stub_name}"
                if stub_id not in functions:
                    functions[stub_id] = {
                        "id": stub_id,
                        "name": stub_name,
                        "file": rel_file,
                        "code": ep["code"],
                        "direct_calls": [],
                    }
                    file_function_index[rel_file][stub_name] = stub_id
                    name_index.setdefault(stub_name, []).append(stub_id)
                root_fn_id = stub_id
            else:
                root_fn_id = handler_name

            ep_id = f"endpoint::{root_fn_id}::{ep.get('method','GET')}::{ep.get('route','/')}"
            endpoints.append({
                "id": ep_id,
                "root_function_id": root_fn_id,
                "function_name": functions[root_fn_id]["name"],
                "method": ep.get("method", "GET"),
                "route_path": ep.get("route", "/"),
                "file": rel_file,
                "code": ep["code"],
            })

    return functions, name_index, file_function_index, endpoints


# ---------------------------------------------------------------------------
# IBM-BOB: Semantic group patterns, sensitivity detection & risk scoring
# ---------------------------------------------------------------------------

_SENSITIVE_PATTERNS: List[re.Pattern] = [
    re.compile(p, re.I) for p in [
        r"payment", r"auth", r"login", r"token", r"secret",
        r"invoice", r"billing", r"charge", r"credit", r"wallet",
        r"password", r"session", r"encrypt", r"decrypt", r"hash",
    ]
]

_GROUP_PATTERNS: Dict[str, List[re.Pattern]] = {
    "auth":          [re.compile(p, re.I) for p in [r"auth", r"login", r"logout", r"session", r"token", r"password", r"credential", r"signin", r"signup", r"oauth", r"jwt", r"verify"]],
    "payments":      [re.compile(p, re.I) for p in [r"payment", r"invoice", r"billing", r"charge", r"credit", r"wallet", r"stripe", r"checkout", r"subscription", r"refund", r"transaction"]],
    "notifications": [re.compile(p, re.I) for p in [r"notif", r"email", r"sms", r"alert", r"webhook", r"push", r"message", r"chat", r"inbox"]],
    "analytics":     [re.compile(p, re.I) for p in [r"analytic", r"track", r"metric", r"event", r"report", r"dashboard", r"stat", r"insight", r"telemetry"]],
    "database":      [re.compile(p, re.I) for p in [r"\bdb\b", r"database", r"repository", r"model", r"schema", r"query", r"orm", r"\bstore\b", r"storage", r"cache", r"redis"]],
    "api":           [re.compile(p, re.I) for p in [r"controller", r"router", r"route", r"handler", r"endpoint", r"middleware", r"resolver", r"interceptor"]],
    "governance":    [re.compile(p, re.I) for p in [r"proposal", r"vote", r"dao", r"govern", r"delegate", r"ballot", r"quorum"]],
    "profile":       [re.compile(p, re.I) for p in [r"profile", r"avatar", r"account", r"member"]],
    "content":       [re.compile(p, re.I) for p in [r"comment", r"feed", r"like", r"dislike", r"reply", r"thread", r"article", r"content"]],
    "moderation":    [re.compile(p, re.I) for p in [r"flag", r"moderat", r"ban", r"spam", r"abuse"]],
    "learning":      [re.compile(p, re.I) for p in [r"module", r"quiz", r"topic", r"progress", r"streak", r"course", r"lesson", r"learn", r"enroll"]],
}


def infer_group(name: str, file_path: str) -> str:
    search = (name + " " + file_path).lower()
    for group, patterns in _GROUP_PATTERNS.items():
        if any(p.search(search) for p in patterns):
            return group
    return "utils"


def is_sensitive(name: str) -> bool:
    return any(p.search(name) for p in _SENSITIVE_PATTERNS)


def compute_risk_score(fan_in: int, fan_out: int, sensitive: bool) -> float:
    connectivity = min(1.0, (fan_in * 0.6 + fan_out * 0.4) / 15.0)
    return round(min(1.0, connectivity + (0.35 if sensitive else 0.0)), 3)


# ---------------------------------------------------------------------------
# Virtual endpoints (unchanged)
# ---------------------------------------------------------------------------

def make_virtual_endpoints(
    functions: Dict[str, Dict[str, Any]],
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """
    When no real HTTP endpoints are found, synthesise virtual entry-points
    from functions that are not called by any other function in the workspace
    (i.e., topmost nodes in the call graph).
    """
    all_called: Set[str] = set()
    for fn in functions.values():
        for called in fn.get("direct_calls", []):
            all_called.add(called)

    roots = [
        fid for fid, fn in functions.items()
        if fn["name"] not in all_called
    ]

    if not roots:
        roots = list(functions.keys())

    virtual: List[Dict[str, Any]] = []
    for fn_id in roots[:limit]:
        fn = functions[fn_id]
        virtual.append({
            "id": f"endpoint::{fn_id}::FUNC::{fn['name']}",
            "root_function_id": fn_id,
            "function_name": fn["name"],
            "method": "FUNC",
            "route_path": fn["name"],
            "file": fn["file"],
            "code": fn["code"],
        })

    return virtual
