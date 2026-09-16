"use client";

import { useEffect, useState } from "react";

const MAX_EDGE = 800;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

/**
 * Shrinks a picked photo to a JPEG no larger than MAX_EDGE on its long side
 * before it is submitted. A phone photo is routinely over the 4 MB limit and
 * often HEIC, which the server refuses. Re-encoding in the browser fixes both
 * wherever the browser can decode the image, and a profile photo never needs
 * more than a few hundred pixels anyway.
 */
async function shrink(file: File): Promise<File | null> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (!blob) return null;
    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PhotoField({ currentUrl, name }: { currentUrl: string | null; name: string }) {
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const picked = input.files?.[0];
    setMessage(null);
    if (!picked) {
      setPreview(currentUrl);
      return;
    }

    setBusy(true);
    const resized = await shrink(picked);
    setBusy(false);

    if (resized) {
      const transfer = new DataTransfer();
      transfer.items.add(resized);
      input.files = transfer.files;
      setPreview(URL.createObjectURL(resized));
      return;
    }

    if (ACCEPTED.includes(picked.type) && picked.size <= 4 * 1024 * 1024) {
      setPreview(URL.createObjectURL(picked));
      return;
    }

    input.value = "";
    setPreview(currentUrl);
    setMessage("That image could not be read. Choose a PNG, JPEG, or WebP photo.");
  }

  const initial = (name.trim() || "?").slice(0, 1).toUpperCase();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="photo" className="text-[13px] font-medium text-ink">
        Profile photo
        <span className="ml-1.5 text-[11.5px] font-normal text-subtle">Optional</span>
      </label>
      <div className="flex items-center gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-16 shrink-0 rounded-full border border-line object-cover" />
        ) : (
          <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-full bg-forest text-[22px] font-medium text-white">
            {initial}
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/*"
            onChange={onChange}
            className="max-w-full text-[13px] text-muted file:mr-3 file:rounded-full file:border file:border-line-strong file:bg-white file:px-3 file:py-1.5 file:text-[13px] file:text-ink hover:file:bg-shell"
          />
          <p className="text-[12.5px] leading-5 text-muted">
            {busy ? "Preparing photo…" : "Students see it beside your name. Saved when you continue."}
          </p>
          {message ? (
            <p role="alert" className="text-[12.5px] text-bad">
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
