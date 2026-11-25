"use client";

/**
 * Photos for one listing, from the dashboard: the backup to sending them on
 * WhatsApp. Pick several at once, drag them in, or take them with the phone's
 * camera. Any phone format works (JPEG, PNG, WebP, iPhone HEIC); the server
 * converts, shrinks and thumbnails each one. Each photo uploads on its own with
 * a progress bar and its own Retry. The first photo is the cover.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  getPropertyPhotos,
  removePropertyPhoto,
  reorderPropertyPhotos,
  uploadPropertyPhoto,
  type ListingPhoto,
} from "@/lib/properties";

type Upload = {
  id: string;
  file: File;
  preview: string;
  progress: number;
  status: "uploading" | "failed" | "done";
  error?: string;
};

const MAX_PHOTOS = 20;

export default function PropertyPhotosManager({
  propertyId,
  title,
  onClose,
  onChanged,
}: {
  propertyId: string;
  title: string;
  onClose: () => void;
  /** Called with the new photo list after any change, so the row can update. */
  onChanged: (urls: string[]) => void;
}) {
  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);

  const apply = useCallback(
    (next: ListingPhoto[]) => {
      setPhotos(next);
      onChanged(next.map((photo) => photo.url));
    },
    [onChanged],
  );

  useEffect(() => {
    let current = true;
    getPropertyPhotos(propertyId)
      .then((data) => {
        if (current) setPhotos(data.photos);
      })
      .catch((err) => {
        if (current) setNotice(err instanceof ApiError ? err.message : "Could not load the photos.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [propertyId]);

  // Free the local previews when the dialog closes.
  useEffect(() => () => uploads.forEach((item) => URL.revokeObjectURL(item.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback(
    async (item: Upload) => {
      setUploads((list) => list.map((u) => (u.id === item.id ? { ...u, status: "uploading", progress: 0, error: undefined } : u)));
      try {
        const data = await uploadPropertyPhoto(propertyId, item.file, (progress) =>
          setUploads((list) => list.map((u) => (u.id === item.id ? { ...u, progress } : u))),
        );
        apply(data.photos);
        setUploads((list) => list.filter((u) => u.id !== item.id));
        URL.revokeObjectURL(item.preview);
        if (data.added?.duplicate) setNotice(`${item.file.name} is already on this listing.`);
      } catch (err) {
        setUploads((list) =>
          list.map((u) =>
            u.id === item.id
              ? { ...u, status: "failed", error: err instanceof ApiError ? err.message : "Upload failed." }
              : u,
          ),
        );
      }
    },
    [apply, propertyId],
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      setNotice("");
      const room = MAX_PHOTOS - photos.length - uploads.filter((u) => u.status !== "failed").length;
      const chosen = Array.from(files).filter((file) => file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name));
      if (chosen.length > room) setNotice(`A listing can have up to ${MAX_PHOTOS} photos; ${Math.max(room, 0)} more fit.`);
      const items: Upload[] = chosen.slice(0, Math.max(room, 0)).map((file) => ({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
        status: "uploading",
      }));
      setUploads((list) => [...list, ...items]);
      // One at a time keeps a phone on a slow connection responsive.
      void items.reduce((chain, item) => chain.then(() => send(item)), Promise.resolve());
    },
    [photos.length, send, uploads],
  );

  const remove = async (photo: ListingPhoto) => {
    if (!window.confirm("Remove this photo from the listing?")) return;
    try {
      apply((await removePropertyPhoto(propertyId, photo.url)).photos);
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Could not remove it.");
    }
  };

  const move = async (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= photos.length) return;
    const urls = photos.map((photo) => photo.url);
    [urls[index], urls[target]] = [urls[target], urls[index]];
    try {
      apply((await reorderPropertyPhotos(propertyId, urls)).photos);
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Could not change the order.");
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`Photos for ${title}`}
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Photos · {title}</h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              The first photo is the cover. Any phone photo works; we resize it for WhatsApp.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700" aria-label="Close">
            ✕
          </button>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            addFiles(event.dataTransfer.files);
          }}
          className={`mt-4 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center ${
            dragging ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-gray-300 dark:border-gray-700"
          }`}
        >
          <p className="text-sm text-gray-600 dark:text-gray-300">Drag photos here, or</p>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            Add photos
          </button>
          <p className="text-[11px] text-gray-400">On a phone this opens your camera or gallery.</p>
          <input
            ref={input}
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            hidden
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>

        {notice ? <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{notice}</p> : null}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((photo, index) => (
            <figure key={photo.url} className="relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.thumbnail_url} alt="" loading="lazy" className="h-28 w-full object-cover" />
              {photo.cover ? (
                <span className="absolute left-1.5 top-1.5 rounded bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  Cover
                </span>
              ) : null}
              <figcaption className="flex items-center justify-between gap-1 px-1.5 py-1 text-xs">
                <span className="flex gap-1">
                  <button type="button" onClick={() => void move(index, -1)} disabled={index === 0} aria-label="Move earlier" className="rounded px-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-white/10">
                    ←
                  </button>
                  <button type="button" onClick={() => void move(index, 1)} disabled={index === photos.length - 1} aria-label="Move later" className="rounded px-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-white/10">
                    →
                  </button>
                </span>
                <button type="button" onClick={() => void remove(photo)} className="text-error-600 hover:text-error-700">
                  Remove
                </button>
              </figcaption>
            </figure>
          ))}
          {uploads.map((item) => (
            <figure key={item.id} className="relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.preview} alt="" className={`h-28 w-full object-cover ${item.status === "failed" ? "opacity-40" : "opacity-70"}`} />
              <figcaption className="px-1.5 py-1 text-[11px]">
                {item.status === "failed" ? (
                  <span className="flex flex-col gap-1">
                    <span className="text-error-600" title={item.error}>
                      {item.error}
                    </span>
                    <span className="flex gap-2">
                      <button type="button" onClick={() => void send(item)} className="font-medium text-brand-600">
                        Retry
                      </button>
                      <button
                        type="button"
                        onClick={() => setUploads((list) => list.filter((u) => u.id !== item.id))}
                        className="text-gray-400"
                      >
                        Dismiss
                      </button>
                    </span>
                  </span>
                ) : (
                  <span className="block h-1.5 w-full overflow-hidden rounded bg-gray-200 dark:bg-gray-700">
                    <span className="block h-full bg-brand-500 transition-all" style={{ width: `${item.progress}%` }} />
                  </span>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
        {!loading && photos.length === 0 && uploads.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No photos yet. Brokers can also send photos on WhatsApp with the listing.</p>
        ) : null}
      </div>
    </div>
  );
}
