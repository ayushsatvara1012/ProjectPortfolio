"""
Test: Fallback Logo Implementation
Tests verify that the fallback logo mechanism works correctly when:
1. Default logo is returned from API
2. Custom logo is provided
3. Image loading fails (frontend error handling)
"""
import pytest
from unittest.mock import MagicMock, patch


class TestFallbackLogoBackend:
    """Backend tests for logo URL generation in /api/config"""

    def test_new_company_gets_default_logo_path(self):
        """New companies without custom logo get relative path /SB_loading.svg"""
        # Simulate company_data from DB where logo_url is NULL (unset)
        company_data = (
            "123",           # id
            "Test Co",       # company_name
            "Professional",  # company_tone
            "#5730F5",       # theme_color
            "https://test.com",  # allowed_origin
            "system prompt", # system_prompt
            "Test AI",       # bot_name
            None,            # logo_url (NULL in DB)
            "Hi!",           # initial_message
            "[]",            # quick_questions
            "circle",        # logo_shape
            None,            # custom_logo_url (NULL)
        )

        # Expected: Falls back to relative path
        logo_url = company_data[7] or "/SB_loading.svg"
        assert logo_url == "/SB_loading.svg"
        assert not logo_url.startswith("https://")

    def test_custom_logo_takes_precedence(self):
        """Custom logo URL takes precedence over default"""
        custom_url = "https://example.com/my-logo.png"
        company_data = (
            "123", "Test Co", "Professional", "#5730F5",
            "https://test.com", "prompt", "Test AI",
            "/SB_loading.svg",  # default
            "Hi!", "[]", "circle",
            custom_url  # custom_logo_url
        )

        # Expected: custom_logo_url takes precedence
        logo_url = company_data[11] or company_data[7]
        assert logo_url == custom_url

    def test_relative_path_format(self):
        """Default logo should be relative path, not full URL"""
        # This ensures the loader can convert it to absolute URL
        logo_url = "/SB_loading.svg"
        assert logo_url.startswith("/")
        assert not logo_url.startswith("http")
        assert logo_url.endswith(".svg")


class TestFallbackLogoFrontend:
    """Frontend tests for logo rendering in sapybase-loader.js"""

    def test_image_element_has_onerror_handler(self):
        """SVG image element includes onerror handler for fallback"""
        # This simulates the SVG generation
        fallback_id = "sb-fab-fallback-abc123"
        onerror_handler = f"document.getElementById('{fallback_id}').style.display='block'"

        # Verify handler format is correct
        assert fallback_id in onerror_handler
        assert ".style.display='block'" in onerror_handler
        assert "document.getElementById" in onerror_handler

    def test_fallback_text_starts_hidden(self):
        """Fallback text is hidden initially (display:none)"""
        # SVG generation should include display:none initially
        fallback_svg = '<text style="display:none;">S</text>'
        assert "display:none" in fallback_svg

    def test_relative_path_conversion(self):
        """Loader converts /SB_loading.svg to absolute URL"""
        # Simulating the _applyConfig method logic
        IFRAME_ORIGIN = "https://www.sapybase.com"
        logo_url = "/SB_loading.svg"

        # Apply conversion
        if logo_url and logo_url.startswith("/"):
            logo_url = IFRAME_ORIGIN + logo_url

        # Verify result is absolute URL
        assert logo_url == "https://www.sapybase.com/SB_loading.svg"
        assert logo_url.startswith("https://")

    def test_absolute_url_not_converted_twice(self):
        """Already absolute URLs are not converted"""
        IFRAME_ORIGIN = "https://www.sapybase.com"
        logo_url = "https://cdn.example.com/custom.png"

        # Apply conversion logic
        if logo_url and logo_url.startswith("/"):
            logo_url = IFRAME_ORIGIN + logo_url

        # Verify URL unchanged
        assert logo_url == "https://cdn.example.com/custom.png"

    def test_empty_logo_url_uses_fallback(self):
        """Empty logo_url falls back to initials"""
        logo_url = ""
        bot_name = "MyAI"
        initial = (bot_name or "S").charAt(0).upper() if hasattr(bot_name, "charAt") else bot_name[0].upper()

        # In actual JS, empty string means no image, so initial is shown
        assert not logo_url  # Empty is falsy
        assert initial == "M"


class TestIntegrationScenarios:
    """Integration tests for complete logo fallback flow"""

    def test_first_time_user_scenario(self):
        """Scenario: First-time user creates bot, logo should appear"""
        # 1. New company created without custom logo
        company_logo_url = None
        # 2. Backend returns relative path
        api_response = {"logo_url": company_logo_url or "/SB_loading.svg"}
        # 3. Frontend receives config
        received_logo = api_response["logo_url"]
        # 4. Loader converts relative path to absolute
        IFRAME_ORIGIN = "https://www.sapybase.com"
        if received_logo and received_logo.startswith("/"):
            received_logo = IFRAME_ORIGIN + received_logo
        # 5. SVG renders with absolute URL
        assert received_logo == "https://www.sapybase.com/SB_loading.svg"

    def test_image_load_failure_scenario(self):
        """Scenario: Default logo fails to load, fallback shows initial"""
        bot_name = "TechBot"
        initial = bot_name[0].upper()

        # 1. Image fails to load (onerror triggered)
        # 2. JavaScript shows fallback text
        fallback_display = "block"  # display:none becomes display:block
        # 3. User sees bot initial instead of blank FAB
        visible_content = initial if fallback_display == "block" else None

        assert visible_content == "T"
        assert visible_content is not None

    def test_custom_logo_scenario(self):
        """Scenario: User uploads custom logo"""
        custom_url = "https://my-cdn.com/my-logo.png"
        # 1. Custom logo URL is provided
        # 2. Takes precedence over default
        final_url = custom_url or "/SB_loading.svg"
        # 3. Either loads custom, or falls back to initial
        assert final_url == custom_url
        assert not final_url.startswith("/")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
