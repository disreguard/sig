from __future__ import annotations

from sig.core.audit import read_audit_log
from sig.core.config import init_project, save_config
from sig.core.fs import create_sig_context
from sig.core.persistent_content import PersistentContentStore
from sig.types import PersistentSignOptions, SigConfig, SignConfig


class TestPersistentContentStore:
    def _setup(self, tmp_path):
        init_project(str(tmp_path))
        return PersistentContentStore(create_sig_context(str(tmp_path)))

    def test_signs_and_verifies_stored_content(self, tmp_path):
        store = self._setup(tmp_path)
        signature = store.sign(
            "Review @input",
            options=PersistentSignOptions(
                id="auditPrompt",
                identity="security-team",
            ),
        )

        assert signature.id == "auditPrompt"
        assert signature.signed_by == "security-team"
        assert signature.hash.startswith("sha256:")

        result = store.verify("auditPrompt")
        assert result.verified is True
        assert result.content == "Review @input"
        assert result.signature is not None
        assert result.signature.hash == signature.hash

    def test_reuses_signatures_when_content_is_unchanged(self, tmp_path):
        store = self._setup(tmp_path)
        first = store.sign_if_changed(
            "same content",
            options=PersistentSignOptions(
                id="prompt",
                identity="alice",
            ),
        )

        second = store.sign_if_changed(
            "same content",
            options=PersistentSignOptions(
                id="prompt",
                identity="bob",
            ),
        )

        assert second.hash == first.hash
        assert second.signed_at == first.signed_at
        assert second.signed_by == first.signed_by

        third = store.sign_if_changed(
            "new content",
            options=PersistentSignOptions(
                id="prompt",
                identity="bob",
            ),
        )
        assert third.hash != first.hash
        assert store.load_content("prompt") == "new content"

    def test_fails_verification_when_provided_content_does_not_match(self, tmp_path):
        store = self._setup(tmp_path)
        store.sign(
            "trusted content",
            options=PersistentSignOptions(id="message1", identity="alice"),
        )

        result = store.verify("message1", content="tampered content")
        assert result.verified is False
        assert result.error is not None
        assert "mismatch" in result.error.lower()

    def test_fails_verification_when_no_signature_exists(self, tmp_path):
        store = self._setup(tmp_path)
        result = store.verify("missing-message")
        assert result.verified is False
        assert result.error is not None
        assert "no signature" in result.error.lower()

    def test_rejects_invalid_ids(self, tmp_path):
        store = self._setup(tmp_path)
        invalid_ids = ["../msg", "a/b", r"a\b", "..", "bad\0id", ""]

        for id in invalid_ids:
            try:
                store.sign("x", options=PersistentSignOptions(id=id, identity="alice"))
                assert False, "Expected sign() to reject invalid id"
            except ValueError as error:
                assert "invalid" in str(error).lower() or "empty" in str(error).lower()

            try:
                store.verify(id)
                assert False, "Expected verify() to reject invalid id"
            except ValueError as error:
                assert "invalid" in str(error).lower() or "empty" in str(error).lower()

    def test_resolves_identity_via_option_config_env_and_unknown_fallback(self, tmp_path, monkeypatch):
        init_project(str(tmp_path))
        store = PersistentContentStore(create_sig_context(str(tmp_path)))

        monkeypatch.setenv("USER", "env-user")
        monkeypatch.setenv("USERNAME", "env-username")

        explicit = store.sign(
            "explicit",
            options=PersistentSignOptions(
                id="id-explicit",
                identity="explicit-user",
            ),
        )
        assert explicit.signed_by == "explicit-user"

        save_config(
            str(tmp_path),
            SigConfig(version=1, sign=SignConfig(identity="config-user")),
        )
        from_config = store.sign(
            "config",
            options=PersistentSignOptions(id="id-config"),
        )
        assert from_config.signed_by == "config-user"

        save_config(str(tmp_path), SigConfig(version=1))
        from_env = store.sign(
            "env",
            options=PersistentSignOptions(id="id-env"),
        )
        assert from_env.signed_by == "env-user"

        monkeypatch.setenv("USER", "")
        monkeypatch.setenv("USERNAME", "")
        unknown = store.sign(
            "unknown",
            options=PersistentSignOptions(id="id-unknown"),
        )
        assert unknown.signed_by == "unknown"

    def test_records_caller_detail_on_verify_audit_events(self, tmp_path):
        store = self._setup(tmp_path)
        ctx = create_sig_context(str(tmp_path))

        store.sign(
            "signed value",
            options=PersistentSignOptions(id="audit-msg", identity="alice"),
        )
        store.verify("audit-msg", detail="directive:verify")

        entries = read_audit_log(ctx, "content:audit-msg")
        verify_entry = next((entry for entry in entries if entry.event == "verify"), None)
        assert verify_entry is not None
        assert verify_entry.detail == "directive:verify"
