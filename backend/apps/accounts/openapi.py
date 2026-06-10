"""drf-spectacular extension for cookie-based JWT authentication.

Registers ``CookieJWTAuthentication`` so the schema generator can resolve
security requirements without warnings. The security scheme itself is declared
in ``SPECTACULAR_SETTINGS["APPEND_COMPONENTS"]``; this extension just maps the
authenticator class to it.
"""

from drf_spectacular.extensions import OpenApiAuthenticationExtension


class CookieJWTAuthenticationExtension(OpenApiAuthenticationExtension):
    target_class = "apps.accounts.authentication.CookieJWTAuthentication"
    name = "cookieAuth"

    def get_security_requirement(self, auto_schema):
        return [{"cookieAuth": []}]

    def get_security_definition(self, auto_schema):
        # Declared globally in SPECTACULAR_SETTINGS; return None to skip duplication.
        return None
