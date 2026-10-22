# draxhtar

Retro / pixel art / ortaçağ temalı portfolyo sitesi. Saf HTML + CSS + JS — build adımı, framework veya görsel dosyası yok. Bütün pixel art (`js/sprites.js`) ve sesler (`js/audio.js`) kodla üretiliyor.

## Çalıştırma

```bash
python3 -m http.server 8000
# → http://localhost:8000
# Giriş kapısını atlamak için: http://localhost:8000/?nogate
```

GitHub Pages'e direkt atılabilir (Settings → Pages → `main` / root).

## Neler var

- **Giriş kapısı** — "PRESS START", ahşap kapılar açılır, ekran sarsılır, fanfar çalar
- **Canlı hero sahnesi** — düşük çözünürlükte çizilip büyütülen canvas: dithering'li gün batımı gökyüzü, ay, parallax dağlar, penceresi titreyen ve bayrakları dalgalanan kale, yarasalar, kıvılcımlar, kayan yıldızlar, ateş püskürten ejderha. **Gökyüzüne tıkla → yıldırım.**
- **Harfler** — başlıktaki harflere dokun, Mario gibi zıplayıp coin fırlatırlar
- **HUD** — scroll = XP barı, her yeni bölüm = LEVEL UP
- **13 achievement** — toast bildirimleri, ★ butonundan liste
- **Skill tree**, **quest log** (nadirlik çerçeveleri, 3D tilt, parlama, lore diyalogları), **parşömen** açılma animasyonu
- **Send a raven** — mektup mühürlenir, kuzgun gelip alıp götürür, sonra `mailto:` açılır
- **Chiptune** — SFX ve döngüde çalan D minör ortaçağ müziği (BGM butonu)
- **CRT** scanline efekti (açılıp kapanabilir)
- Kılıç cursor + kıvılcım izi
- Gizli: ↑ ↑ ↓ ↓ ← → ← → B A
- `prefers-reduced-motion` desteği

## Kişiselleştirme

| Ne | Nerede |
| --- | --- |
| E-posta, hero'daki roller | `js/main.js` → `CONFIG` |
| Hakkımda, istatistikler, skill'ler, projeler, sosyal linkler | `index.html` |
| Skill seviyesi / ikonu | `.skill` üzerindeki `data-lv` ve `data-icon` |
| Proje nadirliği | `.quest` sınıfı: `common` / `rare` / `epic` / `legendary` |
| Pixel art | `js/sprites.js` — her karakter bir piksel, `.` şeffaf |
| Renkler | `css/style.css` → `:root` |
