from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string


def send_html_email(subject, html_template, text_body, recipient_list, context=None):
    """Send an email with both HTML and plain-text alternatives."""
    html = render_to_string(html_template, context or {})
    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=recipient_list if isinstance(recipient_list, list) else [recipient_list],
    )
    msg.attach_alternative(html, "text/html")
    msg.send()
