# Nada Abu Taleb — portfolio

The site loads in darkness. The visitor's cursor is a flickering candle (on phones, a steady lantern
in the middle of the screen), and the art only appears where the light falls. Eyes glow in the empty
corners and flee from the light. The light switch in the nav restores the power for regular browsing.

**Nada edits the site at [app.pagescms.org](https://app.pagescms.org).** She doesn't need code. See
[EDITING.md](EDITING.md).

## How it fits together

```
content/site.yml          all the words on the site (and the photos of Nada)
content/rooms/*.yml       the artworks in each room, in order, with optional title/year/medium
media/                    original uploads, any size, straight from a phone or scanner
src/                      the page template, styles and script
build.mjs                 content + media -> dist/ (resizes images to webp, fills the template)
.pages.yml                the editing dashboard's forms
.github/workflows/        builds and deploys to GitHub Pages on every push
```

Every save in Pages CMS is a commit to `main`. The workflow builds and publishes it in about a minute.
Resized images are cached between runs, so only new uploads get processed.

## One-time setup

1. **Create the repo.** Push this folder to a new GitHub repo, for example `nada-portfolio`, on the `main` branch.
2. **Turn on Pages.** In the repo, go to **Settings → Pages → Build and deployment**, set the source to **GitHub Actions**,
   then push or run the "Deploy site" workflow once.
3. **Custom domain.** In **Settings → Pages → Custom domain**, enter the domain and tick **Enforce HTTPS**
   once it's available. At the domain registrar:
   - `www` gets a `CNAME` record pointing to `<your-github-username>.github.io`
   - the root domain (`@`) gets four `A` records:
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
4. **Give Nada access.** She makes a free GitHub account. You add her under **Settings → Collaborators**.
   She then signs in at [app.pagescms.org](https://app.pagescms.org) with GitHub and picks the repo.
   (If Pages CMS asks to install its GitHub app on the repo, allow it.)

Hosting costs nothing beyond the domain.

## Working on it locally

```sh
npm install
npm start        # builds into dist/ and serves it at http://localhost:8000
```

To change the design, edit `src/`. To change wording or artworks, edit `content/`, or let Nada do it in
the dashboard. The four rooms each have their own hand-made layout, so adding a fifth room means
editing `ROOMS` in `build.mjs`, the CSS for its layout, and `.pages.yml`.
