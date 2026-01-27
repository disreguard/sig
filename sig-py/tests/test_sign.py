import json
import re

from sig.core.config import init_project
from sig.core.sign import sign_file


class TestSignFile:
    test_content = "Hello {{ name }}, welcome to {{ place }}.\n"

    def _setup(self, tmp_path):
        init_project(str(tmp_path))
        prompts = tmp_path / "prompts"
        prompts.mkdir(exist_ok=True)
        (prompts / "test.txt").write_text(self.test_content, encoding="utf-8")
        return str(tmp_path)

    def test_signs_file_and_creates_signature(self, tmp_path):
        root = self._setup(tmp_path)
        sig = sign_file(root, "prompts/test.txt", identity="alice")

        assert sig.file == "prompts/test.txt"
        assert re.match(r"^sha256:[a-f0-9]{64}$", sig.hash)
        assert sig.algorithm == "sha256"
        assert sig.signed_by == "alice"
        assert sig.signed_at
        assert sig.content_length == len(self.test_content.encode("utf-8"))

    def test_stores_signature_and_content(self, tmp_path):
        root = self._setup(tmp_path)
        sign_file(root, "prompts/test.txt", identity="bob")

        sig_path = tmp_path / ".sig" / "sigs" / "prompts" / "test.txt.sig.json"
        raw = json.loads(sig_path.read_text("utf-8"))
        assert raw["file"] == "prompts/test.txt"
        assert raw["signedBy"] == "bob"

        content_path = tmp_path / ".sig" / "sigs" / "prompts" / "test.txt.sig.content"
        assert content_path.read_text("utf-8") == self.test_content

    def test_records_template_engine_from_config(self, tmp_path):
        init_project(str(tmp_path), engine="jinja")
        prompts = tmp_path / "prompts"
        prompts.mkdir(exist_ok=True)
        (prompts / "test.txt").write_text(self.test_content, encoding="utf-8")

        sig = sign_file(str(tmp_path), "prompts/test.txt")
        assert sig.template_engine == "jinja"

    def test_uses_engine_override(self, tmp_path):
        root = self._setup(tmp_path)
        sig = sign_file(root, "prompts/test.txt", engine="mustache")
        assert sig.template_engine == "mustache"

    def test_creates_audit_entry(self, tmp_path):
        root = self._setup(tmp_path)
        sign_file(root, "prompts/test.txt", identity="eve")

        audit_path = tmp_path / ".sig" / "audit.jsonl"
        raw = audit_path.read_text("utf-8").strip()
        entry = json.loads(raw)
        assert entry["event"] == "sign"
        assert entry["file"] == "prompts/test.txt"
        assert entry["identity"] == "eve"

    def test_deterministic_hash(self, tmp_path):
        root = self._setup(tmp_path)
        sig1 = sign_file(root, "prompts/test.txt")
        sig2 = sign_file(root, "prompts/test.txt")
        assert sig1.hash == sig2.hash

    def test_rejects_path_escape(self, tmp_path):
        root = self._setup(tmp_path)
        try:
            sign_file(root, "../../../etc/passwd")
            assert False, "Should have raised"
        except ValueError as e:
            assert "escapes project root" in str(e).lower()

    def test_byte_length_for_non_ascii(self, tmp_path):
        root = self._setup(tmp_path)
        (tmp_path / "prompts" / "emoji.txt").write_text("Hello 🌍\n", encoding="utf-8")
        sig = sign_file(root, "prompts/emoji.txt")
        # '🌍' is 4 bytes in UTF-8, so "Hello 🌍\n" = 11 bytes
        assert sig.content_length == len("Hello 🌍\n".encode("utf-8"))
