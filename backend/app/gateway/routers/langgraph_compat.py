from __future__ import annotations

import asyncio
import json
import shutil
import tempfile
import threading
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from deerflow.client import DeerFlowClient
from deerflow.config.paths import get_paths

router = APIRouter(prefix="/api/langgraph", tags=["langgraph"])


def _now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


class _ThreadStore:
    def __init__(self, path: str | Path | None = None) -> None:
        if path is None:
            path = Path(get_paths().base_dir) / "langgraph" / "threads.json"
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._data = self._load()

    def _load(self) -> dict[str, dict[str, Any]]:
        if not self._path.exists():
            return {}
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                return raw
        except Exception:
            return {}
        return {}

    def _save(self) -> None:
        fd = tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=self._path.parent, suffix=".tmp", delete=False)
        try:
            json.dump(self._data, fd, ensure_ascii=False)
            fd.close()
            Path(fd.name).replace(self._path)
        except BaseException:
            fd.close()
            Path(fd.name).unlink(missing_ok=True)
            raise

    @staticmethod
    def _empty_values() -> dict[str, Any]:
        return {"messages": [], "artifacts": [], "title": None, "todos": []}

    def create_thread(self, metadata: dict[str, Any] | None = None, thread_id: str | None = None) -> dict[str, Any]:
        thread_id = thread_id or str(uuid.uuid4())
        now = _now_iso()
        with self._lock:
            existed = self._data.get(thread_id)
            if existed is not None:
                if metadata:
                    existed["metadata"] = {**(existed.get("metadata") or {}), **metadata}
                    existed["updated_at"] = now
                    self._save()
                return {
                    "thread_id": thread_id,
                    "created_at": existed.get("created_at", now),
                    "metadata": existed.get("metadata", {}),
                }
            record = {
                "thread_id": thread_id,
                "created_at": now,
                "updated_at": now,
                "metadata": metadata or {},
                "status": "idle",
                "values": self._empty_values(),
                "history": [],
                "runs": [],
            }
            self._data[thread_id] = record
            self._save()
        return {"thread_id": thread_id, "created_at": now, "metadata": record["metadata"]}

    def ensure_thread(self, thread_id: str) -> dict[str, Any]:
        with self._lock:
            record = self._data.get(thread_id)
            if record is None:
                now = _now_iso()
                record = {
                    "thread_id": thread_id,
                    "created_at": now,
                    "updated_at": now,
                    "metadata": {},
                    "status": "idle",
                    "values": self._empty_values(),
                    "history": [],
                    "runs": [],
                }
                self._data[thread_id] = record
                self._save()
            return record

    def get(self, thread_id: str) -> dict[str, Any]:
        with self._lock:
            record = self._data.get(thread_id)
            if record is None:
                raise KeyError(thread_id)
            return record

    def delete(self, thread_id: str) -> None:
        with self._lock:
            if thread_id not in self._data:
                raise KeyError(thread_id)
            del self._data[thread_id]
            self._save()

    def update_values(self, thread_id: str, values: dict[str, Any]) -> dict[str, Any]:
        now = _now_iso()
        with self._lock:
            record = self._data.get(thread_id)
            if record is None:
                raise KeyError(thread_id)
            merged = dict(record.get("values") or {})
            merged.update(values or {})
            record["values"] = merged
            record["updated_at"] = now
            history = list(record.get("history") or [])
            history.append({"created_at": now, "values": merged})
            record["history"] = history[-200:]
            self._save()
            return merged

    def append_run(self, thread_id: str, run_id: str, status: str) -> None:
        with self._lock:
            record = self._data.get(thread_id)
            if record is None:
                raise KeyError(thread_id)
            runs = list(record.get("runs") or [])
            runs.append({"run_id": run_id, "status": status, "created_at": _now_iso()})
            record["runs"] = runs[-200:]
            record["updated_at"] = _now_iso()
            self._save()

    def get_run(self, thread_id: str, run_id: str) -> dict[str, Any] | None:
        with self._lock:
            record = self._data.get(thread_id)
            if record is None:
                raise KeyError(thread_id)
            runs = list(record.get("runs") or [])
            for run in reversed(runs):
                if run.get("run_id") == run_id:
                    return run
            return None

    def update_run_status(self, thread_id: str, run_id: str, status: str) -> None:
        with self._lock:
            record = self._data.get(thread_id)
            if record is None:
                raise KeyError(thread_id)
            runs = list(record.get("runs") or [])
            for run in reversed(runs):
                if run.get("run_id") == run_id:
                    run["status"] = status
                    break
            record["runs"] = runs
            record["updated_at"] = _now_iso()
            self._save()

    def search(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        sort_by: str = "updated_at",
        sort_order: str = "desc",
        select: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        with self._lock:
            threads = list(self._data.values())
        reverse = sort_order != "asc"
        threads.sort(key=lambda t: t.get(sort_by, t.get("updated_at", "")), reverse=reverse)
        sliced = threads[max(0, offset) : max(0, offset) + max(0, limit)]
        if not select:
            return sliced
        selected: list[dict[str, Any]] = []
        for thread in sliced:
            entry: dict[str, Any] = {}
            for key in select:
                entry[key] = thread.get(key)
            if "thread_id" not in entry:
                entry["thread_id"] = thread.get("thread_id")
            selected.append(entry)
        return selected


class _ClientHolder:
    def __init__(self) -> None:
        self._client: DeerFlowClient | None = None
        self._lock = threading.Lock()

    def get(self) -> DeerFlowClient:
        with self._lock:
            if self._client is None:
                self._client = DeerFlowClient()
            return self._client


class ThreadCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")
    thread_id: str | None = Field(default=None, alias="threadId")
    metadata: dict[str, Any] = Field(default_factory=dict)


class ThreadSearchRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    limit: int = 50
    offset: int = 0
    sort_by: str = Field(default="updated_at", alias="sortBy")
    sort_order: str = Field(default="desc", alias="sortOrder")
    select: list[str] | None = None


class ThreadUpdateStateRequest(BaseModel):
    values: dict[str, Any] = Field(default_factory=dict)


class RunStreamRequest(BaseModel):
    input: dict[str, Any] = Field(default_factory=dict)
    stream_mode: list[str] = Field(default_factory=lambda: ["values", "messages-tuple", "custom"])
    context: dict[str, Any] = Field(default_factory=dict)
    config: dict[str, Any] = Field(default_factory=dict)


class GlobalRunStreamRequest(RunStreamRequest):
    thread_id: str | None = None


_threads = _ThreadStore()
_client_holder = _ClientHolder()
_run_cancel_events: dict[str, asyncio.Event] = {}
_run_events_lock = threading.Lock()
_run_payload_store: dict[str, RunStreamRequest] = {}
_run_result_store: dict[str, dict[str, Any]] = {}


def _extract_user_message(payload: RunStreamRequest) -> str:
    messages = payload.input.get("messages", [])
    if not isinstance(messages, list) or len(messages) == 0:
        return ""
    msg = messages[-1]
    content = msg.get("content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
            elif isinstance(item, str):
                parts.append(item)
        return "\n".join(parts).strip()
    return str(content)


def _extract_last_user_message(payload: RunStreamRequest) -> dict[str, Any] | None:
    messages = payload.input.get("messages", [])
    if not isinstance(messages, list) or len(messages) == 0:
        return None
    msg = messages[-1]
    if not isinstance(msg, dict):
        return None
    return msg


def _normalize_files_from_message(msg: dict[str, Any], thread_id: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    kwargs = msg.get("additional_kwargs")
    kwargs_files = kwargs.get("files") if isinstance(kwargs, dict) else None
    new_files: list[dict[str, Any]] = []
    new_names: set[str] = set()

    if isinstance(kwargs_files, list):
        for f in kwargs_files:
            if not isinstance(f, dict):
                continue
            filename = f.get("filename")
            if not isinstance(filename, str) or Path(filename).name != filename:
                continue
            size = int(f.get("size") or 0)
            new_files.append(
                {
                    "filename": filename,
                    "size": size,
                    "path": f"/mnt/user-data/uploads/{filename}",
                    "extension": Path(filename).suffix,
                }
            )
            new_names.add(filename)

    _ensure_thread_upload_files(thread_id, new_names)

    historical_files: list[dict[str, Any]] = []
    uploads_dir = get_paths().sandbox_uploads_dir(thread_id)
    if uploads_dir.exists():
        for p in sorted(uploads_dir.iterdir()):
            if not p.is_file() or p.name in new_names:
                continue
            stat = p.stat()
            historical_files.append(
                {
                    "filename": p.name,
                    "size": stat.st_size,
                    "path": f"/mnt/user-data/uploads/{p.name}",
                    "extension": p.suffix,
                }
            )

    return new_files, historical_files


def _ensure_thread_upload_files(thread_id: str, filenames: set[str]) -> None:
    if not filenames:
        return
    paths = get_paths()
    thread_uploads = paths.sandbox_uploads_dir(thread_id)
    thread_uploads.mkdir(parents=True, exist_ok=True)
    threads_root = Path(paths.base_dir) / "threads"
    if not threads_root.exists():
        return
    for filename in filenames:
        target = thread_uploads / filename
        if target.exists():
            continue
        candidates = list(threads_root.glob(f"*/user-data/uploads/{filename}"))
        candidates = [p for p in candidates if p.is_file()]
        if not candidates:
            continue
        source = max(candidates, key=lambda p: p.stat().st_mtime)
        try:
            shutil.copy2(source, target)
        except Exception:
            continue


def _format_uploaded_files_block(new_files: list[dict[str, Any]], historical_files: list[dict[str, Any]]) -> str:
    lines = ["<uploaded_files>", "The following files were uploaded in this message:", ""]
    if new_files:
        for file in new_files:
            size_kb = file["size"] / 1024
            size_str = f"{size_kb:.1f} KB" if size_kb < 1024 else f"{size_kb / 1024:.1f} MB"
            lines.append(f"- {file['filename']} ({size_str})")
            lines.append(f"  Path: {file['path']}")
            lines.append("")
    else:
        lines.append("(empty)")
    if historical_files:
        lines.extend(["The following files were uploaded in previous messages and are still available:", ""])
        for file in historical_files:
            size_kb = file["size"] / 1024
            size_str = f"{size_kb:.1f} KB" if size_kb < 1024 else f"{size_kb / 1024:.1f} MB"
            lines.append(f"- {file['filename']} ({size_str})")
            lines.append(f"  Path: {file['path']}")
            lines.append("")
    lines.append("You can read these files using the `read_file` tool with the paths shown above.")
    lines.append("</uploaded_files>")
    return "\n".join(lines)


def _build_effective_user_message(thread_id: str, payload: RunStreamRequest) -> str:
    text = _extract_user_message(payload)
    msg = _extract_last_user_message(payload)
    if msg is None:
        return text
    new_files, historical_files = _normalize_files_from_message(msg, thread_id)
    if not new_files and not historical_files:
        return text
    files_block = _format_uploaded_files_block(new_files, historical_files)
    return f"{files_block}\n\n{text}" if text else files_block


def _resolve_runtime_overrides(payload: RunStreamRequest) -> dict[str, Any]:
    configurable = payload.config.get("configurable", {})
    context = payload.context or {}
    recursion_limit = payload.config.get("recursion_limit", 100)
    overrides = {
        **configurable,
        **context,
        "model_name": context.get("model_name", configurable.get("model_name")),
        "thinking_enabled": context.get("thinking_enabled", configurable.get("thinking_enabled", True)),
        "plan_mode": context.get("is_plan_mode", configurable.get("is_plan_mode", False)),
        "subagent_enabled": context.get("subagent_enabled", configurable.get("subagent_enabled", False)),
        "reasoning_effort": context.get("reasoning_effort", configurable.get("reasoning_effort")),
        "agent_name": context.get("agent_name", configurable.get("agent_name")),
        "max_concurrent_subagents": context.get(
            "max_concurrent_subagents",
            configurable.get("max_concurrent_subagents", 3),
        ),
        "is_bootstrap": context.get("is_bootstrap", configurable.get("is_bootstrap", False)),
        "recursion_limit": recursion_limit,
    }
    return {key: value for key, value in overrides.items() if value is not None}


@router.post("/threads")
async def create_thread(payload: ThreadCreateRequest) -> dict[str, Any]:
    return _threads.create_thread(metadata=payload.metadata, thread_id=payload.thread_id)


@router.post("/threads/search")
async def search_threads(payload: ThreadSearchRequest) -> list[dict[str, Any]]:
    return _threads.search(
        limit=payload.limit,
        offset=payload.offset,
        sort_by=payload.sort_by,
        sort_order=payload.sort_order,
        select=payload.select,
    )


@router.get("/threads/{thread_id}/state")
async def get_thread_state(thread_id: str) -> dict[str, Any]:
    try:
        record = _threads.get(thread_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Thread not found: {thread_id}") from exc
    return {
        "values": record.get("values", {}),
        "next": [],
        "metadata": record.get("metadata", {}),
        "thread_id": thread_id,
    }


@router.get("/threads/{thread_id}")
async def get_thread(thread_id: str) -> dict[str, Any]:
    try:
        return _threads.get(thread_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Thread not found: {thread_id}") from exc


@router.post("/threads/{thread_id}/state")
async def update_thread_state(thread_id: str, payload: ThreadUpdateStateRequest) -> dict[str, Any]:
    try:
        values = _threads.update_values(thread_id, payload.values)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Thread not found: {thread_id}") from exc
    return {"values": values}


@router.patch("/threads/{thread_id}/state")
async def patch_thread_state(thread_id: str, payload: ThreadUpdateStateRequest) -> dict[str, Any]:
    return await update_thread_state(thread_id, payload)


@router.put("/threads/{thread_id}/state")
async def put_thread_state(thread_id: str, payload: ThreadUpdateStateRequest) -> dict[str, Any]:
    return await update_thread_state(thread_id, payload)


@router.post("/threads/{thread_id}/history")
async def thread_history(thread_id: str) -> list[dict[str, Any]]:
    try:
        record = _threads.get(thread_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Thread not found: {thread_id}") from exc
    history = record.get("history", [])
    if not history:
        return [{"values": record.get("values", {}), "created_at": record.get("created_at")}]
    return history


@router.get("/threads/{thread_id}/history")
async def thread_history_get(thread_id: str) -> list[dict[str, Any]]:
    return await thread_history(thread_id)


@router.delete("/threads/{thread_id}")
async def delete_thread(thread_id: str) -> dict[str, Any]:
    try:
        _threads.delete(thread_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Thread not found: {thread_id}") from exc
    return {"ok": True}


@router.get("/threads/{thread_id}/runs")
async def list_runs(thread_id: str) -> dict[str, Any]:
    try:
        record = _threads.get(thread_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Thread not found: {thread_id}") from exc
    return {"runs": record.get("runs", [])}


@router.get("/threads/{thread_id}/runs/{run_id}")
async def get_run(thread_id: str, run_id: str) -> dict[str, Any]:
    try:
        run = _threads.get_run(thread_id, run_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Thread not found: {thread_id}") from exc
    if run is None:
        raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")
    with _run_events_lock:
        result = _run_result_store.get(run_id)
    if result is not None:
        run = {**run, "result": result}
    return run


@router.post("/threads/{thread_id}/runs")
async def create_run(thread_id: str, payload: RunStreamRequest) -> dict[str, Any]:
    _threads.ensure_thread(thread_id)
    run_id = str(uuid.uuid4())
    _threads.append_run(thread_id, run_id, "pending")
    with _run_events_lock:
        _run_payload_store[run_id] = payload
    return {"run_id": run_id, "thread_id": thread_id, "status": "pending"}


@router.post("/threads/{thread_id}/runs/{run_id}/cancel")
async def cancel_run(thread_id: str, run_id: str) -> dict[str, Any]:
    with _run_events_lock:
        event = _run_cancel_events.get(run_id)
        _run_payload_store.pop(run_id, None)
    if event is not None:
        event.set()
    try:
        _threads.update_run_status(thread_id, run_id, "cancelled")
    except KeyError:
        pass
    return {"ok": True, "run_id": run_id, "thread_id": thread_id}


@router.delete("/threads/{thread_id}/runs/{run_id}")
async def delete_run(thread_id: str, run_id: str) -> dict[str, Any]:
    return await cancel_run(thread_id, run_id)


@router.post("/threads/{thread_id}/runs/{run_id}/stream")
async def join_run_stream(thread_id: str, run_id: str, payload: RunStreamRequest) -> StreamingResponse:
    with _run_events_lock:
        cached_result = _run_result_store.get(run_id)
    if cached_result is not None:
        values = cached_result.get("values") or {}

        def make_sse(event_name: str, data: dict[str, Any]) -> str:
            return f"event: {event_name}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

        async def replay_stream():
            yield make_sse("metadata", {"run_id": run_id, "thread_id": thread_id})
            if values:
                yield make_sse("values", values)
            yield make_sse("end", {"run_id": run_id, "thread_id": thread_id})

        return StreamingResponse(replay_stream(), media_type="text/event-stream")
    with _run_events_lock:
        stored_payload = _run_payload_store.pop(run_id, None)
    stream_payload = stored_payload or payload
    return await stream_run(thread_id, stream_payload, run_id=run_id)


@router.post("/threads/{thread_id}/runs/{run_id}/join")
async def join_run(thread_id: str, run_id: str, payload: RunStreamRequest) -> StreamingResponse:
    return await join_run_stream(thread_id, run_id, payload)


@router.get("/threads/{thread_id}/runs/{run_id}/stream")
async def join_run_stream_get(thread_id: str, run_id: str) -> StreamingResponse:
    with _run_events_lock:
        cached_result = _run_result_store.get(run_id)
    if cached_result is not None:
        values = cached_result.get("values") or {}

        def make_sse(event_name: str, data: dict[str, Any]) -> str:
            return f"event: {event_name}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

        async def replay_stream():
            yield make_sse("metadata", {"run_id": run_id, "thread_id": thread_id})
            if values:
                yield make_sse("values", values)
            yield make_sse("end", {"run_id": run_id, "thread_id": thread_id})

        return StreamingResponse(replay_stream(), media_type="text/event-stream")
    with _run_events_lock:
        stored_payload = _run_payload_store.get(run_id)
    if stored_payload is None:
        stored_payload = RunStreamRequest()
    return await stream_run(thread_id, stored_payload, run_id=run_id)


@router.post("/threads/{thread_id}/runs/wait")
async def wait_run(thread_id: str, payload: RunStreamRequest) -> dict[str, Any]:
    _threads.ensure_thread(thread_id)
    client = _client_holder.get()
    text = _build_effective_user_message(thread_id, payload)
    overrides = _resolve_runtime_overrides(payload)
    last_values: dict[str, Any] | None = None
    for evt in client.stream(text, thread_id=thread_id, **overrides):
        if evt.type == "values":
            last_values = evt.data
    if last_values is None:
        last_values = {"messages": [], "artifacts": [], "title": None}
    _threads.update_values(thread_id, last_values)
    return last_values


@router.post("/threads/{thread_id}/runs/{run_id}/wait")
async def wait_run_by_id(thread_id: str, run_id: str, payload: RunStreamRequest) -> dict[str, Any]:
    with _run_events_lock:
        stored_payload = _run_payload_store.pop(run_id, None)
    effective_payload = stored_payload or payload
    result = await wait_run(thread_id, effective_payload)
    try:
        _threads.update_run_status(thread_id, run_id, "success")
    except KeyError:
        pass
    with _run_events_lock:
        _run_result_store[run_id] = {"thread_id": thread_id, "status": "success", "values": result}
    return result


@router.post("/threads/{thread_id}/runs/stream")
async def stream_run(thread_id: str, payload: RunStreamRequest, run_id: str | None = None) -> StreamingResponse:
    _threads.ensure_thread(thread_id)
    run_id = run_id or str(uuid.uuid4())
    cancel_event = asyncio.Event()
    with _run_events_lock:
        _run_cancel_events[run_id] = cancel_event
    _threads.append_run(thread_id, run_id, "running")

    client = _client_holder.get()
    text = _build_effective_user_message(thread_id, payload)
    overrides = _resolve_runtime_overrides(payload)
    stream_mode = payload.stream_mode or ["values", "messages-tuple", "custom"]

    def make_sse(event_name: str, data: dict[str, Any]) -> str:
        return f"event: {event_name}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    async def event_stream():
        queue: asyncio.Queue[tuple[str, dict[str, Any]] | None] = asyncio.Queue()
        loop = asyncio.get_running_loop()
        last_values: dict[str, Any] | None = None

        def producer() -> None:
            nonlocal last_values
            try:
                for evt in client.stream(text, thread_id=thread_id, **overrides):
                    if cancel_event.is_set():
                        break
                    if evt.type == "values":
                        last_values = evt.data
                    loop.call_soon_threadsafe(queue.put_nowait, (evt.type, evt.data))
            except Exception as exc:
                loop.call_soon_threadsafe(queue.put_nowait, ("error", {"detail": str(exc)}))
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)

        producer_task = asyncio.create_task(asyncio.to_thread(producer))
        try:
            yield make_sse("metadata", {"run_id": run_id, "thread_id": thread_id})
            while True:
                item = await queue.get()
                if item is None:
                    break
                event_name, data = item
                if event_name == "error":
                    yield make_sse("error", data)
                    continue
                if event_name == "messages-tuple":
                    if "messages-tuple" in stream_mode:
                        yield make_sse("messages-tuple", data)
                    elif "messages" in stream_mode:
                        yield make_sse("messages", data)
                    continue
                if event_name not in stream_mode and event_name != "values":
                    continue
                yield make_sse(event_name, data)
            yield make_sse("end", {"run_id": run_id, "thread_id": thread_id})
        finally:
            await producer_task
            with _run_events_lock:
                _run_cancel_events.pop(run_id, None)
                _run_payload_store.pop(run_id, None)
                _run_result_store[run_id] = {
                    "thread_id": thread_id,
                    "status": "cancelled" if cancel_event.is_set() else "success",
                    "values": last_values or {},
                }
            if cancel_event.is_set():
                _threads.update_run_status(thread_id, run_id, "cancelled")
            else:
                _threads.update_run_status(thread_id, run_id, "success")
            if last_values is not None:
                _threads.update_values(thread_id, last_values)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/runs/stream")
async def stream_run_global(payload: GlobalRunStreamRequest) -> StreamingResponse:
    thread_id = payload.thread_id or str(uuid.uuid4())
    inner_payload = RunStreamRequest(
        input=payload.input,
        stream_mode=payload.stream_mode,
        context=payload.context,
        config=payload.config,
    )
    return await stream_run(thread_id, inner_payload)
