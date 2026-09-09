#!/usr/bin/env python3
"""Vertex のメールボックスを Python 標準ライブラリだけで呼び出す。"""

import argparse
import json
import math
import os
from pathlib import Path
import sys
import time
import uuid

DEFAULT_TIMEOUT_SECONDS = 60.0
POLL_INTERVAL_SECONDS = 0.05
MAILBOX_RELATIVE_PATH = Path("DebugOutput") / "agent-mailbox"


def resolve_mailbox(explicit_directory):
    """明示指定、環境変数、既存の親ディレクトリ、作業位置の順で解決する。"""
    configured = explicit_directory or os.environ.get("VERTEX_MAILBOX")
    if configured:
        return Path(configured).expanduser().resolve()
    current = Path.cwd().resolve()
    for parent in (current, *current.parents):
        candidate = parent / MAILBOX_RELATIVE_PATH
        if candidate.is_dir():
            return candidate
    return current / MAILBOX_RELATIVE_PATH


def write_atomic(path, payload):
    """書きかけの要求を監視側へ見せないよう同じディレクトリで公開する。"""
    temporary_path = path.with_name(path.name + ".tmp")
    try:
        with temporary_path.open("x", encoding="utf-8") as stream:
            json.dump(payload, stream, ensure_ascii=False, allow_nan=False)
        temporary_path.replace(path)
    finally:
        temporary_path.unlink(missing_ok=True)


def reject_nonfinite(value):
    """Node が JSON として受理しない非有限数を拒否する。"""
    raise ValueError(f"JSON に非有限数は使えません: {value}")


def request(mailbox, operation, arguments, timeout):
    """一意な要求を公開し、応答を読み終えたら削除する。"""
    mailbox.mkdir(parents=True, exist_ok=True)
    (mailbox / ".enabled").touch(exist_ok=True)
    identifier = uuid.uuid4().hex
    request_path = mailbox / f"req-{identifier}.json"
    response_path = mailbox / f"res-{identifier}.json"
    write_atomic(request_path, {"op": operation, "args": json.dumps(arguments, ensure_ascii=False, allow_nan=False)})
    deadline = time.monotonic() + timeout
    while True:
        if response_path.is_file():
            response = json.loads(response_path.read_text(encoding="utf-8-sig"))
            if not isinstance(response, dict) or not isinstance(response.get("ok"), bool):
                raise ValueError("メールボックスの応答形式が不正です")
            response_path.unlink()
            return response
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError(f"応答待ちがタイムアウトしました: {request_path}（要求は残っています）")
        time.sleep(min(POLL_INTERVAL_SECONDS, remaining))


def main(argv=None):
    """コマンド応答を一つの JSON として stdout に出力する。"""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("op")
    parser.add_argument("args", nargs="?", default="{}", help="引数の JSON オブジェクト")
    parser.add_argument("--mailbox", metavar="DIR")
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT_SECONDS)
    options = parser.parse_args(argv)
    try:
        if not math.isfinite(options.timeout) or options.timeout <= 0:
            raise ValueError("--timeout は有限の正数で指定してください")
        arguments = json.loads(options.args, parse_constant=reject_nonfinite)
        if not isinstance(arguments, dict):
            raise ValueError("引数は JSON オブジェクトで指定してください")
        response = request(resolve_mailbox(options.mailbox), options.op, arguments, options.timeout)
        print(json.dumps(response, ensure_ascii=False, allow_nan=False))
        return 0 if response["ok"] else 1
    except (OSError, ValueError, TimeoutError) as exception:
        print(json.dumps({"ok": False, "op": options.op, "error": str(exception), "elapsedMs": 0}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    sys.exit(main())
