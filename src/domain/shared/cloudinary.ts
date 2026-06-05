export function cloudinaryThumb(url: string, size = 64): string {
  const marker = "/image/upload/";
  const i = url.indexOf(marker);
  if (i < 0) return url;
  const cut = i + marker.length;
  return url.slice(0, cut) + `c_fill,g_face,w_${size},h_${size},f_auto,q_auto/` + url.slice(cut);
}
