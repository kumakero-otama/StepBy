const assert = require("assert");
const fs = require("fs");
const path = require("path");

for (const name of ["login.html", "login_en.html", "login_hi.html"]) {
  const html = fs.readFileSync(path.join(__dirname, `../UI0/auth/${name}`), "utf8");
  assert.match(html, /id="google-signin-button"/);
  assert.match(html, /id="guest-login-button"/);
  assert.match(html, /data-document="terms"/);
  assert.match(html, /data-document="privacy"/);
  assert.match(html, /id="user-agreement-modal"/);
  assert.match(html, /ui0-login-scroll-20260817/);
}
const css = fs.readFileSync(path.join(__dirname, "../UI0/auth/auth.css"), "utf8");
assert.match(css, /body\.login-page[\s\S]*overflow-y:\s*auto/);
assert.match(css, /\.login-shell[\s\S]*overflow:\s*visible/);
assert.match(css, /@media \(max-height: 580px\)/);
console.log("login actions remain reachable on short browser and PWA viewports");
