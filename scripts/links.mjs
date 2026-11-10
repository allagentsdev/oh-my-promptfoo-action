/** Only credential-free report links may cross into public outputs. */
export function publicUrl(value) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash ||
    [...url.searchParams].some(([key, value]) => key !== "evalId" || !/^[\w.:-]+$/.test(value))
  )
    throw new Error("A report link must be an HTTP(S) URL without credentials");
  return url.href;
}
