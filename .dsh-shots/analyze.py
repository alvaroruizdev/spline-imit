from PIL import Image
import colorsys

for name in ["vidrio", "export-v2"]:
    im = Image.open(f".dsh-shots/{name}.png").convert("RGB")
    px = im.load()
    w, h = im.size
    vals, sats = [], []
    white = 0
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b = px[x, y]
            if abs(r - 236) + abs(g - 236) + abs(b - 236) > 8:
                lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
                sat = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[1]
                vals.append(lum)
                sats.append(sat)
                if r > 250 and g > 250 and b > 250:
                    white += 1
    print(
        name,
        "pixels", len(vals),
        "meanL", round(sum(vals) / len(vals), 4),
        "meanSat", round(sum(sats) / len(sats), 4),
        "nearWhite%", round(100 * white / len(vals), 1),
    )
