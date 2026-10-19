# Rising Solutions Group website

Planning, development, real estate and due diligence for Florida commercial and land deals.

The home page behind the text is a full-screen technical drawing that draws itself as the visitor scrolls. One sample parcel goes through each stage:

| Chapter | What the drawing shows |
|---|---|
| Overview | A fine-line map of the area traces outward from the subject parcel |
| 01 Analyze | Boundary survey, then the constraint layers (zoning, setbacks, flood zone, wetlands, easement, protected trees, utilities) and the buildable area |
| 02 Design | Concept site plan with buildings, parking, dimensions, a site data table and an elevation |
| 03 Present | Red revision clouds for the questions taken to city or county staff |
| Who we serve → Contact | The view travels across the map and ends on the finished sheet with its title block |

Visitors can hover a layer, standard or question in the text, or point at the drawing itself, to highlight it. Switching a layer off recalculates the buildable acreage.

The parcel, plans and map are a generated sample for illustration, not a real property.

## Folder layout

```
site/                      ← THE WEBSITE. Publish this folder as-is.
  index.html               All words and page structure
  assets/js/site.js        The drawing engine and page behavior
  assets/images/           Logo (dark-background version), mark, favicon, original logo
.github/workflows/         GitHub Pages preview on every push to main
netlify.toml               Netlify settings (publish folder = site, no build step)
```

## See it on GitHub Pages

1. Push this repository to GitHub.
2. In the repository, open **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Every push to `main` then publishes the site at `https://<your-user>.github.io/<repo-name>/`.

The preview is hidden from search engines. GitHub Pages on a private repository needs a paid GitHub plan. On the free plan, the repository has to be public.

## Preview on your computer

```bash
python3 -m http.server 8080 --directory site    # then open http://localhost:8080
```

## Editing

- **Words, phone, address:** `site/index.html`. Each chapter is a `<section class="chapter">`.
- **Colors and fonts:** the `:root` block at the top of the `<style>` in `site/index.html`.
- **The drawing:**
  - `site/assets/js/site.js`.
  - The camera stop for each chapter is the `KF` list.
  - The parcel and its layers are in `G` near the top.

## Forms

The proposal request form and the book sign-up are set up for **Netlify Forms**: `data-netlify`, a hidden `form-name` and a spam-trap field.

- **On Netlify:** submissions arrive in **Site configuration → Forms**. Turn on email notifications there.
- **On GitHub Pages:** forms cannot be received. Visitors who try see a message asking them to call 407-739-5959.

## Publishing on Netlify (for launch)

1. In Netlify: **Add new site → Import an existing project →** pick this repository. The settings come from `netlify.toml`.
2. Add the domain under **Domain management**. HTTPS is automatic.
3. Once the domain is known, change `og:image` in `index.html` to the full address (`https://YOUR-DOMAIN/assets/images/logo.png`).

## Before launch

- Confirm how the contracting company (Continental Investments International Network LLC) should be named in the footer.
- Match the book wording to the counsel-approved text.
