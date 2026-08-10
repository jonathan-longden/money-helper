# Household Ledger

A small, private budget app: what's committed, what's left, what to set aside.

It started life as a Claude artifact. This repo is the standalone version — an
installable [PWA](https://web.dev/progressive-web-apps/) that lives on your home
screen, opens without browser chrome, and works with no signal.

## Installing it on a phone

1. Deploy it once (see below), then open the URL in the phone's browser.
2. **iPhone/iPad:** tap Share → *Add to Home Screen*.
   **Android:** tap the *Install* button the app shows, or Chrome's ⋮ → *Install app*.
3. Launch it from the home screen. After the first visit it runs offline.

## Deploying

The included workflow publishes to GitHub Pages on every push to `main`:

1. Push this repo to GitHub. The repo must be public unless the account has a
   paid plan — Pages doesn't serve private repos on GitHub Free.
2. Push to `main`. The app lands at `https://<user>.github.io/<repo>/`.

The workflow enables Pages and sets it to build from Actions on its own, so
there's no settings visit to remember.

Nothing about the app is host-specific, so any static host works — run
`npm run build` and upload `dist/`. If it's served from a subpath, set
`BASE_PATH` at build time (the workflow does this automatically):

```sh
BASE_PATH=/money-helper/ npm run build
```

## Your data

Everything is stored in this device's `localStorage`. There is no account, no
server, and nothing is transmitted anywhere — which also means:

- **The ledger does not sync between phones.** Install it on each device that
  needs it.
- **Clearing browser data deletes it.** Open *Edit income, expenses & debts →
  Backup* to save a JSON file, and *Restore* to load it on another device or
  after a reset. Restoring replaces the ledger on that device.

## Working on it

```sh
npm install
npm run dev        # local dev server
npm run build      # production build into dist/
npm run preview    # serve the built app (needed to exercise the service worker)
```

Two generators only need re-running when their inputs change:

```sh
npm run icons      # re-render app icons from scripts/icon.svg
npm run fonts      # re-download the self-hosted webfonts into src/fonts/
```

Fonts are self-hosted rather than pulled from Google Fonts so the installed app
keeps its typography offline; both the fonts and the icons are committed, so a
clean checkout builds without network access to either.

## Layout

| Path | What's in it |
| --- | --- |
| `src/App.jsx` | The ledger — budget maths, spending log, setup editor |
| `src/lib/storage.js` | `localStorage` persistence and backup export/import |
| `src/components/` | Install prompt, update toast, backup controls |
| `src/index.css` | Design system: the gold-on-green ledger styling |
| `vite.config.js` | Build config, PWA manifest and service worker |
| `scripts/` | Icon and font generators |
