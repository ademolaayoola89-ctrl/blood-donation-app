import os
import sys
import qrcode
from PIL import Image, ImageDraw, ImageFont

# Determine URL: CLI arg > DEPLOY_URL env var > fallback hardcoded
FALLBACK_URL = 'https://admirable-sunburst-685c88.netlify.app'
if len(sys.argv) > 1 and sys.argv[1].strip():
    url = sys.argv[1].strip()
else:
    url = os.environ.get('DEPLOY_URL', FALLBACK_URL)

qr = qrcode.QRCode(box_size=12, border=4)
qr.add_data(url)
qr.make(fit=True)
img = qr.make_image(fill_color='black', back_color='white').convert('RGB')
width, height = img.size
canvas = Image.new('RGB', (width, height + 120), 'white')
canvas.paste(img, (0, 0))

draw = ImageDraw.Draw(canvas)
try:
    font = ImageFont.truetype('arial.ttf', 24)
except Exception:
    font = ImageFont.load_default()

def measure_text(text, font):
    if hasattr(draw, 'textbbox'):
        bbox = draw.textbbox((0, 0), text, font=font)
        return bbox[2] - bbox[0], bbox[3] - bbox[1]
    if hasattr(font, 'getbbox'):
        bbox = font.getbbox(text)
        return bbox[2] - bbox[0], bbox[3] - bbox[1]
    return draw.textsize(text, font=font)

text = 'Scan to open the Blood Donation App'
w, h = measure_text(text, font)
draw.text(((width - w) / 2, height + 20), text, fill='black', font=font)
text2 = url
w2, h2 = measure_text(text2, font)
draw.text(((width - w2) / 2, height + 20 + h + 10), text2, fill='black', font=font)
canvas.save('blood-donation-app-qr.png')
print('Created blood-donation-app-qr.png')
