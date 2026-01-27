import pytest
from sig.core.config import init_project


@pytest.fixture
def project(tmp_path):
    """Initialize a sig project in a temp directory."""
    init_project(str(tmp_path))
    prompts = tmp_path / "prompts"
    prompts.mkdir()
    return tmp_path
