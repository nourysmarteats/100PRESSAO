from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1200, 630
GRAFITE   = (22, 24, 29)
CREME     = (246, 241, 231)
CREME_DIM = (185, 176, 160)
AMBAR     = (224, 154, 62)
COBRE     = (164, 95, 45)

DISPLAY = "/usr/share/fonts/truetype/liberation/LiberationSansNarrow-Bold.ttf"
BODY    = "/usr/share/fonts/truetype/lato/Lato-Regular.ttf"
BODY_B  = "/usr/share/fonts/truetype/lato/Lato-Semibold.ttf"

img = Image.new("RGB", (W, H), GRAFITE)

# brilho âmbar difuso por trás do carimbo
glow = Image.new("RGB", (W, H), GRAFITE)
gd = ImageDraw.Draw(glow)
gd.ellipse([20, 35, 580, 595], fill=(74, 51, 23))
glow = glow.filter(ImageFilter.GaussianBlur(110))
img = Image.blend(img, glow, 0.85)
d = ImageDraw.Draw(img)

# ---- carimbo, recortado em círculo ----
logo = Image.open("../src/assets/logo-100pressao.png").convert("RGB")
s = min(logo.size)
logo = logo.crop(((logo.width-s)//2, (logo.height-s)//2,
                  (logo.width+s)//2, (logo.height+s)//2))
D = 400
logo = logo.resize((D, D), Image.LANCZOS)
mask = Image.new("L", (D*4, D*4), 0)
ImageDraw.Draw(mask).ellipse([0, 0, D*4, D*4], fill=255)
mask = mask.resize((D, D), Image.LANCZOS)
CX, CY = 300, H//2
img.paste(logo, (CX - D//2, CY - D//2), mask)
# anel de contorno
d.ellipse([CX-D//2-7, CY-D//2-7, CX+D//2+7, CY+D//2+7], outline=(58, 63, 72), width=3)

# ---- texto ----
def tracked(draw, xy, text, font, fill, track=0):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + track
    return x

X = 610
f_eyebrow = ImageFont.truetype(BODY_B, 22)
LINHAS = ["A PRESSÃO CERTA,", "NO COPO CERTO."]
MAX_W = W - X - 58
tam = 78
while tam > 40:
    f = ImageFont.truetype(DISPLAY, tam)
    if max(d.textlength(l, font=f) for l in LINHAS) <= MAX_W:
        break
    tam -= 1
f_head    = ImageFont.truetype(DISPLAY, tam)
f_sub     = ImageFont.truetype(BODY, 27)
f_foot    = ImageFont.truetype(BODY_B, 23)

tracked(d, (X, 132), "CERVEJARIA ARTESANAL", f_eyebrow, AMBAR, track=3.2)

d.text((X, 178), LINHAS[0], font=f_head, fill=CREME)
d.text((X, 178 + int(tam * 1.08)), LINHAS[1], font=f_head, fill=CREME)

d.line([X, 372, X + 96, 372], fill=COBRE, width=4)

d.text((X, 402), "Pequeno-almoço  ·  Petiscos", font=f_sub, fill=CREME_DIM)
d.text((X, 440), "Almoço PF  ·  Cerveja artesanal", font=f_sub, fill=CREME_DIM)

tracked(d, (X, 500), "MERCADO MUNICIPAL DE CARNAXIDE", f_foot, CREME, track=1.6)

img.save("../public/og-100pressao.png",
         "PNG", optimize=True)
print("gerado:", img.size, "| corpo do titulo:", tam)
