# CSPC 2026 Speaker Graphic Generator

A static, browser-based generator for CSPC 2026 speaker social graphics. Speakers can choose an English, French or bilingual template, upload a headshot, reposition/zoom it, add their name/title/organization, and download a 1080 × 1350 PNG.

## GitHub Pages setup

1. Create a new public GitHub repository, for example `cspc-speaker-generator`.
2. Upload **all contents of this folder**, preserving the `assets` folder.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/(root)` folder, then save.
6. GitHub will provide a public URL such as `https://YOURUSERNAME.github.io/cspc-speaker-generator/`.

## Files

- `index.html` — interface
- `style.css` — page styling
- `script.js` — template selection, photo crop, text rendering and PNG download
- `assets/English.png`
- `assets/French.png`
- `assets/Bilingual.png`

## Privacy

The generator is entirely client-side. Uploaded headshots are read in the visitor's browser and are not sent to a server by this code.

## Easy customizations

In `script.js`:

- `PHOTO_CIRCLE` controls the headshot circle position and radius.
- `TEXT_BOX` controls where the speaker's name/title/organization appear.
- `templates` controls the template filenames.

No framework, package manager, build process or backend is required.
