import numpy as np
from PIL import Image, ImageFilter

SIZE = 1024


def hexrgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64)


def mesh(blobs, base, size=SIZE, blur=110, grain=9.0, seed=1):
    r = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float64)
    yy /= size
    xx /= size
    acc = np.zeros((size, size, 3), dtype=np.float64)
    wsum = np.zeros((size, size), dtype=np.float64)
    for cx, cy, radius, color in blobs:
        d2 = (xx - cx) ** 2 + (yy - cy) ** 2
        w = np.exp(-d2 / (2.0 * radius * radius)) + 1e-6
        acc += w[..., None] * hexrgb(color)
        wsum += w
    acc += 0.04 * hexrgb(base)
    wsum += 0.04
    im = Image.fromarray(np.clip(acc / wsum[..., None], 0, 255).astype(np.uint8))
    im = im.filter(ImageFilter.GaussianBlur(blur))
    arr = np.asarray(im).astype(np.float64)
    arr = arr + r.normal(0.0, grain, (size, size, 1)) + r.normal(0.0, grain * 0.55, (size, size, 3))
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


PRESETS = {
    "gradient-hero": dict(
        base="#1b4535", blur=85, grain=8.0, seed=11,
        blobs=[
            (0.00, 0.22, 0.19, "#0d2b21"),
            (0.26, 0.00, 0.17, "#2f7a52"),
            (0.55, 0.02, 0.16, "#8fae55"),
            (0.86, 0.02, 0.17, "#e0b855"),
            (1.02, 0.30, 0.17, "#6f97bd"),
            (0.50, 0.34, 0.19, "#3f9068"),
            (0.10, 0.55, 0.19, "#0f3a2b"),
            (0.80, 0.55, 0.17, "#2a6f4e"),
            (0.22, 0.92, 0.19, "#e9e2cd"),
            (0.62, 0.88, 0.18, "#1d5b40"),
            (1.02, 0.95, 0.17, "#0d2b21"),
        ],
    ),
    "gradient-meadow": dict(
        base="#2a6a52", blur=85, grain=8.0, seed=23,
        blobs=[
            (0.00, 0.06, 0.18, "#14402f"),
            (0.34, 0.00, 0.17, "#3f8f67"),
            (0.70, 0.04, 0.16, "#9cb85e"),
            (1.00, 0.16, 0.17, "#e3c163"),
            (0.16, 0.44, 0.19, "#1d5b43"),
            (0.60, 0.48, 0.18, "#35866a"),
            (1.02, 0.62, 0.17, "#6f97bd"),
            (0.06, 0.96, 0.19, "#eee7d4"),
            (0.54, 0.98, 0.18, "#17503b"),
            (1.00, 1.00, 0.17, "#0f3a2b"),
        ],
    ),
    "gradient-sand": dict(
        base="#d8c9a6", blur=85, grain=7.5, seed=37,
        blobs=[
            (0.00, 0.08, 0.18, "#f2ecdb"),
            (0.36, 0.00, 0.17, "#e3c163"),
            (0.78, 0.02, 0.16, "#c9954a"),
            (1.02, 0.24, 0.17, "#a8743c"),
            (0.18, 0.44, 0.19, "#efe6cf"),
            (0.66, 0.50, 0.18, "#a9ac6a"),
            (1.02, 0.72, 0.17, "#5f8f6b"),
            (0.08, 0.94, 0.19, "#7fa07a"),
            (0.56, 0.98, 0.18, "#2f6a52"),
            (1.00, 1.00, 0.17, "#1d5b40"),
        ],
    ),
    "gradient-slate": dict(
        base="#26382f", blur=85, grain=8.5, seed=53,
        blobs=[
            (0.00, 0.10, 0.18, "#14241d"),
            (0.38, 0.00, 0.17, "#2f5a68"),
            (0.80, 0.04, 0.16, "#6f97bd"),
            (1.02, 0.30, 0.17, "#96b4cd"),
            (0.20, 0.46, 0.19, "#1d4436"),
            (0.64, 0.52, 0.18, "#2f7a5c"),
            (1.02, 0.78, 0.17, "#3f8f67"),
            (0.06, 0.92, 0.19, "#e0b855"),
            (0.50, 0.98, 0.18, "#17301f"),
            (1.00, 1.00, 0.17, "#14241d"),
        ],
    ),
    "gradient-ink": dict(
        base="#101b16", blur=90, grain=9.0, seed=71,
        blobs=[
            (0.00, 0.12, 0.19, "#080f0c"),
            (0.40, 0.00, 0.17, "#1d4436"),
            (0.84, 0.06, 0.17, "#2a6f4e"),
            (0.24, 0.48, 0.19, "#2f7a5c"),
            (0.72, 0.54, 0.18, "#122a20"),
            (1.02, 0.36, 0.17, "#0d2b21"),
            (0.10, 0.94, 0.19, "#080f0c"),
            (0.62, 0.98, 0.18, "#1a3a2e"),
            (1.00, 1.00, 0.17, "#080f0c"),
        ],
    ),
}

if __name__ == "__main__":
    for name, cfg in PRESETS.items():
        img = mesh(cfg["blobs"], cfg["base"], blur=cfg["blur"], grain=cfg["grain"], seed=cfg["seed"])
        img.save(f"public/{name}.webp", "WEBP", quality=88, method=6)
        print(name, img.size)
