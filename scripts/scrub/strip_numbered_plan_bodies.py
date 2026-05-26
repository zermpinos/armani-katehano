# filter-repo --commit-callback BODY: cleanup pass for commit messages that
# carry numbered-plan formatting (a fingerprint of plan-driven authoring).
#
# Operations:
#   1. If the SUBJECT itself starts with a numbered-plan prefix
#      (e.g. "  1. Import foo from bar"), strip the prefix so the
#      remainder becomes the subject.
#   2. If the BODY contains any line matching the numbered-plan shape
#      (>=1 line like "  2. something"), drop the body entirely.
#
# Independent of message_rewrites.yaml; idempotent.
import re

if "NUMBERED_PLAN_RE" not in globals():
    globals()["NUMBERED_PLAN_RE"]  = re.compile(rb'(?:^|\n)\s+\d+\.\s')
    globals()["LEADING_PLAN_RE"]   = re.compile(rb'^\s*\d+\.\s+')

_msg = commit.message
_was_str = isinstance(_msg, str)
_msg_bytes = _msg.encode("utf-8") if _was_str else _msg

# Split into subject + rest at the first newline.
_first_nl = _msg_bytes.find(b"\n")
if _first_nl < 0:
    _subject = _msg_bytes
    _rest = b""
else:
    _subject = _msg_bytes[:_first_nl]
    _rest = _msg_bytes[_first_nl + 1:]

# (1) Strip a numbered-plan prefix from the subject if present.
_m = LEADING_PLAN_RE.match(_subject)
if _m:
    _subject = _subject[_m.end():].strip()

# (2) Drop the body if it contains any numbered-plan items.
_body_hits = NUMBERED_PLAN_RE.findall(_rest)
if len(_body_hits) >= 1:
    _rest = b""

# Reassemble; only mutate if something changed.
if _rest:
    _new = _subject + b"\n\n" + _rest.strip(b"\n")
else:
    _new = _subject

if _new != _msg_bytes:
    commit.message = _new.decode("utf-8") if _was_str else _new
