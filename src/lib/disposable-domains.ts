const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "10minutemail.net",
  "disposablemail.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "mailinator.com",
  "sharklasers.com",
  "temp-mail.org",
  "tempmail.com",
  "throwawaymail.com",
  "yopmail.com",
]);

export function getEmailDomain(email: string) {
  const domain = email.trim().toLowerCase().split("@").pop() ?? "";
  return domain;
}

export function isDisposableEmail(email: string) {
  const domain = getEmailDomain(email);
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}
