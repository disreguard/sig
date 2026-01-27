from sig.templates.engines import extract_placeholders, get_engine_names


class TestExtractPlaceholders:
    def test_jinja(self):
        content = "Hello {{ name }}, {% if admin %}welcome{% endif %} {# comment #}"
        found = extract_placeholders(content, "jinja")
        assert "{{ name }}" in found
        assert "{% if admin %}" in found
        assert "{# comment #}" in found

    def test_mustache(self):
        content = "Hello {{name}}, {{{raw}}}, {{#section}}content{{/section}}"
        found = extract_placeholders(content, "mustache")
        assert "{{name}}" in found
        assert "{{{raw}}}" in found

    def test_js_template(self):
        content = "Hello ${name}, value is ${obj.prop}"
        found = extract_placeholders(content, "js-template")
        assert "${name}" in found
        assert "${obj.prop}" in found

    def test_bash(self):
        content = "Deploy $VERSION to ${ENVIRONMENT}"
        found = extract_placeholders(content, "bash")
        assert "$VERSION" in found
        assert "${ENVIRONMENT}" in found

    def test_mlld(self):
        content = "Analyze @input and check <config.json>"
        found = extract_placeholders(content, "mlld")
        assert "@input" in found
        assert "<config.json>" in found

    def test_erb(self):
        content = "Hello <%= name %>, <% if admin %>"
        found = extract_placeholders(content, "erb")
        assert "<%= name %>" in found
        assert "<% if admin %>" in found

    def test_multiple_engines(self):
        content = "Hello {{ name }} and ${value}"
        found = extract_placeholders(content, ["jinja", "js-template"])
        assert "{{ name }}" in found
        assert "${value}" in found

    def test_custom_patterns(self):
        content = "Hello %%name%% and %%other%%"
        found = extract_placeholders(content, None, [
            {"name": "custom", "patterns": [r"%%\w+%%"]},
        ])
        assert "%%name%%" in found
        assert "%%other%%" in found

    def test_no_engine(self):
        found = extract_placeholders("hello world")
        assert len(found) == 0


class TestGetEngineNames:
    def test_returns_all_names(self):
        names = get_engine_names()
        assert "jinja" in names
        assert "mustache" in names
        assert "mlld" in names
        assert "bash" in names
        assert len(names) > 8
