const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });

function getImgBBKey() {
  // 1) window global
  if (typeof window !== "undefined" && window.IMGBB_API_KEY) return String(window.IMGBB_API_KEY);
  // 2) localStorage
  try {
    const v = localStorage.getItem("IMGBB_API_KEY");
    if (v) return String(v);
  } catch (e) {}
  // 3) missing
  return "";
}

export async function imgbbUpload(file, apiKey) {
  if (!file) throw new Error("File topilmadi");
  if (!apiKey) throw new Error("ImgBB API key topilmadi");

  const base64Image = await fileToBase64(file);
  const formData = new FormData();
  formData.append("image", base64Image);

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.error?.message || "Image upload failed");
  }

  return data.data?.url || data.data?.display_url;
}

// New export for checkout.js compatibility
export async function uploadToImgBB(file) {
  const apiKey = getImgBBKey();
  if (!apiKey) throw new Error("ImgBB API key topilmadi. Set window.IMGBB_API_KEY or localStorage IMGBB_API_KEY.");
  return imgbbUpload(file, apiKey);
}
