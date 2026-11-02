# velowa examples

Small, runnable programs. Each one starts with a comment that says what it does and how to run it. They import
`velowa` like your own project would; run them from a checkout after `npm run build` (the package resolves to
`dist/`), or copy one into your project.

First run of any of them on a new machine links the account: a QR code appears in the terminal, scan it with
WhatsApp > _Linked devices_ > _Link a device_. The login is kept in `./auth` (keep that folder private), so the next
start connects straight away. Examples that print a QR use `qrcode-terminal` (`npm install qrcode-terminal`).

| Example                              | What it shows                                                                                                          |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| [`echo-bot.js`](echo-bot.js)         | the smallest bot: link, connect, answer every message. Start here.                                                     |
| [`cases-bot.js`](cases-bot.js)       | a bot written as one `switch` over the command: ping, say, polls, buttons, quotes, media download, admin checks        |
| [`plugin-bot/`](plugin-bot)          | a bot written as plugin files, one per command, reloaded while it runs when you edit one                               |
| [`notifier.js`](notifier.js)         | send one message (or picture) from a script, a cron job or CI, then exit                                               |
| [`channel-post.js`](channel-post.js) | publish to a channel: text with a label, a poll, a picture                                                             |
| [`group-admin.js`](group-admin.js)   | change a group's name, description and settings, remove / add / promote / demote a member, post a status; all reverted |
| [`calls.js`](calls.js)               | voice and video calls with an audio / video file, group calls, call links ("rooms")                                    |
| [`tour.js`](tour.js)                 | sends one of everything to your own chat and checks the account data: also a smoke test for your setup                 |

Configuration is by environment variable or argument, never by editing the code: `OWNERS=4915…,4916…` (phone numbers
that may use owner commands), `GROUP=…@g.us`, `MEMBER=4915…`, `CHANNEL=…@newsletter`, `VELOWA_LOG=1` (record the
protocol under `./logs` for debugging).

Two things to know before you point a bot at an account you care about: WhatsApp can restrict accounts that automate
messages (see "Reliability and safety" in the main README, and `new Client({ antiban: true })`), and `group-admin.js` and
`calls.js` act on real groups and people, so try them on a test group and your own numbers first.

The examples are meant to be copied, and copying them follows the velowa License: keep the one-line notice at the top of the
file, or add a comment such as `// Based on velowa (https://github.com/7ucg/velowa) by Baron - velowa License` next to
what you copy, and name velowa in the documentation of your project (see "License and credit" in the main README).
