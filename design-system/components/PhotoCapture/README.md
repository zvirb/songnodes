# PhotoCapture

Adds one image (a crate photo of a record sleeve, artwork for a set) by taking a photo or choosing a file, then shows a square preview with Retake, Remove photo and a field to describe the image.

## When to use / not use
Use when an image belongs to one record or set. For importing data files use FileDrop. Don't ask for a photo when a link to the release (Discogs, Beatport) would do.

## Anatomy & markup
```html
<div class="sn-photo-capture">
  <div class="sn-photo-capture__body">
    <div class="sn-photo-capture__frame" data-filled><img alt="" src="blob:…"></div>
    <div class="sn-photo-capture__side">
      <div class="sn-photo-capture__actions">
        <input type="file" accept="image/*" capture="environment" class="sn-sr sn-photo-capture__input" tabindex="-1" aria-hidden="true">
        <button class="sn-btn" type="button">camera icon Take photo</button>
        <input type="file" accept="image/jpeg,image/png,image/webp" class="sn-sr sn-photo-capture__input" tabindex="-1" aria-hidden="true">
        <button class="sn-btn" type="button">upload icon Choose image</button>
      </div>
      <p class="sn-photo-capture__meta">JPEG, PNG or WebP, up to 10 MB.</p>
      <div class="sn-field sn-text-field"> "Describe the photo" textarea </div>
    </div>
  </div>
</div>
```
The buttons call `click()` on the hidden inputs. `capture="environment"` opens the rear camera on phones; desktops ignore it and show the file picker, so hide "Take photo" there if you can detect no camera (`navigator.mediaDevices`), or keep both.

## States
Empty (dashed frame with image icon, both buttons), filled (thumbnail, file name · size · time, Retake, Remove photo, alt-text field), error (wrong type or too large: `sn-field__error` under the buttons, GOV.UK wording).

## Content rules
Buttons: "Take photo", "Choose image", "Retake", "Remove photo". Alt text label "Describe the photo", help: "What someone needs to know if they can’t see it: artist, title, label, any writing." Example: "Front sleeve of Overmono, So U Kno, on XL Recordings. Plain white label with a blue stamp."

## Accessibility
The preview `<img>` has empty `alt` because the description field sits next to it; the saved image uses the description as its `alt`. After a photo is added focus moves to the description; after removal, back to Take photo. Changes are announced politely.

## Responsive
Phones: the frame grows to the full width (max 280px) above the actions. Desktop: 160px square beside them.

## Do / don't
- Do strip location data (EXIF GPS) before upload.
- Don't block saving when the description is empty; prompt for it.

## In SongNodes / in the music library
New: no image capture exists yet. Intended for crate photos on the mobile track explorer and artwork for saved sets.
