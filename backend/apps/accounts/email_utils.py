import re

_DISPOSABLE_DOMAINS = {
    "10minutemail.com",
    "10minutemail.net",
    "10minutemail.org",
    "burnermail.io",
    "dispostable.com",
    "emailondeck.com",
    "getnada.com",
    "grr.la",
    "guerrillamail.com",
    "guerrillamail.net",
    "guerrillamail.org",
    "guerrillamail.biz",
    "inboxkitten.com",
    "mail.tm",
    "maildrop.cc",
    "maileater.com",
    "mailexpire.com",
    "mailforspam.com",
    "mailin8r.com",
    "mailkert.com",
    "mailmaid.com",
    "mailmetrash.com",
    "mailnator.com",
    "mailnull.com",
    "mailinator.com",
    "moakt.com",
    "mohmal.com",
    "mt2009.com",
    "mytemp.email",
    "pokemail.net",
    "sharklasers.com",
    "sneakemail.com",
    "sofort-mail.de",
    "spam.care",
    "spam.la",
    "spam.su",
    "spambox.info",
    "spambox.us",
    "spamcowboy.com",
    "spamcowboy.net",
    "spamcowboy.org",
    "spamday.com",
    "spamdecoy.net",
    "spamfree24.org",
    "spamgourmet.com",
    "temp-mail.org",
    "temp-mail.ru",
    "tempinbox.com",
    "tempmail.com",
    "tempmail.net",
    "tempmail.ninja",
    "temporarymail.com",
    "temporarymail.org",
    "thankyou2010.com",
    "throwaway.email",
    "trash2009.com",
    "trashmail.com",
    "trashmail.net",
    "trashymail.com",
    "tyldd.com",
    "uggsrock.com",
    "wegwerfmail.de",
    "wegwerfmail.net",
    "wegwerfmail.org",
    "wh4f.org",
    "whyspam.me",
    "willselfdestruct.com",
    "winemaven.info",
    "wronghead.com",
    "wuzup.net",
    "xagloo.com",
    "xemaps.com",
    "xents.com",
    "xmaily.com",
    "xoxy.net",
    "yep.it",
    "yogamaven.com",
    "yopmail.com",
    "yopmail.fr",
    "yopmail.net",
    "ypmail.webarnak.fr.eu.org",
    "yuurok.com",
    "zehnminutenmail.de",
    "zippymail.info",
    "zoaxe.com",
    "zoemail.org",
}

_GMAIL_RE = re.compile(r"^([^@]+)@(gmail\.com|googlemail\.com)$", re.I)


def normalize_email(email: str) -> str:
    email = email.strip().lower()
    match = _GMAIL_RE.match(email)
    if match:
        local = match.group(1)
        plus_idx = local.find("+")
        if plus_idx != -1:
            local = local[:plus_idx]
        local = local.replace(".", "")
        return f"{local}@gmail.com"
    return email


def is_disposable_email(email: str) -> bool:
    domain = email.rsplit("@", 1)[-1].lower()
    return domain in _DISPOSABLE_DOMAINS
