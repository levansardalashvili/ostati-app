// Fetches a real, 6-digit signup-confirmation OTP from the local test
// proxy (~/otp-server.js, not part of this repo — never embeds secrets
// here). Requires output.otpEmail (the email just submitted on the
// registration form — callers alias their own email variable into this
// one right before invoking this script, since different flows use
// different local names: output.email / output.customerEmail /
// output.providerEmail / output.realEmail).
const email = output.otpEmail;
const password = output.otp_password || 'TestPass123';
const res = http.get(`http://127.0.0.1:7890/otp?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);
output.otp = res.body.trim();
