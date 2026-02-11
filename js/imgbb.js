const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });

export async function imgbbUpload(file, apiKey) {
  if (!file) throw new Error('File topilmadi');
  if (!apiKey) throw new Error('ImgBB API key topilmadi');

  const base64Image = await fileToBase64(file);
  const formData = new FormData();
  formData.append('image', base64Image);

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data?.error?.message || 'Image upload failed');
  }

  return data.data.url || data.data.display_url;
}
