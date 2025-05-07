from PIL import Image, ImageDraw

input_image_path = "icons/icon.png"
output_icns_path = "icons/icon.icns"

def create_rounded_corners(image, radius):
    mask = Image.new('L', image.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([(0, 0), image.size], radius=radius, fill=255)
    output = Image.new('RGBA', image.size, (0, 0, 0, 0))
    output.paste(image, mask=mask)
    return output

with Image.open(input_image_path) as img:
    target_size = int(1024 * 0.85)
    img.thumbnail((target_size, target_size), Image.Resampling.LANCZOS)
    img = img.convert('RGBA')
    radius = int(target_size * 0.22)
    rounded_img = create_rounded_corners(img, radius)
    final_img = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    paste_x = (1024 - rounded_img.size[0]) // 2
    paste_y = (1024 - rounded_img.size[1]) // 2
    final_img.paste(rounded_img, (paste_x, paste_y))
    sizes = [(16, 16), (32, 32), (64, 64), (128, 128), (256, 256), (512, 512), (1024, 1024)]
    images = []
    for size in sizes:
        resized_img = final_img.resize(size, Image.Resampling.LANCZOS)
        if resized_img.mode != 'RGBA':
            resized_img = resized_img.convert('RGBA')
        images.append(resized_img)
    final_img.save(output_icns_path, 'ICNS', append_images=images)
