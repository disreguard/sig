import re

from sig.core.config import init_project, sig_dir
from sig.core.sign import sign_file
from sig.core.verify import verify_file, check_file, check_all_signed


class TestVerifyFile:
    def _setup(self, tmp_path):
        init_project(str(tmp_path), engine="jinja")
        prompts = tmp_path / "prompts"
        prompts.mkdir(exist_ok=True)
        (prompts / "test.txt").write_text(
            "Review {{ code }} for issues.\n", encoding="utf-8"
        )
        return str(tmp_path)

    def test_verifies_unmodified_signed_file(self, tmp_path):
        root = self._setup(tmp_path)
        sign_file(root, "prompts/test.txt")
        result = verify_file(root, "prompts/test.txt")

        assert result.verified is True
        assert result.template == "Review {{ code }} for issues.\n"
        assert result.signed_by
        assert result.error is None

    def test_returns_stored_content(self, tmp_path):
        root = self._setup(tmp_path)
        sign_file(root, "prompts/test.txt")
        result = verify_file(root, "prompts/test.txt")

        assert result.verified is True
        assert result.template == "Review {{ code }} for issues.\n"

    def test_extracts_placeholders(self, tmp_path):
        root = self._setup(tmp_path)
        sign_file(root, "prompts/test.txt")
        result = verify_file(root, "prompts/test.txt")

        assert "{{ code }}" in result.placeholders

    def test_fails_for_modified_file(self, tmp_path):
        root = self._setup(tmp_path)
        sign_file(root, "prompts/test.txt")
        with open(tmp_path / "prompts" / "test.txt", "a", encoding="utf-8") as f:
            f.write("INJECTED\n")

        result = verify_file(root, "prompts/test.txt")
        assert result.verified is False
        assert result.template is None
        assert re.search(r"modified", result.error, re.IGNORECASE)

    def test_fails_for_unsigned_file(self, tmp_path):
        root = self._setup(tmp_path)
        result = verify_file(root, "prompts/test.txt")

        assert result.verified is False
        assert re.search(r"no signature", result.error, re.IGNORECASE)

    def test_fails_for_missing_file(self, tmp_path):
        root = self._setup(tmp_path)
        sign_file(root, "prompts/test.txt")
        (tmp_path / "prompts" / "test.txt").unlink()

        result = verify_file(root, "prompts/test.txt")
        assert result.verified is False
        assert re.search(r"not found", result.error, re.IGNORECASE)

    def test_detects_corrupted_signature(self, tmp_path):
        root = self._setup(tmp_path)
        sign_file(root, "prompts/test.txt")

        sig_path = (
            tmp_path / ".sig" / "sigs" / "prompts" / "test.txt.sig.json"
        )
        sig_path.write_text("CORRUPTED{{{not json", encoding="utf-8")

        result = verify_file(root, "prompts/test.txt")
        assert result.verified is False
        assert re.search(r"corrupted|tampered", result.error, re.IGNORECASE)

    def test_rejects_path_escape(self, tmp_path):
        root = self._setup(tmp_path)
        try:
            verify_file(root, "../../../etc/passwd")
            assert False, "Should have raised"
        except ValueError as e:
            assert "escapes project root" in str(e).lower()


class TestCheckFile:
    def _setup(self, tmp_path):
        init_project(str(tmp_path))
        prompts = tmp_path / "prompts"
        prompts.mkdir(exist_ok=True)
        (prompts / "a.txt").write_text("content a", encoding="utf-8")
        (prompts / "b.txt").write_text("content b", encoding="utf-8")
        return str(tmp_path)

    def test_unsigned(self, tmp_path):
        root = self._setup(tmp_path)
        result = check_file(root, "prompts/a.txt")
        assert result.status == "unsigned"

    def test_signed(self, tmp_path):
        root = self._setup(tmp_path)
        sign_file(root, "prompts/a.txt")
        result = check_file(root, "prompts/a.txt")
        assert result.status == "signed"
        assert result.signature is not None

    def test_modified(self, tmp_path):
        root = self._setup(tmp_path)
        sign_file(root, "prompts/a.txt")
        (tmp_path / "prompts" / "a.txt").write_text("changed", encoding="utf-8")
        result = check_file(root, "prompts/a.txt")
        assert result.status == "modified"

    def test_corrupted(self, tmp_path):
        root = self._setup(tmp_path)
        sign_file(root, "prompts/a.txt")
        sig_path = tmp_path / ".sig" / "sigs" / "prompts" / "a.txt.sig.json"
        sig_path.write_text("!!!NOT JSON!!!", encoding="utf-8")
        result = check_file(root, "prompts/a.txt")
        assert result.status == "corrupted"


class TestCheckAllSigned:
    def _setup(self, tmp_path):
        init_project(str(tmp_path))
        prompts = tmp_path / "prompts"
        prompts.mkdir(exist_ok=True)
        (prompts / "a.txt").write_text("content a", encoding="utf-8")
        (prompts / "b.txt").write_text("content b", encoding="utf-8")
        return str(tmp_path)

    def test_all_signed(self, tmp_path):
        root = self._setup(tmp_path)
        sign_file(root, "prompts/a.txt")
        sign_file(root, "prompts/b.txt")

        results = check_all_signed(root)
        assert len(results) == 2
        assert all(r.status == "signed" for r in results)

    def test_mix_signed_and_modified(self, tmp_path):
        root = self._setup(tmp_path)
        sign_file(root, "prompts/a.txt")
        sign_file(root, "prompts/b.txt")
        (tmp_path / "prompts" / "b.txt").write_text("changed", encoding="utf-8")

        results = check_all_signed(root)
        statuses = sorted(r.status for r in results)
        assert statuses == ["modified", "signed"]
