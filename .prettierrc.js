export default {
  tabWidth: 2,
  semi: false,
  singleQuote: true,
  trailingComma: 'none',
  // Preserve each file's existing line ending instead of forcing LF.
  // Without this, a Windows checkout with core.autocrlf=true (converting
  // every file to CRLF on checkout) fails `prettier --check .` repo-wide,
  // unrelated to any actual code content — same fix already applied in
  // epr-register-enrol-frontend's .prettierrc.js for the identical cause.
  endOfLine: 'auto'
}
